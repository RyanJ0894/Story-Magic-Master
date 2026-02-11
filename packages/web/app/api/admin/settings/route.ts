import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { validateCsrf } from '@/lib/csrf';

// Validation schema for PUT body
const UpdateSettingsSchema = z.object({
  settings: z.record(z.string(), z.any()).refine(
    (val) => Object.keys(val).length > 0,
    { message: 'settings must contain at least one key' }
  ),
});

/**
 * GET /api/admin/settings
 * Fetch all platform settings from the platform_settings table.
 * Returns { settings: Record<string, any> } keyed by the `key` column.
 */
export async function GET(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const rows = await prisma.platformSetting.findMany({
      select: { key: true, value: true, updatedBy: true, updatedAt: true },
    });

    // Transform rows into a keyed record
    const settings: Record<string, unknown> = {};
    for (const row of rows) {
      settings[row.key] = row.value;
    }

    return NextResponse.json({ settings });
  } catch (error) {
    console.error('Error fetching platform settings:', error);
    return NextResponse.json({ error: 'Failed to fetch platform settings' }, { status: 500 });
  }
}

/**
 * PUT /api/admin/settings
 * Bulk upsert platform settings.
 * Accepts { settings: Record<string, any> } in body.
 * Each key/value pair is upserted into platform_settings with updated_by and updated_at.
 */
export async function PUT(request: Request) {
  // CSRF validation
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Parse request body
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  // Validate with Zod
  const parseResult = UpdateSettingsSchema.safeParse(body);
  if (!parseResult.success) {
    return NextResponse.json({
      error: 'Invalid request body',
      details: parseResult.error.format(),
    }, { status: 400 });
  }

  const { settings } = parseResult.data;
  const now = new Date().toISOString();

  try {
    // Upsert each key/value pair in a transaction
    await prisma.$transaction(
      Object.entries(settings).map(([key, value]) =>
        prisma.platformSetting.upsert({
          where: { key },
          create: {
            key,
            value,
            updatedBy: userId,
          },
          update: {
            value,
            updatedBy: userId,
          },
        })
      )
    );

    // Return the saved settings
    return NextResponse.json({ settings, updated_at: now });
  } catch (error) {
    console.error('Error saving platform settings:', error);
    return NextResponse.json({ error: 'Failed to save platform settings' }, { status: 500 });
  }
}
