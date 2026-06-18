export const dynamic = 'force-dynamic';

import { SignUp } from '@clerk/nextjs';
import { Sparkles } from 'lucide-react';

export default async function SignupPage({
  searchParams,
}: {
  // #322 (2026-06-17): previously hardcoded `fallbackRedirectUrl="/dashboard"`
  // which silently dropped the invite flow's `?redirect_url=/invite/<token>`.
  // New users invited to a team would sign up, get sent to /dashboard, and
  // never accept the invite — Ryan's "team invite goes to dashboard not
  // login setup" report. Now honors both `redirect_url` (Clerk convention)
  // and `redirect` (our older convention) with safety-validated relative
  // paths only, to avoid open-redirect attacks.
  searchParams: Promise<{ redirect?: string; redirect_url?: string }>;
}) {
  const params = await searchParams;
  const raw = params.redirect_url ?? params.redirect ?? '';
  const rawRedirect = raw ? decodeURIComponent(raw) : '';
  // `!startsWith('//')` blocks protocol-relative URLs like //evil.com which
  // would otherwise pass the bare leading-slash check (open-redirect).
  const isSafeRelative =
    rawRedirect.startsWith('/') && !rawRedirect.startsWith('//');
  const fallbackUrl = isSafeRelative ? rawRedirect : '/dashboard';

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-muted px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl brand-gradient-br mb-4">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">
          Story Magic
        </h1>
      </div>
      <SignUp
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl',
          },
        }}
        fallbackRedirectUrl={fallbackUrl}
      />
    </div>
  );
}
