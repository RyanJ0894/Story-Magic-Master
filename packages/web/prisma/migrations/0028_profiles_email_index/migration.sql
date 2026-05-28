-- DATA-02: Index profiles.email for invite lookups.
-- addMember / invite flows query `profiles` by email on every invite; without
-- this index each lookup is a full table scan. Name matches Prisma's @@index([email]).
CREATE INDEX IF NOT EXISTS "profiles_email_idx" ON "profiles"("email");
