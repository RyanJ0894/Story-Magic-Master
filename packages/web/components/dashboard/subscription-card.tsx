'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Crown, Zap, Download, Calendar, AlertCircle, CheckCircle } from 'lucide-react';
import type { Subscription, SubscriptionLimits, SubscriptionPlan } from '@/lib/types/marketplace';

interface SubscriptionCardProps {
  subscription: Subscription | null;
  limits: SubscriptionLimits;
  onUpgrade?: () => void;
  onManage?: () => void;
}

const PLAN_DETAILS: Record<SubscriptionPlan, { name: string; color: string; icon: typeof Crown }> = {
  writer_basic: { name: 'Basic', color: 'bg-slate-500', icon: Zap },
  writer_pro: { name: 'Pro', color: 'bg-violet-500', icon: Crown },
  enterprise: { name: 'Enterprise', color: 'bg-amber-500', icon: Crown },
};

export function SubscriptionCard({ subscription, limits, onUpgrade, onManage }: SubscriptionCardProps) {
  const isActive = subscription?.status === 'active' || subscription?.status === 'trialing';
  const plan = subscription?.plan || 'writer_basic';
  const planDetails = PLAN_DETAILS[plan];
  const PlanIcon = planDetails.icon;

  const generationsPercent = limits.generations_limit > 0
    ? ((limits.generations_limit - limits.generations_remaining) / limits.generations_limit) * 100
    : 0;

  const downloadsPercent = limits.downloads_limit > 0
    ? ((limits.downloads_limit - limits.downloads_remaining) / limits.downloads_limit) * 100
    : 0;

  const daysRemaining = limits.period_ends
    ? Math.max(0, Math.ceil((new Date(limits.period_ends).getTime() - Date.now()) / (1000 * 60 * 60 * 24)))
    : null;

  if (!subscription) {
    return (
      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            No Active Subscription
          </CardTitle>
          <CardDescription>
            Subscribe to start creating audio versions of your scripts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-lg border bg-muted">
                <div className="font-semibold">Basic</div>
                <div className="text-2xl font-bold">$10<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                  <li>5 audio generations</li>
                  <li>1 download/month</li>
                  <li>Unlimited shares</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg border-2 border-violet-500 bg-violet-50 dark:bg-violet-950">
                <div className="font-semibold text-violet-600 dark:text-violet-400">Pro</div>
                <div className="text-2xl font-bold">$20<span className="text-sm font-normal text-muted-foreground">/mo</span></div>
                <ul className="mt-2 text-sm text-muted-foreground space-y-1">
                  <li>15 audio generations</li>
                  <li>5 downloads/month</li>
                  <li>Priority processing</li>
                </ul>
              </div>
            </div>
            <Button className="w-full" onClick={onUpgrade}>
              <Crown className="w-4 h-4 mr-2" />
              Subscribe Now
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <div className={`p-1.5 rounded-lg ${planDetails.color}`}>
              <PlanIcon className="w-4 h-4 text-white" />
            </div>
            {planDetails.name} Plan
          </CardTitle>
          <Badge variant={isActive ? 'default' : 'destructive'}>
            {subscription.status === 'trialing' ? 'Trial' : subscription.status}
          </Badge>
        </div>
        {daysRemaining !== null && (
          <CardDescription className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            {subscription.cancel_at_period_end
              ? `Cancels in ${daysRemaining} days`
              : `Renews in ${daysRemaining} days`}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Generations Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Zap className="w-4 h-4" />
              Audio Generations
            </span>
            <span className="font-medium">
              {limits.generations_limit - limits.generations_remaining} / {limits.generations_limit}
            </span>
          </div>
          <Progress value={generationsPercent} className="h-2" />
          {limits.generations_remaining <= 1 && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              {limits.generations_remaining === 0
                ? 'No generations remaining this period'
                : 'Only 1 generation remaining'}
            </p>
          )}
        </div>

        {/* Downloads Usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-1.5 text-muted-foreground">
              <Download className="w-4 h-4" />
              Downloads
            </span>
            <span className="font-medium">
              {limits.downloads_limit - limits.downloads_remaining} / {limits.downloads_limit}
            </span>
          </div>
          <Progress value={downloadsPercent} className="h-2" />
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {plan === 'writer_basic' && (
            <Button variant="outline" className="flex-1" onClick={onUpgrade}>
              <Crown className="w-4 h-4 mr-2" />
              Upgrade to Pro
            </Button>
          )}
          <Button variant="ghost" className="flex-1" onClick={onManage}>
            Manage Subscription
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
