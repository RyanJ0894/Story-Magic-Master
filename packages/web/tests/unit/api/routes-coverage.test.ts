/**
 * Tests for Additional API Routes Coverage
 *
 * Covers:
 * - GET/PATCH /api/alerts
 * - GET/POST /api/teams
 * - GET /api/jobs/[id]
 * - POST /api/stripe/portal
 * - GET /api/health
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

// Mock Prisma - include all models needed
const mockPrisma = {
  alert: {
    findMany: vi.fn(),
    count: vi.fn(),
    updateMany: vi.fn(),
  },
  profile: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
  },
  team: {
    findMany: vi.fn(),
    create: vi.fn(),
  },
  teamMember: {
    findMany: vi.fn(),
  },
  job: {
    findUnique: vi.fn(),
  },
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

// Mock Stripe portal session
const mockCreatePortalSession = vi.fn();
vi.mock('@/lib/stripe/server', () => ({
  createPortalSession: (...args: unknown[]) => mockCreatePortalSession(...args),
}));

// Mock global fetch for health checks
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// =============================================================================
// Imports (after mocks)
// =============================================================================

const { GET: getAlerts, PATCH: patchAlerts } = await import(
  '@/app/api/alerts/route'
);
const { GET: getTeams, POST: createTeam } = await import(
  '@/app/api/teams/route'
);
const { GET: getJob } = await import('@/app/api/jobs/[id]/route');
const { POST: createPortal } = await import('@/app/api/stripe/portal/route');
const { GET: getHealth } = await import('@/app/api/health/route');

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

// =============================================================================
// Setup
// =============================================================================

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.mockResolvedValue({ userId: 'user_test123' });
  mockValidateCsrf.mockReturnValue(null);
});

// =============================================================================
// Alerts API
// =============================================================================

describe('GET /api/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest('http://localhost:22000/api/alerts');
    const res = await getAlerts(req);
    expect(res.status).toBe(401);
  });

  it('returns alerts and unread count', async () => {
    mockPrisma.alert.findMany.mockResolvedValue([
      {
        id: 'alert-1',
        alertType: 'team_invite',
        title: 'Invite',
        message: 'You were invited',
        projectId: null,
        teamId: 'team-1',
        relatedUserId: null,
        metadata: {},
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-02-01'),
        project: null,
        team: { id: 'team-1', name: 'My Team' },
      },
    ]);
    mockPrisma.alert.count.mockResolvedValue(1);

    const req = createRequest('http://localhost:22000/api/alerts');
    const res = await getAlerts(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.alerts).toHaveLength(1);
    expect(data.alerts[0].alert_type).toBe('team_invite');
    expect(data.unreadCount).toBe(1);
  });

  it('filters by unread when ?unread=true', async () => {
    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.alert.count.mockResolvedValue(0);

    const req = createRequest('http://localhost:22000/api/alerts?unread=true');
    await getAlerts(req);

    expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_test123', isRead: false },
      }),
    );
  });

  it('respects the limit parameter', async () => {
    mockPrisma.alert.findMany.mockResolvedValue([]);
    mockPrisma.alert.count.mockResolvedValue(0);

    const req = createRequest('http://localhost:22000/api/alerts?limit=5');
    await getAlerts(req);

    expect(mockPrisma.alert.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 5 }),
    );
  });

  it('resolves related user profiles', async () => {
    mockPrisma.alert.findMany.mockResolvedValue([
      {
        id: 'alert-2',
        alertType: 'share',
        title: 'Shared',
        message: 'Project shared',
        projectId: 'proj-1',
        teamId: null,
        relatedUserId: 'user_other',
        metadata: {},
        isRead: false,
        readAt: null,
        createdAt: new Date('2026-02-01'),
        project: { id: 'proj-1', name: 'Project' },
        team: null,
      },
    ]);
    mockPrisma.profile.findMany.mockResolvedValue([
      { id: 'user_other', fullName: 'Jane Doe', avatarUrl: 'https://img.test/jane.png' },
    ]);
    mockPrisma.alert.count.mockResolvedValue(1);

    const req = createRequest('http://localhost:22000/api/alerts');
    const res = await getAlerts(req);
    const data = await res.json();

    expect(data.alerts[0].related_user).toEqual({
      full_name: 'Jane Doe',
      avatar_url: 'https://img.test/jane.png',
    });
  });
});

describe('PATCH /api/alerts', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest('http://localhost:22000/api/alerts', {
      method: 'PATCH',
      body: { markAllRead: true },
    });
    const res = await patchAlerts(req);
    expect(res.status).toBe(401);
  });

  it('marks specific alerts as read', async () => {
    mockPrisma.alert.updateMany.mockResolvedValue({ count: 2 });

    const req = createRequest('http://localhost:22000/api/alerts', {
      method: 'PATCH',
      body: { alertIds: ['alert-1', 'alert-2'] },
    });
    const res = await patchAlerts(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_test123', id: { in: ['alert-1', 'alert-2'] } },
      }),
    );
  });

  it('marks all alerts as read with markAllRead', async () => {
    mockPrisma.alert.updateMany.mockResolvedValue({ count: 5 });

    const req = createRequest('http://localhost:22000/api/alerts', {
      method: 'PATCH',
      body: { markAllRead: true },
    });
    const res = await patchAlerts(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockPrisma.alert.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user_test123', isRead: false },
      }),
    );
  });

  it('returns 400 when neither alertIds nor markAllRead provided', async () => {
    const req = createRequest('http://localhost:22000/api/alerts', {
      method: 'PATCH',
      body: {},
    });
    const res = await patchAlerts(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 for empty alertIds array', async () => {
    const req = createRequest('http://localhost:22000/api/alerts', {
      method: 'PATCH',
      body: { alertIds: [] },
    });
    const res = await patchAlerts(req);

    expect(res.status).toBe(400);
  });
});

// =============================================================================
// Teams API
// =============================================================================

describe('GET /api/teams', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest('http://localhost:22000/api/teams');
    const res = await getTeams(req);
    expect(res.status).toBe(401);
  });

  it('returns owned and member teams', async () => {
    const ownedTeam = {
      id: 'team-1',
      name: 'My Team',
      ownerId: 'user_test123',
      createdAt: new Date(),
      members: [],
    };
    const membership = {
      id: 'mem-1',
      role: 'editor',
      status: 'accepted',
      team: {
        id: 'team-2',
        name: 'Other Team',
        ownerId: 'user_other',
        owner: { fullName: 'Other User', avatarUrl: null },
      },
    };

    mockPrisma.team.findMany.mockResolvedValue([ownedTeam]);
    mockPrisma.teamMember.findMany.mockResolvedValue([membership]);

    const req = createRequest('http://localhost:22000/api/teams');
    const res = await getTeams(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.owned).toHaveLength(1);
    expect(data.member).toHaveLength(1);
    expect(data.teams).toHaveLength(2);
  });

  it('returns empty arrays when user has no teams', async () => {
    mockPrisma.team.findMany.mockResolvedValue([]);
    mockPrisma.teamMember.findMany.mockResolvedValue([]);

    const req = createRequest('http://localhost:22000/api/teams');
    const res = await getTeams(req);
    const data = await res.json();

    expect(data.owned).toHaveLength(0);
    expect(data.member).toHaveLength(0);
    expect(data.teams).toHaveLength(0);
  });
});

describe('POST /api/teams', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest('http://localhost:22000/api/teams', {
      method: 'POST',
      body: { name: 'Team' },
    });
    const res = await createTeam(req);
    expect(res.status).toBe(401);
  });

  it('creates a team and returns 201', async () => {
    const newTeam = {
      id: 'team-new',
      name: 'New Team',
      ownerId: 'user_test123',
      description: null,
      defaultShareAccess: 'stream',
      autoShareNewProjects: false,
    };
    mockPrisma.team.create.mockResolvedValue(newTeam);

    const req = createRequest('http://localhost:22000/api/teams', {
      method: 'POST',
      body: { name: 'New Team' },
    });
    const res = await createTeam(req);
    const data = await res.json();

    expect(res.status).toBe(201);
    expect(data.team.name).toBe('New Team');
  });

  it('returns 400 when name is missing', async () => {
    const req = createRequest('http://localhost:22000/api/teams', {
      method: 'POST',
      body: {},
    });
    const res = await createTeam(req);

    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when name exceeds 100 characters', async () => {
    const req = createRequest('http://localhost:22000/api/teams', {
      method: 'POST',
      body: { name: 'x'.repeat(101) },
    });
    const res = await createTeam(req);

    expect(res.status).toBe(400);
  });

  it('returns 400 for invalid defaultShareAccess enum', async () => {
    const req = createRequest('http://localhost:22000/api/teams', {
      method: 'POST',
      body: { name: 'Team', defaultShareAccess: 'invalid' },
    });
    const res = await createTeam(req);

    expect(res.status).toBe(400);
  });

  it('accepts optional fields', async () => {
    mockPrisma.team.create.mockResolvedValue({
      id: 'team-full',
      name: 'Full Team',
      description: 'A team',
      defaultShareAccess: 'download',
      autoShareNewProjects: true,
    });

    const req = createRequest('http://localhost:22000/api/teams', {
      method: 'POST',
      body: {
        name: 'Full Team',
        description: 'A team',
        defaultShareAccess: 'download',
        autoShareNewProjects: true,
      },
    });
    const res = await createTeam(req);

    expect(res.status).toBe(201);
    expect(mockPrisma.team.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: 'Full Team',
          description: 'A team',
          defaultShareAccess: 'download',
          autoShareNewProjects: true,
        }),
      }),
    );
  });
});

// =============================================================================
// Jobs API
// =============================================================================

describe('GET /api/jobs/[id]', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest('http://localhost:22000/api/jobs/job-1');
    const res = await getJob(req, routeParams({ id: 'job-1' }));
    expect(res.status).toBe(401);
  });

  it('returns 404 when job does not exist', async () => {
    mockPrisma.job.findUnique.mockResolvedValue(null);

    const req = createRequest('http://localhost:22000/api/jobs/nonexistent');
    const res = await getJob(req, routeParams({ id: 'nonexistent' }));

    expect(res.status).toBe(404);
  });

  it('returns 403 when user does not own the project', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-1',
      status: 'processing',
      progress: { step: 'tts', percent: 50 },
      error: null,
      startedAt: new Date(),
      completedAt: null,
      createdAt: new Date(),
      projectId: 'proj-1',
      project: {
        id: 'proj-1',
        name: 'Other Project',
        userId: 'user_other',
        status: 'processing',
      },
    });

    const req = createRequest('http://localhost:22000/api/jobs/job-1');
    const res = await getJob(req, routeParams({ id: 'job-1' }));

    expect(res.status).toBe(403);
  });

  it('returns job status when user owns the project', async () => {
    const jobData = {
      id: 'job-1',
      status: 'completed',
      progress: { step: 'done', percent: 100 },
      error: null,
      startedAt: new Date('2026-02-01T10:00:00Z'),
      completedAt: new Date('2026-02-01T10:05:00Z'),
      createdAt: new Date('2026-02-01T09:59:00Z'),
      projectId: 'proj-1',
      project: {
        id: 'proj-1',
        name: 'My Project',
        userId: 'user_test123',
        status: 'ready',
      },
    };
    mockPrisma.job.findUnique.mockResolvedValue(jobData);

    const req = createRequest('http://localhost:22000/api/jobs/job-1');
    const res = await getJob(req, routeParams({ id: 'job-1' }));
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.id).toBe('job-1');
    expect(data.status).toBe('completed');
    expect(data.progress).toEqual({ step: 'done', percent: 100 });
    expect(data.project_id).toBe('proj-1');
    expect(data.project_status).toBe('ready');
  });

  it('returns default progress when progress is null', async () => {
    mockPrisma.job.findUnique.mockResolvedValue({
      id: 'job-2',
      status: 'queued',
      progress: null,
      error: null,
      startedAt: null,
      completedAt: null,
      createdAt: new Date(),
      projectId: 'proj-1',
      project: {
        id: 'proj-1',
        name: 'My Project',
        userId: 'user_test123',
        status: 'queued',
      },
    });

    const req = createRequest('http://localhost:22000/api/jobs/job-2');
    const res = await getJob(req, routeParams({ id: 'job-2' }));
    const data = await res.json();

    expect(data.progress).toEqual({ step: 'unknown', percent: 0 });
  });
});

// =============================================================================
// Stripe Portal API
// =============================================================================

describe('POST /api/stripe/portal', () => {
  it('returns 401 when not authenticated', async () => {
    mockAuth.mockResolvedValue({ userId: null });
    const req = createRequest('http://localhost:22000/api/stripe/portal', {
      method: 'POST',
    });
    const res = await createPortal(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when user has no stripeCustomerId', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({ stripeCustomerId: null });

    const req = createRequest('http://localhost:22000/api/stripe/portal', {
      method: 'POST',
    });
    const res = await createPortal(req);
    const data = await res.json();

    expect(res.status).toBe(400);
    expect(data.error).toBe('No subscription found');
  });

  it('returns 400 when profile does not exist', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue(null);

    const req = createRequest('http://localhost:22000/api/stripe/portal', {
      method: 'POST',
    });
    const res = await createPortal(req);

    expect(res.status).toBe(400);
  });

  it('returns portal URL on success', async () => {
    mockPrisma.profile.findUnique.mockResolvedValue({
      stripeCustomerId: 'cus_test123',
    });
    mockCreatePortalSession.mockResolvedValue({
      url: 'https://billing.stripe.com/session/test',
    });

    const req = createRequest('http://localhost:22000/api/stripe/portal', {
      method: 'POST',
    });
    const res = await createPortal(req);
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.url).toBe('https://billing.stripe.com/session/test');
    expect(mockCreatePortalSession).toHaveBeenCalledWith({
      customerId: 'cus_test123',
      returnUrl: 'http://localhost:22000/billing',
    });
  });
});

// =============================================================================
// Health API
// =============================================================================

describe('GET /api/health', () => {
  beforeEach(() => {
    // Set env vars for health checks
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_xxx';
    process.env.CLERK_SECRET_KEY = 'sk_test_xxx';
    process.env.ELEVENLABS_API_KEY = 'el_test_xxx';
    process.env.OPENAI_API_KEY = 'sk-test-xxx';
    process.env.ORCHESTRATOR_URL = 'http://localhost:22002';
    process.env.AUDIO_OUTPUT_DIR = '/tmp/audio';
  });

  it('returns 200 with health status (no auth required)', async () => {
    // Database check
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    // External service checks
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const res = await getHealth();
    const data = await res.json();

    expect(res.status).toBe(200);
    expect(data.status).toBeDefined();
    expect(data.timestamp).toBeDefined();
    expect(data.version).toBeDefined();
    expect(data.uptime).toBeGreaterThanOrEqual(0);
    expect(data.checks).toBeInstanceOf(Array);
    expect(data.checks.length).toBeGreaterThanOrEqual(3);
  });

  it('returns 503 when database is unhealthy', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    // Auth keys missing to make auth unhealthy too
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    delete process.env.CLERK_SECRET_KEY;

    // External checks succeed
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const res = await getHealth();
    const data = await res.json();

    // Database is a critical service, so overall should be unhealthy -> 503
    expect(res.status).toBe(503);
    expect(data.status).toBe('unhealthy');
  });

  it('includes all service checks in response', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockFetch.mockResolvedValue({ ok: true, status: 200 });

    const res = await getHealth();
    const data = await res.json();

    const checkNames = data.checks.map((c: { name: string }) => c.name);
    expect(checkNames).toContain('database');
    expect(checkNames).toContain('auth');
    expect(checkNames).toContain('storage');
    expect(checkNames).toContain('elevenlabs');
    expect(checkNames).toContain('openai');
    expect(checkNames).toContain('orchestrator');
  });
});
