/**
 * Schema consistency tests for packages/shared
 *
 * These tests verify that the shared Prisma schema includes every model that
 * web and orchestrator depend on, and that there are no orphaned schemas.
 * Peter can run these to confirm the shared package is correctly wired.
 *
 * Run: pnpm --filter @story-magic/shared test
 */

import { describe, it, expect } from 'vitest';

// Import the generated Prisma module to verify the generated types exist.
// This catches any issue where prisma generate wasn't run or the output path is wrong.
import * as SharedPrisma from './generated/prisma/index.js';

describe('@story-magic/shared — Prisma client generation', () => {
  it('exports PrismaClient', () => {
    expect(SharedPrisma.PrismaClient).toBeDefined();
    expect(typeof SharedPrisma.PrismaClient).toBe('function');
  });

  it('exports Prisma namespace', () => {
    expect(SharedPrisma.Prisma).toBeDefined();
    expect(typeof SharedPrisma.Prisma).toBe('object');
  });
});

describe('@story-magic/shared — web models present', () => {
  const dmmf = (SharedPrisma.Prisma as unknown as { dmmf: { datamodel: { models: { name: string }[] } } }).dmmf;
  const modelNames = new Set(dmmf.datamodel.models.map((m) => m.name));

  const WEB_MODELS = [
    'Project', 'Profile', 'Job', 'JobLog', 'Usage',
    'Purchase', 'Subscription', 'CreditTransaction', 'StoryScore',
    'ScriptShare', 'TeamShare', 'Team', 'TeamMember',
    'ActivityLog', 'Alert', 'AuditLog', 'VoiceClone',
    'WebhookEndpoint', 'WebhookDeliveryLog',
  ] as const;

  for (const model of WEB_MODELS) {
    it(`includes web model: ${model}`, () => {
      expect(modelNames.has(model)).toBe(true);
    });
  }
});

describe('@story-magic/shared — orchestrator pipeline models present', () => {
  const dmmf = (SharedPrisma.Prisma as unknown as { dmmf: { datamodel: { models: { name: string }[] } } }).dmmf;
  const modelNames = new Set(dmmf.datamodel.models.map((m) => m.name));

  const ORCHESTRATOR_MODELS = [
    'MixManifest', 'Timeline', 'Alignment', 'TtsStem', 'VoiceMap',
  ] as const;

  for (const model of ORCHESTRATOR_MODELS) {
    it(`includes orchestrator model: ${model}`, () => {
      expect(modelNames.has(model)).toBe(true);
    });
  }
});

describe('@story-magic/shared — no duplicate model names', () => {
  it('each model name appears exactly once', () => {
    const dmmf = (SharedPrisma.Prisma as unknown as { dmmf: { datamodel: { models: { name: string }[] } } }).dmmf;
    const names = dmmf.datamodel.models.map((m) => m.name);
    const unique = new Set(names);
    expect(names.length).toBe(unique.size);
  });
});
