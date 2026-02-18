# Appendix B: NPM Audit Report
**Date:** February 18, 2026
**Tool:** `pnpm audit`
**Scope:** story-magic monorepo (all packages)

---

## Summary

| # | Severity | Package | Vulnerable Version | Patched | Advisory |
|---|----------|---------|--------------------|---------|----------|
| 1 | **HIGH** | next | >=13.0.0 <15.0.8 | >=15.0.8 | [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) |
| 2 | MODERATE | lodash | >=4.0.0 <=4.17.22 | >=4.17.23 | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) |
| 3 | MODERATE | next | >=10.0.0 <15.5.10 | >=15.5.10 | [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) |
| 4 | MODERATE | ajv | <8.18.0 | >=8.18.0 | [GHSA-2g4f-4pwh-qvx6](https://github.com/advisories/GHSA-2g4f-4pwh-qvx6) |
| 5 | MODERATE | next | (middleware bypass) | >=15.0.8 | (same root cause as #1) |
| 6 | LOW | ai | <5.0.52 | >=5.0.52 | [GHSA-rwvc-j5jr-mgvh](https://github.com/advisories/GHSA-rwvc-j5jr-mgvh) |

**Totals:** 6 vulnerabilities (1 high, 4 moderate, 1 low)

---

## Remediation Recommendations

### 1. next@14.2.35 -- HIGH + 2 MODERATE (Advisories #1, #3, #5)

**Issue:** Three advisories affect Next.js: HTTP request deserialization DoS via insecure React Server Components, Image Optimizer DoS via remotePatterns, and middleware authorization bypass. All require Next.js 15.x to fully resolve.

**Why we cannot patch immediately:** The fix requires upgrading from Next.js 14 to 15, which is a major version migration. This involves breaking changes to the App Router, middleware behavior, and server action APIs. The upgrade is non-trivial and must be scheduled as a dedicated sprint.

**Current mitigations:**
- Render.com WAF filters malicious request patterns before they reach the application
- Content Security Policy (CSP) headers restrict script execution and resource loading
- React Server Components are not used in insecure mode (all server actions require authentication)
- Image Optimizer `remotePatterns` is locked to known domains only

**Action:** Schedule Next.js 14 to 15 migration as a post-launch workstream. Track in backlog.

---

### 2. lodash@4.17.21 -- MODERATE (Advisory #2)

**Issue:** Prototype pollution via `_.unset` and `_.omit` in lodash versions <=4.17.22. Affects 144 dependency paths through `swagger-ui-react` (web) and `hpp` (orchestrator).

**Why it persists:** lodash is a transitive dependency pulled in by `swagger-ui-react` and `hpp`. Neither has released an update that pins lodash >=4.17.23.

**Action:** Add pnpm overrides to `package.json` to force lodash >=4.17.23 across all packages:

```json
{
  "pnpm": {
    "overrides": {
      "lodash@>=4.0.0 <4.17.23": "4.17.23"
    }
  }
}
```

Run `pnpm install` and verify no regressions. This is safe -- 4.17.23 is a patch release with no breaking changes.

---

### 3. ajv@6.12.6 -- MODERATE (Advisory #4)

**Issue:** Regular expression denial of service (ReDoS) when using the `$data` option in ajv versions <8.18.0. Reached through 48 dependency paths, all via `eslint@8.57.1`.

**Risk assessment:** **No production risk.** This dependency is dev-only (eslint is not bundled or deployed). The ReDoS vector requires crafted schema input, which is not applicable to a linting tool running in CI/local dev.

**Action:** No immediate action required. This will resolve automatically when upgrading to ESLint 9+, which uses ajv@8.x. Schedule as part of the ESLint flat config migration.

---

### 4. ai@4.3.19 -- LOW (Advisory #6)

**Issue:** Vercel AI SDK filetype whitelist bypass allows uploading files with disallowed extensions.

**Risk assessment:** **Minimal.** The orchestrator uses the AI SDK for LLM inference (text completions), not for file uploads. There is no user-facing file upload endpoint exposed through the AI SDK in our application. The vulnerability is not exploitable in our usage pattern.

**Action:** Upgrade to `ai@5.x` when convenient. This is a major version bump, so verify API compatibility before upgrading.

---

## Risk Matrix

| Advisory | Exploitable in Production? | Blocked By | Priority |
|----------|---------------------------|------------|----------|
| next DoS / middleware bypass | Low (WAF + CSP mitigate) | Next.js 15 migration | Medium -- schedule post-launch |
| lodash prototype pollution | Moderate (transitive, but reachable) | Nothing -- override available | **High -- apply override now** |
| ajv ReDoS | None (dev-only) | ESLint 9 migration | Low -- defer |
| ai filetype bypass | None (not using file uploads) | Major version bump | Low -- defer |

---

## Raw Audit Output

```
6 vulnerabilities found
Severity: 1 low | 4 moderate | 1 high

1. HIGH - Next.js HTTP request deserialization can lead to DoS when using insecure React Server Components
   Package: next
   Vulnerable: >=13.0.0 <15.0.8
   Patched: >=15.0.8
   Paths: packages/web > @clerk/nextjs, @sentry/nextjs, next@14.2.35
   Advisory: GHSA-h25m-26qc-wcjf

2. MODERATE - Lodash Prototype Pollution in _.unset and _.omit
   Package: lodash
   Vulnerable: >=4.0.0 <=4.17.22
   Patched: >=4.17.23
   Paths: packages/orchestrator > hpp > lodash@4.17.21, packages/web > swagger-ui-react > lodash@4.17.21 (144 paths)
   Advisory: GHSA-xxjr-mmjv-4gpg

3. MODERATE - Next.js self-hosted DoS via Image Optimizer remotePatterns
   Package: next
   Vulnerable: >=10.0.0 <15.5.10
   Patched: >=15.5.10
   Paths: same as #1
   Advisory: GHSA-9g9p-9gw9-jx7f

4. MODERATE - ajv ReDoS when using $data option
   Package: ajv
   Vulnerable: <8.18.0
   Patched: >=8.18.0
   Paths: eslint@8.57.1 > ajv@6.12.6 (48 paths, dev dependency)
   Advisory: GHSA-2g4f-4pwh-qvx6

5. MODERATE - Next.js middleware authorization bypass
   Package: next (already covered above)

6. LOW - Vercel AI SDK filetype whitelist bypass
   Package: ai
   Vulnerable: <5.0.52
   Patched: >=5.0.52
   Paths: packages/orchestrator > ai@4.3.19
   Advisory: GHSA-rwvc-j5jr-mgvh
```
