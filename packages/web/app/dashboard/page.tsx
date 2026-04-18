export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { ensureProfile } from '@/lib/ensure-profile';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { HelpCircle } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';
import { DashboardTabs } from './dashboard-tabs';

const TIER_LIMITS: Record<string, number> = {
  free: 3,
  creator: 50,
  pro: 200,
  studio: 1000,
  enterprise: 9999,
  university: 500,
};

const TIER_NAMES: Record<string, string> = {
  free: 'Individual',
  creator: 'Starter Enterprise',
  pro: 'Professional Simulation',
  studio: 'Studio Enterprise',
  enterprise: 'Enterprise Unlimited',
  university: 'University Program',
};

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  const [projects, profile] = await Promise.all([
    prisma.project.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    }),
    ensureProfile(userId),
  ]);

  const tier = profile?.subscriptionTier || 'free';
  const tierLimit = TIER_LIMITS[tier] ?? 3;
  const tierDisplayName = TIER_NAMES[tier] ?? 'Individual';

  const remainingResult = await prisma.$queryRaw<[{ remaining: number }]>`
    SELECT COALESCE(
      (SELECT p.pages_limit - p.pages_used FROM usage p WHERE p.user_id = ${userId} AND p.period = to_char(now(), 'YYYY-MM') LIMIT 1),
      ${tierLimit}::int
    ) AS remaining
  `;
  const remaining = Number(remainingResult[0]?.remaining ?? tierLimit);
  const usedPages = Math.max(0, tierLimit - remaining);
  const usagePercent = tierLimit > 0 ? Math.min(100, (usedPages / tierLimit) * 100) : 0;

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/dashboard">
              <Image src="/logo.png" alt="Story Magic" width={144} height={144} className="rounded-lg" />
            </Link>

            <div className="flex items-center gap-4">
              <AlertsDropdown />

              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted" data-testid="usage-indicator">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground" data-testid="subscription-tier">{tierDisplayName}</p>
                  <p className="text-sm font-medium text-foreground">{remaining} / {tierLimit} pages</p>
                </div>
                <div className="w-16">
                  <Progress value={usagePercent} className="h-2" />
                </div>
              </div>

              {['enterprise', 'studio', 'pro', 'creator'].includes(tier) && (
                <Link href="/enterprise/dashboard">
                  <Button variant="outline" size="sm" className="hidden sm:flex items-center gap-1.5">
                    Enterprise
                  </Button>
                </Link>
              )}

              <Link href="/guide">
                <Button variant="ghost" size="sm" data-testid="guide-button">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help
                </Button>
              </Link>

              <SignOutButton />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
            <p className="mt-1 text-muted-foreground text-sm">Manage your audio productions and account</p>
          </div>
        </div>

        <DashboardTabs
          projects={projects}
          tier={tier}
          tierDisplayName={tierDisplayName}
          tierLimit={tierLimit}
          usedPages={usedPages}
          remaining={remaining}
          usagePercent={usagePercent}
        />

        {/* Impact Support Nudge */}
        <div className="mt-10 rounded-xl border border-blue-800/40 bg-blue-950/20 px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">💙 Support Impact Storytellers</p>
            <p className="text-xs text-zinc-400 mt-0.5">
              Our free Impact program gives trauma survivors and recovery advocates free AI audio production.
              A small gift from you keeps it free for them.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Link
              href="/impact/stories"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 border border-zinc-700 transition-colors"
            >
              Listen
            </Link>
            <Link
              href="/impact/donate"
              className="px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-500 text-white transition-colors"
            >
              Give a gift →
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
