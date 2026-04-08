'use client';

import { useState, useRef } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import {
  Inbox,
  Upload,
  Download,
  Search,
  Star,
  Clock,
  Copy,
  QrCode,
  BookOpen,
  Headphones,
  Filter,
  Check,
} from 'lucide-react';
import { ReaderScriptCard } from '@/components/dashboard/reader-script-card';
import type { ReaderLibraryEntryDetailed } from '@/lib/types/marketplace';

interface ReaderDashboardClientProps {
  entries: ReaderLibraryEntryDetailed[];
  readerCode: string;
  stats: {
    totalScripts: number;
    activeCount: number;
    archivedCount: number;
    favoritedCount: number;
  };
}

export function ReaderDashboardClient({
  entries,
  readerCode,
  stats,
}: ReaderDashboardClientProps) {
  const router = useRouter();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [copied, setCopied] = useState(false);
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [playingId, setPlayingId] = useState<string | null>(null);

  const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://storymagic.ai'}/r/${readerCode}`;

  // Filter entries by source
  const receivedScripts = entries.filter(e => e.source === 'received');
  const uploadedScripts = entries.filter(e => e.source === 'uploaded');
  const purchasedDownloads = entries.filter(e => e.source === 'purchased');

  // Filter by search query
  const filterBySearch = (entries: ReaderLibraryEntryDetailed[]) => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      e =>
        e.script_name.toLowerCase().includes(q) ||
        e.writer_name.toLowerCase().includes(q)
    );
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(readerCode);
      setCopied(true);
      toast({
        title: 'Code copied!',
        description: 'Your reader code has been copied to clipboard.',
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: 'Failed to copy',
        description: 'Please copy the code manually.',
        variant: 'destructive',
      });
    }
  };

  const handlePlay = (entry: ReaderLibraryEntryDetailed) => {
    setPlayingId(entry.id);
    router.push(`/reader/play/${entry.id}`);
  };

  const handlePause = () => {
    setPlayingId(null);
  };

  const handleFavorite = async (entry: ReaderLibraryEntryDetailed) => {
    try {
      const response = await apiFetch(`/api/reader/library/${entry.id}/favorite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_favorited: !entry.is_favorited }),
      });

      if (!response.ok) throw new Error('Failed to update');

      toast({
        title: entry.is_favorited ? 'Removed from favorites' : 'Added to favorites',
      });
      router.refresh();
    } catch {
      toast({
        title: 'Failed to update',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleDownload = (entry: ReaderLibraryEntryDetailed) => {
    router.push(`/reader/purchase/${entry.id}?type=download`);
  };

  const handleRemove = async (entry: ReaderLibraryEntryDetailed) => {
    if (!confirm(`Remove "${entry.script_name}" from your library?`)) {
      return;
    }

    try {
      const response = await apiFetch(`/api/reader/library/${entry.id}`, {
        method: 'DELETE',
      });

      if (!response.ok) throw new Error('Failed to remove');

      toast({
        title: 'Script removed',
        description: 'The script has been removed from your library.',
      });
      router.refresh();
    } catch {
      toast({
        title: 'Failed to remove',
        description: 'Please try again.',
        variant: 'destructive',
      });
    }
  };

  const handleUnlock = (entry: ReaderLibraryEntryDetailed) => {
    router.push(`/reader/purchase/${entry.id}?type=unlock`);
  };

  const handleAddNote = (entry: ReaderLibraryEntryDetailed) => {
    router.push(`/reader/library/${entry.id}/notes`);
  };

  const renderScriptList = (scripts: ReaderLibraryEntryDetailed[]) => {
    const filtered = filterBySearch(scripts);

    if (filtered.length === 0 && searchQuery) {
      return (
        <Card className="border-dashed">
          <CardContent className="p-8 text-center">
            <Search className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="font-medium mb-2">No matching scripts</h3>
            <p className="text-sm text-muted-foreground">
              Try a different search term
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {filtered.map((entry) => (
          <ReaderScriptCard
            key={entry.id}
            entry={entry}
            isPlaying={playingId === entry.id}
            onPlay={() => handlePlay(entry)}
            onPause={handlePause}
            onFavorite={() => handleFavorite(entry)}
            onDownload={() => handleDownload(entry)}
            onRemove={() => handleRemove(entry)}
            onUnlock={() => handleUnlock(entry)}
            onAddNote={() => handleAddNote(entry)}
          />
        ))}
      </div>
    );
  };

  return (
    <>
      <div className="grid lg:grid-cols-3 gap-8">
        {/* Main Column - Library */}
        <div className="lg:col-span-2 space-y-6">
          {/* Reader Code Card */}
          <Card className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-white/80 mb-1">Your Reader Code</p>
                  <p className="text-3xl font-mono font-bold tracking-wider">{readerCode}</p>
                  <p className="text-sm text-white/70 mt-2">
                    Give this to writers for free script submissions
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={handleCopyCode}
                  >
                    {copied ? (
                      <>
                        <Check className="w-4 h-4 mr-2" />
                        Copied!
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4 mr-2" />
                        Copy Code
                      </>
                    )}
                  </Button>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-0"
                    onClick={() => setQrModalOpen(true)}
                  >
                    <QrCode className="w-4 h-4 mr-2" />
                    QR Code
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Library Tabs */}
          <Tabs defaultValue="received" className="space-y-4">
            <div className="flex items-center justify-between">
              <TabsList>
                <TabsTrigger value="received" className="flex items-center gap-2">
                  <Inbox className="w-4 h-4" />
                  Received
                  <Badge variant="secondary" className="ml-1">{receivedScripts.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="uploaded" className="flex items-center gap-2">
                  <Upload className="w-4 h-4" />
                  Uploaded
                  <Badge variant="secondary" className="ml-1">{uploadedScripts.length}</Badge>
                </TabsTrigger>
                <TabsTrigger value="downloads" className="flex items-center gap-2">
                  <Download className="w-4 h-4" />
                  Downloads
                  <Badge variant="secondary" className="ml-1">{purchasedDownloads.length}</Badge>
                </TabsTrigger>
              </TabsList>

              <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" className="h-8 w-8">
                  <Filter className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search scripts..."
                className="pl-9"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            {/* Received Scripts */}
            <TabsContent value="received" className="space-y-4 mt-0">
              {receivedScripts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Inbox className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">No scripts received yet</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Share your reader code with writers to receive their scripts
                    </p>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-muted rounded-lg">
                      <span className="font-mono font-bold">{readerCode}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 px-2"
                        onClick={handleCopyCode}
                      >
                        {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                renderScriptList(receivedScripts)
              )}
            </TabsContent>

            {/* Uploaded Scripts */}
            <TabsContent value="uploaded" className="space-y-4 mt-0">
              {uploadedScripts.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Upload className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">No uploaded scripts</h3>
                    <p className="text-sm text-muted-foreground mb-4">
                      Upload scripts you want to evaluate as audio
                    </p>
                    <Link href="/reader/upload">
                      <Button>
                        <Upload className="w-4 h-4 mr-2" />
                        Upload Script ($5)
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              ) : (
                renderScriptList(uploadedScripts)
              )}
            </TabsContent>

            {/* Downloaded Scripts */}
            <TabsContent value="downloads" className="space-y-4 mt-0">
              {purchasedDownloads.length === 0 ? (
                <Card className="border-dashed">
                  <CardContent className="p-8 text-center">
                    <Download className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
                    <h3 className="font-medium mb-2">No downloads yet</h3>
                    <p className="text-sm text-muted-foreground">
                      Purchase royalty-free downloads for $25/script
                    </p>
                  </CardContent>
                </Card>
              ) : (
                renderScriptList(purchasedDownloads)
              )}
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Quick Stats */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Library Stats</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4" />
                  Total Scripts
                </span>
                <span className="font-medium">{stats.totalScripts}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Headphones className="w-4 h-4" />
                  Active
                </span>
                <span className="font-medium">{stats.activeCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Star className="w-4 h-4" />
                  Favorited
                </span>
                <span className="font-medium">{stats.favoritedCount}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Archived
                </span>
                <span className="font-medium text-amber-600">{stats.archivedCount}</span>
              </div>
            </CardContent>
          </Card>

          {/* Pricing Info */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Pricing</CardTitle>
              <CardDescription>Pay only for what you use</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span>Receive from writers</span>
                <Badge variant="outline" className="text-green-600">Free</Badge>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Upload PDF script</span>
                <span className="font-medium">$5</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>OCR scanned pages</span>
                <span className="font-medium">$8</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Unlock archived</span>
                <span className="font-medium">$5</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span>Download (royalty-free)</span>
                <span className="font-medium">$25</span>
              </div>
            </CardContent>
          </Card>

          {/* Recently Played */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recently Played</CardTitle>
            </CardHeader>
            <CardContent>
              {entries.filter(e => e.last_played_at).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No listening history yet
                </p>
              ) : (
                <div className="space-y-2">
                  {entries
                    .filter(e => e.last_played_at)
                    .sort((a, b) => new Date(b.last_played_at!).getTime() - new Date(a.last_played_at!).getTime())
                    .slice(0, 5)
                    .map(entry => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-2 p-2 rounded hover:bg-accent cursor-pointer"
                        onClick={() => handlePlay(entry)}
                      >
                        <div className="w-8 h-8 rounded bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                          <Headphones className="w-4 h-4 text-blue-600" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{entry.script_name}</p>
                          <p className="text-xs text-muted-foreground">
                            {Math.round((entry.play_position_seconds / (entry.duration_seconds || 1)) * 100)}% complete
                          </p>
                        </div>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* QR Code Modal */}
      <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Your Reader QR Code</DialogTitle>
            <DialogDescription>
              Writers can scan this to share scripts with you instantly
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center p-6">
            <div className="w-48 h-48 bg-card rounded-lg p-4 mb-4">
              {/* QR Code placeholder - would use react-qr-code in production */}
              <div className="w-full h-full flex items-center justify-center border-2 border-dashed border-border rounded">
                <QrCode className="w-16 h-16 text-muted-foreground" />
              </div>
            </div>
            <p className="text-center text-sm text-muted-foreground mb-4">
              Code: <span className="font-mono font-bold">{readerCode}</span>
            </p>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setQrModalOpen(false)}>
                Close
              </Button>
              <Button onClick={handleCopyCode}>
                <Copy className="w-4 h-4 mr-2" />
                Copy Code
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
