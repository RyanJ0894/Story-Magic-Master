/**
 * Alert Preferences API Route
 *
 * GET  /api/alerts/preferences - Get user's alert preferences
 * PUT  /api/alerts/preferences - Update alert preferences (upsert)
 */

import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { log } from '@/lib/logger';

// =============================================================================
// Validation
// =============================================================================

const UpdatePreferencesSchema = z.object({
  emailTeamInvites: z.boolean().optional(),
  emailScriptShared: z.boolean().optional(),
  emailStatusChanges: z.boolean().optional(),
  emailComments: z.boolean().optional(),
  emailTeamChanges: z.boolean().optional(),
  emailGenerationComplete: z.boolean().optional(),
  inappAll: z.boolean().optional(),
  emailDigestFrequency: z.enum(['instant', 'daily', 'weekly', 'never']).optional(),
});

// =============================================================================
// GET - Fetch alert preferences
// =============================================================================

export const GET = withAuth(async (_request, { userId, prisma }) => {
  try {
    // Find existing preferences or return defaults
    let preferences = await prisma.alertPreference.findUnique({
      where: { userId },
    });

    if (!preferences) {
      // Return default preferences without persisting
      preferences = {
        id: null,
        userId,
        emailTeamInvites: true,
        emailScriptShared: true,
        emailStatusChanges: true,
        emailComments: true,
        emailTeamChanges: true,
        emailGenerationComplete: false,
        inappAll: true,
        emailDigestFrequency: 'instant',
        createdAt: null,
        updatedAt: null,
      };
    }

    return NextResponse.json({ data: preferences });
  } catch (error) {
    log.error('[AlertPreferences] Error fetching', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch alert preferences',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});

// =============================================================================
// PUT - Update alert preferences (upsert)
// =============================================================================

export const PUT = withAuth(async (request, { userId, prisma }) => {
  const parsed = await parseBody(request, UpdatePreferencesSchema);
  if ('error' in parsed) return parsed.error;
  const updates = parsed.data;

  // Require at least one field to update
  if (Object.keys(updates).length === 0) {
    return NextResponse.json(
      {
        error: 'At least one preference field must be provided',
        code: 'VALIDATION_ERROR',
      },
      { status: 400 },
    );
  }

  try {
    const preferences = await prisma.alertPreference.upsert({
      where: { userId },
      create: {
        userId,
        ...updates,
      },
      update: updates,
    });

    return NextResponse.json({ data: preferences });
  } catch (error) {
    log.error('[AlertPreferences] Error updating', error);
    return NextResponse.json(
      {
        error: 'Failed to update alert preferences',
        code: 'UPDATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
});
