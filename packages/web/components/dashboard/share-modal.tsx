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
  CheckCircle,
  Eye,
  Download,
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
  Send,
  BarChart2,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/fetch';
import type { ScriptShare, AccessLevel } from '@/lib/types/marketplace';

interface ShareModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName: string;
  /** @deprecated QR tab removed — prop kept for call-site compatibility, not used internally */
  writerCode?: string;
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
  existingShares = [],
  onCreateShare,
}: ShareModalProps) {
  const [copied, setCopied] = useState(false);
  const [accessLevel, setAccessLevel] = useState<AccessLevel>('stream');
  const [expiresIn, setExpiresIn] = useState<string>('never');
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);
  const [showOptions, setShowOptions] = useState(false);
  const { toast } = useToast();

  // Bulk share state
  const [bulkRecipients, setBulkRecipients] = useState<Array<{ email: string; name: string }>>([
    { email: '', name: '' },
  ]);
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkExpiry, setBulkExpiry] = useState<string>('30');
  const [isSendingBulk, setIsSendingBulk] = useState(false);

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

  const addBulkRecipient = () => {
    if (bulkRecipients.length >= 20) return;
    setBulkRecipients((prev) => [...prev, { email: '', name: '' }]);
  };

  const removeBulkRecipient = (idx: number) => {
    setBulkRecipients((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateBulkRecipient = (idx: number, field: 'email' | 'name', value: string) => {
    setBulkRecipients((prev) =>
      prev.map((r, i) => (i === idx ? { ...r, [field]: value } : r))
    );
  };

  const handleBulkShare = async () => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const filled = bulkRecipients.filter((r) => r.email.trim());
    if (filled.length === 0) {
      toast({ variant: 'destructive', title: 'Add at least one recipient email' });
      return;
    }
    const invalid = filled.filter((r) => !emailRegex.test(r.email.trim()));
    if (invalid.length > 0) {
      toast({
        variant: 'destructive',
        title: 'Invalid email address',
        description: `Check: ${invalid.map((r) => r.email).join(', ')}`,
      });
      return;
    }
    const valid = filled;

    setIsSendingBulk(true);
    try {
      const res = await apiFetch(`/api/projects/${projectId}/share/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: valid.map((r) => ({
            email: r.email.trim(),
            name: r.name.trim() || undefined,
          })),
          access_level: 'stream',
          expires_in_days: parseInt(bulkExpiry, 10),
          message: bulkMessage.trim() || undefined,
        }),
      });

      if (!res.ok) {
        toast({ variant: 'destructive', title: 'Failed to send invites' });
        return;
      }

      const data = await res.json();
      const { summary } = data;
      toast({
        title: `Invites sent`,
        description: `${summary.emailsSent} of ${summary.total} emails sent successfully`,
      });

      // Reset and close
      setBulkRecipients([{ email: '', name: '' }]);
      setBulkMessage('');
      onOpenChange(false);
    } catch (err) {
      log.error('Bulk share failed', err);
      toast({ variant: 'destructive', title: 'Something went wrong' });
    } finally {
      setIsSendingBulk(false);
    }
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
              Link
            </TabsTrigger>
            <TabsTrigger value="bulk">
              <Send className="w-4 h-4 mr-2" />
              Send to...
            </TabsTrigger>
          </TabsList>

          {/* Share Tab — Link + optional Email in one flow */}
          <TabsContent value="share" className="space-y-4 mt-4">
            <button
              onClick={() => setShowOptions((v) => !v)}
              className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              {showOptions ? (
                <ChevronUp className="w-3 h-3" />
              ) : (
                <ChevronDown className="w-3 h-3" />
              )}
              {showOptions ? 'Hide options' : 'Options'}
            </button>

            {showOptions && (
              <>
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
                    placeholder="email@example.com"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                  />
                </div>
              </>
            )}

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

          {/* Bulk Share Tab */}
          <TabsContent value="bulk" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              Send personalised email invites to up to 20 people at once. Each gets their own
              unique link so you can track who listened.
            </p>

            {/* Recipients */}
            <div className="space-y-2">
              <Label>Recipients</Label>
              <div className="max-h-48 overflow-y-auto space-y-2 pr-1">
              {bulkRecipients.map((r, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={r.email}
                    onChange={(e) => updateBulkRecipient(idx, 'email', e.target.value)}
                    className="flex-1"
                  />
                  <Input
                    placeholder="Name (optional)"
                    value={r.name}
                    onChange={(e) => updateBulkRecipient(idx, 'name', e.target.value)}
                    className="w-36"
                  />
                  {bulkRecipients.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0"
                      onClick={() => removeBulkRecipient(idx)}
                    >
                      <Trash2 className="w-4 h-4 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              ))}
              </div>
              {bulkRecipients.length < 20 && (
                <Button variant="outline" size="sm" onClick={addBulkRecipient} className="w-full">
                  <Plus className="w-4 h-4 mr-2" />
                  Add recipient
                </Button>
              )}
            </div>

            {/* Message */}
            <div className="space-y-2">
              <Label>
                Personal message{' '}
                <span className="text-muted-foreground font-normal">(optional)</span>
              </Label>
              <textarea
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none min-h-[80px] focus:outline-none focus:ring-2 focus:ring-ring"
                placeholder={'Hi {name},\n\nHere\'s the audio for my screenplay...'}
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                maxLength={1000}
              />
              <p className="text-xs text-muted-foreground">
                Use <code className="bg-muted px-1 rounded">{'{name}'}</code> to personalise per recipient.
              </p>
            </div>

            {/* Expiry */}
            <div className="space-y-2">
              <Label>Link expires in</Label>
              <Select value={bulkExpiry} onValueChange={setBulkExpiry}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="7">7 days</SelectItem>
                  <SelectItem value="30">30 days</SelectItem>
                  <SelectItem value="90">90 days</SelectItem>
                  <SelectItem value="365">1 year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full"
              onClick={handleBulkShare}
              disabled={isSendingBulk || bulkRecipients.every((r) => !r.email.trim())}
            >
              {isSendingBulk ? (
                'Sending…'
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send {bulkRecipients.filter((r) => r.email.trim()).length} invite
                  {bulkRecipients.filter((r) => r.email.trim()).length === 1 ? '' : 's'}
                </>
              )}
            </Button>
          </TabsContent>

        </Tabs>

        {/* Dashboard Link */}
        <div className="mt-4 pt-3 border-t flex items-center justify-between">
          <a
            href={`/projects/${projectId}/shares`}
            className="text-xs text-muted-foreground hover:text-violet-500 transition-colors flex items-center gap-1"
          >
            <BarChart2 className="w-3 h-3" />
            View share tracking dashboard
          </a>
          {existingShares.length > 0 && (
            <Badge variant="secondary" className="text-xs">
              {existingShares.length} share{existingShares.length === 1 ? '' : 's'}
            </Badge>
          )}
        </div>

      </DialogContent>
    </Dialog>
  );
}
