import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { verifyPassword, isBcryptHash, hashPassword } from '@/lib/password';
import { VerifySharePasswordRequestSchema } from '@/lib/api/dto';
import { rateLimit, getClientIp } from '@/lib/api/rate-limit';

interface RouteParams {
  params: Promise<{ code: string }>;
}

// GET /api/shares/access/[code] - Access a shared script by code
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { code } = await params;

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
    return NextResponse.json({ error: 'Share not found or expired' }, { status: 404 });
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
  }

  // Check max plays
  if (share.maxPlays && share.playCount >= share.maxPlays) {
    return NextResponse.json({ error: 'This share link has reached its play limit' }, { status: 410 });
  }

  // Check if password protected
  if (share.passwordHash) {
    return NextResponse.json({
      requiresPassword: true,
      projectName: share.project?.name,
      writerName: share.project?.user?.fullName,
    });
  }

  // Check writer subscription status
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId: share.project?.userId,
      status: { in: ['active', 'trialing'] },
    },
    select: { id: true },
  });

  if (!subscription) {
    return NextResponse.json(
      { error: 'This content is temporarily unavailable (writer subscription inactive)' },
      { status: 403 }
    );
  }

  // Increment view count
  await prisma.scriptShare.update({
    where: { id: share.id },
    data: {
      viewCount: (share.viewCount || 0) + 1,
      lastAccessedAt: new Date(),
    },
  });

  // Get current user if logged in
  const { userId } = await auth();

  // If logged in, add to reader's library
  if (userId) {
    // Check if already in library
    const existingEntry = await prisma.readerLibrary.findFirst({
      where: {
        readerId: userId,
        projectId: share.projectId,
      },
      select: { id: true },
    });

    if (!existingEntry) {
      try {
        await prisma.readerLibrary.create({
          data: {
            readerId: userId,
            projectId: share.projectId,
            source: 'received',
            shareId: share.id,
            status: 'active',
          },
        });
      } catch {
        // Ignore unique constraint violations
      }
    }
  }

  // Get audio output for streaming
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
      url: audioOutput.filePath,
      duration: audioOutput.durationSeconds,
    } : null,
    canDownload: share.accessLevel === 'download',
  });
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
    return NextResponse.json(
      { error: 'Invalid request', details: parseResult.error.flatten().fieldErrors },
      { status: 400 }
    );
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
    return NextResponse.json({ error: 'Share not found' }, { status: 404 });
  }

  // Verify password (supports both bcrypt and legacy SHA-256 hashes)
  if (!share.passwordHash) {
    // No password set - this shouldn't happen as we only get here for protected shares
    return NextResponse.json({ error: 'Share configuration error' }, { status: 500 });
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
    return NextResponse.json({ error: 'Incorrect password' }, { status: 401 });
  }

  // Same checks as GET
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    return NextResponse.json({ error: 'This share link has expired' }, { status: 410 });
  }

  if (share.maxPlays && share.playCount >= share.maxPlays) {
    return NextResponse.json({ error: 'This share link has reached its play limit' }, { status: 410 });
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
    return NextResponse.json(
      { error: 'This content is temporarily unavailable' },
      { status: 403 }
    );
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
      url: audioOutput.filePath,
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
