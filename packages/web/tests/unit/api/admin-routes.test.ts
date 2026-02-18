/**
 * Tests for Admin API Routes (Auth & Authz)
 *
 * Covers all 8 admin routes:
 * - GET /api/admin/stats
 * - GET /api/admin/users
 * - PATCH /api/admin/users
 * - GET /api/admin/users/[userId]
 * - PATCH /api/admin/users/[userId]
 * - GET /api/admin/subscriptions
 * - PATCH /api/admin/subscriptions
 * - GET /api/admin/subscriptions/[subscriptionId]
 * - POST /api/admin/subscriptions/[subscriptionId]
 * - GET /api/admin/settings
 * - PUT /api/admin/settings
 * - GET /api/admin/audit-logs
 * - POST /api/admin/corpus/populate
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// =============================================================================
// Mocks
// =============================================================================

// Mock Clerk auth
const mockAuth = vi.fn();
vi.mock('@clerk/nextjs/server', () => ({
  auth: () => mockAuth(),
}));

// Mock Prisma — include all models used by admin routes
const mockPrisma = {
  profile: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  project: {
    count: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
    update: vi.fn(),
  },
  scriptShare: {
    count: vi.fn(),
  },
  platformSetting: {
    findMany: vi.fn(),
    upsert: vi.fn(),
  },
  auditLog: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
  $queryRaw: vi.fn(),
};
vi.mock('@/lib/db', () => ({
  prisma: mockPrisma,
}));

// Mock CSRF validation
const mockValidateCsrf = vi.fn(() => null);
vi.mock('@/lib/csrf', () => ({
  validateCsrf: (...args: unknown[]) => mockValidateCsrf(...args),
}));

// Mock rate limit
vi.mock('@/lib/api/rate-limit', () => ({
  rateLimit: vi.fn(() => Promise.resolve(null)),
  getClientIp: vi.fn(() => '127.0.0.1'),
}));

// Mock logger
vi.mock('@/lib/logger', () => ({
  log: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

// Mock audit logging
const mockLogAuditEvent = vi.fn().mockResolvedValue(undefined);
vi.mock('@/lib/api/audit', () => ({
  logAuditEvent: (...args: unknown[]) => mockLogAuditEvent(...args),
  extractRequestInfo: vi.fn(() => ({
    ip_address: '127.0.0.1',
    user_agent: 'test-agent',
  })),
  AuditActions: {
    ADMIN_USER_UPDATE: 'admin.user.update',
    ADMIN_USER_SUSPEND: 'admin.user.suspend',
    ADMIN_SUBSCRIPTION_MODIFY: 'admin.subscription.modify',
    SUBSCRIPTION_CANCEL: 'subscription.cancel',
    SUBSCRIPTION_RESUME: 'subscription.resume',
  },
  ResourceTypes: {
    USER: 'user',
    SUBSCRIPTION: 'subscription',
  },
}));

// Mock populateMissingEmbeddings
const mockPopulateMissingEmbeddings = vi.fn();
vi.mock('@/lib/comparable/service', () => ({
  populateMissingEmbeddings: (...args: unknown[]) =>
    mockPopulateMissingEmbeddings(...args),
}));

// Mock mapDbStatsToAdminStats
vi.mock('@/lib/api/mappers', async (importOriginal) => {
  const actual = (await importOriginal()) as Record<string, unknown>;
  return {
    ...actual,
    // Keep the real implementation — it's a pure mapper
  };
});

// =============================================================================
// Imports (after mocks)
// =============================================================================

const { GET: getStats } = await import('@/app/api/admin/stats/route');
const { GET: getUsers, PATCH: patchUsers } = await import(
  '@/app/api/admin/users/route'
);
const { GET: getUser, PATCH: patchUser } = await import(
  '@/app/api/admin/users/[userId]/route'
);
const { GET: getSubscriptions, PATCH: patchSubscriptions } = await import(
  '@/app/api/admin/subscriptions/route'
);
const { GET: getSubscription, POST: postSubscription } = await import(
  '@/app/api/admin/subscriptions/[subscriptionId]/route'
);
const { GET: getSettings, PUT: putSettings } = await import(
  '@/app/api/admin/settings/route'
);
const { GET: getAuditLogs } = await import(
  '@/app/api/admin/audit-logs/route'
);
const { POST: populateCorpus } = await import(
  '@/app/api/admin/corpus/populate/route'
);

// =============================================================================
// Helpers
// =============================================================================

function createRequest(
  url: string,
  options: {
    method?: string;
    body?: Record<string, unknown> | unknown[];
    headers?: Record<string, string>;
  } = {},
): NextRequest {
  const init: RequestInit = {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      origin: 'http://localhost:22000',
      ...options.headers,
    },
  };
  if (options.body) {
    init.body = JSON.stringify(options.body);
  }
  return new NextRequest(url, init);
}

function routeParams(params: Record<string, string>) {
  return { params: Promise.resolve(params) };
}

/** Set up auth as an admin user */
function setupAdmin() {
  mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
  mockPrisma.profile.findUnique.mockResolvedValue({
    id: 'admin_user_123',
    userType: 'admin',
  });
}

