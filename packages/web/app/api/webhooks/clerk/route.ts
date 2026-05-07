import { NextResponse } from 'next/server';
import { Webhook } from 'svix';
import { headers } from 'next/headers';
import { prisma } from '@/lib/db';
import { log } from '@/lib/logger';
import { errorResponse } from '@/lib/api/error-response';

interface ClerkWebhookEvent {
  type: string;
  data: {
    id: string;
    email_addresses?: Array<{ email_address: string }>;
    first_name?: string | null;
    last_name?: string | null;
    image_url?: string | null;
  };
}

export async function POST(request: Request) {
  const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;

  if (!WEBHOOK_SECRET) {
    log.error('CLERK_WEBHOOK_SECRET not configured');
    return errorResponse('Webhook secret not configured', 500, { code: 'CONFIG_ERROR' });
  }

  // Verify the webhook signature
  const headerPayload = await headers();
  const svixId = headerPayload.get('svix-id');
  const svixTimestamp = headerPayload.get('svix-timestamp');
  const svixSignature = headerPayload.get('svix-signature');

  if (!svixId || !svixTimestamp || !svixSignature) {
    return errorResponse('Missing svix headers', 400, { code: 'MISSING_HEADERS' });
  }

  const payload = await request.text();

  const wh = new Webhook(WEBHOOK_SECRET);
  let event: ClerkWebhookEvent;

  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (error) {
    log.error('Webhook verification failed', error);
    return errorResponse('Invalid signature', 400, { code: 'INVALID_SIGNATURE' });
  }

  // Handle events
  switch (event.type) {
    case 'user.created': {
      const { id, email_addresses, first_name, last_name, image_url } = event.data;
      const email = email_addresses?.[0]?.email_address;
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || email;

      const SIGNUP_BONUS_CREDITS = 3;

      await prisma.profile.create({
        data: {
          id,
          email: email ?? null,
          fullName: fullName ?? null,
          avatarUrl: image_url ?? null,
          credits: SIGNUP_BONUS_CREDITS,
        },
      });

      await prisma.creditTransaction.create({
        data: {
          profileId: id,
          amount: SIGNUP_BONUS_CREDITS,
          reason: 'signup_bonus',
        },
      });
      break;
    }

    case 'user.updated': {
      const { id, email_addresses, first_name, last_name, image_url } = event.data;
      const email = email_addresses?.[0]?.email_address;
      const fullName = [first_name, last_name].filter(Boolean).join(' ') || undefined;

      await prisma.profile.update({
        where: { id },
        data: {
          ...(email !== undefined && { email }),
          ...(fullName !== undefined && { fullName }),
          ...(image_url !== undefined && { avatarUrl: image_url }),
        },
      });
      break;
    }

    case 'user.deleted': {
      const { id } = event.data;
      // Cascade delete handles related records (projects, jobs, etc.)
      await prisma.profile.delete({
        where: { id },
      }).catch(() => {
        // Profile may already be deleted
      });
      break;
    }

    default:
      // Ignore unhandled event types
      break;
  }

  return NextResponse.json({ received: true });
}
