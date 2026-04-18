'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Lock } from 'lucide-react';

const ENTERPRISE_PASSWORD = 'Masejase0894!';

export default function EnterprisePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password === ENTERPRISE_PASSWORD) {
      // Store access in sessionStorage so the plans page can verify
      sessionStorage.setItem('enterprise_access', '1');
      // Go to dashboard if already logged in, otherwise plans page
      router.push('/enterprise/dashboard');
    } else {
      setError('Incorrect password. Please try again.');
      setPassword('');
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-background to-muted px-4">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <Link href="/" className="inline-block mb-6">
            <Image src="/logo.png" alt="Story Magic" width={144} height={144} className="rounded-xl mx-auto" />
          </Link>
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 mb-4">
            <Lock className="w-5 h-5 text-violet-600 dark:text-violet-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            Enterprise Access
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Enter your password to view enterprise packages.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => {
                setPassword(e.target.value);
                setError('');
              }}
              placeholder="Enter password"
              className="mt-1"
              autoFocus
            />
            {error && (
              <p className="mt-2 text-sm text-red-600 dark:text-red-400">{error}</p>
            )}
          </div>

          <Button type="submit" className="w-full brand-gradient brand-gradient-hover">
            View Enterprise Plans
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          <Link href="/pricing" className="hover:text-foreground transition-colors">
            ← Back to pricing
          </Link>
        </p>
      </div>
    </div>
  );
}
