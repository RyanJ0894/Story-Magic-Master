'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, FileText, Folder, Mic, BarChart2, Users, Clock,
  CheckCircle, Loader2, XCircle, ChevronRight, ChevronDown, Music, Zap,
} from 'lucide-react';

type TabId = 'overview' | 'projects' | 'voices' | 'analytics';

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
  draft: { label: 'Draft', icon: FileText, className: 'text-muted-foreground' },
  processing: { label: 'Processing', icon: Loader2, className: 'text-blue-500 animate-spin' },
  completed: { label: 'Completed', icon: CheckCircle, className: 'text-green-500' },
  failed: { label: 'Failed', icon: XCircle, className: 'text-red-500' },
};

const TIER_CARDS = [
  { ids: ['free'], label: 'Individual', sublabel: 'Free Trial', pages: '3', color: 'border-slate-600 bg-slate-800/40', contactSales: false },
  { ids: ['creator'], label: 'Starter Enterprise', sublabel: 'Creator', pages: '50', color: 'border-blue-700 bg-blue-900/30', contactSales: false },
  { ids: ['pro', 'studio'], label: 'Professional', sublabel: 'Pro · Studio', pages: '200–1,000', color: 'border-cyan-700 bg-cyan-900/30', contactSales: false },
  { ids: ['enterprise', 'university'], label: 'Enterprise', sublabel: 'Unlimited · Academic', pages: null, color: 'border-emerald-700 bg-emerald-900/30', contactSales: true },
];

const SAMPLE_VOICES = [
  { name: 'Echo', type: 'Narrator', gender: 'Male', age: '40–50', style: 'Authoritative', available: true },
  { name: 'Nova', type: 'Lead', gender: 'Female', age: '25–35', style: 'Dynamic', available: true },
  { name: 'Atlas', type: 'Supporting', gender: 'Male', age: '30–40', style: 'Calm', available: true },
  { name: 'Lyra', type: 'Lead', gender: 'Female', age: '20–30', style: 'Emotive', available: true },
  { name: 'Orion', type: 'Villain', gender: 'Male', age: '40–55', style: 'Intense', available: true },
  { name: 'Sage', type: 'Supporting', gender: 'Non-binary', age: '25–35', style: 'Thoughtful', available: true },
  { name: 'Blaze', type: 'Action', gender: 'Male', age: '28–38', style: 'Energetic', available: true },
  { name: 'Celeste', type: 'Narrator', gender: 'Female', age: '35–45', style: 'Warm', available: true },
];

const RECENT_ACTIVITY = [
  { action: 'Audio generated', detail: 'Scene 3 completed', time: '2 hours ago', icon: '🎧' },
  { action: 'Script uploaded', detail: 'New screenplay added', time: '1 day ago', icon: '📄' },
  { action: 'Voice assigned', detail: 'Echo → Narrator role', time: '1 day ago', icon: '🎤' },
  { action: 'Project shared', detail: 'Shared with team', time: '3 days ago', icon: '👥' },
];

