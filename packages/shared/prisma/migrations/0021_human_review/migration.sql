-- CreateTable: human_reviews
CREATE TABLE "human_reviews" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "project_id" UUID NOT NULL,
    "job_id" UUID NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "notified_reviewer_at" TIMESTAMP(3),
    "notified_customer_at" TIMESTAMP(3),
    "amount_cents" INTEGER NOT NULL DEFAULT 9900,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "human_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "human_reviews_job_id_key" ON "human_reviews"("job_id");
CREATE INDEX "human_reviews_status_created_at_idx" ON "human_reviews"("status", "created_at" DESC);
CREATE INDEX "human_reviews_user_id_idx" ON "human_reviews"("user_id");

ALTER TABLE "human_reviews" ADD CONSTRAINT "human_reviews_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;
