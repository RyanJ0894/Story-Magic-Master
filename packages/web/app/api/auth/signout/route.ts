import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { headers } from 'next/headers';

export async function POST() {
  const supabase = await createClient();
  await supabase.auth.signOut();

  // Get origin from request headers for proper redirect
  const headersList = await headers();
  const origin = headersList.get('origin') || headersList.get('referer')?.split('/').slice(0, 3).join('/') || process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

  return NextResponse.redirect(new URL('/login', origin));
}
