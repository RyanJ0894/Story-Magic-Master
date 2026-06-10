'use client';

import Link from 'next/link';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Mail, ArrowLeft, Loader2, CreditCard } from 'lucide-react';

export default function EnterpriseContactPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubscribe() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/enterprise/checkout', { method: 'POST' });
      const data = await res.json() as { url?: string; error?: string };
      if (!res.ok) {
        setError(data.error ?? 'Failed to start checkout');
        return;
      }
      if (data.url) {
        router.push(data.url);
      }
    } catch {
      setError('Network error — please try again');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-3">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
              <Crown className="w-6 h-6 text-violet-600 dark:text-violet-400" />
            </div>
          </div>
          <CardTitle className="text-xl">Enterprise Access Required</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            This area is available to Enterprise plan members only.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-center text-muted-foreground">
            Subscribe to Enterprise for unlimited generations, team collaboration,
            and priority support — or contact us for a white-glove onboarding experience.
          </p>

          {error && (
            <p className="text-sm text-destructive text-center">{error}</p>
          )}

          <Button
            className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
            disabled={loading}
            onClick={() => void handleSubscribe()}
          >
            {loading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CreditCard className="w-4 h-4" />
            )}
            Subscribe to Enterprise
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">or</span>
            </div>
          </div>

          <a
            href="mailto:info@storymagicapp.net?subject=Enterprise%20Access%20Request"
            className="flex items-center justify-center gap-2 w-full rounded-md border border-input bg-background hover:bg-accent text-sm font-medium h-10 px-4 transition-colors"
          >
            <Mail className="w-4 h-4" />
            Contact Us for White-Glove Onboarding
          </a>

          <Link href="/dashboard">
            <Button variant="ghost" size="sm" className="w-full gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Back to Dashboard
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
