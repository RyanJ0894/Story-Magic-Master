'use client';

import { useState } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  FileText,
  Share2,
  Users,
  Eye,
  Copy,
  Check,
} from 'lucide-react';
import { SubscriptionCard } from '@/components/dashboard/subscription-card';
import { WriterScriptCard } from '@/components/dashboard/writer-script-card';
import { ShareModal } from '@/components/dashboard/share-modal';
import type { WriterScriptSummary, Subscription, SubscriptionLimits } from '@/lib/types/marketplace';

interface WriterDashboardClientProps {
  scripts: WriterScriptSummary[];
  subscription: Subscription | null;
  limits: SubscriptionLimits;
  writerCode: string;
  stats: {
    totalScripts: number;
    totalShares: number;
    totalReaders: number;
    totalViews: number;
  };
}

export function WriterDashboardClient({
  scripts,
  subscription,
  limits,
  writerCode,
  stats,
}: WriterDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const [selectedScript, setSelectedScript] = useState<WriterScriptSummary | null>(null);
  const [copied, setCopied] = useState(false);

  const shareableUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://storymagic.ai'}/w/${writerCode}`;

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      setCopied(true);
      toast({
        title: 'Link copied!',
        description: 'Your shareable link has been copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the link manually.',
        variant: 'destructive',
      });
    }
  };

  const handleShare = (script: WriterScriptSummary) => {
    setSelectedScript(script);
    setShareModalOpen(true);
  };

  const handleGenerate = async (script: WriterScriptSummary) => {
    router.push(`/projects/${script.project_id}/generate`);
  };

  const handleDelete = async (script: WriterScriptSummary) => {
    if (!confirm(`Are you sure you want to delete "${script.name}"? This cannot be undone.`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/projects/${script.project_id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to delete');

      toast({
        title: 'Script deleted',
        description: `"${script.name}" has been removed.`,
      });
      router.refresh();
    } catch {
      toast({
        title: 'Failed to delete',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleViewAnalytics = (script: WriterScriptSummary) => {
    router.push(`/projects/${script.project_id}/analytics`);
  };

  return (
    <>
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900">
                <FileText className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalScripts}</p>
                <p className="text-sm text-muted-foreground">Scripts</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900">
                <Share2 className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalShares}</p>
                <p className="text-sm text-muted-foreground">Shares</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900">
                <Users className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalReaders}</p>
                <p className="text-sm text-muted-foreground">Readers</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900">
                <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="text-2xl font-bold">{stats.totalViews}</p>
                <p className="text-sm text-muted-foreground">Total Views</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Column - Scripts */}
        <div className="lg:col-span-2 space-y-6">
          {/* Writer Code Card */}
          <Card className="bg-gradient-to-r from-violet-500 to-purple-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/80 mb-1">Your Writer Code</p>
                  <p className="text-3xl font-mono font-bold tracking-wider">{writerCode}</p>
                  <p className="text-sm text-white/70 mt-2">
                    Share this code with agents and producers
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={handleCopyLink}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Link
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Scripts List */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">My Scripts</h2>
              <Link href="/upload">
                <Button variant="outline" size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Upload Script
                </Button>
              </Link>
            </div>

            {scripts.length === 0 ? (
              <Card className="border-dashed">
                <CardContent className="p-8 text-center">
                  <FileText className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                  <h3 className="font-medium mb-2">No scripts yet</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Upload your first screenplay to get started
                  </p>
                  <Link href="/upload">
                    <Button>
                      <Plus className="w-4 h-4 mr-2" />
                      Upload Script
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                {scripts.map((script) => (
                  <WriterScriptCard
                    key={script.project_id}
                    script={script}
                    onShare={() => handleShare(script)}
                    onGenerate={() => handleGenerate(script)}
                    onDelete={() => handleDelete(script)}
                    onViewAnalytics={() => handleViewAnalytics(script)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Subscription Status */}
          <SubscriptionCard
            subscription={subscription}
            limits={limits}
            onUpgrade={() => router.push('/pricing')}
            onManage={() => router.push('/account/subscription')}
          />

          {/* Quick Tips */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Getting Started</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0 text-xs font-bold text-violet-600">
                  1
                </div>
                <div className="text-sm">
                  <p className="font-medium">Upload your script</p>
                  <p className="text-muted-foreground">PDF or paste text directly</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0 text-xs font-bold text-violet-600">
                  2
                </div>
                <div className="text-sm">
                  <p className="font-medium">Generate audio</p>
                  <p className="text-muted-foreground">AI voices bring characters to life</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center flex-shrink-0 text-xs font-bold text-violet-600">
                  3
                </div>
                <div className="text-sm">
                  <p className="font-medium">Share with industry</p>
                  <p className="text-muted-foreground">Send to agents, managers, producers</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Share Modal */}
      {selectedScript && (
        <ShareModal
          open={shareModalOpen}
          onOpenChange={setShareModalOpen}
          projectId={selectedScript.project_id}
          projectName={selectedScript.name}
          writerCode={writerCode}
        />
      )}
    </>
  );
}
