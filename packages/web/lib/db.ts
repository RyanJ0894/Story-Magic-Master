import { PrismaClient } from '@prisma/client';

const globalForPrisma = globalThis as unknown as { prisma: PrismaClient };

// Connection pool: 8 connections per service (web + orchestrator = 16 total)
// leaves headroom on the 256MB PostgreSQL ~20 connection limit
const CONNECTION_LIMIT = parseInt(process.env.DATABASE_CONNECTION_LIMIT || '8', 10);

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
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

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

function appendConnectionLimit(url: string): string {
  if (!url) return url;
  const separator = url.includes('?') ? '&' : '?';
  if (url.includes('connection_limit=')) return url;
  return `${url}${separator}connection_limit=${CONNECTION_LIMIT}`;
}
