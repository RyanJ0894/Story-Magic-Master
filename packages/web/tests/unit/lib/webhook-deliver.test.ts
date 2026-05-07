import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const mockPrisma = {
  webhookEndpoint: { findMany: vi.fn() },
};
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }));
vi.mock('@/lib/logger', () => ({ log: { warn: vi.fn(), info: vi.fn(), error: vi.fn() } }));

const { dispatchWebhooks } = await import('@/lib/webhooks/deliver');

describe('dispatchWebhooks', () => {
  beforeEach(() => vi.clearAllMocks());

  it('does nothing when no endpoints are registered', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([]);
    await dispatchWebhooks('job.completed', 'user-1', 'job-1', 'proj-1');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('fires POST to each registered endpoint', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      { url: 'https://example.com/hook', secret: 'test_secret' },
    ]);
    mockFetch.mockResolvedValue({ ok: true });

    await dispatchWebhooks('job.completed', 'user-1', 'job-1', 'proj-1', { audioUrl: 'https://cdn.example.com/output.mp3' });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, opts] = mockFetch.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://example.com/hook');
    expect(opts.method).toBe('POST');

    const headers = opts.headers as Record<string, string>;
    expect(headers['X-StoryMagic-Event']).toBe('job.completed');
    expect(headers['X-StoryMagic-Signature']).toMatch(/^sha256=/);
  });

  it('includes correct event type in payload', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      { url: 'https://example.com/hook', secret: 'secret' },
    ]);
    mockFetch.mockResolvedValue({ ok: true });

    await dispatchWebhooks('job.failed', 'user-1', 'job-1', 'proj-1', { error: 'OOM' });

    const opts = mockFetch.mock.calls[0][1] as RequestInit;
    const payload = JSON.parse(opts.body as string);
    expect(payload.event).toBe('job.failed');
    expect(payload.data.error).toBe('OOM');
  });

  it('does not throw when delivery fails', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      { url: 'https://example.com/hook', secret: 'secret' },
    ]);
    mockFetch.mockRejectedValue(new Error('Network error'));

    await expect(
      dispatchWebhooks('job.completed', 'user-1', 'job-1', 'proj-1')
    ).resolves.toBeUndefined();
  });

  it('fires to multiple endpoints in parallel', async () => {
    mockPrisma.webhookEndpoint.findMany.mockResolvedValue([
      { url: 'https://a.example.com/hook', secret: 's1' },
      { url: 'https://b.example.com/hook', secret: 's2' },
    ]);
    mockFetch.mockResolvedValue({ ok: true });

    await dispatchWebhooks('job.completed', 'user-1', 'job-1', 'proj-1');
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
