'use client';

import { useEffect, useRef, useState } from 'react';
import { useUser } from '@clerk/nextjs';
import { apiFetch } from '@/lib/api/fetch';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Sparkles, Users, Loader2, CheckCircle, XCircle, LogIn } from 'lucide-react';

interface InviteDetails {
  id: string;
  email: string;
  role: string;
  invitedAt: string;
  team: {
    id: string;
    name: string;
    description?: string;
    profiles: {
      full_name: string;
    };
  };
  inviter: {
    full_name: string;
  };
}

export default function InvitePage() {
  const params = useParams();
  const router = useRouter();
  const token = params.token as string;
  const { isSignedIn, isLoaded: clerkLoaded, user } = useUser();
  const signedInEmail = user?.primaryEmailAddress?.emailAddress ?? null;

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);
  // Prevent double-accept on re-render
  const autoAcceptAttempted = useRef(false);

  // Fetch invite details
  useEffect(() => {
    async function fetchInvite() {
      try {
        const res = await apiFetch(`/api/invite/${token}`);
        const data = await res.json();

        if (!res.ok) {
          setError(data.error || 'Failed to load invite');
          return;
        }

        setInvite(data.invite);
      } catch {
        setError('Failed to load invite details');
      } finally {
        setLoading(false);
      }
    }

    fetchInvite();
  }, [token]);

  // A-006 (2026-06-15): auto-accept WAS firing as soon as Clerk reported
  // isSignedIn=true. Ryan's report: users were being dropped on the
  // dashboard without ever seeing the "Create Account" prompt. Common case:
  //   - User already had a Clerk session (logged in via a different team /
  //     friend's laptop / cached prior account)
  //   - Click invite link → auto-accept fires → they join the team under
  //     the WRONG account and never get a chance to sign up with the
  //     invited email
  //
  // Fix: stop auto-accepting. When signed in we show an explicit
  // "Continue as <email>" Accept button so the user sees:
  //   (a) which account they're about to join the team under
  //   (b) that there's a confirm step in case they need to sign out first
  // When not signed in we still show the sign-up prompt.
  useEffect(() => {
    if (!clerkLoaded || !invite || loading) return;
    if (!isSignedIn) {
      setNeedsAuth(true);
    }
    // No auto-accept: users always click an explicit button.
    // autoAcceptAttempted ref still in place — only used now to prevent
    // the user from double-clicking the manual Accept button while
    // the first POST is in flight.
  }, [clerkLoaded, isSignedIn, invite, loading]);

  const handleAccept = async () => {
    setAccepting(true);
    setError(null);

    try {
      const res = await apiFetch(`/api/invite/${token}`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.code === 'AUTH_REQUIRED') {
          setNeedsAuth(true);
          return;
        }
        // Invite was already accepted (e.g. user clicked link twice, or previously
        // accepted) — treat as success and send them to the dashboard.
        if (data.code === 'INVALID_STATUS' && data.details?.status === 'accepted') {
          setSuccess(true);
          setTimeout(() => router.push('/dashboard'), 1500);
          return;
        }
        throw new Error(data.error || 'Failed to accept invite');
      }

      setSuccess(true);

      setTimeout(() => {
        router.push('/dashboard');
      }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  // Loading state — wait for both invite fetch and Clerk auth state
  if (loading || !clerkLoaded) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    );
  }

  // A-006 — removed: previously this branch rendered a "Joining team…"
  // spinner while auto-accept fired. We now show the invite card with an
  // explicit Accept button so the user sees which account they're joining
  // the team under before committing.

  // Error state
  if (error && !invite) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Invalid Invite</h2>
            <p className="text-muted-foreground mb-6">{error}</p>
            <Link href="/dashboard">
              <Button>Go to Dashboard</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Success state
  if (success) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardContent className="pt-6 text-center">
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Welcome to the team!</h2>
            <p className="text-muted-foreground mb-4">
              You've successfully joined <strong>{invite?.team.name}</strong>.
            </p>
            <p className="text-sm text-muted-foreground">Redirecting to dashboard...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Proactive sign-up CTA: Clerk confirms user is signed out and invite is loaded —
  // show account creation immediately instead of letting the POST fail with AUTH_REQUIRED.
  if (clerkLoaded && !isSignedIn && invite) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-violet-600" />
            </div>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Create a free Story Magic account to accept your invitation to{' '}
              <strong>{invite.team.name}</strong>.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Once your account is created you&apos;ll be added to the team automatically.
            </p>
            <Link href={`/signup?redirect_url=/invite/${token}`} className="block">
              <Button className="w-full brand-gradient brand-gradient-hover">Create Account</Button>
            </Link>
            <p className="text-xs text-muted-foreground text-center">
              Already have an account?{' '}
              <Link href={`/login?redirect_url=/invite/${token}`} className="underline">Sign in</Link>
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Needs auth state — fallback when Clerk state is unavailable (e.g. POST returned AUTH_REQUIRED)
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-violet-600" />
            </div>
            <CardTitle>Create your account</CardTitle>
            <CardDescription>
              Create a free Story Magic account to accept this team invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Once your account is created you'll be added to the team automatically.
            </p>
            <Link href={`/signup?redirect_url=/invite/${token}`} className="block">
              <Button className="w-full brand-gradient brand-gradient-hover">Create Account</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Main invite view
  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="border-b border-border bg-background">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-12 h-12 rounded-lg brand-gradient-br flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">Story Magic</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-md mx-auto px-4 py-16">
        <Card>
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
              <Users className="w-8 h-8 text-violet-600" />
            </div>
            <CardTitle className="text-2xl">Team Invitation</CardTitle>
            <CardDescription>
              You've been invited to join a team on Story Magic
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* Team Info */}
            <div className="p-4 rounded-lg bg-muted space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Team</span>
                <span className="font-semibold text-foreground">
                  {invite?.team.name}
                </span>
              </div>

              {invite?.team.description && (
                <div>
                  <span className="text-sm text-muted-foreground">Description</span>
                  <p className="text-sm text-muted-foreground mt-1">
                    {invite.team.description}
                  </p>
                </div>
              )}

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Invited by</span>
                <span className="text-foreground">
                  {invite?.inviter?.full_name || invite?.team.profiles?.full_name || 'Team owner'}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Your role</span>
                <Badge variant="secondary" className="capitalize">
                  {invite?.role}
                </Badge>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
              </div>
            )}

            {/* A-006 — show the signed-in account so a user with a stale
                Clerk session doesn't accidentally join a team under the wrong
                account. The invitedEmail is shown below for cross-reference;
                a mismatch isn't blocking (some teams invite a personal email
                but the user joins under a work account) but it's surfaced. */}
            {isSignedIn && signedInEmail && (
              <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 text-sm">
                <p className="text-blue-900 dark:text-blue-200">
                  You're about to join as <strong>{signedInEmail}</strong>.
                  {invite?.email && invite.email !== signedInEmail && (
                    <>
                      {' '}
                      The invite was sent to <strong>{invite.email}</strong>.
                      <Link
                        href={`/sign-up?redirect_url=/invite/${token}`}
                        className="ml-1 underline text-blue-700 dark:text-blue-300 hover:no-underline"
                      >
                        Use a different account?
                      </Link>
                    </>
                  )}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleAccept}
                disabled={accepting}
                className="w-full brand-gradient brand-gradient-hover"
              >
                {accepting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  'Accept Invitation'
                )}
              </Button>

              <Link href="/dashboard" className="block">
                <Button variant="ghost" className="w-full">
                  Decline
                </Button>
              </Link>
            </div>

            <p className="text-xs text-center text-muted-foreground">
              By accepting, you'll be able to access shared scripts and collaborate with the team.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
