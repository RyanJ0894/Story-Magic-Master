export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import ClerkSignIn from '../clerk-sign-in';

export default async function LoginPage({
  searchParams,
}: {
  // #322 (2026-06-17): the invite page passes `?redirect_url=...` (Clerk's
  // own convention), but earlier code paths used `?redirect=`. Accept BOTH
  // so existing links continue working. `redirect_url` wins if both present.
  searchParams: Promise<{ redirect?: string; redirect_url?: string }>;
}) {
  const params = await searchParams;
  // Only accept relative redirects to prevent open-redirect attacks. The
  // `!startsWith('//')` guard blocks protocol-relative URLs like //evil.com
  // which would otherwise pass the leading-slash check.
  const raw = params.redirect_url ?? params.redirect ?? '';
  const rawRedirect = raw ? decodeURIComponent(raw) : '';
  const isSafeRelative =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//');
  const fallbackUrl = isSafeRelative ? rawRedirect : '/dashboard';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-muted px-4">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-4">
          <Image src="/logo.png" alt="Story Magic" width={160} height={160} className="rounded-xl mx-auto" />
        </Link>
      </div>
      <ClerkSignIn fallbackRedirectUrl={fallbackUrl} />
    </div>
  );
}
