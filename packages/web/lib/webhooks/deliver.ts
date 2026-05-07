import { createHmac } from 'crypto';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';

export type WebhookEvent = 'job.completed' | 'job.failed';

interface WebhookPayload {
  event: WebhookEvent;
  jobId: string;
  projectId: string;
  userId: string;
  timestamp: string;
  data: Record<string, unknown>;
}

function sign(secret: string, body: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

async function fireOne(url: string, secret: string, payload: WebhookPayload): Promise<void> {
  const body = JSON.stringify(payload);
  const signature = sign(secret, body);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-StoryMagic-Signature': `sha256=${signature}`,
        'X-StoryMagic-Event': payload.event,
      },
      body,
      signal: controller.signal,
    });

    if (!res.ok) {
      log.warn('[Webhooks] Delivery non-2xx', { url, status: res.status, event: payload.event });
    }
  } catch (err) {
    log.warn('[Webhooks] Delivery failed', { url, event: payload.event, error: err instanceof Error ? err.message : String(err) });
  } finally {
    clearTimeout(timeout);
  }
}

export async function dispatchWebhooks(
  event: WebhookEvent,
  userId: string,
  jobId: string,
  projectId: string,
  data: Record<string, unknown> = {}
): Promise<void> {
  const endpoints = await prisma.webhookEndpoint.findMany({
    where: { userId, events: { has: event } },
    select: { url: true, secret: true },
  });

  if (endpoints.length === 0) return;

  const payload: WebhookPayload = {
    event,
    jobId,
    projectId,
    userId,
    timestamp: new Date().toISOString(),
    data,
  };

  // Fire all webhooks concurrently; failures are logged but never throw
  await Promise.allSettled(endpoints.map((ep) => fireOne(ep.url, ep.secret, payload)));
}
