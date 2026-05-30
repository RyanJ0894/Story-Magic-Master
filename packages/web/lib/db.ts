import { PrismaClient } from '@story-magic/shared';
import { encrypt, decrypt } from '@/lib/crypto/field-encryption';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Connection pool: 8 connections per service (web + orchestrator = 16 total)
// leaves headroom on the 256MB PostgreSQL ~20 connection limit
const CONNECTION_LIMIT = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '8', 10);

function buildPrisma() {
  const client = new PrismaClient({
    log:
      process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    datasources: {
      db: {
        url: appendConnectionLimit(process.env.DATABASE_URL || ''),
      },
    },
  });

  // BL-017: Field-level encryption for Project.scriptText via Prisma query extension.
  // encrypt() / decrypt() are no-ops when FIELD_ENCRYPTION_KEY is not set,
  // enabling gradual rollout and local dev without the key.
  return client.$extends({
    query: {
      project: {
        async create({ args, query }) {
          if (typeof args.data?.scriptText === 'string') {
            args.data.scriptText = encrypt(args.data.scriptText);
          }
          const result = await query(args);
          if (typeof result.scriptText === 'string') {
            result.scriptText = decrypt(result.scriptText);
          }
          return result;
        },
        async update({ args, query }) {
          if (typeof (args.data as Record<string, unknown>)?.scriptText === 'string') {
            (args.data as Record<string, unknown>).scriptText = encrypt(
              (args.data as Record<string, unknown>).scriptText as string,
            );
          }
          const result = await query(args);
          if (typeof result.scriptText === 'string') {
            result.scriptText = decrypt(result.scriptText);
          }
          return result;
        },
        async upsert({ args, query }) {
          if (typeof args.create?.scriptText === 'string') {
            args.create.scriptText = encrypt(args.create.scriptText);
          }
          if (typeof (args.update as Record<string, unknown>)?.scriptText === 'string') {
            (args.update as Record<string, unknown>).scriptText = encrypt(
              (args.update as Record<string, unknown>).scriptText as string,
            );
          }
          const result = await query(args);
          if (typeof result.scriptText === 'string') {
            result.scriptText = decrypt(result.scriptText);
          }
          return result;
        },
        async findUnique({ args, query }) {
          const result = await query(args);
          if (result && typeof result.scriptText === 'string') {
            result.scriptText = decrypt(result.scriptText);
          }
          return result;
        },
        async findFirst({ args, query }) {
          const result = await query(args);
          if (result && typeof result.scriptText === 'string') {
            result.scriptText = decrypt(result.scriptText);
          }
          return result;
        },
        async findMany({ args, query }) {
          const results = await query(args);
          for (const row of results) {
            if (typeof row.scriptText === 'string') {
              row.scriptText = decrypt(row.scriptText);
            }
          }
          return results;
        },
      },
    },
  });
}

// Cast to PrismaClient for type compatibility throughout the app.
// The $extends call above adds transparent encrypt/decrypt at runtime;
// all standard CRUD methods remain available with their original signatures.
export const prisma = (globalForPrisma.prisma ?? buildPrisma()) as unknown as PrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function appendConnectionLimit(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  if (url.includes('connection_limit=')) return url;
  return `${url}${separator}connection_limit=${CONNECTION_LIMIT}`;
}
