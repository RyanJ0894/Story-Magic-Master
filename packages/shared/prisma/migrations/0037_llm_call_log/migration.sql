-- LLM call log for cost attribution (T3-4 of cost-opt Phase 2)
-- One row per LLM call from runAgentLoop or generateStructuredOutput.
-- Powers "what did this script cost?" SQL queries.

CREATE TABLE "llm_call_log" (
    "id"                UUID            NOT NULL DEFAULT gen_random_uuid(),
    "project_id"        TEXT,
    "operation"         TEXT            NOT NULL,
    "model"             TEXT            NOT NULL,
    "provider"          TEXT            NOT NULL,
    "input_tokens"      INTEGER,
    "output_tokens"     INTEGER,
    "cost_estimate_usd" DECIMAL(10, 6),
    "duration_ms"       INTEGER         NOT NULL,
    "succeeded"         BOOLEAN         NOT NULL,
    "error_message"     TEXT,
    "created_at"        TIMESTAMPTZ     NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "llm_call_log_pkey" PRIMARY KEY ("id")
);

-- Per-project cost rollups (most common query):
--   SELECT operation, SUM(cost_estimate_usd) FROM llm_call_log
--   WHERE project_id = $1 GROUP BY operation;
CREATE INDEX "llm_call_log_project_created_idx" ON "llm_call_log"("project_id", "created_at" DESC);

-- Per-operation aggregates (which operations are getting expensive?):
CREATE INDEX "llm_call_log_operation_created_idx" ON "llm_call_log"("operation", "created_at" DESC);

-- Time-range scans (today's burn, retention cleanup):
CREATE INDEX "llm_call_log_created_idx" ON "llm_call_log"("created_at");
