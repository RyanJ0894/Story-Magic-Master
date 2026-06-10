'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Users, Mail, Trash2, Plus, ArrowLeft, ChevronDown, ChevronRight, UserMinus, UserCheck } from 'lucide-react';
import { apiFetch } from '@/lib/api/fetch';
import { EnterpriseErrorBoundary } from '@/components/enterprise/EnterpriseErrorBoundary';

interface TeamMember {
  id: string;
  userId: string | null;
  invitedEmail: string | null;
  role: string;
  memberType?: string | null;
  status: string;
  deactivatedAt?: string | null;
  user?: { id: string; fullName: string | null; email: string | null } | null;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

const MEMBER_TYPES = [
  { value: 'talent_actor', label: 'Talent / Actor' },
  { value: 'staff', label: 'Staff' },
  { value: 'representation', label: 'Representation' },
  { value: 'production', label: 'Production' },
];

const MEMBER_TYPE_LABELS: Record<string, string> = {
  talent_actor: 'Talent / Actor',
  staff: 'Staff',
  representation: 'Representation',
  production: 'Production',
};

export default function EnterpriseTeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState('');
  const [inviteMemberType, setInviteMemberType] = useState<string>('talent_actor');
  const [inviting, setInviting] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [confirmPending, setConfirmPending] = useState<{ memberId: string; label: string; action: 'remove' | 'deactivate' | 'reactivate' } | null>(null);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) return;
      const data = await res.json();
      const owned: Team[] = data.owned ?? [];
      setTeams(owned);
      setSelectedTeam(prev => {
        if (!prev) return owned[0] ?? null;
        return owned.find(t => t.id === prev.id) ?? owned[0] ?? null;
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreatingTeam(true);
    try {
      const res = await apiFetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create team');
      setTeamName('');
      setShowCreateForm(false);
      toast.success('Team created!');
      // Reload full list to get accurate state from server
      await loadTeams();
    } catch {
      toast.error('Failed to create team');
    } finally {
      setCreatingTeam(false);
    }
  };

  const inviteMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTeam || !inviteEmail.trim()) return;
    setInviting(true);
    try {
      const res = await apiFetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: inviteEmail.trim(),
          name: inviteName.trim() || undefined,
          memberType: inviteMemberType,
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to invite');
      }
      setInviteEmail('');
      setInviteName('');
      toast.success(`Invite sent to ${inviteEmail}`);
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to invite member');
    } finally {
      setInviting(false);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!selectedTeam) return;
    try {
      const res = await apiFetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ memberId }),
      });
      if (!res.ok) throw new Error('Failed to remove');
      toast.success('Member removed');
      await loadTeams();
    } catch {
      toast.error('Failed to remove member');
    }
  };

  const patchMember = async (memberId: string, action: 'deactivate' | 'reactivate') => {
    if (!selectedTeam) return;
    try {
      const res = await apiFetch(`/api/teams/${selectedTeam.id}/members/${memberId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? `Failed to ${action}`);
      }
      toast.success(action === 'deactivate' ? 'Sub-account deactivated' : 'Sub-account reactivated');
      await loadTeams();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : `Failed to ${action}`);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <EnterpriseErrorBoundary>
    <div className="min-h-screen bg-background">
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 h-14 flex items-center gap-3">
          <Link href="/enterprise/dashboard">
            <Image src="/logo.png" alt="Story Magic" width={28} height={28} className="rounded-lg" />
          </Link>
          <span className="text-sm text-muted-foreground">/</span>
          <span className="text-sm font-medium">Team Management</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* Header row */}
        <div className="flex items-center justify-between gap-3 mb-8">
          <div className="flex items-center gap-3">
            <Link href="/enterprise/dashboard">
              <Button variant="ghost" size="sm" className="gap-1.5">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
            </Link>
            <h1 className="text-xl font-bold">Team Management</h1>
          </div>
          {/* Show "New Team" toggle only when at least one team exists */}
          {teams.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowCreateForm(v => !v)}
            >
              {showCreateForm ? <ChevronDown className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              New Team
            </Button>
          )}
        </div>

        {/* Create form — shown when no teams, OR when user toggled it open */}
        {(teams.length === 0 || showCreateForm) && (
          <Card className="max-w-md mb-6">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                {teams.length === 0 ? 'Create Your Team' : 'Create New Team'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={createTeam} className="space-y-4">
                <div>
                  <Label htmlFor="teamName">Team Name</Label>
                  <Input
                    id="teamName"
                    value={teamName}
                    onChange={e => setTeamName(e.target.value)}
                    placeholder="e.g. Answers Film LLC"
                    className="mt-1"
                    autoFocus={showCreateForm}
                  />
                </div>
                <div className="flex gap-2">
                  <Button
                    type="submit"
                    disabled={creatingTeam || !teamName.trim()}
                    className="flex-1 brand-gradient brand-gradient-hover"
                  >
                    {creatingTeam ? 'Creating...' : 'Create Team'}
                  </Button>
                  {teams.length > 0 && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => { setShowCreateForm(false); setTeamName(''); }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Team list + management — only when teams exist */}
        {teams.length > 0 && (
          <div className="space-y-6">
            {/* Team selector — tabs when multiple teams */}
            {teams.length > 1 && (
              <div>
                <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Select Team</p>
                <div className="flex flex-wrap gap-2">
                  {teams.map(t => (
                    <Button
                      key={t.id}
                      variant={t.id === selectedTeam?.id ? 'default' : 'outline'}
                      size="sm"
                      className={t.id === selectedTeam?.id ? 'brand-gradient brand-gradient-hover' : ''}
                      onClick={() => setSelectedTeam(teams.find(x => x.id === t.id) ?? null)}
                    >
                      {t.name}
                      <Badge
                        variant="secondary"
                        className="ml-1.5 text-xs"
                      >
                        {(t.members ?? []).filter(m => m.status === 'accepted').length}
                      </Badge>
                    </Button>
                  ))}
                </div>
              </div>
            )}

            {selectedTeam && (
              <div className="grid gap-6 lg:grid-cols-2">
                {/* Invite member */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Mail className="w-4 h-4" />
                      Invite to {selectedTeam.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={inviteMember} className="space-y-4">
                      <div>
                        <Label htmlFor="invite-name">Name</Label>
                        <Input
                          id="invite-name"
                          type="text"
                          value={inviteName}
                          onChange={e => setInviteName(e.target.value)}
                          placeholder="Sarah Johnson"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-email">Email Address</Label>
                        <Input
                          id="invite-email"
                          type="email"
                          value={inviteEmail}
                          onChange={e => setInviteEmail(e.target.value)}
                          placeholder="actor@example.com"
                          className="mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="invite-type">Member Type</Label>
                        <Select value={inviteMemberType} onValueChange={setInviteMemberType}>
                          <SelectTrigger id="invite-type" className="mt-1">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {MEMBER_TYPES.map(t => (
                              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <Button
                        type="submit"
                        disabled={inviting || !inviteEmail.trim()}
                        className="w-full brand-gradient brand-gradient-hover gap-1.5"
                      >
                        <Plus className="w-4 h-4" />
                        {inviting ? 'Sending Invite...' : 'Send Invite'}
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Member list */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Users className="w-4 h-4" />
                      Members ({(selectedTeam.members ?? []).filter(m => m.status === 'accepted' && !m.deactivatedAt).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {/* Active members */}
                    {(() => {
                      const active = (selectedTeam.members ?? []).filter(m => m.status === 'accepted' && !m.deactivatedAt);
                      return active.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-4">
                          No active members yet. Invite your first team member.
                        </p>
                      ) : (
                        <div className="max-h-[360px] overflow-y-auto space-y-2 pr-1">
                          {active.map(m => (
                            <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                              <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-medium text-violet-600 dark:text-violet-400 shrink-0">
                                {(m.user?.fullName ?? m.invitedEmail ?? '?')[0].toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">
                                  {m.user?.fullName ?? m.invitedEmail}
                                </p>
                                <Badge variant="secondary" className="text-xs mt-0.5">
                                  {m.memberType ? MEMBER_TYPE_LABELS[m.memberType] ?? m.memberType : 'Member'}
                                </Badge>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Deactivate (90-day retention)"
                                className="shrink-0 text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-900/20"
                                onClick={() => {
                                  const name = m.user?.fullName ?? m.invitedEmail ?? 'this member';
                                  setConfirmPending({ memberId: m.id, action: 'deactivate', label: `Deactivate ${name}? They will lose access immediately. Their record is retained for 90 days.` });
                                }}
                              >
                                <UserMinus className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                title="Remove permanently"
                                className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                onClick={() => {
                                  const name = m.user?.fullName ?? m.invitedEmail ?? 'this member';
                                  setConfirmPending({ memberId: m.id, action: 'remove', label: `Permanently remove ${name} from the team?` });
                                }}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      );
                    })()}

                    {/* Pending invitations */}
                    {(() => {
                      const pending = (selectedTeam.members ?? []).filter(m => m.status === 'pending');
                      if (pending.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Pending Invitations ({pending.length})
                          </p>
                          <div className="max-h-[280px] overflow-y-auto space-y-2 pr-1">
                            {pending.map(m => (
                              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-dashed border-border">
                                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center text-sm font-medium text-muted-foreground shrink-0">
                                  {(m.invitedEmail ?? '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-muted-foreground truncate">{m.invitedEmail}</p>
                                  <p className="text-xs text-muted-foreground/60">Invite pending</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="shrink-0 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    setConfirmPending({ memberId: m.id, action: 'remove', label: `Cancel invite for ${m.invitedEmail}?` });
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Deactivated sub-accounts (90-day retention) */}
                    {(() => {
                      const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
                      const deactivated = (selectedTeam.members ?? []).filter(m =>
                        m.deactivatedAt && new Date(m.deactivatedAt) > ninetyDaysAgo
                      );
                      if (deactivated.length === 0) return null;
                      return (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">
                            Deactivated ({deactivated.length}) — retained for 90 days
                          </p>
                          <div className="max-h-[200px] overflow-y-auto space-y-2 pr-1">
                            {deactivated.map(m => (
                              <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg bg-muted/20 border border-dashed border-amber-200 dark:border-amber-900/40 opacity-70">
                                <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-sm font-medium text-amber-600 shrink-0">
                                  {(m.user?.fullName ?? m.invitedEmail ?? '?')[0].toUpperCase()}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-medium truncate">{m.user?.fullName ?? m.invitedEmail}</p>
                                  <p className="text-xs text-muted-foreground/60">Deactivated</p>
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Reactivate"
                                  className="shrink-0 text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-900/20"
                                  onClick={() => {
                                    const name = m.user?.fullName ?? m.invitedEmail ?? 'this member';
                                    setConfirmPending({ memberId: m.id, action: 'reactivate', label: `Reactivate ${name}? They will regain access to shared projects.` });
                                  }}
                                >
                                  <UserCheck className="w-3.5 h-3.5" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  title="Delete permanently"
                                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => {
                                    const name = m.user?.fullName ?? m.invitedEmail ?? 'this member';
                                    setConfirmPending({ memberId: m.id, action: 'remove', label: `Permanently delete ${name}? This cannot be undone.` });
                                  }}
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        )}
      </main>

      {/* Confirm remove/cancel dialog — replaces window.confirm */}
      <Dialog open={!!confirmPending} onOpenChange={(open) => { if (!open) setConfirmPending(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Are you sure?</DialogTitle>
            <DialogDescription>{confirmPending?.label}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPending(null)}>Cancel</Button>
            <Button
              variant={confirmPending?.action === 'reactivate' ? 'default' : 'destructive'}
              onClick={() => {
                if (confirmPending) {
                  if (confirmPending.action === 'remove') void removeMember(confirmPending.memberId);
                  else void patchMember(confirmPending.memberId, confirmPending.action);
                }
                setConfirmPending(null);
              }}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </EnterpriseErrorBoundary>
  );
}
