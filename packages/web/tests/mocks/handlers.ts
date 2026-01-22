import { http, HttpResponse } from 'msw';

const BASE_URL = 'http://localhost:22000';

// Test data factories
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: 'user-123',
  full_name: 'Test User',
  user_type: 'writer',
  writer_code: 'ABC123',
  reader_code: 'XYZ789',
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockSubscription = (overrides = {}) => ({
  id: 'sub-123',
  user_id: 'user-123',
  plan: 'pro',
  status: 'active',
  generations_limit: 10,
  generations_used: 2,
  downloads_limit: 5,
  downloads_used: 1,
  current_period_start: new Date().toISOString(),
  current_period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  user_id: 'user-123',
  name: 'Test Script',
  status: 'completed',
  page_count: 90,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockShare = (overrides = {}) => ({
  id: 'share-123',
  project_id: 'project-123',
  shared_by: 'user-123',
  share_code: 'abc123xyz',
  access_level: 'stream',
  view_count: 5,
  play_count: 3,
  is_active: true,
  created_at: new Date().toISOString(),
  ...overrides,
});

export const createMockLibraryEntry = (overrides = {}) => ({
  id: 'entry-123',
  reader_id: 'user-123',
  project_id: 'project-123',
  source: 'received',
  status: 'active',
  is_favorited: false,
  play_position_seconds: 0,
  completed: false,
  created_at: new Date().toISOString(),
  ...overrides,
});

// API Handlers
export const handlers = [
  // Shares API
  http.get(`${BASE_URL}/api/shares`, () => {
    return HttpResponse.json({
      shares: [createMockShare()],
    });
  }),

  http.post(`${BASE_URL}/api/shares`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      share: createMockShare(body),
      shareUrl: `${BASE_URL}/s/abc123xyz`,
      shareCode: 'abc123xyz',
    });
  }),

  http.get(`${BASE_URL}/api/shares/:shareId`, ({ params }) => {
    return HttpResponse.json({
      share: createMockShare({ id: params.shareId as string }),
    });
  }),

  http.patch(`${BASE_URL}/api/shares/:shareId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      share: createMockShare({ id: params.shareId as string, ...body }),
    });
  }),

  http.delete(`${BASE_URL}/api/shares/:shareId`, () => {
    return HttpResponse.json({ success: true });
  }),

  // Share Access API
  http.get(`${BASE_URL}/api/shares/access/:code`, () => {
    return HttpResponse.json({
      share: { id: 'share-123', accessLevel: 'stream' },
      project: { id: 'project-123', name: 'Test Script', pageCount: 90 },
      writer: { name: 'Test Writer', code: 'ABC123' },
      audio: {
        url: 'https://storage.test.com/audio.m4a',
        duration: 3600,
      },
      canDownload: false,
    });
  }),

  // Reader Library API
  http.get(`${BASE_URL}/api/reader/library`, () => {
    return HttpResponse.json({
      entries: [
        {
          ...createMockLibraryEntry(),
          script_name: 'Test Script',
          page_count: 90,
          writer_name: 'Test Writer',
          writer_code: 'ABC123',
          writer_subscribed: true,
          duration_seconds: 3600,
        },
      ],
    });
  }),

  http.get(`${BASE_URL}/api/reader/library/:entryId`, ({ params }) => {
    return HttpResponse.json({
      entry: createMockLibraryEntry({ id: params.entryId as string }),
      audio: {
        file_url: 'https://storage.test.com/audio.m4a',
        duration_seconds: 3600,
      },
    });
  }),

  http.patch(`${BASE_URL}/api/reader/library/:entryId`, async ({ params, request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      entry: createMockLibraryEntry({ id: params.entryId as string, ...body }),
    });
  }),

  http.delete(`${BASE_URL}/api/reader/library/:entryId`, () => {
    return HttpResponse.json({ success: true });
  }),

  http.post(`${BASE_URL}/api/reader/library/:entryId/favorite`, async ({ params, request }) => {
    const body = await request.json() as { is_favorited?: boolean };
    return HttpResponse.json({
      entry: createMockLibraryEntry({ id: params.entryId as string }),
      is_favorited: body.is_favorited ?? true,
    });
  }),

  http.post(`${BASE_URL}/api/reader/library/:entryId/position`, async ({ request }) => {
    const body = await request.json() as { position: number };
    return HttpResponse.json({
      entry: createMockLibraryEntry({ play_position_seconds: body.position }),
      position: body.position,
      completed: false,
    });
  }),

  // Upload API
  http.post(`${BASE_URL}/api/reader/upload/create-payment`, () => {
    return HttpResponse.json({
      clientSecret: 'pi_test_secret',
      paymentIntentId: 'pi_test_123',
    });
  }),

  http.post(`${BASE_URL}/api/reader/upload/process`, () => {
    return HttpResponse.json({
      projectId: 'project-new-123',
      jobId: 'job-123',
      status: 'processing',
    });
  }),

  // Jobs API
  http.get(`${BASE_URL}/api/jobs/:jobId/status`, () => {
    return HttpResponse.json({
      status: 'completed',
      progress: 100,
      message: 'Processing complete',
    });
  }),

  // Projects API
  http.delete(`${BASE_URL}/api/projects/:projectId`, () => {
    return HttpResponse.json({ success: true });
  }),
];
