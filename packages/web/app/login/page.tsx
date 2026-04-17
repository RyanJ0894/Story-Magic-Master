export const dynamic = 'force-dynamic';

import Image from 'next/image';
import Link from 'next/link';
import { SignIn } from '@clerk/nextjs';

export default function LoginPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-muted px-4">
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-4">
          <Image src="/logo.png" alt="Story Magic" width={80} height={80} className="rounded-xl mx-auto" />
        </Link>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'mx-auto',
            card: 'shadow-xl',
          },
        }}
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
