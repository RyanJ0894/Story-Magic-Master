-- CreateTable: api_keys
CREATE TABLE "api_keys" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key_hash" TEXT NOT NULL,
    "key_prefix" TEXT NOT NULL,
    "last_used_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "api_keys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "api_keys_key_hash_key" ON "api_keys"("key_hash");
CREATE INDEX "api_keys_user_id_idx" ON "api_keys"("user_id");
CREATE INDEX "api_keys_key_hash_idx" ON "api_keys"("key_hash");

ALTER TABLE "api_keys" ADD CONSTRAINT "api_keys_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- CreateTable: webhook_endpoints
CREATE TABLE "webhook_endpoints" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[] NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webhook_endpoints_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "webhook_endpoints_user_id_idx" ON "webhook_endpoints"("user_id");

ALTER TABLE "webhook_endpoints" ADD CONSTRAINT "webhook_endpoints_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
