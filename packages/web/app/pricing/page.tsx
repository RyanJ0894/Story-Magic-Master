'use client';

import { Suspense, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PRICING_TIERS, type SubscriptionTier } from '@/lib/stripe/config';
import { Check, X, Loader2, Building2 } from 'lucide-react';

function PricingContent() {
  const [interval, setInterval] = useState<'monthly' | 'yearly'>('monthly');
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

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
      const response = await apiFetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tier, interval }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session');
      }

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
          Every plan includes up to 150-page scripts, full AI voice library, music, ambience, and SFX.
        </p>

        {/* Interval Toggle */}
        <div className="mt-8 flex items-center justify-center gap-4" role="radiogroup" aria-label="Billing interval">
          <button
            onClick={() => setInterval('monthly')}
            role="radio"
            aria-checked={interval === 'monthly'}
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
            role="radio"
            aria-checked={interval === 'yearly'}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition flex items-center gap-2 ${
              interval === 'yearly'
                ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Annual
            <Badge variant="secondary" className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">
              Save 20%
            </Badge>
          </button>
        </div>
      </div>

      {/* Pricing Cards */}
      <div className="grid gap-6 lg:grid-cols-4">
        {PRICING_TIERS.map((tier) => {
          const displayPrice = interval === 'monthly' ? tier.monthlyPrice : tier.yearlyPrice;

          return (
            <Card
              key={tier.tier}
              className={`relative flex flex-col ${
                tier.highlighted
                  ? 'border-violet-500 dark:border-violet-400 shadow-lg shadow-violet-500/10'
                  : ''
              }`}
            >
              {tier.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="brand-gradient text-white px-3">
                    Most Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-4">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-1">
                  {tier.tagline}
                </p>
                <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>
                <p className="text-sm text-muted-foreground mt-1">{tier.description}</p>
              </CardHeader>

              <CardContent className="flex flex-col flex-1 space-y-6">
                {/* Price */}
                <div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold text-foreground">
                      ${displayPrice === 0 ? '0' : displayPrice}
                    </span>
                    {displayPrice > 0 && (
                      <span className="text-muted-foreground">/mo</span>
                    )}
                  </div>
                  {interval === 'yearly' && displayPrice > 0 && (
                    <p className="text-xs text-muted-foreground mt-1">
                      ${displayPrice * 12} billed annually
                    </p>
                  )}
                </div>

                {/* Script limit */}
                <div className="py-3 border-y border-border">
                  <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                    {tier.scriptsPerMonth === null ? 'Unlimited' : tier.scriptsPerMonth}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {tier.scriptsPerMonth === 1 ? 'script per month' : 'scripts per month'}
                  </p>
                </div>

                {/* Features */}
                <ul className="space-y-2 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <Check className="w-4 h-4 text-green-500 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground">{feature}</span>
                    </li>
                  ))}
                  {tier.limitations.map((limitation) => (
                    <li key={limitation} className="flex items-start gap-2">
                      <X className="w-4 h-4 text-muted-foreground/50 flex-shrink-0 mt-0.5" />
                      <span className="text-sm text-muted-foreground/60">{limitation}</span>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  onClick={() => handleSubscribe(tier.tier)}
                  disabled={loading !== null}
                  className={`w-full mt-auto ${
                    tier.highlighted ? 'brand-gradient brand-gradient-hover' : ''
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
                  ) : tier.trialDays ? (
                    `Start ${tier.trialDays}-Day Free Trial`
                  ) : (
                    'Subscribe'
                  )}
                </Button>

                {tier.trialDays && (
                  <p className="text-xs text-center text-muted-foreground -mt-3">
                    No charge until trial ends. Cancel anytime.
                  </p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Enterprise CTA */}
      <div className="mt-12 rounded-2xl border border-border bg-background p-8 text-center">
        <Building2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
        <h2 className="text-xl font-bold text-foreground mb-2">Enterprise Packages</h2>
        <p className="text-muted-foreground max-w-xl mx-auto mb-6">
          Team plans from $2,400/yr for 10 users — up to 200+ users with custom infrastructure,
          SSO, SOC 2 compliance, and dedicated support.
        </p>
        <Link href="/enterprise">
          <Button variant="outline" size="lg">
            View Enterprise Packages
          </Button>
        </Link>
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Questions?{' '}
          <a href="mailto:info@storymagicapp.net" className="text-violet-600 hover:underline">
            Contact us
          </a>
        </p>
      </div>
    </main>
  );
}

function PricingContentFallback() {
  return (
    <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
      <div className="text-center mb-12">
        <div className="h-10 w-72 bg-slate-200 rounded mx-auto" />
        <div className="h-5 w-96 bg-slate-200 rounded mx-auto mt-4" />
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
            <Link href="/">
              <Image src="/logo.png" alt="Story Magic" width={56} height={56} className="rounded-lg" />
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
