import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import { server } from './mocks/server';

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  redirect: vi.fn(),
}));

// Mock Clerk auth (replaces old Supabase auth mock)
vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: 'user_test123' })),
  currentUser: vi.fn(() => Promise.resolve({
    id: 'user_test123',
    firstName: 'Test',
    lastName: 'User',
    emailAddresses: [{ emailAddress: 'test@example.com' }],
    imageUrl: null,
  })),
}));

vi.mock('@clerk/nextjs', () => ({
  useUser: () => ({
    isSignedIn: true,
    user: { id: 'user_test123', firstName: 'Test', lastName: 'User' },
    isLoaded: true,
  }),
  useAuth: () => ({
    userId: 'user_test123',
    isSignedIn: true,
    isLoaded: true,
  }),
  useClerk: () => ({
    signOut: vi.fn(),
  }),
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock Prisma client (replaces old Supabase query mock)
export const mockPrismaClient = {
  project: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'test-project-id' }),
    update: vi.fn().mockResolvedValue({}),
    delete: vi.fn().mockResolvedValue({}),
  },
  profile: {
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'user_test123' }),
    update: vi.fn().mockResolvedValue({}),
  },
  job: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({ id: 'test-job-id' }),
    update: vi.fn().mockResolvedValue({}),
  },
  alert: {
    findMany: vi.fn().mockResolvedValue([]),
    count: vi.fn().mockResolvedValue(0),
    updateMany: vi.fn().mockResolvedValue({ count: 0 }),
  },
  team: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn().mockResolvedValue({ id: 'test-team-id' }),
  },
  teamMember: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  usage: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  storyScore: {
    findFirst: vi.fn().mockResolvedValue(null),
  },
  audioOutput: {
    findMany: vi.fn().mockResolvedValue([]),
  },
  $queryRaw: vi.fn().mockResolvedValue([]),
};

vi.mock('@/lib/db', () => ({
  prisma: mockPrismaClient,
}));

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:22000');
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_fake');
vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_fake');

// Reset mocks between tests
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  cleanup();
  server.resetHandlers();
  vi.clearAllMocks();
});

afterAll(() => {
  server.close();
});
