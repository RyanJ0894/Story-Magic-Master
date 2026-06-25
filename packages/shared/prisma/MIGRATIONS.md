# Prisma migrations — operating rules

> **Origin:** DT-33-L-2 (code-review 2026-06-25 follow-up). The information
> existed in scattered comments across `schema.prisma`; this file collects
> the rules in one place so a new engineer can find them.

This package owns the single source of truth for the database schema. All
runtime services (web, orchestrator, worker) import the generated Prisma
client from here. There is **one shared Postgres database per environment**
(`dev`, `staging`, `prd`).

## The cardinal rule

**Never run `prisma db push` against a production or staging environment.**

Use it freely on a local dev DB to prototype schema changes; commit nothing
to the migrations folder until the shape is settled. Once it's settled,
create a proper migration with `prisma migrate dev --name <descriptive>`
and commit the SQL alongside the schema change.

### Why `db push` is dangerous on shared envs

| Problem | Concrete example in this repo |
|---|---|
| **Partial indexes are lost.** Prisma doesn't model index `WHERE` predicates, so `db push` drops them silently. | `schema.prisma:213` warns about `jobs_first_audio_url_not_null` — a partial index created in migration 0023 and re-asserted in 0025. `db push` would drop it. |
| **No version trail.** `_prisma_migrations` is what every other service checks before running. `db push` skips it; the next `migrate deploy` then thinks migrations are missing and fails. | Every dev-DB `db push` in 2026-05 produced this exact error and had to be hand-reconciled. |
| **No reversibility.** Migrations are git-tracked. `db push` is not — you cannot revert it cleanly. | The 0040–0044 series of FK additions would have been miserable to unwind without the migration files. |
| **No CI gate.** Migration files get reviewed in PRs. `db push` happens in someone's shell at 11 PM. | Migration 0045 (CreditTransaction FK) caught a half-bidirectional relation in PR review; `db push` would have shipped the breakage. |

## The normal flow

```bash
# 1. Edit schema.prisma (add a model, add a field, change a constraint)
# 2. Generate a migration with a descriptive name:
cd packages/shared
pnpm prisma migrate dev --name add_consistency_check_flags

# 3. Review the generated SQL in packages/shared/prisma/migrations/<id>_<name>/migration.sql
#    — confirm it's the SQL you intended, no surprise destructive ops

# 4. Commit BOTH:
#    - packages/shared/prisma/schema.prisma (the new shape)
#    - packages/shared/prisma/migrations/<new-folder>/migration.sql (the diff)

# 5. CI + Render pick up the migration on the next deploy via
#    `pnpm prisma migrate deploy` in the web service start command.
```

## The dev-prototyping flow (`db push` IS fine here)

```bash
# 1. Spin up a LOCAL Postgres just for you. Not shared, not prod.
# 2. Point DATABASE_URL at it.
# 3. Iterate on schema.prisma + db push freely until the shape settles.
# 4. THEN switch to `migrate dev --name ...` to bake the final shape into a
#    real migration that ships through the normal CI flow.
```

## What to do when you find a drift

If `prisma migrate deploy` fails on staging or prod with a "migration is
missing" or "already applied" error, somebody ran `db push` somewhere it
shouldn't have happened. The recovery:

1. **Don't run `migrate resolve` yet** — diagnose first. Compare the live
   schema against the most-recent committed migration.
2. **Write a "drift-reconcile" migration** that brings the DB to the
   committed state. Manual, defensive, idempotent. SQL like `ALTER TABLE
   ... ADD COLUMN IF NOT EXISTS ...` and `CREATE INDEX IF NOT EXISTS ...`.
3. **Commit + deploy** that reconcile migration. CI picks it up; live DB
   gets pinned back to the committed-truth state.
4. **Run `prisma migrate resolve --applied <reconcile-name>`** only if the
   migration genuinely needs to be marked applied without running (e.g.
   the shape is already correct but the `_prisma_migrations` row is
   missing).

## Untracked indexes (intentional)

Some indexes can't be expressed in Prisma's schema model. They're tracked
in raw SQL inside the migration files and marked with an
`// UNTRACKED:` comment in `schema.prisma` so engineers don't try to "fix"
their absence. As of migration 0045:

- `jobs_first_audio_url_not_null` — partial index on `jobs(id)` filtered
  by `first_audio_url IS NOT NULL`. Migration 0023, re-asserted in 0025.

Any future partial / functional / GIN / GiST indexes will land here.
