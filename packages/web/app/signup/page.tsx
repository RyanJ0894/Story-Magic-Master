export const dynamic = 'force-dynamic';

import { SignUp } from '@clerk/nextjs';
import { Sparkles } from 'lucide-react';

export default function SignupPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted dark:from-background dark:to-muted px-4">
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 mb-4">
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
        fallbackRedirectUrl="/dashboard"
      />
    </div>
  );
}
