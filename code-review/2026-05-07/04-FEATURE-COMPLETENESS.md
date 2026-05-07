# Feature Completeness — 2026-05-07

## Summary

All Sprint D–G features landed in 14 PRs merged overnight. No known half-implementations.

---

## Completed Overnight (Sprint D–G)

| Feature | PR | Status | Notes |
|---------|----|--------|-------|
| Fountain/FDX native import | #39 | COMPLETE | Parser + upload UI |
| Scene-level sharing | #39 | COMPLETE | `sceneIndex` + seek on listen page |
| Director Notes UI | #58 | COMPLETE | Panel + API + prompt injection |
| Credit system | #41 | COMPLETE | Ledger, purchase, deduction, bonus |
| Podcast RSS distribution | #42 | COMPLETE | Model, endpoint, public page |
| Emotion cue overrides | #43 | COMPLETE | Per-dialogue Select + re-render |
| Enterprise direct access | #44 | COMPLETE | No password gate for enterprise |
| Sprint B UX polish | #45 | COMPLETE | 4 P0/P1 items |
| Sprint C tech debt | #46 | COMPLETE | DELETE verb + Story Adviser flag |
| Mobile PWA | #52 | COMPLETE | Manifest + service worker + iOS hint |
| Voice cloning | #52 | COMPLETE | Upload + `VoiceCloneUploader` |
| Audio preview hint | #52 | COMPLETE | 15s contextual preview |
| Public REST API + webhooks | #53 | COMPLETE | ApiKey model + endpoints + HMAC |
| Human-in-loop review | #54 | COMPLETE | Queue + email + decision API |
| Team comments | #55 | COMPLETE | Sidebar + notifications |
| Pipeline silent failure fix | #56 | COMPLETE | Throws on missing episode.m4a |
| Plans page live pricing | #57 | COMPLETE | PRICING_TIERS single source |

---

## Still Incomplete (Post-Launch Backlog)

| Feature | Gap | SP | Sprint |
|---------|-----|----|--------|
| PR #27 Enterprise Master Account | CONFLICTING — needs rebase | 3 | Post-launch |
| Share modal "View all" > 5 | Pagination/expand | 2 | Post-launch |
| Corpus ingestion on Render | Needs Ryan's AI keys | 2 | Post-launch (Ryan) |

---

## Blocked (External)

| Feature | Blocked By |
|---------|-----------|
| Production revenue | Ryan — Stripe production account |
| Custom domain live | Ryan — DNS CNAME update |
| Subscriptions activate | Ryan — Stripe webhook event config |
| Admin MFA | Ryan — Clerk TOTP enablement |
