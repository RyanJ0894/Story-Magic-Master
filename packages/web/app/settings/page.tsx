export const dynamic = 'force-dynamic';

import { auth, currentUser } from '@clerk/nextjs/server';
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
  AudioLines,
} from 'lucide-react';

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login?redirect=/settings');
  }

  const [profile, clerkUser] = await Promise.all([
    ensureProfile(userId),
    currentUser(),
  ]);
  const tier = profile?.subscriptionTier || 'free';
  const mfaEnabled = (clerkUser?.totpEnabled ?? false) || (clerkUser?.twoFactorEnabled ?? false);
  const isAdmin = profile?.userType === 'admin';

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

        {/* Audio Tuning — B-005 (2026-06-15) */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AudioLines className="w-5 h-5" />
              Audio Tuning
            </CardTitle>
            <CardDescription>
              Adjust narration pace and the mix balance to match your taste
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">Custom audio defaults</p>
                <p className="text-sm text-muted-foreground">
                  Set narration speed and music / ambience / SFX volumes for every future generation.
                  Generate a 30-second preview, iterate, then lock in your preferred mix.
                </p>
              </div>
              <Badge variant="secondary">New</Badge>
            </div>

            <Link href="/settings/audio" className="inline-block">
              <Button variant="outline" size="sm">
                <AudioLines className="w-4 h-4 mr-2" />
                Open audio tuning
              </Button>
            </Link>
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
            {/* MFA Required banner for admins */}
            {isAdmin && !mfaEnabled && (
              <div className="flex items-start gap-3 p-4 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800">
                <Shield className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">
                    Two-Factor Authentication Required
                  </p>
                  <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
                    Admin accounts must have 2FA enabled. Please enable it below to maintain full access.
                  </p>
                </div>
              </div>
            )}

            {/* MFA status row */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">Two-Factor Authentication (2FA)</p>
                <p className="text-sm text-muted-foreground">
                  {mfaEnabled
                    ? 'Your account is protected with two-factor authentication.'
                    : 'Add an extra layer of security to your account with an authenticator app.'}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  variant={mfaEnabled ? 'outline' : 'secondary'}
                  className={
                    mfaEnabled
                      ? 'border-green-500 text-green-600 dark:text-green-400'
                      : 'text-muted-foreground'
                  }
                >
                  {mfaEnabled ? 'Enabled' : 'Disabled'}
                </Badge>
                {!mfaEnabled && (
                  <a
                    href="https://accounts.clerk.dev/user/security"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button variant="default" size="sm">
                      <Shield className="w-4 h-4 mr-2" />
                      Enable 2FA
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* General auth management */}
            <div className="flex items-center justify-between p-4 rounded-lg bg-muted">
              <div>
                <p className="font-medium text-foreground">Account & Sessions</p>
                <p className="text-sm text-muted-foreground">
                  Manage your password, connected accounts, and active sessions.
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
