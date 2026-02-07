import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profile?.user_type !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // Fetch all platform settings
  const { data: rows, error } = await supabase
    .from('platform_settings')
    .select('key, value, updated_by, updated_at');

  if (error) {
    // Handle table not existing
    if (error.code === '42P01') {
      return NextResponse.json({
        error: 'Platform settings table not configured',
        message: 'Please run the platform_settings migration in Supabase',
      }, { status: 503 });
    }
    console.error('Error fetching platform settings:', error);
    return NextResponse.json({ error: 'Failed to fetch platform settings' }, { status: 500 });
  }

  // Transform rows into a keyed record
  const settings: Record<string, any> = {};
  for (const row of rows ?? []) {
    settings[row.key] = row.value;
  }

  return NextResponse.json({ settings });
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

  const supabase = await createClient();

  // Verify user is authenticated
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is admin
  const { data: profile } = await supabase
    .from('profiles')
    .select('user_type')
    .eq('id', user.id)
    .single();

  if (profile?.user_type !== 'admin') {
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

  // Upsert each key/value pair
  const upsertRows = Object.entries(settings).map(([key, value]) => ({
    key,
    value,
    updated_by: user.id,
    updated_at: now,
  }));

  const { error } = await supabase
    .from('platform_settings')
    .upsert(upsertRows, { onConflict: 'key' });

  if (error) {
    // Handle table not existing
    if (error.code === '42P01') {
      return NextResponse.json({
        error: 'Platform settings table not configured',
        message: 'Please run the platform_settings migration in Supabase',
      }, { status: 503 });
    }
    console.error('Error saving platform settings:', error);
    return NextResponse.json({ error: 'Failed to save platform settings' }, { status: 500 });
  }

  // Return the saved settings
  return NextResponse.json({ settings, updated_at: now });
}
