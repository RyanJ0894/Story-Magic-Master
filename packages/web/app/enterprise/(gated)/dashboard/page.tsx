export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Users, FolderOpen, Activity, ThumbsUp, ThumbsDown, MessageSquare, Play, Clock, Headphones, Plus, Crown } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { NotificationBell } from '@/components/notifications/NotificationBell';
import { TeamNotesTab } from '@/components/enterprise/TeamNotesTab';
import { EnterpriseProjectAssignment } from '@/components/enterprise/EnterpriseProjectAssignment';
import { EnterpriseErrorBoundary } from '@/components/enterprise/EnterpriseErrorBoundary';
import { TimeAgo } from '@/components/ui/time-ago';

const EVENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  listen_complete: { label: 'Listened to completion', icon: '🎧', color: 'text-green-500' },
  listen_start:    { label: 'Started listening',       icon: '▶️',  color: 'text-blue-500' },
  listen_progress: { label: 'Listening in progress',   icon: '⏳',  color: 'text-blue-400' },
  note_added:      { label: 'Added a note',            icon: '📝',  color: 'text-yellow-500' },
  liked:           { label: 'Liked',                   icon: '👍',  color: 'text-green-600' },
  passed:          { label: 'Disliked',                 icon: '👎',  color: 'text-red-500' },
  undecided:       { label: 'Marked undecided',        icon: '🤔',  color: 'text-gray-500' },
};

const TIER_SEAT_LIMITS: Record<string, number> = {
  creator: 30,
  pro: 50,
  studio: 75,
  enterprise: 200,
};

