import '@testing-library/jest-dom/vitest';
import { vi, afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// =============================================================================
// Environment Variables
// =============================================================================

vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:22000');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
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
// Mock Supabase Client
// =============================================================================

const mockSupabaseAuth = {
  getUser: vi.fn(() => Promise.resolve({ data: { user: null }, error: null })),
  getSession: vi.fn(() => Promise.resolve({ data: { session: null }, error: null })),
  signInWithPassword: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  signInWithOtp: vi.fn(() => Promise.resolve({ data: {}, error: null })),
  signUp: vi.fn(() => Promise.resolve({ data: { user: { id: 'user-123' } }, error: null })),
  signOut: vi.fn(() => Promise.resolve({ error: null })),
  onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
};

export const mockSupabaseClient = {
  auth: mockSupabaseAuth,
  from: vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
  })),
};

vi.mock('@/lib/supabase/client', () => ({
  createClient: () => mockSupabaseClient,
}));

// =============================================================================
// Cleanup
// =============================================================================

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
