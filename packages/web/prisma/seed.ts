/**
 * Dev seed — creates stable fixtures for local development and CI.
 * Run via: pnpm db:seed  (or: prisma db seed)
 * All IDs are stable so this script is idempotent.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEV_USER_ID = 'user_dev_test_001';
const DEV_PROJECT_ID = '00000000-dead-beef-0000-000000000001';
const DEV_PROJECT_ADVANCED_ID = '00000000-dead-beef-0000-000000000002';

async function main() {
  // Profile
  await prisma.profile.upsert({
    where: { id: DEV_USER_ID },
    update: {},
    create: {
      id: DEV_USER_ID,
      email: 'dev@storymagic.test',
      fullName: 'Dev User',
      subscriptionTier: 'pro',
      subscriptionStatus: 'active',
    },
  });

  // Standard project
  await prisma.project.upsert({
    where: { id: DEV_PROJECT_ID },
    update: {},
    create: {
      id: DEV_PROJECT_ID,
      userId: DEV_USER_ID,
      name: 'Dev Test Project',
      description: 'Seed project for local development',
      status: 'draft',
      scriptText: 'INT. OFFICE - DAY\n\nA DEVELOPER types furiously.\n\nDEVELOPER\nWhere are my fixtures?',
      pageCount: 1,
    },
  });

  // Project with Advanced Analysis purchase
  await prisma.project.upsert({
    where: { id: DEV_PROJECT_ADVANCED_ID },
    update: {},
    create: {
      id: DEV_PROJECT_ADVANCED_ID,
      userId: DEV_USER_ID,
      name: 'Dev Advanced Analysis Project',
      description: 'Seed project with Advanced Analysis upgrade active',
      status: 'draft',
      scriptText: 'INT. STUDIO - NIGHT\n\nA DIRECTOR reviews the rushes.\n\nDIRECTOR\nNot bad. Run it again.',
      pageCount: 1,
    },
  });

  // Advanced Analysis purchase for the second project
  await prisma.purchase.upsert({
    where: { stripePaymentIntentId: 'pi_dev_advanced_analysis_001' },
    update: {},
    create: {
      userId: DEV_USER_ID,
      projectId: DEV_PROJECT_ADVANCED_ID,
      purchaseType: 'advanced_analysis',
      amountCents: 999,
      currency: 'usd',
      stripePaymentIntentId: 'pi_dev_advanced_analysis_001',
      status: 'completed',
    },
  });

  console.log('Seed complete.');
  console.log(`  Profile:  ${DEV_USER_ID}`);
  console.log(`  Project:  ${DEV_PROJECT_ID}  (standard)`);
  console.log(`  Project:  ${DEV_PROJECT_ADVANCED_ID}  (advanced analysis active)`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
