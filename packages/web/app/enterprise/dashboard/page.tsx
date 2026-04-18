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
import { Users, FolderOpen, Activity, ThumbsUp, ThumbsDown, MessageSquare, Play, Clock } from 'lucide-react';
import { SignOutButton } from '@/components/auth/sign-out-button';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';

const EVENT_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  listen_complete: { label: 'Listened to completion', icon: '🎧', color: 'text-green-500' },
  listen_start:    { label: 'Started listening',       icon: '▶️',  color: 'text-blue-500' },
  listen_progress: { label: 'Listening in progress',   icon: '⏳',  color: 'text-blue-400' },
  note_added:      { label: 'Added a note',            icon: '📝',  color: 'text-yellow-500' },
  liked:           { label: 'Liked',                   icon: '👍',  color: 'text-green-600' },
  passed:          { label: 'Passed',                  icon: '👎',  color: 'text-red-500' },
  undecided:       { label: 'Marked undecided',        icon: '🤔',  color: 'text-gray-500' },
};

function timeAgo(date: Date): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

export default async function EnterpriseDashboardPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  // Load the team owned by this user
  const team = await prisma.team.findFirst({
    where: { ownerId: userId },
    include: {
      members: {
        where: { status: 'accepted' },
        include: { user: { select: { id: true, fullName: true, email: true } } },
        orderBy: { acceptedAt: 'asc' },
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

  // If no team exists yet, show setup prompt
  if (!team) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center px-4">
        <div className="max-w-md w-full text-center">
          <Image src="/logo.png" alt="Story Magic" width={72} height={72} className="rounded-xl mx-auto mb-6" />
          <h1 className="text-2xl font-bold mb-2">Enterprise Dashboard</h1>
          <p className="text-muted-foreground mb-6">
            You don&apos;t have a team yet. Create one to start inviting team members and tracking engagement.
          </p>
          <Link href="/enterprise/team">
            <Button className="brand-gradient brand-gradient-hover">
              Create Your Team
            </Button>
          </Link>
          <p className="mt-4 text-sm">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">← Back to Dashboard</Link>
          </p>
        </div>
      </div>
    );
  }

  const memberCount = team.members.length;
  const projectCount = team.teamShares.length;
  const activityCount = team.activityLogs.length;

  // Aggregate project decisions
  const projectDecisions = team.teamShares.map((share) => {
    const reads = share.project.readerLibrary;
    return {
      project: share.project,
      liked: reads.filter(r => r.readStatus === 'liked').length,
      passed: reads.filter(r => r.readStatus === 'passed').length,
      undecided: reads.filter(r => r.readStatus === 'undecided').length,
      notes: reads.filter(r => r.notes).length,
      completed: reads.filter(r => r.completed).length,
    };
  });

  const profile = await prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true, email: true } });

  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 h-14 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard">
              <Image src="/logo.png" alt="Story Magic" width={32} height={32} className="rounded-lg" />
            </Link>
            <span className="font-semibold text-sm hidden sm:block">Enterprise</span>
            <Badge variant="secondary" className="text-xs">{team.name}</Badge>
          </div>
          <div className="flex items-center gap-2">
            <AlertsDropdown />
            <Link href="/enterprise/team">
              <Button variant="outline" size="sm">Manage Team</Button>
            </Link>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">Dashboard</Button>
            </Link>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground">Master Account</h1>
          <p className="text-muted-foreground mt-1">
            Welcome back, {profile?.fullName ?? profile?.email ?? 'Admin'}. Here&apos;s your team&apos;s activity.
          </p>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
                  <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{memberCount}</p>
                  <p className="text-xs text-muted-foreground">Team Members</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-violet-100 dark:bg-violet-900/30">
                  <FolderOpen className="w-4 h-4 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projectCount}</p>
                  <p className="text-xs text-muted-foreground">Shared Projects</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Activity className="w-4 h-4 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{activityCount}</p>
                  <p className="text-xs text-muted-foreground">Activities</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <ThumbsUp className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-2xl font-bold">{projectDecisions.reduce((s, p) => s + p.liked, 0)}</p>
                  <p className="text-xs text-muted-foreground">Total Likes</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="activity">
          <TabsList className="mb-6">
            <TabsTrigger value="activity">Activity Feed</TabsTrigger>
            <TabsTrigger value="projects">Projects</TabsTrigger>
            <TabsTrigger value="team">Team</TabsTrigger>
          </TabsList>

          {/* Activity Feed */}
          <TabsContent value="activity">
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
                          <span className="text-xs text-muted-foreground whitespace-nowrap">{timeAgo(log.createdAt)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Projects Tab */}
          <TabsContent value="projects">
            {projectDecisions.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground text-sm">No projects shared yet.</p>
                  <Link href="/dashboard" className="mt-4 inline-block">
                    <Button variant="outline" size="sm">Go to Dashboard to Share Projects</Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {projectDecisions.map(({ project, liked, passed, undecided, notes, completed }) => (
                  <Card key={project.id} className="hover:border-violet-500/50 transition-colors">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-sm font-semibold truncate">{project.name}</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center gap-3 text-sm mb-4">
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <ThumbsUp className="w-3.5 h-3.5" />
                          {liked}
                        </span>
                        <span className="flex items-center gap-1 text-red-500">
                          <ThumbsDown className="w-3.5 h-3.5" />
                          {passed}
                        </span>
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <Clock className="w-3.5 h-3.5" />
                          {undecided}
                        </span>
                        <span className="flex items-center gap-1 text-amber-500">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {notes}
                        </span>
                        <span className="flex items-center gap-1 text-blue-500">
                          <Play className="w-3.5 h-3.5" />
                          {completed}
                        </span>
                      </div>
                      <Link href={`/projects/${project.id}`}>
                        <Button variant="outline" size="sm" className="w-full text-xs">View Project</Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base">Team Members</CardTitle>
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
                          <p className="text-xs text-muted-foreground">{member.user?.email}</p>
                        </div>
                        <Badge variant="secondary" className="text-xs capitalize">{member.role}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
