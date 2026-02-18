export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { ensureProfile } from '@/lib/ensure-profile';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowLeft,
  Sparkles,
  User,
  Bell,
  CreditCard,
  Shield,
  Mail,
  ExternalLink,
} from 'lucide-react';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login?redirect=/settings');
  }

  const profile = await ensureProfile(userId);
  const tier = profile?.subscriptionTier || 'free';

  const tierNames: Record<string, string> = {
    free: 'Free',
    creator: 'Creator',
    pro: 'Pro',
    studio: 'Studio',
  };

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
              <div className="w-8 h-8 rounded-lg brand-gradient-br flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <h1 className="font-semibold text-foreground">Settings</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Profile Section */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <User className="w-5 h-5" />
                  Profile
                </CardTitle>
                <CardDescription>
                  Your account information
                </CardDescription>
              </div>
              <Badge variant="secondary">{tierNames[tier]} Plan</Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Display Name</p>
                <p className="font-medium text-foreground">
                  {profile.fullName || 'Not set'}
                </p>
              </div>
              <div className="p-4 rounded-lg bg-muted">
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium text-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4 text-muted-foreground" />
                  {profile.email || 'Not available'}
                </p>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              Profile details are managed through your authentication provider. To update your name, email, or profile picture, use the account menu or visit your Clerk profile.
            </p>
          </CardContent>
        </Card>

        {/* Notification Preferences */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notification Preferences
            </CardTitle>
            <CardDescription>
              Control how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">In-App Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Receive notifications about project activity, team updates, and generation status
                </p>
              </div>
              <Badge variant="outline" className="border-green-500 text-green-600 dark:text-green-400">
                Enabled
              </Badge>
            </div>

            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">Email Notifications</p>
                <p className="text-sm text-muted-foreground">
                  Get email updates for important events like completed generations
                </p>
              </div>
              <Badge variant="secondary">
                Coming Soon
              </Badge>
            </div>

            <Link href="/alerts" className="inline-block">
              <Button variant="outline" size="sm">
                <Bell className="w-4 h-4 mr-2" />
                View All Notifications
              </Button>
            </Link>
          </CardContent>
        </Card>

        {/* Subscription & Billing */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="w-5 h-5" />
              Subscription & Billing
            </CardTitle>
            <CardDescription>
              Manage your plan and payment details
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">Current Plan</p>
                <p className="text-sm text-muted-foreground">
                  You are on the {tierNames[tier]} plan
                </p>
              </div>
              <Badge
                variant={tier !== 'free' ? 'default' : 'secondary'}
                className={tier !== 'free' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300' : ''}
              >
                {tierNames[tier]}
              </Badge>
            </div>

            <div className="flex flex-wrap gap-3">
              <Link href="/billing">
                <Button variant="outline" size="sm">
                  <CreditCard className="w-4 h-4 mr-2" />
                  Manage Billing
                </Button>
              </Link>
              {tier === 'free' && (
                <Link href="/pricing">
                  <Button size="sm" className="brand-gradient brand-gradient-hover">
                    <Sparkles className="w-4 h-4 mr-2" />
                    Upgrade Plan
                  </Button>
                </Link>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Security */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5" />
              Security
            </CardTitle>
            <CardDescription>
              Account security and authentication settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">Authentication</p>
                <p className="text-sm text-muted-foreground">
                  Managed by Clerk. Change your password, enable 2FA, and manage sessions.
                </p>
              </div>
              <a
                href="https://accounts.clerk.dev/user"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="outline" size="sm">
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Manage
                </Button>
              </a>
            </div>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="text-red-600 dark:text-red-400">Danger Zone</CardTitle>
            <CardDescription>
              Irreversible actions that affect your account
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Separator className="mb-4" />
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-foreground">Delete Account</p>
                <p className="text-sm text-muted-foreground">
                  Permanently delete your account and all associated data. This action cannot be undone.
                </p>
              </div>
              <Button variant="destructive" size="sm" disabled title="Account deletion is not yet available">
                Delete Account
              </Button>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
