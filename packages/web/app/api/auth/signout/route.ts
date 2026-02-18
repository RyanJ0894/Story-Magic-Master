import { NextResponse } from 'next/server';
import { withAuth } from '@/lib/api/middleware';
import { headers } from 'next/headers';

export const POST = withAuth(async () => {
  // Clerk handles session invalidation client-side.
  // This route redirects to the login page where Clerk's <SignIn /> takes over.
  const headersList = await headers();
  const origin =
    headersList.get('origin') ||
    headersList.get('referer')?.split('/').slice(0, 3).join('/') ||
    'https://story-magic-web.onrender.com';

  return NextResponse.redirect(new URL('/login', origin));
});
