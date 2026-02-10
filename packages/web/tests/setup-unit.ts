import { vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:22000');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://test.supabase.co');
vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'test-anon-key');
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
vi.stubEnv('RATE_LIMIT_DISABLED', 'true'); // Disable rate limiting in unit tests

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
