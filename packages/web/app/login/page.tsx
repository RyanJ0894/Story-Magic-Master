export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import ClerkSignIn from './clerk-sign-in';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  const params = await searchParams;
  // Only accept relative redirects to prevent open-redirect attacks.
  const rawRedirect = params.redirect ? decodeURIComponent(params.redirect) : '';
  const fallbackUrl = rawRedirect.startsWith('/') ? rawRedirect : '/dashboard';

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