/** Set up auth as a regular (non-admin) user */
function setupRegularUser() {
  mockAuth.mockResolvedValue({ userId: 'regular_user_123' });
  mockPrisma.profile.findUnique.mockResolvedValue({
    id: 'regular_user_123',
    userType: 'writer',
  });
}

/** Set up unauthenticated state */
function setupUnauthenticated() {
  mockAuth.mockResolvedValue({ userId: null });
}

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockValidateCsrf.mockReturnValue(null);
});

// =============================================================================
// GET /api/admin/stats
// =============================================================================

describe('GET /api/admin/stats', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest('http://localhost:22000/api/admin/stats');
    const res = await getStats(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but not admin', async () => {
    setupRegularUser();
    const req = createRequest('http://localhost:22000/api/admin/stats');
    const res = await getStats(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with stats when authenticated as admin', async () => {
    setupAdmin();
    // Mock $queryRaw — single row with all counts (TD-058 optimisation)
    mockPrisma.$queryRaw.mockResolvedValueOnce([
      {
        total_users: BigInt(100),
        writer_count: BigInt(60),
        reader_count: BigInt(40),
        active_subscription_count: BigInt(25),
        project_count: BigInt(200),
        share_count: BigInt(30),
        new_users_today: BigInt(5),
        new_users_week: BigInt(20),
        new_users_month: BigInt(50),
      },
    ]);

    const req = createRequest('http://localhost:22000/api/admin/stats');
    const res = await getStats(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.total_users).toBe(100);
    expect(data.total_writers).toBe(60);
    expect(data.total_readers).toBe(40);
    expect(data.active_subscriptions).toBe(25);
    expect(data.total_projects).toBe(200);
    expect(data.total_shares).toBe(30);
    expect(data.mrr_cents).toBe(37500); // 25 * 1500
    expect(data.new_users_today).toBe(5);
    expect(data.new_users_week).toBe(20);
    expect(data.new_users_month).toBe(50);
  });
});

// =============================================================================
// GET /api/admin/users
// =============================================================================

describe('GET /api/admin/users', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest('http://localhost:22000/api/admin/users');
    const res = await getUsers(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but not admin', async () => {
    setupRegularUser();
    const req = createRequest('http://localhost:22000/api/admin/users');
    const res = await getUsers(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated users when admin (no filters)', async () => {
    setupAdmin();
    const mockUsers = [
      {
        id: 'user_1',
        fullName: 'Alice',
        userType: 'writer',
        writerCode: 'WR001',
        readerCode: null,
        createdAt: new Date('2026-01-01'),
        updatedAt: new Date('2026-01-15'),
        subscriptions: [{ id: 'sub_1', status: 'active', plan: 'pro' }],
      },
    ];

    mockPrisma.profile.findMany.mockResolvedValueOnce(mockUsers);
    mockPrisma.profile.count.mockResolvedValueOnce(1);

    const req = createRequest('http://localhost:22000/api/admin/users');
    const res = await getUsers(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].fullName).toBe('Alice');
    expect(data.pagination.total).toBe(1);
    expect(data.pagination.page).toBe(1);
  });

  it('supports search, type, and pagination params', async () => {
    setupAdmin();
    mockPrisma.profile.findMany.mockResolvedValueOnce([]);
    mockPrisma.profile.count.mockResolvedValueOnce(0);

    const req = createRequest(
      'http://localhost:22000/api/admin/users?page=2&limit=10&search=alice&type=writer',
    );
    const res = await getUsers(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.profile.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10, // (page 2 - 1) * 10
        take: 10,
        where: expect.objectContaining({
          userType: 'writer',
          OR: expect.any(Array),
        }),
      }),
    );
  });
});

