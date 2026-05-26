-- DT-BL-SV1: Composite index on content_access_log for per-share analytics
-- Without this, every share engagement query is a full table scan.
-- play/route.ts writes shareId on every play/complete event.
CREATE INDEX IF NOT EXISTS "content_access_log_share_id_created_at_idx"
  ON "content_access_log"("share_id", "created_at" DESC);
