'use client';

import { useState } from 'react';
import { log } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Copy,
  Mail,
  Link2,
  QrCode,
  Clock,
  CheckCircle,
  Users,
  Download,
  Eye,
} from 'lucide-react';
import type { ScriptShare, AccessLevel } from '@/lib/types/marketplace';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  writerCode: string;
  existingShares?: ScriptShare[];
  onCreateShare?: (options: {
    access_level: AccessLevel;
    expires_in_hours?: number;
    recipient_email?: string;
  }) => Promise<{ url: string; token: string }>;
}

export function ShareModal({
  open,
  onOpenChange,
  projectId,
  projectName,
  writerCode,
  existingShares = [],
  onCreateShare,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('stream');
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showAllShares, setShowAllShares] = useState(false);
  const { toast } = useToast();

  const handleCopy = async (url: string) => {
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCreateShare = async () => {
    if (!onCreateShare) return;

    setIsCreating(true);
    try {
      const expiresInHours = expiresIn === 'never' ? undefined : parseInt(expiresIn, 10);
      const result = await onCreateShare({
        access_level: accessLevel,
        expires_in_hours: expiresInHours,
        recipient_email: recipientEmail || undefined,
      });
      setShareUrl(result.url);
    } catch (error) {
      log.error('Failed to create share', error);
      toast({
        variant: 'destructive',
        title: 'Share link failed',
        description: 'Could not create the share link. Please try again.',
      });
    } finally {
      setIsCreating(false);
    }
  };

  const handleEmailShare = () => {
    if (!shareUrl) return;
    const subject = encodeURIComponent(`Check out my script: ${projectName}`);
    const body = encodeURIComponent(
      `Hi,\n\nI'd like to share my screenplay "${projectName}" with you. You can listen to the audio version here:\n\n${shareUrl}\n\nLet me know what you think!\n\nBest`
    );
    window.open(`mailto:${recipientEmail}?subject=${subject}&body=${body}`);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Share &ldquo;{projectName}&rdquo;</DialogTitle>
          <DialogDescription>
            Create a shareable link or send directly to industry readers
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="share" className="mt-4">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="share">
              <Link2 className="w-4 h-4 mr-2" />
              Share
            </TabsTrigger>
            <TabsTrigger value="qr">
              <QrCode className="w-4 h-4 mr-2" />
              QR Code
            </TabsTrigger>
          </TabsList>

          {/* Share Tab — Link + optional Email in one flow */}
          <TabsContent value="share" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Access Level</Label>
                <Select value={accessLevel} onValueChange={(v) => setAccessLevel(v as AccessLevel)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="stream">
                      <div className="flex items-center gap-2">
                        <Eye className="w-4 h-4" />
                        Stream Only
                      </div>
                    </SelectItem>
                    <SelectItem value="download">
                      <div className="flex items-center gap-2">
                        <Download className="w-4 h-4" />
                        Allow Download
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Expires</Label>
                <Select value={expiresIn} onValueChange={setExpiresIn}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">Never</SelectItem>
                    <SelectItem value="24">24 hours</SelectItem>
                    <SelectItem value="168">7 days</SelectItem>
                    <SelectItem value="720">30 days</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>
                Recipient Email{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <Input
                type="email"
                placeholder="agent@talent-agency.com"
                value={recipientEmail}
                onChange={(e) => setRecipientEmail(e.target.value)}
              />
            </div>

            {shareUrl ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Input
                    value={shareUrl}
                    readOnly
                    className="font-mono text-sm"
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => handleCopy(shareUrl)}
                  >
                    {copied ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                </div>

                {recipientEmail && (
                  <Button variant="outline" className="w-full" onClick={handleEmailShare}>
                    <Mail className="w-4 h-4 mr-2" />
                    Open Email Client
                  </Button>
                )}
              </div>
            ) : (
              <Button className="w-full" onClick={handleCreateShare} disabled={isCreating}>
                {isCreating ? 'Creating...' : 'Create Share Link'}
              </Button>
            )}

            <p className="text-xs text-muted-foreground text-center">
              Anyone with this link can access the audio. Readers will need a free account.
            </p>
          </TabsContent>

          {/* QR Code Tab */}
          <TabsContent value="qr" className="space-y-4 mt-4">
            <div className="flex flex-col items-center gap-4">
              <div className="w-48 h-48 bg-muted rounded-lg flex items-center justify-center border-2 border-dashed">
                <QrCode className="w-24 h-24 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground text-center">
                Perfect for in-person pitches. Show this QR code for instant access.
              </p>
            </div>

            <div className="space-y-2">
              <Label>QR Code Type</Label>
              <Select defaultValue="temporary">
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="temporary">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4" />
                      Temporary (24h, 1 play)
                    </div>
                  </SelectItem>
                  <SelectItem value="permanent">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-4 h-4" />
                      Permanent Link
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button className="w-full" variant="outline">
              <Download className="w-4 h-4 mr-2" />
              Download QR Code
            </Button>
          </TabsContent>
        </Tabs>

        {/* Existing Shares */}
        {existingShares.length > 0 && (
          <div className="mt-6 pt-4 border-t">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-medium">Active Shares</h4>
              <Badge variant="secondary">{existingShares.length}</Badge>
            </div>
            <div className="space-y-2 max-h-32 overflow-y-auto">
              {(showAllShares ? existingShares : existingShares.slice(0, 5)).map((share) => (
                <div
                  key={share.id}
                  className="flex items-center justify-between text-sm p-2 rounded-lg bg-muted"
                >
                  <div className="flex items-center gap-2">
                    <Users className="w-4 h-4 text-muted-foreground" />
                    <span className="text-muted-foreground">
                      {share.view_count} views
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {share.expires_at
                      ? `Expires ${new Date(share.expires_at).toLocaleDateString()}`
                      : 'No expiry'}
                  </span>
                </div>
              ))}
            </div>
            {existingShares.length > 5 && !showAllShares && (
              <button
                onClick={() => setShowAllShares(true)}
                className="mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                View all ({existingShares.length})
              </button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
