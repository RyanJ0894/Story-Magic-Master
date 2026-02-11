import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Plus, FileText, Sparkles, LogOut, Folder, HelpCircle } from 'lucide-react';
import { AlertsDropdown } from '@/components/alerts/AlertsDropdown';

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Fetch user's projects
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { updatedAt: 'desc' },
  });

  // Fetch user's profile for usage info
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  // Get remaining pages via raw query
  const remainingResult = await prisma.$queryRaw<[{ remaining: number }]>`
    SELECT COALESCE(
      (SELECT p.pages_limit - p.pages_used FROM usage p WHERE p.user_id = ${userId} AND p.period = to_char(now(), 'YYYY-MM') LIMIT 1),
      CASE
        WHEN ${profile?.subscriptionTier ?? 'free'} = 'creator' THEN 50
        WHEN ${profile?.subscriptionTier ?? 'free'} = 'pro' THEN 200
        WHEN ${profile?.subscriptionTier ?? 'free'} = 'studio' THEN 1000
        ELSE 3
      END
    ) AS remaining
  `;
  const remainingPages = remainingResult[0]?.remaining ?? null;

  const tierLimits: Record<string, number> = {
    free: 3,
    creator: 50,
    pro: 200,
    studio: 1000,
  };

  const tierNames: Record<string, string> = {
    free: 'Free',
    creator: 'Creator',
    pro: 'Pro',
    studio: 'Studio',
  };

  const tier = profile?.subscriptionTier || 'free';
  const limit = tierLimits[tier];
  const remaining = remainingPages ?? limit;
  const usedPages = limit - remaining;
  const usagePercent = (usedPages / limit) * 100;

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, className?: string }> = {
    draft: { variant: 'secondary', label: 'Draft' },
    processing: { variant: 'default', label: 'Processing' },
    completed: { variant: 'outline', label: 'Completed', className: 'border-green-500 text-green-600 dark:text-green-400' },
    failed: { variant: 'destructive', label: 'Failed' },
  };

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <Link href="/dashboard" className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold text-lg text-foreground">Story Magic</span>
            </Link>

            <div className="flex items-center gap-4">
              {/* Alerts */}
              <AlertsDropdown />

              {/* Usage indicator */}
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-lg bg-muted" data-testid="usage-indicator">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground" data-testid="subscription-tier">{tierNames[tier]} Plan</p>
                  <p className="text-sm font-medium text-foreground">
                    {remaining} / {limit} pages
                  </p>
                </div>
                <div className="w-16">
                  <Progress value={usagePercent} className="h-2" />
                </div>
              </div>

              <Link href="/guide">
                <Button variant="ghost" size="sm" data-testid="guide-button">
                  <HelpCircle className="w-4 h-4 mr-2" />
                  Help
                </Button>
              </Link>

              <form action="/api/auth/signout" method="post">
                <Button variant="ghost" size="sm" type="submit" data-testid="signout-button">
                  <LogOut className="w-4 h-4 mr-2" />
                  Sign out
                </Button>
              </form>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">
              Your Projects
            </h1>
            <p className="mt-1 text-muted-foreground">
              Create and manage your audio productions
            </p>
          </div>
          <Link href="/projects/new">
            <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700" data-testid="new-project-button">
              <Plus className="w-4 h-4 mr-2" />
              New Project
            </Button>
          </Link>
        </div>

        {/* Mobile usage indicator */}
        <Card className="mb-6 sm:hidden">
          <CardContent className="py-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">{tierNames[tier]} Plan</span>
              <span className="text-sm text-muted-foreground">
                {remaining} / {limit} pages
              </span>
            </div>
            <Progress value={usagePercent} className="h-2" />
          </CardContent>
        </Card>

        {/* Projects Grid */}
        {projects && projects.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => {
              const status = statusConfig[project.status] || statusConfig.draft;
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="h-full transition-all hover:shadow-md hover:border-violet-300 dark:hover:border-violet-700 cursor-pointer" data-testid="project-card">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                          <FileText className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <Badge variant={status.variant} className={status.className} data-testid="project-status">{status.label}</Badge>
                      </div>
                      <CardTitle className="mt-3 text-lg" data-testid="project-title">{project.name}</CardTitle>
                      <CardDescription className="line-clamp-2">
                        {project.description || 'No description'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex items-center justify-between text-sm text-muted-foreground">
                        <span>{project.pageCount || 0} pages</span>
                        <span>
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        ) : (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
                <Folder className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-1">
                No projects yet
              </h3>
              <p className="text-muted-foreground text-center mb-6 max-w-sm">
                Create your first project to start transforming scripts into immersive audio experiences.
              </p>
              <Link href="/projects/new">
                <Button className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700">
                  <Plus className="w-4 h-4 mr-2" />
                  Create Your First Project
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
