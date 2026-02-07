# Security Audit
**Date:** February 1, 2026
**Scope:** All Story Magic codebases

---

## Summary

| Component | Score | Critical | High | Medium | Low |
|-----------|-------|----------|------|--------|-----|
| Director (prototype) | 1/10 | 3 | 2 | 2 | 0 |
| Orchestrator (prototype) | 2/10 | 3 | 2 | 2 | 1 |
| SaaS Monorepo | 7/10 | 1 | 1 | 3 | 2 |

---

## Findings

### SEC-01: No Authentication on Prototype Services (Critical)
**Location:** `Director/main.py`, `Orchestrator/server.js`
**Impact:** Anyone can trigger audio generation, consuming API credits and resources
**Status:** Fixed in monorepo (Supabase JWT + rate limiting)
**Action:** If prototypes are still deployed/accessible, shut them down immediately

### SEC-02: Wildcard CORS with Credentials (Critical)
**Location:** `Director/main.py:50-56`
```python
CORSMiddleware(
    allow_origins=["*"],
    allow_credentials=True,  # Invalid with wildcard
)
```
**Impact:** Browsers will reject this combination; indicates configuration confusion
**Status:** Fixed in monorepo (explicit origins)
**Action:** Remove prototype CORS or restrict to development origins

### SEC-03: Path Traversal on File Download (Critical)
**Location:** `Orchestrator/server.js:89` — `/download/:project_id/:filename`
**Impact:** Attacker can read arbitrary files with `../../../etc/passwd`
**Status:** Likely addressed in monorepo with `path.resolve()` + whitelist
**Action:** Verify monorepo download endpoint sanitizes paths

### SEC-04: Missing Public Share Page (Critical — Monorepo)
**Location:** `story-magic/packages/web/`
**Impact:** Share links generate 404 errors — broken feature
**Status:** API complete, page component missing
**Action:** Implement `/share/[code]/page.tsx`

### SEC-05: No Input Size Limits on Prototype (High)
**Location:** `Director/main.py:59-61`
**Impact:** Unlimited script_text accepts arbitrarily large inputs (DoS vector)
**Status:** Fixed in monorepo (500KB / 150 page limits)
**Action:** Prototype deprecation resolves this

### SEC-06: SSRF Risk on Supabase Callback (High)
**Location:** `Director/tools/supabase_tool.py:29-36`
**Impact:** Unvalidated callback URL could target internal services
**Status:** Unknown if addressed in monorepo
**Action:** Validate callback URL against allowlist

### SEC-07: Prompt Injection Risk (High — Monorepo)
**Location:** `story-magic/packages/web/app/api/generate/route.ts`
**Status:** Basic filters exist (blocks "ignore previous instructions", "[INST]" tags)
**Gap:** Sophisticated prompt injection may bypass string filters
**Action:** Consider output validation + sandboxed LLM execution

### SEC-08: API Keys in Prototype Logs (Medium)
**Location:** `Director/main.py:476-479`
**Impact:** Environment variables logged in error context
**Action:** Remove sensitive data from log output

### SEC-09: CSP unsafe-inline in Production (Medium — Monorepo)
**Location:** `story-magic/packages/web/next.config.js`
**Impact:** Allows inline script execution (XSS risk if combined with other vuln)
**Status:** Required for Next.js hot reload in dev; should use nonces in production
**Action:** Configure CSP nonces for production build

### SEC-10: Incomplete requirements.txt (Medium)
**Location:** `Director/requirements.txt`
**Impact:** Unreproducible builds; could pull vulnerable transitive deps
**Action:** Prototype deprecation resolves this

### SEC-11: No Encryption at Rest (Medium — Monorepo)
**Location:** Supabase storage
**Impact:** Audio files and scripts stored unencrypted
**Action:** Enable Supabase storage encryption; add per-tenant keys for enterprise

### SEC-12: Temp File Cleanup Missing (Low — Monorepo)
**Location:** `story-magic/packages/orchestrator/`
**Impact:** Audio temp files persist on disk indefinitely
**Action:** Implement cleanup job (delete files >7 days old)

### SEC-13: Default ElevenLabs Voice Hardcoded (Low)
**Location:** `Orchestrator/lib/db.js:54`
**Impact:** Fallback voice could be unintended for production
**Action:** Make configurable, log when fallback is used

---

## Recommendations by Priority

### Immediate (Before Any Production Traffic)
1. Deprecate/shut down standalone Director and Orchestrator services
2. Implement public share page (SEC-04)
3. Verify path traversal protection in monorepo download endpoint (SEC-03)

### Short-Term (Week 1-2)
4. Add prompt injection defense-in-depth (output validation)
5. Configure CSP nonces for production
6. Implement automated temp file cleanup
7. Validate Supabase callback URL against allowlist

### Medium-Term (Month 1)
8. Enable encryption at rest for Supabase storage
9. Add comprehensive security test suite
10. Implement audit logging for content access
11. Conduct penetration testing

### Enterprise Track
12. Per-tenant encryption keys
13. SOC 2 Type II preparation
14. TPN/MPAA compliance assessment