// =============================================================================
// PATCH /api/admin/users
// =============================================================================

describe('PATCH /api/admin/users', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest('http://localhost:22000/api/admin/users', {
      method: 'PATCH',
      body: { userId: 'user_1', user_type: 'admin' },
    });
    const res = await patchUsers(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest('http://localhost:22000/api/admin/users', {
      method: 'PATCH',
      body: { userId: 'user_1', user_type: 'admin' },
    });
    const res = await patchUsers(req);
    expect(res.status).toBe(403);
  });

  it('updates user and returns 200 when admin', async () => {
    setupAdmin();
    const updatedProfile = {
      id: 'user_1',
      fullName: 'Alice Updated',
      userType: 'admin',
    };
    mockPrisma.profile.update.mockResolvedValueOnce(updatedProfile);

    const req = createRequest('http://localhost:22000/api/admin/users', {
      method: 'PATCH',
      body: { userId: 'user_1', user_type: 'admin' },
    });
    const res = await patchUsers(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.userType).toBe('admin');
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('returns 400 when userId is missing', async () => {
    setupAdmin();
    const req = createRequest('http://localhost:22000/api/admin/users', {
      method: 'PATCH',
      body: { user_type: 'admin' },
    });
    const res = await patchUsers(req);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// GET /api/admin/users/[userId]
// =============================================================================

describe('GET /api/admin/users/[userId]', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/users/user_target',
    );
    const res = await getUser(req, routeParams({ userId: 'user_target' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when authenticated but not admin', async () => {
    mockAuth.mockResolvedValue({ userId: 'regular_user_123' });
    // First call: admin check in the route handler (withAuth used, not withAdminAuth)
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'regular_user_123',
      userType: 'writer',
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/users/user_target',
    );
    const res = await getUser(req, routeParams({ userId: 'user_target' }));
    expect(res.status).toBe(403);
  });

  it('returns 200 with user details when admin', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // First call: admin check
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'admin_user_123',
      userType: 'admin',
    });
    // Second call: fetch target user
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'user_target',
      fullName: 'Target User',
      userType: 'writer',
      writerCode: 'WR123',
      readerCode: null,
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-15'),
      subscriptions: [],
    });
    mockPrisma.project.count.mockResolvedValueOnce(5);

    const req = createRequest(
      'http://localhost:22000/api/admin/users/user_target',
    );
    const res = await getUser(req, routeParams({ userId: 'user_target' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.id).toBe('user_target');
    expect(data.data.fullName).toBe('Target User');
    expect(data.data.project_count).toBe(5);
  });

  it('returns 404 when target user does not exist', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // Admin check
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'admin_user_123',
      userType: 'admin',
    });
    // Target user not found
    mockPrisma.profile.findUnique.mockResolvedValueOnce(null);

    const req = createRequest(
      'http://localhost:22000/api/admin/users/nonexistent',
    );
    const res = await getUser(req, routeParams({ userId: 'nonexistent' }));
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// PATCH /api/admin/users/[userId]
// =============================================================================

