'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING_TIERS, type SubscriptionTier } from '@/lib/stripe/config';
import { Check, Sparkles, Loader2 } from 'lucide-react';

function PricingContent() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Show canceled message if redirected from checkout
  const canceled = searchParams.get('canceled');

  useEffect(() => {
    if (canceled) {
      toast.error('Checkout was canceled. You can try again when ready.');
    }
  }, [canceled]);

  const handleSubscribe = async (tier: SubscriptionTier) => {
    if (tier === 'free') {
      router.push('/signup');
      return;
    }

    setLoading(tier);

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      if (data.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Something went wrong');
      setLoading(null);
    }
  };

  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      {/* Page Header */}
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your needs. All plans include our core audio generation features.
        </p>

        {/* Interval Toggle */}
        <div className="mt-8 flex items-center justify-center gap-4">
          <button
            onClick={() => setInterval('monthly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              interval === 'monthly'
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Monthly
          </button>
          <button
            onClick={() => setInterval('yearly')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              interval === 'yearly'
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Yearly
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Save 17%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => {
          const price = interval === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice;
          const monthlyEquivalent = interval === 'yearly' ? Math.round(tier.yearlyPrice / 12) : tier.monthlyPrice;

          return (
            <Card
              key={tier.tier}
              className={`relative ${
                tier.highlighted
                  ? 'border-violet-500 dark:border-violet-400 shadow-lg shadow-violet-500/10'
                  : ''
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 text-white">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader>
                <CardTitle className="text-xl">{tier.name}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${price === 0 ? '0' : monthlyEquivalent}
                    </span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {interval === 'yearly' && price > 0 && (
                    <p className="text-sm text-muted-foreground mt-1">
                      ${price} billed yearly
                    </p>
                  )}
                </div>

                {/* Pages */}
                <div className="py-4 border-y border-border">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {tier.pages.toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    pages per month
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">
                        {feature}
                      </span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSubscribe(tier.tier)}
                  disabled={loading !== null}
                  className={`w-full ${
                    tier.highlighted
                      ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700'
                      : ''
                  }`}
                  variant={tier.highlighted ? 'default' : 'outline'}
                >
                  {loading === tier.tier ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Loading...
                    </>
                  ) : tier.tier === 'free' ? (
                    'Get Started Free'
                  ) : (
                    'Subscribe'
                  )}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* FAQ or Additional Info */}
      <div className="mt-16 text-center">
        <p className="text-muted-foreground">
          All plans include a 14-day money-back guarantee.{' '}
          <Link href="/contact" className="text-violet-600 hover:underline">
            Contact us
          </Link>{' '}
          if you have questions.
        </p>
      </div>
    </main>
  );
}

function PricingContentFallback() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
          Choose the plan that fits your needs. All plans include our core audio generation features.
        </p>
      </div>
      <div className="grid gap-6 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="animate-pulse">
            <CardHeader>
              <div className="h-6 w-24 bg-slate-200 rounded" />
              <div className="h-4 w-32 bg-slate-200 rounded mt-2" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="h-10 w-20 bg-slate-200 rounded" />
              <div className="h-20 bg-slate-200 rounded" />
              <div className="h-10 bg-slate-200 rounded" />
            </CardContent>
          </Card>
        ))}
      </div>
    </main>
  );
}

export default function PricingPage() {
  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">Story Magic</span>
            </Link>

            <div className="flex items-center gap-4">
              <Link href="/login">
                <Button variant="ghost">Sign in</Button>
              </Link>
              <Link href="/signup">
                <Button>Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <Suspense fallback={<PricingContentFallback />}>
        <PricingContent />
      </Suspense>
    </div>
  );
}
