import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { headers } from 'next/headers';
import { validateCsrf } from '@/lib/csrf';

export async function POST(request: Request) {
  const csrfError = validateCsrf(request);
  if (csrfError) {
    return NextResponse.json({ error: 'CSRF validation failed' }, { status: 403 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  // Clerk handles session invalidation client-side via <SignOutButton> or useClerk().signOut()
  // This route exists for backward compatibility — redirect to Clerk's sign-out
  const headersList = await headers();
  const origin = headersList.get('origin') || headersList.get('referer')?.split('/').slice(0, 3).join('/') || 'http://localhost:22000';

  return NextResponse.redirect(new URL('/login', origin));
}
