/**
 * E2E Test Data Seed
 *
 * Creates stable project fixtures required by authenticated E2E specs.
 * All IDs are deterministic — safe to run repeatedly (idempotent upserts).
 *
 * Usage:
 *   doppler run --project story-magic --config dev -- \
 *     tsx packages/web/e2e/seed-test-data.ts
 *
 *   Or with explicit DB URL:
 *     DATABASE_URL=postgres://... tsx packages/web/e2e/seed-test-data.ts
 *
 * Required environment variables:
 *   DATABASE_URL        — PostgreSQL connection string
 *   E2E_TEST_USER_ID    — Clerk user ID of the test account (set in Doppler dev)
 *
 * Optional overrides (defaults shown):
 *   REAL_DRAFT_PROJECT_ID     = 606f2749-17a3-431c-9ec5-9970284bb32d
 *   REAL_COMPLETED_PROJECT_ID = 71e98a0f-731f-4a25-8cab-2226daca0a3e
 *   REAL_COMPLETED_PROJECT_ID_ALT = d4ffc7fc-e37f-4cbc-b0f0-6298ee7202f8
 *
 * Which specs use which IDs:
 *   audio-generation-1page     → REAL_DRAFT + REAL_COMPLETED
 *   audio-generation-15page    → REAL_DRAFT + REAL_COMPLETED
 *   audio-generation-30page    → REAL_DRAFT + REAL_COMPLETED
 *   full-script-processing     → REAL_DRAFT
 *   progressive-playback       → REAL_DRAFT
 *   ryan-flow                  → REAL_COMPLETED_ALT
 *   generate-to-playback       → REAL_DRAFT
 *   screenplay-notes           → REAL_DRAFT | REAL_COMPLETED
 *   screenplay-reader          → REAL_DRAFT | REAL_COMPLETED
 */

import { PrismaClient } from '@story-magic/shared';

const prisma = new PrismaClient();

// ---------------------------------------------------------------------------
// Well-known IDs (must match the fallback values in each spec file)
// ---------------------------------------------------------------------------

const TEST_USER_ID = process.env.E2E_TEST_USER_ID || '';

const DRAFT_PROJECT_ID =
  process.env.REAL_DRAFT_PROJECT_ID || '606f2749-17a3-431c-9ec5-9970284bb32d';

const COMPLETED_PROJECT_ID =
  process.env.REAL_COMPLETED_PROJECT_ID || '71e98a0f-731f-4a25-8cab-2226daca0a3e';

// ryan-flow spec uses a different completed project ID (historical accident)
const COMPLETED_PROJECT_ID_ALT =
  process.env.REAL_COMPLETED_PROJECT_ID_ALT || 'd4ffc7fc-e37f-4cbc-b0f0-6298ee7202f8';

// Minimal screenplay text sufficient for a 1-page parse
const ONE_PAGE_SCRIPT = `INT. COFFEE SHOP - DAY

SARAH (30s, determined) sits at a corner table with cold coffee.

SARAH
(to herself)
This is it. Today's the day.

The door CHIMES. MARCUS (40s, distinguished) enters.

MARCUS
Sarah? Sarah Mitchell?

SARAH
(standing)
Marcus. You came.

MARCUS
Of course I came. Your message said it was urgent.

Sarah takes a breath. She slides a manila envelope across the table.

SARAH
It is.

Marcus opens it. His expression changes.

MARCUS
Where did you get this?

SARAH
Does it matter?

MARCUS
(quietly)
It matters a great deal.`;

async function main() {
  if (!TEST_USER_ID) {
    console.error('❌  E2E_TEST_USER_ID is not set. Cannot seed without a valid Clerk user ID.');
    console.error('    Set E2E_TEST_USER_ID in Doppler (story-magic/dev) or export it manually.');
    process.exit(1);
  }

  console.log(`Seeding E2E test data for user: ${TEST_USER_ID}`);

  // Ensure the profile row exists (Clerk webhook creates it on first sign-in,
  // but the DB may be clean in a fresh dev environment).
  await prisma.profile.upsert({
    where: { id: TEST_USER_ID },
    update: {},
    create: {
      id: TEST_USER_ID,
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    },
  });

  // ------------------------------------------------------------------
  // 1. Draft project — used by generate-flow specs
  //    Status: "draft", has script text, no audio output yet.
  // ------------------------------------------------------------------
  await prisma.project.upsert({
    where: { id: DRAFT_PROJECT_ID },
    update: {
      name: '[E2E] Draft Project',
      status: 'draft',
      scriptText: ONE_PAGE_SCRIPT,
      pageCount: 1,
      userId: TEST_USER_ID,
    },
    create: {
      id: DRAFT_PROJECT_ID,
      userId: TEST_USER_ID,
      name: '[E2E] Draft Project',
      status: 'draft',
      scriptText: ONE_PAGE_SCRIPT,
      pageCount: 1,
    },
  });
  console.log(`✓ Draft project: ${DRAFT_PROJECT_ID}`);

  // ------------------------------------------------------------------
  // 2. Completed project (primary) — used by audio-generation specs
  //    Status: "completed", has a completed job and audio output row.
  // ------------------------------------------------------------------
  await prisma.project.upsert({
    where: { id: COMPLETED_PROJECT_ID },
    update: {
      name: '[E2E] Completed Project',
      status: 'completed',
      scriptText: ONE_PAGE_SCRIPT,
      pageCount: 1,
      userId: TEST_USER_ID,
    },
    create: {
      id: COMPLETED_PROJECT_ID,
      userId: TEST_USER_ID,
      name: '[E2E] Completed Project',
      status: 'completed',
      scriptText: ONE_PAGE_SCRIPT,
      pageCount: 1,
    },
  });
  console.log(`✓ Completed project (primary): ${COMPLETED_PROJECT_ID}`);

  // ------------------------------------------------------------------
  // 3. Completed project (alternate) — used by ryan-flow spec
  //    Same structure as (2), different ID.
  // ------------------------------------------------------------------
  await prisma.project.upsert({
    where: { id: COMPLETED_PROJECT_ID_ALT },
    update: {
      name: '[E2E] Completed Project (ryan-flow)',
      status: 'completed',
      scriptText: ONE_PAGE_SCRIPT,
      pageCount: 1,
      userId: TEST_USER_ID,
    },
    create: {
      id: COMPLETED_PROJECT_ID_ALT,
      userId: TEST_USER_ID,
      name: '[E2E] Completed Project (ryan-flow)',
      status: 'completed',
      scriptText: ONE_PAGE_SCRIPT,
      pageCount: 1,
    },
  });
  console.log(`✓ Completed project (ryan-flow): ${COMPLETED_PROJECT_ID_ALT}`);

  console.log('\n✅  E2E seed complete. Run authenticated specs with:');
  console.log(
    '    doppler run --project story-magic --config dev -- ' +
      'pnpm --filter @story-magic/web test:e2e -- --project=chromium-authenticated'
  );
}

main()
  .catch((err) => {
    console.error('Seed failed:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