describe('PATCH /api/admin/users/[userId]', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/users/user_target',
      { method: 'PATCH', body: { user_type: 'reader' } },
    );
    const res = await patchUser(req, routeParams({ userId: 'user_target' }));
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    mockAuth.mockResolvedValue({ userId: 'regular_user_123' });
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'regular_user_123',
      userType: 'writer',
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/users/user_target',
      { method: 'PATCH', body: { user_type: 'reader' } },
    );
    const res = await patchUser(req, routeParams({ userId: 'user_target' }));
    expect(res.status).toBe(403);
  });

  it('updates target user and returns 200 when admin', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // Admin check
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'admin_user_123',
      userType: 'admin',
    });
    // Target user exists
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'user_target',
      userType: 'writer',
    });
    // Update result
    mockPrisma.profile.update.mockResolvedValueOnce({
      id: 'user_target',
      userType: 'reader',
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/users/user_target',
      { method: 'PATCH', body: { user_type: 'reader' } },
    );
    const res = await patchUser(req, routeParams({ userId: 'user_target' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.userType).toBe('reader');
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('returns 400 when admin tries to demote themselves', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    // Admin check
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'admin_user_123',
      userType: 'admin',
    });
    // Target user is the same admin
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'admin_user_123',
      userType: 'admin',
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/users/admin_user_123',
      { method: 'PATCH', body: { user_type: 'writer' } },
    );
    const res = await patchUser(
      req,
      routeParams({ userId: 'admin_user_123' }),
    );
    expect(res.status).toBe(400);
  });

  it('returns 404 when target user does not exist', async () => {
    mockAuth.mockResolvedValue({ userId: 'admin_user_123' });
    mockPrisma.profile.findUnique.mockResolvedValueOnce({
      id: 'admin_user_123',
      userType: 'admin',
    });
    mockPrisma.profile.findUnique.mockResolvedValueOnce(null);

    const req = createRequest(
      'http://localhost:22000/api/admin/users/nonexistent',
      { method: 'PATCH', body: { user_type: 'reader' } },
    );
    const res = await patchUser(req, routeParams({ userId: 'nonexistent' }));
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// GET /api/admin/subscriptions
// =============================================================================

describe('GET /api/admin/subscriptions', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
    );
    const res = await getSubscriptions(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
    );
    const res = await getSubscriptions(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated subscriptions when admin (no filters)', async () => {
    setupAdmin();
    const mockSubs = [
      {
        id: 'sub_1',
        status: 'active',
        plan: 'pro',
        createdAt: new Date(),
        user: { id: 'user_1', fullName: 'Alice', userType: 'writer' },
      },
    ];

    mockPrisma.subscription.findMany.mockResolvedValueOnce(mockSubs);
    mockPrisma.subscription.count
      .mockResolvedValueOnce(1) // total count with filter
      .mockResolvedValueOnce(1) // active
      .mockResolvedValueOnce(0) // trialing
      .mockResolvedValueOnce(0); // canceled

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
    );
    const res = await getSubscriptions(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.summary.active).toBe(1);
    expect(data.pagination.total).toBe(1);
  });

  it('supports status and plan filters', async () => {
    setupAdmin();
    mockPrisma.subscription.findMany.mockResolvedValueOnce([]);
    mockPrisma.subscription.count
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0);

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions?status=active&plan=pro',
    );
    const res = await getSubscriptions(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.subscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: 'active', plan: 'pro' },
      }),
    );
  });
});

// =============================================================================
// PATCH /api/admin/subscriptions
// =============================================================================

describe('PATCH /api/admin/subscriptions', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
      {
        method: 'PATCH',
        body: {
          subscriptionId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'cancel',
        },
      },
    );
    const res = await patchSubscriptions(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
      {
        method: 'PATCH',
        body: {
          subscriptionId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'cancel',
        },
      },
    );
    const res = await patchSubscriptions(req);
    expect(res.status).toBe(403);
  });

  it('cancels a subscription when admin', async () => {
    setupAdmin();
    const subId = '550e8400-e29b-41d4-a716-446655440000';
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: subId,
      userId: 'user_1',
      status: 'active',
    });
    mockPrisma.subscription.update.mockResolvedValueOnce({
      id: subId,
      cancelAtPeriodEnd: true,
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
      { method: 'PATCH', body: { subscriptionId: subId, action: 'cancel' } },
    );
    const res = await patchSubscriptions(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.cancelAtPeriodEnd).toBe(true);
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('returns 404 when subscription not found', async () => {
    setupAdmin();
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
      {
        method: 'PATCH',
        body: {
          subscriptionId: '550e8400-e29b-41d4-a716-446655440000',
          action: 'cancel',
        },
      },
    );
    const res = await patchSubscriptions(req);
    expect(res.status).toBe(404);
  });

  it('returns 400 when plan missing for update_plan action', async () => {
    setupAdmin();
    const subId = '550e8400-e29b-41d4-a716-446655440000';
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: subId,
      userId: 'user_1',
      status: 'active',
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions',
      {
        method: 'PATCH',
        body: { subscriptionId: subId, action: 'update_plan' },
      },
    );
    const res = await patchSubscriptions(req);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// GET /api/admin/subscriptions/[subscriptionId]
// =============================================================================

describe('GET /api/admin/subscriptions/[subscriptionId]', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1',
    );
    const res = await getSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1',
    );
    const res = await getSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 200 with subscription details when admin', async () => {
    setupAdmin();
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1',
      status: 'active',
      plan: 'pro',
      user: {
        id: 'user_1',
        fullName: 'Alice',
        userType: 'writer',
        writerCode: 'WR001',
        readerCode: null,
      },
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1',
    );
    const res = await getSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.id).toBe('sub_1');
    expect(data.data.user.fullName).toBe('Alice');
  });

  it('returns 404 when subscription not found', async () => {
    setupAdmin();
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/nonexistent',
    );
    const res = await getSubscription(
      req,
      routeParams({ subscriptionId: 'nonexistent' }),
    );
    expect(res.status).toBe(404);
  });
});

