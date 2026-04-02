/**
 * Prisma client singleton for the orchestrator package.
 *
 * Replaces Supabase DB queries with Prisma ORM.
 * Tables not in the Prisma schema (voice_map, tts_stems, etc.)
 * use prisma.$queryRaw / prisma.$executeRaw.
 */

import { PrismaClient } from '../generated/prisma/index.js';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