export function DashboardTabs({
  projects, tier, tierDisplayName, tierLimit, usedPages, remaining, usagePercent,
}: DashboardTabsProps) {
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [expandedStat, setExpandedStat] = useState<string | null>(null);

  const recentProjects = projects.slice(0, 3);

  const statusCounts = ['draft', 'processing', 'completed', 'failed'].map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));

  const toggleStat = (label: string) =>
    setExpandedStat((prev) => (prev === label ? null : label));

  return (
    <div>
      {/* Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Total Projects */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleStat('projects')}
            className="w-full p-4 text-left hover:bg-muted/40 transition-colors"
          >
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
              {statusCounts.map(({ status, count }) => {
                const s = STATUS_CONFIG[status];
                const Icon = s.icon;
                return (
                  <div key={status} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      <Icon className={`w-3 h-3 ${s.className}`} />
                      {s.label}
                    </span>
                    <span className="font-medium">{count}</span>
                  </div>
                );
              })}
              <button onClick={() => { setActiveTab('projects'); setExpandedStat(null); }} className="mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium">
                View all →
              </button>
            </div>
          )}
        </div>

        {/* Pages Used */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleStat('pages')}
            className="w-full p-4 text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-sm text-muted-foreground">Pages Used</p>
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
            </div>
          )}
        </div>

        {/* Voice Library */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleStat('voices')}
            className="w-full p-4 text-left hover:bg-muted/40 transition-colors"
          >
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
              {SAMPLE_VOICES.slice(0, 4).map((v) => (
                <div key={v.name} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground">{v.name}</span>
                  <span className="text-muted-foreground/60">{v.type}</span>
                </div>
              ))}
              <button onClick={() => { setActiveTab('voices'); setExpandedStat(null); }} className="mt-1 text-xs text-blue-400 hover:text-blue-300 font-medium">
                Browse all →
              </button>
            </div>
          )}
        </div>

        {/* Active Users */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button
            onClick={() => toggleStat('users')}
            className="w-full p-4 text-left hover:bg-muted/40 transition-colors"
          >
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
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center">
                  <Users className="w-3 h-3 text-emerald-400" />
                </div>
                <span className="text-xs font-medium">You</span>
                <span className="text-xs text-muted-foreground ml-auto">{tierDisplayName}</span>
              </div>
              {['enterprise', 'studio', 'pro', 'creator'].includes(tier) && (
                <button onClick={() => setActiveTab('overview')} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  Manage team →
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-1 p-1 bg-muted rounded-lg mb-8 w-fit">
        {([
          { id: 'overview', label: 'Overview', icon: BarChart2 },
          { id: 'projects', label: 'Projects', icon: Folder },
          { id: 'voices', label: 'Voice Library', icon: Mic },
          { id: 'analytics', label: 'Analytics', icon: Zap },
        ] as { id: TabId; label: string; icon: React.ElementType }[]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? 'bg-background text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div className="space-y-8">
          {/* Subscription Plan */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Subscription Plans</h2>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {TIER_CARDS.map((t) => {
                const isCurrent = t.ids.includes(tier);
                return (
                  <div
                    key={t.ids[0]}
                    className={`relative border rounded-xl p-4 flex flex-col transition-all ${t.color} ${
                      isCurrent ? 'ring-2 ring-blue-500' : ''
                    }`}
                  >
                    {isCurrent && (
                      <span className="absolute -top-2 left-4 px-2 py-0.5 bg-blue-600 text-white text-xs font-bold rounded-full">
                        Current Plan
                      </span>
                    )}
                    <p className="font-semibold text-sm text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{t.sublabel}</p>
                    <p className="text-xs text-muted-foreground mt-2 flex-1">
                      {t.pages ? `${t.pages} pages/month` : 'Unlimited pages'}
                    </p>
                    {t.contactSales && (
                      <a
                        href="mailto:sales@storymagicapp.net"
                        className="block mt-3 text-xs text-emerald-400 hover:text-emerald-300 font-medium"
                      >
                        Contact Sales →
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Usage + Recent Projects */}
          <div className="grid lg:grid-cols-3 gap-8">
            {/* Usage */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h3 className="text-sm font-semibold text-foreground mb-4">Monthly Usage</h3>
              <div className="flex items-end justify-between mb-2">
                <span className="text-3xl font-bold">{usedPages}</span>
                <span className="text-sm text-muted-foreground">/ {tierLimit} pages</span>
              </div>
              <Progress value={usagePercent} className="h-2 mb-3" />
              <p className="text-xs text-muted-foreground">{remaining} pages remaining this month</p>
              <div className="mt-4 pt-4 border-t border-border">
                <p className="text-xs text-muted-foreground">Plan</p>
                <p className="text-sm font-medium text-foreground">{tierDisplayName}</p>
              </div>
            </div>

            {/* Recent Projects */}
            <div className="lg:col-span-2 bg-card border border-border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-foreground">Recent Projects</h3>
                <button onClick={() => setActiveTab('projects')} className="text-xs text-blue-400 hover:text-blue-300 font-medium">
                  View all →
                </button>
              </div>
              {recentProjects.length > 0 ? (
                <div className="space-y-3">
                  {recentProjects.map((p) => {
                    const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.draft;
                    const StatusIcon = s.icon;
                    return (
                      <Link key={p.id} href={`/projects/${p.id}`} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors group">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                          <FileText className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate group-hover:text-blue-400 transition-colors">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.pageCount || 0} pages · {new Date(p.updatedAt).toLocaleDateString()}</p>
                        </div>
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <StatusIcon className={`w-3.5 h-3.5 ${s.className}`} />
                          <span className="text-xs text-muted-foreground">{s.label}</span>
                        </div>
                        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                      </Link>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Folder className="w-8 h-8 text-muted-foreground mb-2" />
                  <p className="text-sm text-muted-foreground">No projects yet</p>
                  <Link href="/projects/new">
                    <Button size="sm" className="brand-gradient brand-gradient-hover mt-3">
                      <Plus className="w-3 h-3 mr-1" /> New Project
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Team Activity */}
          <div className="bg-card border border-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Team Activity</h3>
            </div>
            <div className="space-y-3">
              {RECENT_ACTIVITY.map((item, i) => (
                <div key={i} className="flex items-start gap-3 py-2 border-b border-border last:border-0">
                  <span className="text-lg leading-none mt-0.5">{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground">{item.action}</p>
                    <p className="text-xs text-muted-foreground">{item.detail}</p>
                  </div>
                  <span className="text-xs text-muted-foreground flex-shrink-0">{item.time}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Projects Tab */}
      {activeTab === 'projects' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold">All Projects</h2>
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
                  <Link key={project.id} href={`/projects/${project.id}`}>
                    <Card className="h-full transition-all hover:shadow-md hover:border-blue-300 dark:hover:border-blue-700 cursor-pointer" data-testid="project-card">
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
                          <span>{new Date(project.updatedAt).toLocaleDateString()}</span>
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
                <Folder className="w-8 h-8 text-muted-foreground mb-3" />
                <h3 className="text-lg font-semibold mb-1">No projects yet</h3>
                <p className="text-muted-foreground text-center mb-6 max-w-sm text-sm">
                  Create your first project to start transforming scripts into immersive audio.
                </p>
                <Link href="/projects/new">
                  <Button className="brand-gradient brand-gradient-hover">
                    <Plus className="w-4 h-4 mr-2" /> Create Your First Project
                  </Button>
                </Link>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Voice Library Tab */}
      {activeTab === 'voices' && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Voice Library</h2>
              <p className="text-sm text-muted-foreground mt-1">50+ AI voices available for your productions</p>
            </div>
            <Link href="/voice-marketplace">
              <Button variant="outline" size="sm">
                <Mic className="w-4 h-4 mr-2" />
                Join as Voice Actor
              </Button>
            </Link>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {SAMPLE_VOICES.map((voice) => (
              <div key={voice.name} className="bg-card border border-border rounded-xl p-4 hover:border-blue-400 dark:hover:border-blue-600 transition-colors">
                <div className="flex items-center justify-between mb-3">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500/20 to-cyan-500/20 border border-blue-500/30 flex items-center justify-center">
                    <Music className="w-5 h-5 text-blue-400" />
                  </div>
                  <Badge variant="outline" className="text-xs">{voice.type}</Badge>
                </div>
                <p className="font-semibold text-foreground">{voice.name}</p>
                <p className="text-xs text-muted-foreground mt-1">{voice.gender} · {voice.age}</p>
                <p className="text-xs text-muted-foreground">{voice.style}</p>
                <div className="mt-3 pt-3 border-t border-border">
                  <span className="flex items-center gap-1 text-xs text-green-500">
                    <CheckCircle className="w-3 h-3" /> Available
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-8 rounded-xl border border-amber-600/30 bg-amber-950/20 p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <div className="flex-1">
              <p className="font-semibold text-amber-300">🎤 Voice Marketplace Opening Soon</p>
              <p className="text-sm text-muted-foreground mt-1">
                Access 50+ licensed AI voices from real voice actors — consent-based, royalty-sharing.
              </p>
            </div>
            <Link href="/voice-marketplace">
              <Button className="bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex-shrink-0">
                Learn More
              </Button>
            </Link>
          </div>
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && (
        <div className="space-y-6">
          <h2 className="text-lg font-semibold">Analytics</h2>
          <div className="grid sm:grid-cols-3 gap-4">
            {[
              { label: 'Projects Created', value: projects.length, sub: 'All time' },
              { label: 'Pages Processed', value: usedPages, sub: 'This month' },
              { label: 'Pages Available', value: remaining, sub: `of ${tierLimit} total` },
            ].map((s) => (
              <div key={s.label} className="bg-card border border-border rounded-xl p-5">
                <p className="text-sm text-muted-foreground">{s.label}</p>
                <p className="text-3xl font-bold mt-1">{s.value}</p>
                <p className="text-xs text-muted-foreground mt-1">{s.sub}</p>
              </div>
            ))}
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Monthly Usage</h3>
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm text-muted-foreground">Pages used</span>
              <span className="text-sm font-medium">{usedPages} / {tierLimit}</span>
            </div>
            <Progress value={usagePercent} className="h-3 mb-2" />
            <p className="text-xs text-muted-foreground">{Math.round(usagePercent)}% of monthly limit used</p>
          </div>
          <div className="bg-card border border-border rounded-xl p-5">
            <h3 className="text-sm font-semibold mb-4">Projects by Status</h3>
            <div className="space-y-3">
              {['draft', 'processing', 'completed', 'failed'].map((status) => {
                const count = projects.filter((p) => p.status === status).length;
                const s = STATUS_CONFIG[status];
                const StatusIcon = s.icon;
                return (
                  <div key={status} className="flex items-center gap-3">
                    <StatusIcon className={`w-4 h-4 ${s.className}`} />
                    <span className="text-sm flex-1">{s.label}</span>
                    <span className="text-sm font-medium">{count}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
