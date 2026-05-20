import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, isBcryptHash, hashPassword } from '@/lib/password';
import { VerifySharePasswordRequestSchema } from '@/lib/api/dto';
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';
import { errorResponse } from '@/lib/api/error-response';
import { accessShare, ShareServiceError } from '@/lib/services/shares';
import { resolveAudioUrl } from '@/lib/resolve-audio-url';

interface RouteParams {
  params: Promise<{ code: string }>;
}

// GET /api/shares/access/[code] - Access a shared script by code
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;

  // Rate limit: loose (60/min) per IP to prevent enumeration/abuse on this public endpoint (TD-063)
  const ip = getClientIp(request);
  const limited = await rateLimit(`share-access:${ip}`, 'loose');
  if (limited) return limited;

  // Get current user if logged in
  const { userId } = await auth();

  try {
    const result = await accessShare(prisma, code, userId);

    // Handle password-protected shares
    if (result.requiresPassword) {
      return NextResponse.json({
        requiresPassword: true,
        projectName: result.projectName,
        writerName: result.writerName,
      });
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ShareServiceError) {
      return errorResponse(error.message, error.statusCode, { code: error.code });
    }
    return errorResponse('Internal server error', 500);
  }
}

// POST /api/shares/access/[code] - Verify password for protected share
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;

  // Rate limit: strict (5/min) per IP+code to prevent brute-force password guessing
  const ip = getClientIp(request);
  const limited = await rateLimit(`share-pw:${code}:${ip}`, 'strict');
  if (limited) return limited;

  // Parse and validate request body
  const body = await request.json();
  const parseResult = VerifySharePasswordRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return errorResponse('Invalid request', 400, {
      code: 'VALIDATION_ERROR',
      details: parseResult.error.flatten().fieldErrors,
    });
  }

  const { password } = parseResult.data;

  // Get share by code
  const share = await prisma.scriptShare.findFirst({
    where: {
      shareCode: code,
      isActive: true,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          pageCount: true,
          userId: true,
          user: {
            select: {
              fullName: true,
              writerCode: true,
            },
          },
        },
      },
    },
  });

  if (!share) {
    return errorResponse('Share not found', 404, { code: 'NOT_FOUND' });
  }

  // Verify password (supports both bcrypt and legacy SHA-256 hashes)
  if (!share.passwordHash) {
    // No password set - this shouldn't happen as we only get here for protected shares
    return errorResponse('Share configuration error', 500, { code: 'CONFIG_ERROR' });
  }

  let isValid = false;
  if (isBcryptHash(share.passwordHash)) {
    isValid = await verifyPassword(password, share.passwordHash);
  } else {
    // Legacy SHA-256 hash - migrate to bcrypt on successful verification
    const legacyHash = await legacyHashPassword(password);
    isValid = legacyHash === share.passwordHash;
    if (isValid) {
      // Migrate to bcrypt
      const bcryptHash = await hashPassword(password);
      await prisma.scriptShare.update({
        where: { id: share.id },
        data: { passwordHash: bcryptHash },
      });
    }
  }
  if (!isValid) {
    return errorResponse('Incorrect password', 401, { code: 'INVALID_PASSWORD' });
  }

  // Same checks as GET
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return errorResponse('This share link has expired', 410, { code: 'EXPIRED' });
  }

  if (share.maxPlays && share.playCount >= share.maxPlays) {
    return errorResponse('This share link has reached its play limit', 410, { code: 'PLAY_LIMIT_REACHED' });
  }

  // Check writer subscription
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: share.project?.userId,
      status: { in: ['active', 'trialing'] },
    },
    select: { id: true },
  });

  if (!subscription) {
    return errorResponse('This content is temporarily unavailable', 403, { code: 'SUBSCRIPTION_INACTIVE' });
  }

  // Increment view count
  await prisma.scriptShare.update({
    where: { id: share.id },
    data: {
      viewCount: (share.viewCount || 0) + 1,
      lastAccessedAt: new Date(),
    },
  });

  // Get audio output
  const audioOutput = await prisma.audioOutput.findFirst({
    where: { projectId: share.projectId },
    select: { id: true, filePath: true, durationSeconds: true },
    orderBy: { createdAt: 'desc' },
  });

  return NextResponse.json({
    share: {
      id: share.id,
      accessLevel: share.accessLevel,
      expiresAt: share.expiresAt,
    },
    project: {
      id: share.project?.id,
      name: share.project?.name,
      pageCount: share.project?.pageCount,
    },
    writer: {
      name: share.project?.user?.fullName ?? '',
      code: share.project?.user?.writerCode ?? '',
    },
    audio: audioOutput ? {
      url: resolveAudioUrl(audioOutput.filePath),
      duration: audioOutput.durationSeconds,
    } : null,
    canDownload: share.accessLevel === 'download',
  });
}

// Legacy SHA-256 hashing (for backward compatibility only)
async function legacyHashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}
