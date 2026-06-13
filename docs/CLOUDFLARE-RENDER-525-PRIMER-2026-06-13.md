# Cloudflare ↔ Render: Gray / Orange / Verify — How It Fits

**Date:** 2026-06-13
**Audience:** Chris, Peter
**Context:** Diagnosing the persistent 525 on `https://storymagicapp.net/` while `https://www.storymagicapp.net/` returns 200. This primer explains the four moving parts so we can talk about the failure modes precisely instead of saying "Cloudflare's being weird."

---

## The four parts

The 525 you've been hitting touches four moving parts. They're easy to confuse because they all sound like "make TLS work" but each lives at a different layer.

### 1. The DNS record (where does the name resolve?)

In Cloudflare, every record (A, CNAME) for a hostname answers: "if someone asks DNS for `storymagicapp.net`, what IP do they get back?" That answer can be:

- **the real origin IP** (e.g., Render's `216.24.57.1`)
- **a Cloudflare proxy IP** (e.g., `104.21.x` / `172.67.x`)

Which gets returned depends on the next part.

### 2. The proxy toggle — "gray cloud" vs "orange cloud"

In the Cloudflare DNS dashboard, every proxiable record has a cloud icon next to it.

- **Gray cloud (proxied = false, "DNS-only")** — Cloudflare publishes the record as-is. The visitor's browser learns the *real* origin IP and connects to it directly. CF is out of the path.
- **Orange cloud (proxied = true)** — Cloudflare publishes its *own* anycast IPs as the answer. The visitor's browser connects to Cloudflare. Cloudflare *then* connects to your origin on your behalf, terminates TLS, may cache, may run WAF rules, etc. This is "the CDN turned on."

`www.storymagicapp.net` is orange-clouded today — that's why `dig` returns `104.21.70.53` (a CF IP) instead of Render's IP.

### 3. The CF "SSL/TLS" mode — how strictly CF validates the origin's cert

When CF is orange-clouded, it makes an HTTPS connection from CF → origin. The "SSL/TLS" setting in the CF dashboard governs how strict that hop is:

| Mode | What CF accepts from the origin |
|---|---|
| **Off** | HTTP only. Never use. |
| **Flexible** | CF talks HTTP to origin. Browser sees HTTPS, origin sees HTTP. Insecure; lies to browsers. |
| **Full** | CF talks HTTPS, accepts any cert (self-signed, expired, hostname-mismatched all fine). |
| **Full (strict)** | CF talks HTTPS, validates the cert chain against trusted CAs *and* requires the cert's CN/SAN to match the hostname. |

The zone is set to **Full (strict)** (responsible default). That's why CF rejects the apex: the cert it's seeing doesn't validate. CF responds with **525** ("SSL handshake failed with origin").

### 4. Render's "verification" — Render's permission to issue/serve a cert for your hostname

Separately from anything above, Render has to know "yes, this customer really controls `storymagicapp.net` and we're allowed to obtain a TLS cert for it." Render does this with an **ACME challenge** — the same protocol Let's Encrypt uses. Two flavours:

- **HTTP-01** — Render says: "make `http://storymagicapp.net/.well-known/acme-challenge/<token>` return this exact value." If Render's verifier fetches that URL and sees the token, ownership is proved.
- **DNS-01** — Render says: "add a TXT record `_acme-challenge.storymagicapp.net` with this value." If Render's verifier looks up DNS and sees it, ownership is proved.

When Render gets ownership proof, it issues a chained Google Trust Services cert and starts serving it. Until then, `verificationStatus = "unverified"` in their API and they may serve a stale or fallback cert.

---

## How the four parts interact

```
   browser ────────────────► Cloudflare ────────────────► origin
              (DNS lookup)      (SSL/TLS mode +
              gray vs orange     CF-to-origin TLS)
              decides what
              browser gets)
                                                  ▲
                                                  │
                                              who is the
                                            origin? Render?
                                            verified for
                                            this host?
```

Each part can fail independently:

| Failure | Symptom | Fix |
|---|---|---|
| DNS record points at the wrong service | CF hits wrong origin, cert mismatch | Repoint DNS |
| Orange cloud + Full(strict) + bad chain | 525 | Fix chain at origin, or downgrade to Full |
| Render unverified | Render serves stale/fallback cert | Re-run verification |
| HTTP-01 verification + orange cloud | Verification stalls (CF answers the challenge instead of forwarding to origin) | Gray-cloud temporarily, OR use DNS-01 |

---

## Why the apex hit *both* the verification and the routing trap

`www.storymagicapp.net` works because:

1. DNS record is a CNAME → `story-magic-web.onrender.com` (correct origin)
2. Render verified it (probably via DNS-01 since CF was orange) → modern Google Trust Services cert with full chain
3. Orange-clouded + Full(strict) — CF connects to Render, sees a valid chain, accepts it. 200.

`storymagicapp.net` (apex) is broken because:

1. DNS A record is `76.76.21.21` (**Vercel's anycast IP**, leftover from an old deploy) — *not Render at all*
2. Render therefore can't pass HTTP-01 (the challenge would land on Vercel)
3. Render can't issue a fresh cert, so it serves an older leaf-only Let's Encrypt cert as fallback
4. CF Full(strict) sees the bad chain → **525**

Render API state confirms this:

| Domain | Type | Status |
|---|---|---|
| `storymagicapp.net` | apex | `unverified` |
| `www.storymagicapp.net` | subdomain | `verified` |
| `app.storymagicapp.net` | subdomain | `verified` |

---

## The "gray cloud temporarily" pattern (general purpose)

When stuck on HTTP-01 verification anywhere and CF is in the way, the standard dance is:

1. Note the record's current proxied state.
2. Toggle to gray cloud.
3. Wait ~30 s for the DNS TTL to roll over (CF's edge TTL is short).
4. Trigger verification at the origin (Render's `/verify` endpoint, or whatever the platform exposes).
5. Poll until verified.
6. Re-toggle to orange.

It works because while gray, Render's HTTP-01 fetcher gets the real origin IP and reaches your service directly. The brief window is usually safe because the orange-cloud path was 5xx-ing anyway.

But — it only helps when the DNS record points at the right origin. Which, as we just learned, isn't the case for our apex. That's why I stopped before flipping.

---

## The three terms in one sentence

- **Gray cloud** = "CF, get out of the way, hand out the origin IP."
- **Orange cloud** = "CF, sit in front, terminate TLS, hand out your own IP."
- **Verify** = "Origin platform, please prove you control the hostname so you can issue a cert" — separate from anything CF is doing, but CF's proxy state can block the proof if HTTP-01 is the method.

Once you understand that **DNS routing**, **CF's proxy posture**, **CF's origin-TLS strictness**, and **origin-side certificate possession** are four orthogonal things, failure modes become legible. The 525 in particular is *always* CF→origin TLS failing under Full(strict); the question is just *why* — wrong cert, wrong IP, no cert, expired cert, or missing chain.

---

## For `storymagicapp.net` specifically

The apex A record needs to change from `76.76.21.21` (Vercel) to a Render target — their apex IP (`216.24.57.1`), or a CNAME-at-apex flattened to `story-magic-web.onrender.com`. That's the single next action.

Three options ranked by durability:

1. **CNAME flattening at apex → `story-magic-web.onrender.com`** *(recommended)*. CF supports this on the apex. Survives Render IP changes. Least likely to break again.
2. **A record at apex → `216.24.57.1`** (Render's apex anycast IP). Works today; couples us to a specific IP Render could change.
3. **Drop the apex domain in Render entirely.** Add a CF page rule that 301s `storymagicapp.net/*` → `www.storymagicapp.net/*`. No apex cert to break. Simplest, but commits to www-only forever.

In all three, after DNS lands, `POST /v1/services/{id}/custom-domains/{cdm-id}/verify` against Render will let it issue a real cert. The 525 clears as soon as Render serves the chained GTS cert.

---

## Open questions

- Was the Vercel IP `76.76.21.21` from a former Vercel deploy that never got migrated when we moved to Render? If so, are there other CF zones with the same leftover?
- Should we add a small CI/smoke check that asserts `dig +short storymagicapp.net` resolves to a Render-owned address? Cheap insurance against silent DNS drift.
- Should we standardise on DNS-01 verification for all Render custom domains to remove the orange-cloud-blocks-HTTP-01 footgun entirely?

— Claude (overnight hardening run handoff)
