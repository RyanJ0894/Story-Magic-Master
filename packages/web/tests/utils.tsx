import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Mock toast provider
const MockToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// All providers wrapper
const AllProviders: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <MockToastProvider>{children}</MockToastProvider>;
};

// Custom render function with providers
const customRender = (
  ui: ReactElement,
  options?: Omit<RenderOptions, 'wrapper'>
) => {
  return {
    user: userEvent.setup(),
    ...render(ui, { wrapper: AllProviders, ...options }),
  };
};

// Re-export everything
export * from '@testing-library/react';
export { customRender as render };

// Test data helpers
export const mockAuthUser = {
  id: 'user-123',
  email: 'test@example.com',
  app_metadata: {},
  user_metadata: { full_name: 'Test User' },
  aud: 'authenticated',
  created_at: new Date().toISOString(),
};

export const mockWriterProfile = {
  id: 'user-123',
  full_name: 'Test Writer',
  user_type: 'writer' as const,
  writer_code: 'WRT123',
  reader_code: 'RDR456',
};

export const mockReaderProfile = {
  id: 'user-123',
  full_name: 'Test Reader',
  user_type: 'reader' as const,
  writer_code: null,
  reader_code: 'RDR456',
};

export const mockSubscription = {
  id: 'sub-123',
  user_id: 'user-123',
  plan: 'pro' as const,
  status: 'active' as const,
  stripe_subscription_id: 'sub_stripe_123',
  generations_limit: 10,
  generations_used: 2,
  downloads_limit: 5,
  downloads_used: 1,
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
};

export const mockScript = {
  project_id: 'project-123',
  name: 'The Great Screenplay',
  status: 'completed' as const,
  page_count: 110,
  created_at: new Date().toISOString(),
  share_count: 3,
  reader_count: 2,
  total_views: 15,
  audio_generated: true,
};

export const mockLibraryEntry = {
  id: 'entry-123',
  reader_id: 'user-123',
  project_id: 'project-123',
  source: 'received' as const,
  share_id: 'share-123',
  status: 'active' as const,
  is_favorited: false,
  notes: null,
  tags: [],
  last_played_at: null,
  play_position_seconds: 0,
  completed: false,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  script_name: 'Test Script',
  page_count: 90,
  writer_name: 'John Writer',
  writer_code: 'JHN123',
  writer_subscribed: true,
  duration_seconds: 5400,
};

// API response helpers
export function createApiResponse<T>(data: T, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function createApiError(message: string, status = 400): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}
