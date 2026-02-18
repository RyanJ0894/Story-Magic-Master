'use client';

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ProtectedPlayer } from '@/components/player/protected-player';
import {
  Lock,
  AlertCircle,
  Clock,
  PlayCircle,
  Loader2,
  User,
  FileText,
  Calendar,
} from 'lucide-react';

interface ShareData {
  share: {
    id: string;
    accessLevel: 'stream' | 'download';
    expiresAt: string | null;
  };
  project: {
    id: string;
    name: string;
    pageCount: number;
  };
  writer: {
    name: string;
    code: string;
  };
  audio: {
    url: string;
    duration: number;
    manifest: {
      scenes?: Array<{
        scene_id: string;
        title?: string;
        start_time: number;
        duration: number;
        characters: string[];
      }>;
    };
  } | null;
  canDownload: boolean;
}

interface PasswordRequiredState {
  requiresPassword: true;
  projectName: string;
  writerName: string;
}

interface ErrorState {
  error: string;
}

type ShareResponse = ShareData | PasswordRequiredState | ErrorState;

function isPasswordRequired(data: ShareResponse): data is PasswordRequiredState {
  return 'requiresPassword' in data && data.requiresPassword === true;
}

function isError(data: ShareResponse): data is ErrorState {
  return 'error' in data;
}

export default function PublicSharePage() {
  const params = useParams();
  const code = params?.code as string;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passwordRequired, setPasswordRequired] = useState(false);
  const [passwordMeta, setPasswordMeta] = useState<{ projectName: string; writerName: string } | null>(null);
  const [password, setPassword] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [shareData, setShareData] = useState<ShareData | null>(null);

  // Fetch share data on mount
  useEffect(() => {
    if (!code) return;

    async function fetchShare() {
      setLoading(true);
      setError(null);

      try {
        const response = await apiFetch(`/api/shares/access/${code}`);
        const data: ShareResponse = await response.json();

        if (!response.ok) {
          if (isError(data)) {
            setError(data.error);
          } else {
            setError('Failed to load share');
          }
          return;
        }

        if (isPasswordRequired(data)) {
          setPasswordRequired(true);
          setPasswordMeta({
            projectName: data.projectName,
            writerName: data.writerName,
          });
        } else if (!isError(data)) {
          setShareData(data);
        }
      } catch (err) {
        setError('Failed to connect to server');
      } finally {
        setLoading(false);
      }
    }

    fetchShare();
  }, [code]);

  // Handle password verification
  async function handlePasswordSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!password.trim()) return;

    setVerifying(true);
    setError(null);

    try {
      const response = await apiFetch(`/api/shares/access/${code}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data: ShareResponse = await response.json();

      if (!response.ok) {
        if (isError(data)) {
          setError(data.error);
        } else {
          setError('Invalid password');
        }
        return;
      }

      if (!isError(data) && !isPasswordRequired(data)) {
        setShareData(data);
        setPasswordRequired(false);
      }
    } catch (err) {
      setError('Failed to verify password');
    } finally {
      setVerifying(false);
    }
  }

  // Track play count on first play
  async function handlePlay() {
    if (!shareData) return;

    try {
      await apiFetch(`/api/shares/access/${code}/play`, {
        method: 'POST',
      });
    } catch (err) {
      // Silently fail - don't interrupt playback
    }
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-violet-500" />
          <p className="mt-4 text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  // Error state
  if (error && !passwordRequired) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6 text-center">
            <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-8 h-8 text-red-500" />
            </div>
            <h2 className="text-xl font-semibold mb-2">Unable to Access</h2>
            <p className="text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              className="mt-6"
              onClick={() => window.location.href = '/'}
            >
              Go to Story Magic
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Password required state
  if (passwordRequired && passwordMeta) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="w-16 h-16 rounded-full bg-violet-100 dark:bg-violet-900/20 flex items-center justify-center mx-auto mb-4">
              <Lock className="w-8 h-8 text-violet-500" />
            </div>
            <CardTitle>Password Protected</CardTitle>
            <CardDescription>
              Enter the password to listen to this script
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="rounded-lg bg-muted p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <span className="font-medium">{passwordMeta.projectName}</span>
                </div>
                {passwordMeta.writerName && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <User className="w-4 h-4" />
                    <span>by {passwordMeta.writerName}</span>
                  </div>
                )}
              </div>

              <form onSubmit={handlePasswordSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    autoFocus
                  />
                </div>

                {error && (
                  <p className="text-sm text-red-500 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </p>
                )}

                <Button type="submit" className="w-full" disabled={verifying || !password.trim()}>
                  {verifying ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Unlock'
                  )}
                </Button>
              </form>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Audio player state
  if (shareData) {
    const { share, project, writer, audio, canDownload } = shareData;

    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900">
        <div className="max-w-3xl mx-auto p-4 py-8 md:py-12">
          {/* Header */}
          <div className="text-center mb-8">
            <Badge variant="secondary" className="mb-4">
              <PlayCircle className="w-3 h-3 mr-1" />
              Story Magic
            </Badge>
            <h1 className="text-2xl md:text-3xl font-bold mb-2">{project.name}</h1>
            {writer.name && (
              <p className="text-muted-foreground flex items-center justify-center gap-2">
                <User className="w-4 h-4" />
                by {writer.name}
              </p>
            )}
          </div>

          {/* Audio Player */}
          {audio ? (
            <div className="space-y-4">
              <ProtectedPlayer
                projectId={project.id}
                projectName={project.name}
                audioUrl={audio.url}
                duration={audio.duration}
                scenes={(audio.manifest?.scenes || []).map(s => ({
                  ...s,
                  title: s.title || s.scene_id,
                }))}
                allowDownload={canDownload}
                onComplete={handlePlay}
              />

              {/* Meta Info */}
              <div className="flex flex-wrap items-center justify-center gap-4 text-sm text-muted-foreground">
                {project.pageCount > 0 && (
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {project.pageCount} pages
                  </span>
                )}
                {share.expiresAt && (
                  <span className="flex items-center gap-1">
                    <Calendar className="w-4 h-4" />
                    Expires {new Date(share.expiresAt).toLocaleDateString()}
                  </span>
                )}
                {canDownload && (
                  <Badge variant="outline">
                    Download enabled
                  </Badge>
                )}
              </div>
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6 text-center">
                <Clock className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="font-semibold mb-2">Audio Not Ready</h3>
                <p className="text-muted-foreground text-sm">
                  The audio for this script hasn't been generated yet.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Footer */}
          <div className="mt-12 text-center">
            <a
              href="/"
              className="text-sm text-muted-foreground hover:text-violet-500 transition-colors"
            >
              Powered by Story Magic
            </a>
          </div>
        </div>
      </div>
    );
  }

  // Fallback
  return null;
}
