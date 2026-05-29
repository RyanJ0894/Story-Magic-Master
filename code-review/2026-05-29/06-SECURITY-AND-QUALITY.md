# Security and Quality — 2026-05-29

## Security Status: No New Issues

No new security vulnerabilities identified this cycle.

## Existing Controls (Confirmed Intact)

| Control | Location | Status |
|---------|----------|--------|
| Auth middleware (Clerk JWT) | `packages/orchestrator/src/middleware/auth.js` | ✅ |
| IDOR + path traversal on downloads | `packages/orchestrator/src/index.ts` | ✅ |
| `xss` library on user content | Uses `xss` package, no custom `escapeHtml` | ✅ |
| `isApiReady` gate on all client auth calls | Enforced by convention; confirmed in component hooks | ✅ |
| No base64 image data in JSON | Uses `multipart/form-data` / signed URLs | ✅ |
| Rate limiting | `packages/orchestrator/src/middleware/` | ✅ |

## Data Security Gaps (from Data Tiers audit)

### HIGH: `Purchase` no `onDelete` cascade — GDPR erasure blocker

User deletion throws FK constraint violation unless all purchase rows are pre-deleted. No pre-delete cleanup code exists. This is a data-integrity blocker for GDPR deletion requests. Fix: `onDelete: SetNull` + make `userId?` nullable. See `08-DATA-TIERS.md` for migration SQL.

### HIGH: `Subscription` missing `userId` index — entitlement scan performance

Every authenticated API call that checks billing entitlements does a full `subscriptions` table scan. This is correctness-adjacent (billing checks will silently slow under load) but not a security vulnerability. Fix: add `@@index([userId])` + `@@index([userId, status])`.

### HIGH: `ScriptShare` FK no cascade — GDPR exposure (MEDIUM, DT-29-2/3)

Deleting a user who has shared scripts throws FK violation. This means user deletion is blocked unless shares are cleaned up first. Fix: `onDelete: SetNull` on both `sharedByUser` and `sharedWithUser` relations.

## Quality Notes

### Diagnostic Logs in Production Path (CARRYOVER)

`app/invite/[token]/page.tsx:92,101` — two `console.log` calls in the invite-accept handler. These expose internal state (invite token, user data) in production browser consoles. DEBT-02 (pending Ryan sign-off on invite stability).

### No `escapeHtml` Anti-Pattern

Confirmed: no custom HTML escaping in production code. All user-generated content rendered via React (escaped by default) or through `xss` library. Clean.
