'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, FileText, Folder, Mic, Users, MoreHorizontal, Trash2,
  CheckCircle, Loader2, XCircle, ChevronRight, ChevronDown, BarChart2, Building2, Star,
} from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useRouter } from 'next/navigation';
import { PRICING_TIERS } from '@/lib/stripe/config';

interface Project {
  id: string;
  name: string;
  description: string | null;
  status: string;
  pageCount: number | null;
  updatedAt: Date;
}

interface DashboardTabsProps {
  projects: Project[];
  tier: string;
  tierDisplayName: string;
  tierLimit: number;
  usedPages: number;
  remaining: number;
  usagePercent: number;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; className: string }> = {
  draft:      { label: 'Draft',      icon: FileText, className: 'text-muted-foreground' },
  processing: { label: 'Processing', icon: Loader2,  className: 'text-blue-500 animate-spin' },
  completed:  { label: 'Completed',  icon: CheckCircle, className: 'text-green-500' },
  failed:     { label: 'Failed',     icon: XCircle,  className: 'text-red-500' },
};

const TABS = ['Overview', 'Projects', 'Voice Library', 'Analytics'] as const;
type Tab = typeof TABS[number];


export function DashboardTabs({
  projects, tier, tierDisplayName, tierLimit, usedPages, remaining, usagePercent,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<Tab>('Overview');
  const [expandedStat, setExpandedStat] = useState<string | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const router = useRouter();

  async function handleDeleteProject(projectId: string, projectName: string) {
    if (!window.confirm(`Delete "${projectName}"? This cannot be undone.`)) return;
    setDeletingProjectId(projectId);
    try {
      const res = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (res.ok) {
        router.refresh();
      }
    } finally {
      setDeletingProjectId(null);
    }
  }

  const toggleStat = (key: string) =>
    setExpandedStat((prev) => (prev === key ? null : key));

  const recentProjects = projects.slice(0, 3);

  return (
    <div className="space-y-6">

      {/* ── Stat cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">

        {/* Total Projects */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button onClick={() => toggleStat('projects')} className="w-full p-4 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center">
                  <Folder className="w-4 h-4 text-blue-400" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedStat === 'projects' ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{projects.length}</p>
          </button>
          {expandedStat === 'projects' && (
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
              {(['draft', 'processing', 'completed', 'failed'] as const).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const Icon = cfg.icon;
                const count = projects.filter((p) => p.status === s).length;
                return (
                  <div key={s} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className={`w-3 h-3 ${cfg.className}`} />
                      {cfg.label}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Credits / Scripts Used */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button onClick={() => toggleStat('pages')} className="w-full p-4 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground">Credits/Scripts Used</p>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-cyan-500/10 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-cyan-400" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedStat === 'pages' ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">{usedPages}</p>
          </button>
          {expandedStat === 'pages' && (
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
              <Progress value={usagePercent} className="h-1.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{usedPages} used</span>
                <span>{remaining} left</span>
              </div>
              <p className="text-xs text-muted-foreground">Limit: {tierLimit} pages/mo</p>
              <p className="text-xs font-medium">{tierDisplayName}</p>
              <Link href="/billing" className="block text-xs text-blue-400 hover:text-blue-300 font-medium mt-1">
                Manage plan →
              </Link>
            </div>
          )}
        </div>

        {/* Voice Library */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button onClick={() => toggleStat('voices')} className="w-full p-4 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground">Voice Library</p>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center">
                  <Mic className="w-4 h-4 text-amber-400" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedStat === 'voices' ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">50+</p>
          </button>
          {expandedStat === 'voices' && (
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-1.5">
              {['George · Narrator', 'Will · Male Lead', 'Jessica · Female Lead', 'Luna · Supporting'].map((v) => (
                <p key={v} className="text-xs text-muted-foreground">{v}</p>
              ))}
              <Link href="/voice-marketplace" className="block text-xs text-blue-400 hover:text-blue-300 font-medium mt-1">
                Browse all →
              </Link>
            </div>
          )}
        </div>

        {/* Active Users */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button onClick={() => toggleStat('users')} className="w-full p-4 text-left hover:bg-muted/40 transition-colors">
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground">Active Users</p>
              <div className="flex items-center gap-1">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-emerald-400" />
                </div>
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expandedStat === 'users' ? 'rotate-180' : ''}`} />
              </div>
            </div>
            <p className="text-2xl font-bold text-foreground">1</p>
          </button>
          {expandedStat === 'users' && (
            <div className="px-4 pb-4 border-t border-border pt-3 space-y-2">
              <p className="text-xs text-muted-foreground">{tierDisplayName}</p>
              <Link href="/enterprise" className="block text-xs text-blue-400 hover:text-blue-300 font-medium">
                Add team members →
              </Link>
            </div>
          )}
        </div>
      </div>

      {/* ── Tab navigation ── */}
      <div className="border-b border-border">
        <div className="flex gap-0">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab
                  ? 'border-violet-500 text-violet-500'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* ── Overview tab ── */}
      {activeTab === 'Overview' && (
        <div className="space-y-6">

          {/* Subscription Plans */}
          <div>
            <h2 className="text-base font-semibold mb-3">Subscription Plans</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {PRICING_TIERS.map((plan) => {
                const isCurrent = tier === plan.tier;
                return (
                  <div
                    key={plan.tier}
                    className={`rounded-xl border p-4 flex flex-col gap-2 ${
                      isCurrent
                        ? 'border-violet-500 bg-violet-500/5'
                        : plan.highlighted
                        ? 'border-violet-400/40 bg-card'
                        : 'border-border bg-card'
                    }`}
                  >
                    {isCurrent ? (
                      <span className="text-xs font-semibold text-violet-500 uppercase tracking-wide">Current Plan</span>
                    ) : plan.highlighted ? (
                      <span className="flex items-center gap-1 text-xs font-semibold text-amber-500 uppercase tracking-wide">
                        <Star className="w-3 h-3" /> Most Popular
                      </span>
                    ) : (
                      <span className="text-xs">&nbsp;</span>
                    )}
                    <div>
                      <p className="font-semibold text-sm text-foreground">{plan.name}</p>
                      <p className="text-xs text-muted-foreground">{plan.tagline}</p>
                    </div>
                    <p className="text-base font-bold text-foreground">
                      {plan.monthlyPrice === 0 ? 'Free' : `$${plan.monthlyPrice}/mo`}
                    </p>
                    <ul className="space-y-1 flex-1">
                      {plan.features.slice(0, 3).map((feature) => (
                        <li key={feature} className="flex items-start gap-1.5 text-xs text-muted-foreground">
                          <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0 mt-0.5" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isCurrent ? (
                      <Link href="/billing">
                        <Button size="sm" variant="ghost" className="w-full text-xs h-7 text-muted-foreground">
                          Manage Plan
                        </Button>
                      </Link>
                    ) : (
                      <Link href={`/referral?plan=${plan.tier}`}>
                        <Button size="sm" variant={plan.highlighted ? 'default' : 'outline'} className={`w-full text-xs h-7${plan.highlighted ? ' brand-gradient brand-gradient-hover' : ''}`}>
                          Upgrade
                        </Button>
                      </Link>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Enterprise Packages banner — hidden for users already on studio/enterprise */}
          {!['studio', 'enterprise'].includes(tier) && <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-violet-500" />
              <p className="font-semibold text-sm text-foreground">Enterprise Packages!</p>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Team plans from $6,000/yr for 25 users — up to 100+ users with custom
              infrastructure, SSO, SOC 2 compliance, and dedicated support.
            </p>
            <Link href="/enterprise">
              <Button variant="outline" size="sm">
                View Enterprise Packages
              </Button>
            </Link>
          </div>}

          {/* Monthly Usage + Recent Projects */}
          <div className="grid sm:grid-cols-2 gap-4">

            {/* Monthly Usage */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold mb-3">Monthly Usage</h3>
              <div className="flex items-baseline gap-1 mb-1">
                <span className="text-2xl font-bold">{usedPages}</span>
                <span className="text-sm text-muted-foreground">/ {tierLimit} pages</span>
              </div>
              <Progress value={usagePercent} className="h-1.5 mb-2" />
              <p className="text-xs text-muted-foreground">{remaining} pages remaining this month</p>
              <p className="text-xs text-muted-foreground mt-1">
                Plan: <span className="font-medium text-foreground">{tierDisplayName}</span>
              </p>
              <Link href="/billing" className="block text-xs text-blue-400 hover:text-blue-300 font-medium mt-3">
                Manage billing →
              </Link>
            </div>

            {/* Recent Projects */}
            <div className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold">Recent Projects</h3>
                <button onClick={() => setActiveTab('Projects')} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  View all →
                </button>
              </div>
              {recentProjects.length === 0 ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No projects yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentProjects.map((project) => {
                    const s = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
                    const StatusIcon = s.icon;
                    return (
                      <Link key={project.id} href={`/projects/${project.id}`}>
                        <div className="flex items-center justify-between p-2.5 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <FileText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{project.name}</p>
                              <p className="text-xs text-muted-foreground" suppressHydrationWarning>
                                {project.pageCount || 0} pages · {new Date(project.updatedAt).toLocaleDateString()}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                            <StatusIcon className={`w-3.5 h-3.5 ${s.className}`} />
                            <Badge variant="outline" className="text-xs">{s.label}</Badge>
                            <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ── Projects tab ── */}
      {activeTab === 'Projects' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Projects</h2>
            <Link href="/projects/new">
              <Button className="brand-gradient brand-gradient-hover" data-testid="new-project-button">
                <Plus className="w-4 h-4 mr-2" /> New Project
              </Button>
            </Link>
          </div>

          {projects.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {projects.map((project) => {
                const s = STATUS_CONFIG[project.status] || STATUS_CONFIG.draft;
                const StatusIcon = s.icon;
                return (
                  <Card key={project.id} className="h-full transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700" data-testid="project-card">
                    <Link href={`/projects/${project.id}`} className="block cursor-pointer">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                            <FileText className="w-5 h-5 text-muted-foreground" />
                          </div>
                          <div className="flex items-center gap-1">
                            <StatusIcon className={`w-3.5 h-3.5 ${s.className}`} />
                            <Badge variant="outline" className="text-xs" data-testid="project-status">{s.label}</Badge>
                          </div>
                        </div>
                        <CardTitle className="mt-3 text-lg" data-testid="project-title">{project.name}</CardTitle>
                        <CardDescription className="line-clamp-2">{project.description || 'No description'}</CardDescription>
                      </CardHeader>
                      <CardContent className="pt-0">
                        <div className="flex items-center justify-between text-sm text-muted-foreground">
                          <span>{project.pageCount || 0} pages</span>
                          <span suppressHydrationWarning>{new Date(project.updatedAt).toLocaleDateString()}</span>
                        </div>
                      </CardContent>
                    </Link>
                    <div className="px-6 pb-3 flex justify-end" onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="w-7 h-7" aria-label="Project actions">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={deletingProjectId === project.id}
                            onClick={() => void handleDeleteProject(project.id, project.name)}
                          >
                            {deletingProjectId === project.id ? (
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            ) : (
                              <Trash2 className="w-4 h-4 mr-2" />
                            )}
                            Delete Project
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </Card>
                );
              })}
            </div>
          ) : (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <Folder className="w-10 h-10 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">Ready to bring your script to life?</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">
                  Upload a screenplay and Story Magic handles voices, music, ambience, and sound effects automatically.
                </p>
                <Link href="/projects/new">
                  <Button className="brand-gradient brand-gradient-hover" size="lg">
                    <Plus className="w-4 h-4 mr-2" /> Start Your First Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* ── Voice Library tab ── */}
      {activeTab === 'Voice Library' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Voice Library</h2>
            <Link href="/voice-marketplace">
              <Button variant="outline" size="sm">
                <Mic className="w-4 h-4 mr-2" /> Browse All Voices
              </Button>
            </Link>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <Mic className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">50+ Character Voices</p>
              <p className="text-sm text-muted-foreground mb-4">
                Browse the full voice marketplace to preview and assign character voices.
              </p>
              <Link href="/voice-marketplace">
                <Button variant="outline" size="sm">Open Voice Marketplace</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Analytics tab ── */}
      {activeTab === 'Analytics' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Analytics</h2>
          </div>
          <Card>
            <CardContent className="py-12 text-center">
              <BarChart2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm font-semibold mb-1">Analytics Dashboard</p>
              <p className="text-sm text-muted-foreground mb-4">
                Detailed usage analytics and project metrics coming soon.
              </p>
              <Link href="/admin/analytics">
                <Button variant="outline" size="sm">View Admin Analytics</Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      )}

    </div>
  );
}
