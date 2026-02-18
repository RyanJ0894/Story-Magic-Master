import { vi, beforeEach } from 'vitest';

// Mock environment variables
vi.stubEnv('NEXT_PUBLIC_APP_URL', 'http://localhost:22000');
vi.stubEnv('DATABASE_URL', 'postgresql://test:test@localhost:5432/test');
vi.stubEnv('NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY', 'pk_test_fake');
vi.stubEnv('CLERK_SECRET_KEY', 'sk_test_fake');
vi.stubEnv('OPENAI_API_KEY', 'test-openai-key');
vi.stubEnv('RATE_LIMIT_DISABLED', 'true'); // Disable rate limiting in unit tests

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
