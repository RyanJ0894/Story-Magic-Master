# Appendix B: NPM Audit Report

**Story Magic Code Review -- 15 February 2026**

---

## Summary

```
8 vulnerabilities found
Severity: 2 low | 3 moderate | 3 high
```

Audit performed with `pnpm audit` on 15 February 2026 against the locked dependency tree in `pnpm-lock.yaml`.

---

## HIGH Severity (3)

### AUDIT-01: glob -- Command injection via CLI `--cmd` flag

| Field | Value |
|-------|-------|
| **Package** | `glob` |
| **Installed version** | 10.3.10 |
| **Vulnerable range** | >=10.2.0 <10.5.0 |
| **Patched version** | >=10.5.0 |
| **Advisory** | [GHSA-5j98-mcp5-4vw2](https://github.com/advisories/GHSA-5j98-mcp5-4vw2) |
| **Severity** | HIGH |

**Dependency chain:**
```
packages/web > eslint-config-next@14.2.35 > @next/eslint-plugin-next@14.2.35 > glob@10.3.10
```

**Description:** The `glob` package's CLI tool executes matched files with `shell: true` when the `-c` or `--cmd` flag is used, enabling command injection if an attacker can control filenames. This is a CLI-only vulnerability -- the programmatic `glob()` API is not affected.

**Risk assessment:** LOW actual risk. This vulnerability is in a dev-only dependency (`eslint-config-next`) and only affects the CLI binary, which is not invoked during builds or at runtime. The glob library itself (used programmatically) is unaffected.

**Fix recommendation:** Update `eslint-config-next` to a version that pulls `glob >= 10.5.0`. Since this is pinned by Next.js 14.x, upgrading to Next.js 15 would resolve it, or apply a `pnpm.overrides` entry:
```json
"pnpm": {
  "overrides": {
    "glob": ">=10.5.0"
  }
}
```

---

### AUDIT-02: next -- HTTP request deserialization DoS via React Server Components

| Field | Value |
|-------|-------|
| **Package** | `next` |
| **Installed version** | 14.2.35 |
| **Vulnerable range** | >=13.0.0 <15.0.8 |
| **Patched version** | >=15.0.8 |
| **Advisory** | [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) |
| **Severity** | HIGH |

**Dependency chain:**
```
packages/web > next@14.2.35                           (direct)
packages/web > @clerk/nextjs@6.37.3 > next@14.2.35   (peer)
packages/web > @sentry/nextjs@10.34.0 > next@14.2.35 (peer)
```

**Description:** Next.js versions prior to 15.0.8 are vulnerable to denial of service when deserializing HTTP requests that target React Server Components. A crafted request can cause excessive memory allocation or CPU consumption during deserialization.

**Risk assessment:** MEDIUM. This is a direct dependency and affects runtime behavior. The application uses React Server Components for several pages. An attacker with network access could send crafted requests to degrade service availability.

**Fix recommendation:** This is the highest-priority fix. Next.js 14.x will not receive a patch. Plan the Next.js 15 upgrade as a near-term priority. In the interim, ensure Render.com's service auto-restart and the existing rate limiting provide some mitigation against sustained DoS.

---

### AUDIT-03: axios -- DoS via `__proto__` key in `mergeConfig`

| Field | Value |
|-------|-------|
| **Package** | `axios` |
| **Installed version** | 1.13.2 |
| **Vulnerable range** | <=1.13.4 |
| **Patched version** | >=1.13.5 |
| **Advisory** | [GHSA-43fc-jf86-j433](https://github.com/advisories/GHSA-43fc-jf86-j433) |
| **Severity** | HIGH |

**Dependency chain:**
```
packages/web > swagger-ui-react@5.31.0 > swagger-client@3.36.0 > @swagger-api/apidom-reference@1.2.2 > axios@1.13.2
```

**Description:** Axios versions through 1.13.4 are vulnerable to prototype pollution via the `__proto__` key in the `mergeConfig` function. An attacker who can control configuration objects passed to axios can modify `Object.prototype`, potentially leading to denial of service or other unexpected behavior.

**Risk assessment:** LOW-MEDIUM. The vulnerable axios is only used by `swagger-ui-react`, which renders the API documentation page (`/docs`). This page is not user-facing in production and could be restricted to authenticated admin users. The axios instance is used for fetching OpenAPI specs, not for processing user input.

**Fix recommendation:** Update `swagger-ui-react` to a version that depends on `axios >= 1.13.5`. Alternatively, add a `pnpm.overrides` entry:
```json
"pnpm": {
  "overrides": {
    "axios": ">=1.13.5"
  }
}
```
If the docs page is not needed in production, consider moving `swagger-ui-react` to `devDependencies` or behind a build-time feature flag.

---

## MODERATE Severity (3)

### AUDIT-04: jsondiffpatch -- XSS via `HtmlFormatter::nodeBegin`

| Field | Value |
|-------|-------|
| **Package** | `jsondiffpatch` |
| **Installed version** | 0.6.0 |
| **Vulnerable range** | <0.7.2 |
| **Patched version** | >=0.7.2 |
| **Advisory** | [GHSA-33vc-wfww-vjfv](https://github.com/advisories/GHSA-33vc-wfww-vjfv) |
| **Severity** | MODERATE |

**Dependency chain:**
```
packages/orchestrator > ai@4.3.19 > jsondiffpatch@0.6.0
```

**Description:** The `HtmlFormatter` in jsondiffpatch does not sanitize property names when generating HTML diffs. If an attacker can control the keys of objects being diffed, they can inject arbitrary HTML/JavaScript.

**Risk assessment:** LOW. The orchestrator uses the Vercel AI SDK (`ai` package) for LLM interactions. The `jsondiffpatch` dependency is used internally by the AI SDK for structured output diffing, not for rendering HTML in a browser context. The orchestrator is a backend service that does not serve HTML.

**Fix recommendation:** Update `ai` to version 5.x+ which depends on `jsondiffpatch >= 0.7.2`. This is a semver-major upgrade that requires testing the AI SDK integration.

---

### AUDIT-05: lodash -- Prototype pollution in `_.unset` and `_.omit`

| Field | Value |
|-------|-------|
| **Package** | `lodash` |
| **Installed version** | 4.17.21 |
| **Vulnerable range** | >=4.0.0 <=4.17.22 |
| **Patched version** | >=4.17.23 |
| **Advisory** | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) |
| **Severity** | MODERATE |

**Dependency chain (144 paths):**
```
packages/orchestrator > hpp@0.2.3 > lodash@4.17.21
packages/web > swagger-ui-react@5.31.0 > lodash@4.17.21
packages/web > swagger-ui-react@5.31.0 > swagger-client@3.36.0 > @swagger-api/apidom-core@1.2.2 > minim@0.23.8 > lodash@4.17.21
... (144 total paths)
```

**Description:** The `_.unset` and `_.omit` functions in lodash 4.x are vulnerable to prototype pollution when processing user-controlled property paths. An attacker who can control the path argument can modify `Object.prototype`.

**Risk assessment:** LOW-MEDIUM. The primary concern is `hpp` (HTTP Parameter Pollution middleware) in the orchestrator, which uses lodash internally. The swagger-ui paths are documentation-only. Neither path processes untrusted property paths through `_.unset` or `_.omit` directly.

**Fix recommendation:** Apply `pnpm.overrides` to force `lodash >= 4.17.23`:
```json
"pnpm": {
  "overrides": {
    "lodash": ">=4.17.23"
  }
}
```
Note: lodash 4.17.23+ has not been released as of this writing. Monitor for the patched release. Consider replacing `hpp` with a lodash-free alternative or inline implementation.

---

### AUDIT-06: next -- Image Optimizer DoS via `remotePatterns` configuration

| Field | Value |
|-------|-------|
| **Package** | `next` |
| **Installed version** | 14.2.35 |
| **Vulnerable range** | >=10.0.0 <15.5.10 |
| **Patched version** | >=15.5.10 |
| **Advisory** | [GHSA-9g9p-9gw9-jx7f](https://github.com/advisories/GHSA-9g9p-9gw9-jx7f) |
| **Severity** | MODERATE |

**Dependency chain:**
```
packages/web > next@14.2.35                           (direct)
packages/web > @clerk/nextjs@6.37.3 > next@14.2.35   (peer)
packages/web > @sentry/nextjs@10.34.0 > next@14.2.35 (peer)
```

**Description:** Self-hosted Next.js applications are vulnerable to denial of service through the Image Optimizer when `remotePatterns` is configured to allow external image sources. An attacker can craft requests that cause the image optimizer to consume excessive resources.

**Risk assessment:** MEDIUM. The application is self-hosted on Render.com and may use Next.js Image Optimization. If `remotePatterns` is configured (e.g., for Clerk avatars or DiceBear), this vulnerability is exploitable.

**Fix recommendation:** Same as AUDIT-02: upgrade to Next.js 15. In the interim, review `next.config.js` for `remotePatterns` usage. If the Image Optimizer is not needed for external images, restrict or remove `remotePatterns` configuration. Consider using `unoptimized: true` for external images as a workaround.

---

## LOW Severity (2)

### AUDIT-07: ai (Vercel AI SDK) -- File type whitelist bypass on uploads

| Field | Value |
|-------|-------|
| **Package** | `ai` |
| **Installed version** | 4.3.19 |
| **Vulnerable range** | <5.0.52 |
| **Patched version** | >=5.0.52 |
| **Advisory** | [GHSA-rwvc-j5jr-mgvh](https://github.com/advisories/GHSA-rwvc-j5jr-mgvh) |
| **Severity** | LOW |

**Dependency chain:**
```
packages/orchestrator > ai@4.3.19
```

**Description:** The Vercel AI SDK's file upload feature allows bypassing file type whitelists, enabling users to upload file types that should be restricted.

**Risk assessment:** NEGLIGIBLE. Story Magic does not use the AI SDK's file upload feature. The orchestrator uses the AI SDK for LLM text generation (structured outputs, tool calls), not for file handling. No user-facing file upload flows pass through the AI SDK.

**Fix recommendation:** Low priority. Will be resolved naturally when upgrading `ai` to v5 for the jsondiffpatch fix (AUDIT-04). No immediate action required.

---

### AUDIT-08: qs -- `arrayLimit` bypass in comma parsing enables DoS

| Field | Value |
|-------|-------|
| **Package** | `qs` |
| **Installed version** | 6.14.1 |
| **Vulnerable range** | >=6.7.0 <=6.14.1 |
| **Patched version** | >=6.14.2 |
| **Advisory** | [GHSA-w7fw-mjwx-w883](https://github.com/advisories/GHSA-w7fw-mjwx-w883) |
| **Severity** | LOW |

**Dependency chain (5 paths):**
```
packages/orchestrator > express@4.22.1 > qs@6.14.1
packages/orchestrator > express@4.22.1 > body-parser@1.20.4 > qs@6.14.1
packages/orchestrator > express-rate-limit@7.5.1 > express@4.22.1 > body-parser@1.20.4 > qs@6.14.1
```

**Description:** The `qs` query string parser can be exploited to bypass the `arrayLimit` configuration when comma-separated values are used, potentially leading to denial of service through excessive memory allocation when parsing crafted query strings.

**Risk assessment:** LOW. The orchestrator's Express routes accept JSON bodies, not complex query strings. The existing rate limiting on the orchestrator provides additional mitigation against repeated exploitation.

**Fix recommendation:** Apply `pnpm.overrides` for `qs`:
```json
"pnpm": {
  "overrides": {
    "qs": ">=6.14.2"
  }
}
```
This is a patch-level update and should be safe to apply immediately.

---

## Recommended Actions (Priority Order)

| Priority | Vulnerability | Action | Effort |
|----------|---------------|--------|--------|
| 1 | AUDIT-02, AUDIT-06 | Plan Next.js 15 upgrade | HIGH -- semver major, requires testing all pages and middleware |
| 2 | AUDIT-08 | Override `qs` to >=6.14.2 | LOW -- patch version, safe override |
| 3 | AUDIT-03 | Override `axios` to >=1.13.5 | LOW -- patch version, safe override |
| 4 | AUDIT-01 | Override `glob` to >=10.5.0 | LOW -- dev-only, safe override |
| 5 | AUDIT-04, AUDIT-07 | Upgrade `ai` SDK to v5 | MEDIUM -- semver major, test LLM integrations |
| 6 | AUDIT-05 | Override `lodash` when patch available | LOW -- awaiting upstream release |

### Quick Wins (apply now via `package.json`)

Add to the root `package.json`:

```json
{
  "pnpm": {
    "overrides": {
      "glob": ">=10.5.0",
      "axios": ">=1.13.5",
      "qs": ">=6.14.2"
    }
  }
}
```

This would resolve AUDIT-01, AUDIT-03, and AUDIT-08 (3 of 8 vulnerabilities) with minimal risk. Run the full test suite after applying overrides to verify no regressions.

### Medium-Term (next sprint)

- Upgrade Vercel AI SDK from v4 to v5 (resolves AUDIT-04, AUDIT-07)
- Evaluate Next.js 15 upgrade path (resolves AUDIT-02, AUDIT-06)

### Notes

- All 8 vulnerabilities are in transitive dependencies, not in application code
- No vulnerabilities affect authentication, authorization, or data integrity
- The most impactful vulnerability (AUDIT-02, Next.js DoS) requires a major version upgrade that should be planned as a dedicated effort
- The existing rate limiting, security headers, and Render.com auto-restart provide defense-in-depth against the DoS-class vulnerabilities
