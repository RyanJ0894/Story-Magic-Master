# Security and Quality — 2026-05-19

## Security Findings

### [FIXED] Reaction upsert race condition — `app/api/projects/[id]/comments/route.ts:130`

**Issue:** `deleteMany` + `create` for reaction upsert was not atomic. Concurrent requests (double-tap, network retry) could insert duplicate reaction rows.

**Fix applied:** Wrapped both operations in `prisma.$transaction`. Migration 0025 also adds a `WHERE reaction_type IS NOT NULL` partial unique index as a DB-level guard.

**Status:** ✅ Fixed this session

---

### [FIXED] Audio URL origin leak — multiple player components

**Issue:** `ORCHESTRATOR_URL` (server-side only env var) was referenced in browser bundles. Variable was always `undefined` client-side, causing `new Audio('/audio/filename.mp3')` → fetch against web origin → 404 → HTML decoded as audio → static noise.

**Fix applied:** `resolveAudioUrl()` utility; all 5 players updated.

**Status:** ✅ Fixed this session

---

### [FIXED] Team invite FK violation — `app/api/invite/[token]/route.ts`

**Issue:** New Clerk users with no profile row (first login via invite) caused FK constraint violation on `teamMember.update` because `teamMember.userId → profiles.id` FK requires the profile to exist first.

**Fix applied:** `ensureProfile(userId)` called after auth check, before any FK-constrained write.

**Status:** ✅ Fixed this session

---

### [PENDING DEPLOY] `project_comments.user_id` FK missing — migration 0025

**Issue:** `project_comments.user_id` column has no `REFERENCES profiles(id)` FK constraint. Orphaned comment rows survive on profile deletion. ORM-layer enforcement only.

**Fix written:** Migration 0025 adds `ALTER TABLE project_comments ADD CONSTRAINT ... FOREIGN KEY (user_id) REFERENCES profiles(id) ON DELETE CASCADE`.

**Status:** ⚠️ Migration written — requires `prisma migrate deploy` on Render

---

## Input Validation

All API routes reviewed use Zod schemas at the boundary. No raw `req.body` access without parsing.

## Auth Checks

All Sprint M routes (`/notes`, `/comments`) correctly call `auth()` first and return 401 before any DB access. The `withProjectAuth` middleware pattern is consistently applied.

## IDOR Protection

- Notes API: verifies project ownership via `prisma.project.findFirst({ where: { id, userId } })` before any note access
- Comments delete: verifies `comment.userId === currentUserId` before deletion (returns 403 if mismatch)
- Download endpoint: IDOR + path traversal protections remain intact (unchanged)

## Quality — Patterns Worth Noting

- **`toast` for all user-visible errors** — ScreenplayPlayer now uses `sonner` consistently; no more silent catch blocks
- **Prisma `$transaction` for multi-step mutations** — established pattern for any deleteMany + create sequence; test mock pattern documented in 05-TEST-GENERATION.md
- **`resolveAudioUrl()` as single source of truth** — prevents future static-noise regressions; any new player must import from `@/lib/resolve-audio-url`