// =============================================================================
// POST /api/admin/subscriptions/[subscriptionId] (cancel/sync actions)
// =============================================================================

describe('POST /api/admin/subscriptions/[subscriptionId]', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1',
      { method: 'POST' },
    );
    const res = await postSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1',
      { method: 'POST' },
    );
    const res = await postSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    expect(res.status).toBe(403);
  });

  it('returns 404 when subscription not found', async () => {
    setupAdmin();
    mockPrisma.subscription.findUnique.mockResolvedValueOnce(null);

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/nonexistent/cancel',
      { method: 'POST' },
    );
    const res = await postSubscription(
      req,
      routeParams({ subscriptionId: 'nonexistent' }),
    );
    expect(res.status).toBe(404);
  });

  it('cancels subscription when action is cancel', async () => {
    setupAdmin();
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1',
      userId: 'user_1',
      status: 'active',
    });
    mockPrisma.subscription.update.mockResolvedValueOnce({
      id: 'sub_1',
      status: 'canceled',
      cancelAtPeriodEnd: true,
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1/cancel',
      { method: 'POST' },
    );
    const res = await postSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data.status).toBe('canceled');
    expect(mockLogAuditEvent).toHaveBeenCalled();
  });

  it('syncs subscription when action is sync', async () => {
    setupAdmin();
    mockPrisma.subscription.findUnique.mockResolvedValueOnce({
      id: 'sub_1',
      userId: 'user_1',
      status: 'active',
    });
    mockPrisma.subscription.update.mockResolvedValueOnce({
      id: 'sub_1',
      status: 'active',
    });

    const req = createRequest(
      'http://localhost:22000/api/admin/subscriptions/sub_1/sync',
      { method: 'POST' },
    );
    const res = await postSubscription(
      req,
      routeParams({ subscriptionId: 'sub_1' }),
    );
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.message).toContain('Sync');
  });
});

// =============================================================================
// GET /api/admin/settings
// =============================================================================

describe('GET /api/admin/settings', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest('http://localhost:22000/api/admin/settings');
    const res = await getSettings(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest('http://localhost:22000/api/admin/settings');
    const res = await getSettings(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with settings keyed by key column when admin', async () => {
    setupAdmin();
    mockPrisma.platformSetting.findMany.mockResolvedValueOnce([
      {
        key: 'max_script_pages',
        value: 120,
        updatedBy: 'admin_user_123',
        updatedAt: new Date(),
      },
      {
        key: 'maintenance_mode',
        value: false,
        updatedBy: 'admin_user_123',
        updatedAt: new Date(),
      },
    ]);

    const req = createRequest('http://localhost:22000/api/admin/settings');
    const res = await getSettings(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.settings.max_script_pages).toBe(120);
    expect(data.settings.maintenance_mode).toBe(false);
  });
});

// =============================================================================
// PUT /api/admin/settings
// =============================================================================

