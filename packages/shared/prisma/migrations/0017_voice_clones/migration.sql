-- CreateTable
CREATE TABLE "voice_clones" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "elevenlabs_voice_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "voice_clones_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "voice_clones_user_id_idx" ON "voice_clones"("user_id");

-- AddForeignKey
ALTER TABLE "voice_clones" ADD CONSTRAINT "voice_clones_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "profiles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
