/**
 * Corpus Embedding Population Route (Admin)
 *
 * POST /api/admin/corpus/populate - Generate embeddings for scripts without them
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { populateMissingEmbeddings } from '@/lib/comparable/service';

// =============================================================================
// POST - Populate Missing Embeddings
// =============================================================================

export async function POST() {
  const supabase = await createClient();

  // Check authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Check if user is admin (by email domain or specific user list)
  const adminEmails = process.env.ADMIN_EMAILS?.split(',') || [];
  const isAdmin = adminEmails.includes(user.email || '');

  if (!isAdmin) {
    return NextResponse.json(
      { error: 'Admin access required', code: 'FORBIDDEN' },
      { status: 403 }
    );
  }

  try {
    const updatedCount = await populateMissingEmbeddings();

    return NextResponse.json({
      success: true,
      updated: updatedCount,
      message: `Generated embeddings for ${updatedCount} scripts`,
    });
  } catch (error) {
    console.error('[Admin] Populate embeddings error:', error);
    return NextResponse.json(
      {
        error: 'Failed to populate embeddings',
        code: 'POPULATE_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
