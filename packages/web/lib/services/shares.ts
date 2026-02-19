/**
 * Shares Service
 *
 * Pure business logic for script sharing operations.
 * No HTTP request/response handling — routes call these functions
 * and translate results into HTTP responses.
 */

import type { PrismaClient } from '@prisma/client';
import { nanoid } from 'nanoid';
import { hashPassword } from '@/lib/password';

// =============================================================================
// Types
// =============================================================================

export interface CreateShareInput {
  projectId: string;
  accessLevel: string;
  expiresAt?: string;
  recipientEmail?: string | null;
  recipientName?: string | null;
  maxPlays?: number | null;
  password?: string | null;
}

export interface UpdateShareInput {
  accessLevel?: string;
  expiresAt?: string | null;
  isActive?: boolean;
  recipientEmail?: string | null;
  recipientName?: string | null;
  maxPlays?: number | null;
  password?: string | null;
}

export class ShareServiceError extends Error {
  constructor(
    message: string,
    public code: string,
    public statusCode: number,
  ) {
    super(message);
    this.name = 'ShareServiceError';
  }
}

// =============================================================================
// List shares by user
// =============================================================================

export async function getSharesByUser(
  prisma: PrismaClient,
  userId: string,
  projectId?: string | null,
) {
  const where: Record<string, unknown> = { sharedBy: userId };
  if (projectId) {
    where.projectId = projectId;
  }

  return prisma.scriptShare.findMany({
    where,
    include: {
      project: {
        select: {
          id: true,
          name: true,
          pageCount: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
  });
}

// =============================================================================
// Create share
// =============================================================================

export async function createShare(
  prisma: PrismaClient,
  userId: string,
  input: CreateShareInput,
) {
  // Verify user owns this project
  const project = await prisma.project.findFirst({
    where: { id: input.projectId },
    select: { id: true, name: true, userId: true },
  });

  if (!project) {
    throw new ShareServiceError('Project not found', 'NOT_FOUND', 404);
  }

  if (project.userId !== userId) {
    throw new ShareServiceError('Not authorized to share this project', 'FORBIDDEN', 403);
  }

  // Check subscription status
  const subscription = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: ['active', 'trialing'] },
    },
  });

  if (!subscription) {
    throw new ShareServiceError(
      'Active subscription required to share scripts',
      'SUBSCRIPTION_REQUIRED',
      403,
    );
  }

  // Generate share code
  const shareCode = nanoid(10);

  const share = await prisma.scriptShare.create({
    data: {
      projectId: input.projectId,
      sharedBy: userId,
      shareCode,
      accessLevel: input.accessLevel,
      expiresAt: input.expiresAt ? new Date(input.expiresAt) : null,
      recipientEmail: input.recipientEmail ?? null,
      recipientName: input.recipientName ?? null,
      maxPlays: input.maxPlays ?? null,
      passwordHash: input.password ? await hashPassword(input.password) : null,
      isActive: true,
    },
  });

  const shareUrl = `${process.env.NEXT_PUBLIC_APP_URL}/s/${shareCode}`;

  return { share, shareUrl, shareCode };
}

// =============================================================================
// Get single share (with ownership check)
// =============================================================================

export async function getShare(
  prisma: PrismaClient,
  shareId: string,
  userId: string,
) {
  return prisma.scriptShare.findFirst({
    where: {
      id: shareId,
      sharedBy: userId,
    },
    include: {
      project: {
        select: {
          id: true,
          name: true,
          pageCount: true,
        },
      },
    },
  });
}

// =============================================================================
// Update share
// =============================================================================

export async function updateShare(
  prisma: PrismaClient,
  shareId: string,
  input: UpdateShareInput,
) {
  const updates: Record<string, unknown> = {};

  if (input.accessLevel !== undefined) updates.accessLevel = input.accessLevel;
  if (input.expiresAt !== undefined) updates.expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
  if (input.isActive !== undefined) updates.isActive = input.isActive;
  if (input.recipientEmail !== undefined) updates.recipientEmail = input.recipientEmail;
  if (input.recipientName !== undefined) updates.recipientName = input.recipientName;
  if (input.maxPlays !== undefined) updates.maxPlays = input.maxPlays;
  if (input.password !== undefined) {
    updates.passwordHash = input.password ? await hashPassword(input.password) : null;
  }

  return prisma.scriptShare.update({
    where: { id: shareId },
    data: updates,
  });
}

// =============================================================================
// Revoke share (soft delete)
// =============================================================================

export async function revokeShare(prisma: PrismaClient, shareId: string) {
  return prisma.scriptShare.update({
    where: { id: shareId },
    data: { isActive: false },
  });
}

// =============================================================================
// Access share by code (public)
// =============================================================================

export interface ShareAccessResult {
  share: {
    id: string;
    accessLevel: string;
    expiresAt: Date | null;
  };
  project: {
    id: string | undefined;
    name: string | undefined;
    pageCount: number | undefined;
  };
  writer: {
    name: string;
    code: string;
  };
  audio: {
    url: string | null;
    duration: number | null;
  } | null;
  canDownload: boolean;
  /** Set when the share requires a password before content is revealed. */
  requiresPassword?: boolean;
  projectName?: string;
  writerName?: string;
}

/**
 * Look up a share by its public code, validate expiration / play-limits,
 * increment the view counter, optionally add to reader library, and return
 * the data needed to render the share access page.
 *
 * Throws ShareServiceError on validation failures.
 */
export async function accessShare(
  prisma: PrismaClient,
  code: string,
  currentUserId?: string | null,
): Promise<ShareAccessResult> {
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
    throw new ShareServiceError('Share not found or expired', 'NOT_FOUND', 404);
  }

  // Check expiration
  if (share.expiresAt && new Date(share.expiresAt) < new Date()) {
    throw new ShareServiceError('This share link has expired', 'EXPIRED', 410);
  }

  // Check max plays
  if (share.maxPlays && share.playCount >= share.maxPlays) {
    throw new ShareServiceError('This share link has reached its play limit', 'PLAY_LIMIT_REACHED', 410);
  }

  // If password protected, return early
  if (share.passwordHash) {
    return {
      requiresPassword: true,
      projectName: share.project?.name,
      writerName: share.project?.user?.fullName ?? undefined,
    } as ShareAccessResult;
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
    throw new ShareServiceError(
      'This content is temporarily unavailable (writer subscription inactive)',
      'SUBSCRIPTION_INACTIVE',
      403,
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

  // If logged in, add to reader's library
  if (currentUserId) {
    const existingEntry = await prisma.readerLibrary.findFirst({
      where: {
        readerId: currentUserId,
        projectId: share.projectId,
      },
      select: { id: true },
    });

    if (!existingEntry) {
      try {
        await prisma.readerLibrary.create({
          data: {
            readerId: currentUserId,
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

  // Get audio output
  const audioOutput = await prisma.audioOutput.findFirst({
    where: { projectId: share.projectId },
    select: { id: true, filePath: true, durationSeconds: true },
    orderBy: { createdAt: 'desc' },
  });

  return {
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
    audio: audioOutput
      ? { url: audioOutput.filePath, duration: audioOutput.durationSeconds ? Number(audioOutput.durationSeconds) : null }
      : null,
    canDownload: share.accessLevel === 'download',
  };
}
