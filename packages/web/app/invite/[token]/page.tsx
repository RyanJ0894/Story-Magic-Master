'use client';

import { useEffect, useState } from 'react';
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

  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [needsAuth, setNeedsAuth] = useState(false);

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
        throw new Error(data.error || 'Failed to accept invite');
      }

      setSuccess(true);

      // Redirect to dashboard after a moment
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to accept invite');
    } finally {
      setAccepting(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto mb-4" />
          <p className="text-muted-foreground">Loading invite...</p>
        </div>
      </div>
    );
  }

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

  // Needs auth state
  if (needsAuth) {
    return (
      <div className="min-h-screen bg-muted flex items-center justify-center p-4">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center mx-auto mb-4">
              <LogIn className="w-6 h-6 text-violet-600" />
            </div>
            <CardTitle>Sign in to continue</CardTitle>
            <CardDescription>
              Please sign in or create an account to accept this team invitation.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              New to Story Magic? Create a free account to join the team.
            </p>
            <Link href={`/login?redirect=/invite/${token}`} className="block">
              <Button className="w-full brand-gradient brand-gradient-hover">Create Account or Sign In</Button>
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
              <div className="w-8 h-8 rounded-lg brand-gradient-br flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
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
