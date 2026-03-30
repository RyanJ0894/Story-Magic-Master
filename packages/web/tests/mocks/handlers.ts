import { http, HttpResponse } from 'msw';

const BASE_URL = 'http://localhost:22000';

// Test data factories — fields match Prisma camelCase output
export const createMockUser = (overrides = {}) => ({
  id: 'user-123',
  email: 'test@example.com',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockProfile = (overrides = {}) => ({
  id: 'user-123',
  fullName: 'Test User',
  userType: 'writer',
  writerCode: 'ABC123',
  readerCode: 'XYZ789',
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockSubscription = (overrides = {}) => ({
  id: 'sub-123',
  userId: 'user-123',
  plan: 'pro',
  status: 'active',
  generationsLimit: 10,
  generationsUsed: 2,
  downloadsLimit: 5,
  downloadsUsed: 1,
  currentPeriodStart: new Date().toISOString(),
  currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  ...overrides,
});

export const createMockProject = (overrides = {}) => ({
  id: 'project-123',
  userId: 'user-123',
  name: 'Test Script',
  status: 'completed',
  pageCount: 90,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockShare = (overrides = {}) => ({
  id: 'share-123',
  projectId: 'project-123',
  sharedBy: 'user-123',
  shareCode: 'abc123xyz',
  accessLevel: 'stream',
  viewCount: 5,
  playCount: 3,
  isActive: true,
  createdAt: new Date().toISOString(),
  ...overrides,
});

export const createMockLibraryEntry = (overrides = {}) => ({
  id: 'entry-123',
  readerId: 'user-123',
  projectId: 'project-123',
  source: 'received',
  status: 'active',
  isFavorited: false,
  playPositionSeconds: 0,
  completed: false,
  createdAt: new Date().toISOString(),
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
          scriptName: 'Test Script',
          pageCount: 90,
          writerName: 'Test Writer',
          writerCode: 'ABC123',
          writerSubscribed: true,
          durationSeconds: 3600,
        },
      ],
    });
  }),

  http.get(`${BASE_URL}/api/reader/library/:entryId`, ({ params }) => {
    return HttpResponse.json({
      entry: createMockLibraryEntry({ id: params.entryId as string }),
      audio: {
        fileUrl: 'https://storage.test.com/audio.m4a',
        durationSeconds: 3600,
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
    const body = await request.json() as { isFavorited?: boolean };
    return HttpResponse.json({
      entry: createMockLibraryEntry({ id: params.entryId as string }),
      isFavorited: body.isFavorited ?? true,
    });
  }),

  http.post(`${BASE_URL}/api/reader/library/:entryId/position`, async ({ request }) => {
    const body = await request.json() as { position: number };
    return HttpResponse.json({
      entry: createMockLibraryEntry({ playPositionSeconds: body.position }),
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
