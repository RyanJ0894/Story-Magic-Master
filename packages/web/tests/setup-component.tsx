import '@testing-library/jest-dom/vitest';
import { vi, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// =============================================================================
// Environment Variables
// =============================================================================

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:22000');
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_fake');
vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_fake');
vi.stubEnv('NEXT_PUBLIC_ORCHESTRATOR_URL', 'http://localhost:22002');
vi.stubEnv('RATE_LIMIT_DISABLED', 'true');

// =============================================================================
// Mock HTMLAudioElement
// =============================================================================

class MockHTMLAudioElement {
  src = '';
  currentTime = 0;
  duration = 120;
  volume = 1;
  paused = true;
  muted = false;

  play = vi.fn().mockResolvedValue(undefined);
  pause = vi.fn();
  load = vi.fn();
  addEventListener = vi.fn();
  removeEventListener = vi.fn();

  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
}

vi.stubGlobal('Audio', MockHTMLAudioElement);

// =============================================================================
// Mock window.matchMedia
// =============================================================================

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// =============================================================================
// Mock next/navigation
// =============================================================================

const mockRouterPush = vi.fn();
const mockRouterReplace = vi.fn();
const mockRouterRefresh = vi.fn();
const mockRouterBack = vi.fn();

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockRouterPush,
    replace: mockRouterReplace,
    refresh: mockRouterRefresh,
    back: mockRouterBack,
    forward: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/',
  redirect: vi.fn(),
}));

// Export router mocks for test access
export { mockRouterPush, mockRouterReplace, mockRouterRefresh, mockRouterBack };

// =============================================================================
// Mock next/link
// =============================================================================

vi.mock('next/link', () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string; [key: string]: unknown }) => {
    // eslint-disable-next-line @next/next/no-html-link-for-pages
    return <a href={href} {...props}>{children}</a>;
  },
}));

// =============================================================================
// Mock Clerk Auth
// =============================================================================

vi.mock('@clerk/nextjs', () => ({
  ClerkProvider: ({ children }: { children: React.ReactNode }) => children,
  useUser: () => ({ user: { id: 'user_test123' }, isLoaded: true, isSignedIn: true }),
  useAuth: () => ({ userId: 'user_test123', isLoaded: true, isSignedIn: true }),
  useClerk: () => ({ signOut: vi.fn() }),
  SignIn: () => <div data-testid="clerk-sign-in" />,
  SignUp: () => <div data-testid="clerk-sign-up" />,
}));

vi.mock('@clerk/nextjs/server', () => ({
  auth: vi.fn(() => Promise.resolve({ userId: 'user_test123' })),
  currentUser: vi.fn(() => Promise.resolve({ id: 'user_test123', emailAddresses: [{ emailAddress: 'test@example.com' }] })),
}));

// =============================================================================
// Mock Prisma Client
// =============================================================================

export const mockPrisma = {
  project: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
  profile: { findUnique: vi.fn(), update: vi.fn() },
  job: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
  subscription: { findFirst: vi.fn() },
  $queryRaw: vi.fn(),
};

vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// =============================================================================
// Cleanup
// =============================================================================

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