describe('PUT /api/admin/settings', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest('http://localhost:22000/api/admin/settings', {
      method: 'PUT',
      body: { settings: { max_script_pages: 150 } },
    });
    const res = await putSettings(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest('http://localhost:22000/api/admin/settings', {
      method: 'PUT',
      body: { settings: { max_script_pages: 150 } },
    });
    const res = await putSettings(req);
    expect(res.status).toBe(403);
  });

  it('upserts settings and returns 200 when admin', async () => {
    setupAdmin();
    mockPrisma.$transaction.mockResolvedValueOnce([]);

    const req = createRequest('http://localhost:22000/api/admin/settings', {
      method: 'PUT',
      body: { settings: { max_script_pages: 150, maintenance_mode: true } },
    });
    const res = await putSettings(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.settings.max_script_pages).toBe(150);
    expect(data.settings.maintenance_mode).toBe(true);
    expect(data.updated_at).toBeDefined();
  });

  it('returns 400 when settings object is empty', async () => {
    setupAdmin();
    const req = createRequest('http://localhost:22000/api/admin/settings', {
      method: 'PUT',
      body: { settings: {} },
    });
    const res = await putSettings(req);
    expect(res.status).toBe(400);
  });

  it('returns 400 when body is missing settings key', async () => {
    setupAdmin();
    const req = createRequest('http://localhost:22000/api/admin/settings', {
      method: 'PUT',
      body: { max_script_pages: 150 },
    });
    const res = await putSettings(req);
    expect(res.status).toBe(400);
  });
});

// =============================================================================
// GET /api/admin/audit-logs
// =============================================================================

describe('GET /api/admin/audit-logs', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest('http://localhost:22000/api/admin/audit-logs');
    const res = await getAuditLogs(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest('http://localhost:22000/api/admin/audit-logs');
    const res = await getAuditLogs(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with paginated audit logs when admin (no filters)', async () => {
    setupAdmin();
    const mockLogs = [
      {
        id: 'log_1',
        action: 'admin.user.update',
        resourceType: 'user',
        resourceId: 'user_1',
        userId: 'admin_user_123',
        createdAt: new Date('2026-02-01'),
        user: { fullName: 'Admin' },
      },
    ];
    mockPrisma.auditLog.findMany.mockResolvedValueOnce(mockLogs);
    mockPrisma.auditLog.count.mockResolvedValueOnce(1);

    const req = createRequest('http://localhost:22000/api/admin/audit-logs');
    const res = await getAuditLogs(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.data).toHaveLength(1);
    expect(data.data[0].action).toBe('admin.user.update');
    expect(data.pagination.total).toBe(1);
  });

  it('supports filtering by action and resource', async () => {
    setupAdmin();
    mockPrisma.auditLog.findMany.mockResolvedValueOnce([]);
    mockPrisma.auditLog.count.mockResolvedValueOnce(0);

    const req = createRequest(
      'http://localhost:22000/api/admin/audit-logs?action=cancel&resource=subscription',
    );
    const res = await getAuditLogs(req);

    expect(res.status).toBe(200);
    expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          action: { contains: 'cancel', mode: 'insensitive' },
          resourceType: 'subscription',
        }),
      }),
    );
  });
});

// =============================================================================
// POST /api/admin/corpus/populate
// =============================================================================

describe('POST /api/admin/corpus/populate', () => {
  it('returns 401 when unauthenticated', async () => {
    setupUnauthenticated();
    const req = createRequest(
      'http://localhost:22000/api/admin/corpus/populate',
      { method: 'POST' },
    );
    const res = await populateCorpus(req);
    expect(res.status).toBe(401);
  });

  it('returns 403 when not admin', async () => {
    setupRegularUser();
    const req = createRequest(
      'http://localhost:22000/api/admin/corpus/populate',
      { method: 'POST' },
    );
    const res = await populateCorpus(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with count of populated embeddings when admin', async () => {
    setupAdmin();
    mockPopulateMissingEmbeddings.mockResolvedValueOnce(12);

    const req = createRequest(
      'http://localhost:22000/api/admin/corpus/populate',
      { method: 'POST' },
    );
    const res = await populateCorpus(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.updated).toBe(12);
    expect(data.message).toContain('12');
  });

  it('returns 500 when populate fails', async () => {
    setupAdmin();
    mockPopulateMissingEmbeddings.mockRejectedValueOnce(
      new Error('OpenAI rate limit'),
    );

    const req = createRequest(
      'http://localhost:22000/api/admin/corpus/populate',
      { method: 'POST' },
    );
    const res = await populateCorpus(req);
    const data = await res.json();

    expect(res.status).toBe(500);
    expect(data.code).toBe('POPULATE_ERROR');
    expect(data.details).toContain('OpenAI rate limit');
  });
});
