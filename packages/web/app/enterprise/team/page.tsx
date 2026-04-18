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
import { toast } from 'sonner';
import { Users, Mail, Trash2, Plus, ArrowLeft } from 'lucide-react';

interface TeamMember {
  id: string;
  userId: string | null;
  invitedEmail: string | null;
  role: string;
  status: string;
  user?: { id: string; fullName: string | null; email: string | null } | null;
}

interface Team {
  id: string;
  name: string;
  members: TeamMember[];
}

const ROLES = [
  { value: 'talent', label: 'Talent / Actor' },
  { value: 'staff', label: 'Staff' },
  { value: 'representation', label: 'Representation' },
  { value: 'admin', label: 'Admin' },
];

export default function EnterpriseTeamPage() {
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<Team | null>(null);
  const [loading, setLoading] = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('talent');
  const [inviting, setInviting] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [creatingTeam, setCreatingTeam] = useState(false);

  const loadTeams = useCallback(async () => {
    try {
      const res = await fetch('/api/teams');
      if (!res.ok) return;
      const data = await res.json();
      const owned: Team[] = data.owned ?? [];
      setTeams(owned);
      if (owned.length > 0 && !selectedTeam) setSelectedTeam(owned[0]);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [selectedTeam]);

  useEffect(() => { loadTeams(); }, [loadTeams]);

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return;
    setCreatingTeam(true);
    try {
      const res = await fetch('/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName.trim() }),
      });
      if (!res.ok) throw new Error('Failed to create team');
      const team = await res.json();
      setTeams(prev => [team, ...prev]);
      setSelectedTeam(team);
      setTeamName('');
      toast.success('Team created!');
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
      const res = await fetch(`/api/teams/${selectedTeam.id}/members`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inviteEmail.trim(), role: inviteRole }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? 'Failed to invite');
      }
      setInviteEmail('');
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
      const res = await fetch(`/api/teams/${selectedTeam.id}/members`, {
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
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
        <div className="flex items-center gap-3 mb-8">
          <Link href="/enterprise/dashboard">
            <Button variant="ghost" size="sm" className="gap-1.5">
              <ArrowLeft className="w-4 h-4" />
              Dashboard
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Team Management</h1>
        </div>

        {teams.length === 0 ? (
          /* Create first team */
          <Card className="max-w-md">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="w-4 h-4" />
                Create Your Team
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
                    autoFocus
                  />
                </div>
                <Button type="submit" disabled={creatingTeam || !teamName.trim()} className="w-full brand-gradient brand-gradient-hover">
                  {creatingTeam ? 'Creating...' : 'Create Team'}
                </Button>
              </form>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Invite member */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Invite Member
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={inviteMember} className="space-y-4">
                  <div>
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      placeholder="actor@example.com"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label htmlFor="role">Role</Label>
                    <Select value={inviteRole} onValueChange={setInviteRole}>
                      <SelectTrigger className="mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {ROLES.map(r => (
                          <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={inviting || !inviteEmail.trim()} className="w-full brand-gradient brand-gradient-hover gap-1.5">
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
                  Members ({selectedTeam?.members.length ?? 0})
                </CardTitle>
              </CardHeader>
              <CardContent>
                {!selectedTeam || selectedTeam.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">
                    No members yet. Invite your first team member.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {selectedTeam.members.map(m => (
                      <div key={m.id} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-medium text-violet-600 dark:text-violet-400 shrink-0">
                          {(m.user?.fullName ?? m.invitedEmail ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {m.user?.fullName ?? m.invitedEmail}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <Badge variant="secondary" className="text-xs capitalize">{m.role}</Badge>
                            <Badge
                              variant={m.status === 'accepted' ? 'default' : 'secondary'}
                              className="text-xs"
                            >
                              {m.status}
                            </Badge>
                          </div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => removeMember(m.id)}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}
