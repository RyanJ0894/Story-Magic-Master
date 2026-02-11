import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { getTierByName, getPageLimit, type SubscriptionTier } from '@/lib/stripe/config';
import { ArrowLeft, Sparkles, CreditCard, Calendar, CheckCircle, AlertCircle } from 'lucide-react';
import ManageSubscriptionButton from './manage-subscription-button';

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string };
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login?redirect=/billing');
  }

  // Fetch user's profile
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  const tier = (profile?.subscriptionTier || 'free') as SubscriptionTier;
  const pageLimit = getPageLimit(tier);

  // Get remaining pages
  const remainingResult = await prisma.$queryRaw<[{ remaining: number }]>`
    SELECT COALESCE(
      (SELECT p.pages_limit - p.pages_used FROM usage p WHERE p.user_id = ${userId} AND p.period = to_char(now(), 'YYYY-MM') LIMIT 1),
      ${pageLimit}
    ) AS remaining
  `;
  const remainingPages = remainingResult[0]?.remaining ?? pageLimit;

  const tierConfig = getTierByName(tier);
  const remaining = remainingPages ?? pageLimit;
  const usedPages = pageLimit - remaining;
  const usagePercent = (usedPages / pageLimit) * 100;

  const subscriptionStatus = profile?.subscriptionStatus || 'inactive';
  const currentPeriodEnd = profile?.currentPeriodEnd
    ? new Date(profile.currentPeriodEnd)
    : null;

  const hasActiveSubscription = tier !== 'free' && subscriptionStatus === 'active';

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Dashboard
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-semibold text-foreground">Billing</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Success Message */}
        {searchParams.success && (
          <div className="flex items-center gap-3 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
            <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
            <p className="text-green-800 dark:text-green-200">
              Your subscription has been updated successfully!
            </p>
          </div>
        )}

        {/* Current Plan */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="w-5 h-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  Manage your subscription and billing
                </CardDescription>
              </div>
              <Badge
                variant={hasActiveSubscription ? 'default' : 'secondary'}
                className={hasActiveSubscription ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : ''}
              >
                {tierConfig?.name || 'Free'}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Plan Details */}
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Monthly Price</p>
                <p className="text-2xl font-bold text-foreground">
                  ${tierConfig?.monthlyPrice || 0}
                  <span className="text-sm font-normal text-muted-foreground">/month</span>
                </p>
              </div>

              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Page Allowance</p>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">
                  {tierConfig?.pages.toLocaleString() || 3}
                  <span className="text-sm font-normal text-muted-foreground"> pages/month</span>
                </p>
              </div>
            </div>

            {/* Billing Period */}
            {hasActiveSubscription && currentPeriodEnd && (
              <div className="flex items-center gap-3 p-4 rounded-lg bg-muted">
                <Calendar className="w-5 h-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Current billing period ends</p>
                  <p className="font-medium text-foreground">
                    {currentPeriodEnd.toLocaleDateString('en-US', {
                      month: 'long',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </p>
                </div>
              </div>
            )}

            {/* Past Due Warning */}
            {subscriptionStatus === 'past_due' && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-200">Payment past due</p>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Please update your payment method to avoid service interruption.
                  </p>
                </div>
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-wrap gap-3 pt-4 border-t border-border">
              {hasActiveSubscription ? (
                <ManageSubscriptionButton />
              ) : (
                <Link href="/pricing">
                  <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                    Upgrade Plan
                  </Button>
                </Link>
              )}

              {tier !== 'free' && (
                <Link href="/pricing">
                  <Button variant="outline">View All Plans</Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Usage */}
        <Card>
          <CardHeader>
            <CardTitle>Usage This Period</CardTitle>
            <CardDescription>
              Track your page usage for the current billing period
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  Pages used
                </span>
                <span className="font-medium text-foreground">
                  {usedPages} / {pageLimit}
                </span>
              </div>

              <Progress value={usagePercent} className="h-3" />

              <p className="text-sm text-muted-foreground">
                {remaining} pages remaining this month
              </p>

              {usagePercent > 80 && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    You&apos;ve used {Math.round(usagePercent)}% of your monthly allowance.{' '}
                    <Link href="/pricing" className="underline">
                      Upgrade for more pages
                    </Link>
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Features */}
        {tierConfig && (
          <Card>
            <CardHeader>
              <CardTitle>Plan Features</CardTitle>
              <CardDescription>
                What&apos;s included in your {tierConfig.name} plan
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="grid gap-2 sm:grid-cols-2">
                {tierConfig.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="text-sm text-muted-foreground">{feature}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
