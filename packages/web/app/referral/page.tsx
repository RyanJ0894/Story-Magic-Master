'use client';

import { useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { CheckCircle, Tag } from 'lucide-react';

const TIER_DISPLAY: Record<string, { name: string; pages: string }> = {
  creator:    { name: 'Starter',             pages: '5 scripts/month' },
  pro:        { name: 'Pro',                 pages: '15 scripts/month' },
  studio:     { name: 'Creator',             pages: '25 scripts/month' },
  enterprise: { name: 'Enterprise Unlimited', pages: 'Unlimited' },
};

function ReferralForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const planHint = searchParams.get('plan') || '';

  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ tierName: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const res = await fetch('/api/referral/upgrade', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    });

    const data = await res.json() as { error?: string; tierName?: string };
    setLoading(false);

    if (!res.ok) {
      setError(data.error || 'Something went wrong');
      return;
    }

    setSuccess({ tierName: data.tierName! });
    setTimeout(() => router.push('/dashboard'), 2000);
  };

  if (success) {
    return (
      <div className="text-center space-y-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30">
          <CheckCircle className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Plan Activated!</h2>
        <p className="text-muted-foreground">
          Your account has been upgraded to <strong>{success.tierName}</strong>.
        </p>
        <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
      </div>
    );
  }

  return (
    <>
      <div className="text-center mb-8">
        <Link href="/" className="inline-block mb-6">
          <Image src="/logo.png" alt="Story Magic" width={120} height={120} className="rounded-xl mx-auto" />
        </Link>
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
          <Tag className="w-5 h-5 text-violet-600 dark:text-violet-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-foreground">Enter Referral Code</h1>
        {planHint && TIER_DISPLAY[planHint] && (
          <p className="mt-2 text-sm text-muted-foreground">
            Upgrading to <strong>{TIER_DISPLAY[planHint].name}</strong> ({TIER_DISPLAY[planHint].pages})
          </p>
        )}
        {!planHint && (
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your referral code to unlock a plan upgrade.
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <Label htmlFor="code">Referral Code</Label>
          <Input
            id="code"
            type="text"
            value={code}
            onChange={(e) => { setCode(e.target.value.toUpperCase()); setError(''); }}
            placeholder="e.g. STORYMAGIC2026"
            className="mt-1 font-mono tracking-wider uppercase"
            autoFocus
            autoComplete="off"
          />
          {error && (
            <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
          )}
        </div>

        <Button
          type="submit"
          disabled={loading || !code.trim()}
          className="w-full brand-gradient brand-gradient-hover"
        >
          {loading ? 'Activating…' : 'Activate Plan'}
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground transition-colors">
          ← Back to dashboard
        </Link>
      </p>
    </>
  );
}

export default function ReferralPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted px-4">
      <div className="w-full max-w-sm">
        <Suspense fallback={<div className="text-center text-muted-foreground">Loading…</div>}>
          <ReferralForm />
        </Suspense>
      </div>
    </div>
  );
}
