'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Plus, FileText, Folder, Mic, Users,
  CheckCircle, Loader2, XCircle, ChevronRight, ChevronDown, BarChart2, CreditCard,
} from 'lucide-react';

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

export function DashboardTabs({
  projects, tier, tierDisplayName, tierLimit, usedPages, remaining, usagePercent,
}: DashboardTabsProps) {
  const [expandedStat, setExpandedStat] = useState<string | null>(null);

  const statusCounts = ['draft', 'processing', 'completed', 'failed'].map((s) => ({
    status: s,
    count: projects.filter((p) => p.status === s).length,
  }));

  const toggleStat = (key: string) =>
    setExpandedStat((prev) => (prev === key ? null : key));

  return (
    <div className="space-y-8">

      {/* Stat cards */}
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
            </div>
          )}
        </div>

        {/* Pages Used */}
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <button onClick={() => toggleStat('pages')} className="w-full p-4 text-left hover:bg-muted/40 transition-colors">
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
              {['Echo · Narrator', 'Nova · Lead', 'Atlas · Supporting', 'Lyra · Lead'].map((v) => (
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
              {['enterprise', 'studio', 'pro', 'creator'].includes(tier) && (
                <Link href="/enterprise/dashboard" className="block text-xs text-blue-400 hover:text-blue-300 font-medium">
                  Manage team →
                </Link>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Projects — primary content */}
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
                        <span suppressHydrationWarning>{new Date(project.updatedAt).toLocaleDateString()}</span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
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

      {/* Subscription Plans */}
      <div className="pt-2 border-t border-border">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Subscription Plans</h2>
          <Link href="/enterprise" className="text-sm text-blue-400 hover:text-blue-300 font-medium">
            View Enterprise Packages →
          </Link>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[
            { key: 'free',    label: 'Individual',   pages: '3 pages/mo',    price: 'Free' },
            { key: 'creator', label: 'Starter',      pages: '50 pages/mo',   price: '$29/mo' },
            { key: 'pro',     label: 'Professional', pages: '200 pages/mo',  price: '$79/mo' },
            { key: 'studio',  label: 'Studio',       pages: '1,000 pages/mo',price: '$199/mo' },
          ].map((plan) => (
            <div
              key={plan.key}
              className={`rounded-xl border p-4 flex flex-col gap-3 ${
                tier === plan.key
                  ? 'border-violet-500 bg-violet-500/5'
                  : 'border-border bg-card'
              }`}
            >
              <div>
                <p className="font-semibold text-sm text-foreground">{plan.label}</p>
                <p className="text-xs text-muted-foreground">{plan.pages}</p>
              </div>
              <p className="text-sm font-bold text-foreground">{plan.price}</p>
              {tier === plan.key ? (
                <span className="text-xs font-medium text-violet-500">Current Plan</span>
              ) : (
                <Link href={`/referral?plan=${plan.key}`}>
                  <Button size="sm" variant="outline" className="w-full text-xs h-7">
                    Upgrade
                  </Button>
                </Link>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Secondary links */}
      <div className="flex flex-wrap gap-3 pt-2 border-t border-border">
        <Link href="/voice-marketplace" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <Mic className="w-4 h-4" /> Voice Library
          <ChevronRight className="w-3 h-3" />
        </Link>
        <Link href="/billing" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <CreditCard className="w-4 h-4" /> Billing &amp; Plans
          <ChevronRight className="w-3 h-3" />
        </Link>
        <Link href="/admin/analytics" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
          <BarChart2 className="w-4 h-4" /> Analytics
          <ChevronRight className="w-3 h-3" />
        </Link>
        {['enterprise', 'studio', 'pro', 'creator'].includes(tier) && (
          <Link href="/enterprise/dashboard" className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <Users className="w-4 h-4" /> Enterprise Dashboard
            <ChevronRight className="w-3 h-3" />
          </Link>
        )}
      </div>

    </div>
  );
}
