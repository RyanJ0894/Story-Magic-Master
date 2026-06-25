-- FK hardening — code-review 2026-06-25 findings DT-35-H-1 and DT-36-M-1.
--
-- DT-35-H-1 (HIGH): CreditTransaction.jobId was indexed but had no FK to
--   jobs(id). Job deletion left orphan cost-ledger rows that broke refund
--   lookup and cost-attribution reports. Add the FK with ON DELETE SET NULL
--   so the credit history survives the delete while the orphaned pointer
--   clears.
--
-- DT-36-M-1 (MEDIUM): ContentAccessLog had no explicit ON DELETE on its
--   optional user_id + share_id back-relations. Prisma's default is
--   RESTRICT, which silently blocks Profile and ScriptShare deletions
--   whenever any access log references them — including GDPR account
--   removal and downstream Project cascade. Switch both to SET NULL so the
--   audit row keeps existing while the FK clears on parent delete.
--   project_id FK stays CASCADE (the existing default).

-- DT-35-H-1
ALTER TABLE "credit_transactions"
  ADD CONSTRAINT "credit_transactions_job_id_fkey"
    FOREIGN KEY ("job_id")
    REFERENCES "jobs"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

-- DT-36-M-1
ALTER TABLE "content_access_log"
  DROP CONSTRAINT IF EXISTS "content_access_log_user_id_fkey";
ALTER TABLE "content_access_log"
  ADD CONSTRAINT "content_access_log_user_id_fkey"
    FOREIGN KEY ("user_id")
    REFERENCES "profiles"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;

ALTER TABLE "content_access_log"
  DROP CONSTRAINT IF EXISTS "content_access_log_share_id_fkey";
ALTER TABLE "content_access_log"
  ADD CONSTRAINT "content_access_log_share_id_fkey"
    FOREIGN KEY ("share_id")
    REFERENCES "script_shares"("id")
    ON DELETE SET NULL
    ON UPDATE CASCADE;
