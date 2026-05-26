# Security and Quality — 2026-05-26

## Critical Security Fixes Applied This Session

### FIXED: play/route.ts — Race condition + expiry bypass (CRITICAL)

**Before:** `playCount` was read-then-write (`(share.playCount ?? 0) + 1`). Under concurrent play events, two requests could read the same value and both write the same result — losing a count. Additionally, `expiresAt` and `maxPlays` were only enforced if checked separately; the route accepted plays from expired/exhausted shares as long as `isActive=true`.

**After:**
- `{ increment: 1 }` Prisma atomic operation — no race condition possible
- Explicit `expiresAt < now` check returns 410 before any increment
- Explicit `playCount >= maxPlays` check returns 410 before any increment
- Both checks run even when `isActive=true` (belt + suspenders)

### FIXED: shares/page.tsx — Deactivate All without confirmation (P0 UX / security)

Revoking access to all shares is irreversible from the UI. Both the per-row deactivate and "Deactivate All" now require `window.confirm()` with explicit count and consequence before proceeding.

## Retained Security Controls

| Control | Location | Status |
|---------|----------|--------|
| IDOR protection on download | `packages/orchestrator/src/index.ts` | ✅ Unchanged |
| Path traversal protection | `packages/orchestrator/src/index.ts` | ✅ Unchanged |
| Clerk JWT verification | `packages/orchestrator/src/middleware/auth.js` | ✅ Unchanged |
| CSRF validation | `packages/web/lib/csrf.ts` | ✅ Applied on all mutating routes |
| `withAuth` ownership guard | All project routes | ✅ Verified on new routes |
| IP capture (1-hop) | `play/route.ts` | ✅ Takes first IP from x-forwarded-for |

## Remaining Security Notes

| Note | Severity | Action |
|------|----------|--------|
| `shares/route.ts` findMany has no limit | LOW | Add `take: 100` before enterprise rollout |
| IP capture is best-effort (no validation) | LOW | Acceptable for analytics; not used for auth |
