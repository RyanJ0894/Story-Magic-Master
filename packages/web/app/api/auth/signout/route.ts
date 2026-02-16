import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';

export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL('/login', 'https://story-magic-web.onrender.com'));
  }

  // Clerk handles session invalidation client-side.
  // This route redirects to the login page where Clerk's <SignIn /> takes over.
  const headersList = await headers();
  const origin =
    headersList.get('origin') ||
    headersList.get('referer')?.split('/').slice(0, 3).join('/') ||
    'https://story-magic-web.onrender.com';

  return NextResponse.redirect(new URL('/login', origin));
}