export default async function EnterpriseDashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ teamId?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const { teamId: teamIdParam } = await searchParams;

  // Load profile for UI display (gate is handled by the (gated) layout)
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true, subscriptionTier: true },
  });

  // Load all teams owned by this user (for the team selector)
  const allTeams = await prisma.team.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
    orderBy: { createdAt: 'asc' },
  });

  // No team yet — send to team setup
  if (allTeams.length === 0) {
    redirect('/enterprise/team');
  }

  // Resolve which team to display; fall back to first owned team
  const resolvedTeamId = teamIdParam && allTeams.some(t => t.id === teamIdParam)
    ? teamIdParam
    : allTeams[0].id;

  // Load full team data
  const team = await prisma.team.findUnique({
    where: { id: resolvedTeamId },
    include: {
      members: {
        // Exclude deactivated sub-accounts from the master's view (DT-32-C-1).
        where: { status: 'accepted', deactivatedAt: null },
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { acceptedAt: 'asc' },
        // MAX-H-SCALE (code-review 2026-06-25): cap server-side fetch so we
        // never load thousands of rows just to render the dashboard preview.
        // Full list lives at /enterprise/team for accounts that exceed this.
        take: 50,
      },
      teamShares: {
        include: {
          project: {
            select: {
              id: true,
              name: true,
              createdAt: true,
              readerLibrary: {
                select: { readerId: true, readStatus: true, notes: true, completed: true },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        take: 20,
      },
      activityLogs: {
        include: {
          user: { select: { id: true, fullName: true, email: true } },
          project: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      },
    },
  });

  if (!team) redirect('/enterprise/team');

  // All user projects for assignment UI
  const userProjects = await prisma.project.findMany({
    where: { userId },
    select: { id: true, name: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });

  // The members include above is capped at `take: 50` for the preview list,
  // so `team.members.length` would silently report "50" for any team that
  // actually has more — a worse UX than the 480px scroller we replaced.
  // Source the headline stat from a real count query and use the loaded
  // slice only for the list render below.
  const memberCount = await prisma.teamMember.count({
    where: { teamId: resolvedTeamId, status: 'accepted', deactivatedAt: null },
  });
  const MEMBER_PREVIEW_CAP = 50;
  const hasMoreMembers = memberCount > team.members.length;

  // Aggregate project decisions
  const projectDecisions = team.teamShares.map((share) => {
    const reads = share.project.readerLibrary;
    return {
      project: share.project,
      liked: reads.filter(r => r.readStatus === 'like').length,
      passed: reads.filter(r => r.readStatus === 'pass').length,
      undecided: reads.filter(r => r.readStatus === 'undecided').length,
      notes: reads.filter(r => r.notes).length,
      completed: reads.filter(r => r.completed).length,
    };
  });

  const teamProjectIds = team.teamShares.map((s) => s.project.id);
  const NOTES_PAGE_SIZE = 20;
  const [teamComments, totalTeamComments, totalDecisions] = teamProjectIds.length > 0
    ? await Promise.all([
        prisma.projectComment.findMany({
          where: { projectId: { in: teamProjectIds } },
          include: {
            author: { select: { fullName: true, email: true } },
            project: { select: { id: true, name: true } },
          },
          orderBy: { createdAt: 'desc' },
          take: NOTES_PAGE_SIZE,
        }),
        prisma.projectComment.count({ where: { projectId: { in: teamProjectIds } } }),
        prisma.projectComment.count({ where: { projectId: { in: teamProjectIds }, reactionType: { not: null } } }),
      ])
    : [[], 0, 0];

  const seatLimit = TIER_SEAT_LIMITS[profile?.subscriptionTier ?? 'creator'] ?? 30;

  return (
    <EnterpriseErrorBoundary>
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/enterprise/dashboard">
              <Image src="/logo.png" alt="Story Magic" width={144} height={144} className="rounded-lg" />
            </Link>
            <Badge variant="secondary" className="text-xs hidden sm:flex items-center gap-1">
              <Crown className="w-3 h-3" /> Master Account
            </Badge>
          </div>
          <div className="flex items-center gap-2">
            {/* #174: Master notification feed — sole bell on the enterprise dashboard.
                The legacy AlertsDropdown stays on /dashboard, /writer/dashboard, and
                /reader/dashboard for non-master roles; here NotificationBell surfaces
                the master-account subset (sub-account joins/leaves/quota, script
                generation status, billing events). If granular collaboration alerts
                (script_comment etc.) need master visibility, extend feed-types.ts. */}
            <NotificationBell />
            <div className="hidden sm:flex flex-col items-end text-right leading-tight">
              <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{profile?.fullName || 'My Account'}</span>
              <span className="text-xs text-muted-foreground truncate max-w-[140px]">{profile?.email || ''}</span>
            </div>
            <Link href="/enterprise/team">
              <Button variant="outline" size="sm">Manage Team</Button>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Page header */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Master Dashboard</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              Team collaboration and project management for up to {seatLimit} users
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="brand-gradient brand-gradient-hover flex-shrink-0">
              <Plus className="w-4 h-4 mr-2" /> Create New Project
            </Button>
          </Link>
        </div>

        {/* Team selector — only shown when multiple teams exist */}
        {allTeams.length > 1 && (
          <div className="flex items-center gap-2 mb-6 overflow-x-auto pb-1">
            <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">Team:</span>
            {allTeams.map(t => (
              <Link
                key={t.id}
                href={`/enterprise/dashboard?teamId=${t.id}`}
              >
                <Button
                  variant={t.id === resolvedTeamId ? 'default' : 'outline'}
                  size="sm"
                  className={t.id === resolvedTeamId ? 'brand-gradient brand-gradient-hover' : ''}
                >
                  {t.name}
                </Button>
              </Link>
            ))}
            <Link href="/enterprise/team">
              <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
                <Plus className="w-3.5 h-3.5" />
                New Team
              </Button>
            </Link>
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <FolderOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{team.teamShares.length}</p>
                  <p className="text-xs text-muted-foreground">Team Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memberCount}</p>
                  <p className="text-xs text-muted-foreground">Active Users</p>
                  <p className="text-xs text-muted-foreground">of {seatLimit} max</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <Activity className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{totalDecisions}</p>
                  <p className="text-xs text-muted-foreground">Script Decisions</p>
                  <p className="text-xs text-muted-foreground">Reactions total</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Headphones className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-bold">Support</p>
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-xs text-muted-foreground">48h response</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="overview">
          <TabsList className="mb-6">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="notes">Notes & Reactions</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          {/* Overview — Activity Feed */}
          <TabsContent value="overview">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Recent Team Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {team.activityLogs.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No activity yet. Share a project with your team to start tracking engagement.
                  </p>
                ) : (
                  // MAX-H-SCALE (code-review 2026-06-25): removed the
                  // `max-h-[480px] overflow-y-auto` nested scroller. The
                  // query takes 50, so the card grows to a predictable max
                  // height; the page handles scrolling at the viewport
                  // level. Avoids the dual-scrollbar UX on mobile and the
                  // "scrollbar appears at exactly 15 items" surprise.
                  <div className="space-y-3">
                    {team.activityLogs.map((log) => {
                      const ev = EVENT_LABELS[log.eventType] ?? { label: log.eventType, icon: '•', color: 'text-muted-foreground' };
                      const meta = log.metadata as Record<string, unknown>;
                      return (
                        <div key={log.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/50 transition-colors">
                          <span className="text-lg leading-none mt-0.5">{ev.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm">
                              <span className="font-medium">{log.user.fullName ?? log.user.email}</span>
                              {' '}
                              <span className={ev.color}>{ev.label}</span>
                              {' on '}
                              <Link href={`/projects/${log.project.id}`} className="font-medium hover:underline">
                                {log.project.name}
                              </Link>
                            </p>
                            {typeof meta?.noteSnippet === 'string' && (
                              <p className="text-xs text-muted-foreground mt-0.5 truncate">&ldquo;{meta.noteSnippet}&rdquo;</p>
                            )}
                          </div>
                          <TimeAgo iso={log.createdAt.toISOString()} className="text-xs text-muted-foreground whitespace-nowrap" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Team Members — {team.name}</CardTitle>
                <Link href="/enterprise/team">
                  <Button size="sm" className="brand-gradient brand-gradient-hover">Invite Member</Button>
                </Link>
              </CardHeader>
              <CardContent>
                {team.members.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No team members yet. Invite your first member to get started.
                  </p>
                ) : (
                  // MAX-H-SCALE (code-review 2026-06-25): removed nested
                  // scroller. Members fetch is capped at 50 server-side;
                  // dedicated /enterprise/team page handles the full list
                  // for accounts that exceed the preview cap.
                  <div className="space-y-2">
                    {team.members.map((member) => (
                      <div key={member.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-muted/50">
                        <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center text-sm font-medium text-violet-600 dark:text-violet-400">
                          {(member.user?.fullName ?? member.invitedEmail ?? '?')[0].toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {member.user?.fullName ?? member.invitedEmail}
                          </p>
                          <p className="text-xs text-muted-foreground">{member.user?.email ?? 'Sub Account'}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs">
                          {(member as { memberType?: string | null }).memberType === 'talent_actor' ? 'Talent / Actor'
                            : (member as { memberType?: string | null }).memberType === 'staff' ? 'Staff'
                            : (member as { memberType?: string | null }).memberType === 'representation' ? 'Representation'
                            : 'Member'}
                        </Badge>
                      </div>
                    ))}
                    {hasMoreMembers && (
                      <Link
                        href="/enterprise/team"
                        className="block text-sm text-center py-3 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        Showing {team.members.length} of {memberCount} —
                        view all on the Team page →
                      </Link>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab — team-scoped assignment */}
          <TabsContent value="projects">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">Project Assignment — {team.name}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    Assign your projects to this team so members can listen and react.
                  </p>
                </div>
              </CardHeader>
              <CardContent>
                <EnterpriseProjectAssignment
                  key={team.id}
                  teamId={team.id}
                  allProjects={userProjects}
                  assignedProjectIds={teamProjectIds}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Notes & Reactions Tab */}
          <TabsContent value="notes">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Team Notes & Reactions</CardTitle>
              </CardHeader>
              <CardContent>
                <TeamNotesTab
                  initialComments={teamComments}
                  hasMore={totalTeamComments > NOTES_PAGE_SIZE}
                />
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics">
            <Card>
              <CardContent className="py-12 text-center">
                <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm font-semibold mb-1">Team Analytics</p>
                <p className="text-sm text-muted-foreground">
                  Detailed engagement metrics, listen rates, and decision summaries coming soon.
                </p>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
    </EnterpriseErrorBoundary>
  );
}
