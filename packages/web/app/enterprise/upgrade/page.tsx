'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { toast } from 'sonner';
import { Crown, Lock } from 'lucide-react';

export default function EnterpriseUpgradePage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    setLoading(true);

    try {
      const res = await fetch('/api/enterprise/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          toast.error('Incorrect password. Please check with your Story Magic contact.');
        } else {
          toast.error(data.error || 'Something went wrong. Please try again.');
        }
        return;
      }

      toast.success('Enterprise access granted! Welcome.');
      router.push('/enterprise/dashboard');
      router.refresh();
    } catch {
      toast.error('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/dashboard">
            <Image src="/logo.png" alt="Story Magic" width={28} height={28} className="rounded-lg" />
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Enterprise Access</span>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm space-y-6">
          <div className="text-center space-y-2">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto">
              <Crown className="w-6 h-6 text-violet-600" />
            </div>
            <h1 className="text-2xl font-bold">Enterprise Access</h1>
            <p className="text-sm text-muted-foreground">
              Enter your enterprise access code to unlock team management and collaboration features.
            </p>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Access Code
              </CardTitle>
              <CardDescription>
                Contact your Story Magic representative if you don&apos;t have a code.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label htmlFor="password" className="sr-only">Enterprise access code</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    placeholder="Enter access code"
                    autoFocus
                    autoComplete="off"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={loading || !password.trim()}
                  className="w-full brand-gradient brand-gradient-hover"
                >
                  {loading ? 'Verifying...' : 'Unlock Enterprise'}
                </Button>
              </form>
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground">
            Already have access?{' '}
            <Link href="/enterprise/dashboard" className="text-violet-600 hover:underline">
              Go to dashboard
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
