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

// Mock Supabase server client
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(() => Promise.resolve(mockSupabaseClient)),
}));

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:22000');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');

/**
 * Creates a chainable Supabase query mock.
 * Each method returns the same chainable object, with terminal methods
 * (like single()) returning the resolved value.
 */
export function createChainableMock(
  finalValue: { data: any; error: any } = { data: null, error: null }
) {
  const chain: any = {};

  // Define all chainable methods
  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'neq',
    'in',
    'order',
    'limit',
    'gt',
    'gte',
    'lt',
    'lte',
    'like',
    'ilike',
    'is',
    'contains',
    'containedBy',
    'range',
    'filter',
    'match',
    'not',
    'or',
    'textSearch',
  ];

  chainMethods.forEach((method) => {
    chain[method] = vi.fn().mockReturnValue(chain);
  });

  // Terminal methods that resolve to the final value
  chain.single = vi.fn().mockResolvedValue(finalValue);
  chain.maybeSingle = vi.fn().mockResolvedValue(finalValue);

  // Make order/limit also resolvable (some queries end with .order())
  const originalOrder = chain.order;
  chain.order = vi.fn((...args: any[]) => {
    const result = { ...chain };
    // If this is the last call, allow it to resolve
    result.then = (resolve: any) => resolve(finalValue);
    return result;
  });

  // Allow the chain itself to be awaited
  chain.then = (resolve: any) => resolve(finalValue);

  return chain;
}

// Mock Supabase client
export const mockSupabaseClient = {
  auth: {
    getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
    getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
    signOut: vi.fn(() => Promise.resolve({ error: null })),
  },
  from: vi.fn((table: string) => createChainableMock()),
  storage: {
    from: vi.fn(() => ({
      upload: vi.fn(() => Promise.resolve({ error: null })),
      getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://test.com/file.pdf' } })),
    })),
  },
};

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
