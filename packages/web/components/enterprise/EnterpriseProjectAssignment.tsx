'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { FolderOpen, Plus, Minus } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  createdAt: Date;
}

interface Props {
  teamId: string;
  allProjects: Project[];
  assignedProjectIds: string[];
}

export function EnterpriseProjectAssignment({ teamId, allProjects, assignedProjectIds }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [assigned, setAssigned] = useState<Set<string>>(() => new Set(assignedProjectIds));
  const [loadingIds, setLoadingIds] = useState<Set<string>>(() => new Set());

  const setLoading = (id: string, on: boolean) =>
    setLoadingIds(prev => { const s = new Set(prev); on ? s.add(id) : s.delete(id); return s; });

  const assign = async (projectId: string) => {
    if (loadingIds.has(projectId)) return;
    setLoading(projectId, true);
    try {
      const res = await fetch('/api/teams/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, teamId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error ?? 'Failed to assign');
      }
      setAssigned(prev => new Set([...prev, projectId]));
      toast.success('Project added to team');
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to assign project');
    } finally {
      setLoading(projectId, false);
    }
  };

  const unassign = async (projectId: string) => {
    if (loadingIds.has(projectId)) return;
    setLoading(projectId, true);
    try {
      const res = await fetch('/api/teams/share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, teamId }),
      });
      if (!res.ok) throw new Error('Failed to remove');
      setAssigned(prev => { const s = new Set(prev); s.delete(projectId); return s; });
      toast.success('Project removed from team');
      startTransition(() => router.refresh());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to remove project');
    } finally {
      setLoading(projectId, false);
    }
  };

  if (allProjects.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FolderOpen className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No projects yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Create a project from your dashboard first.</p>
        </CardContent>
      </Card>
    );
  }

  const teamProjects = allProjects.filter(p => assigned.has(p.id));
  const availableProjects = allProjects.filter(p => !assigned.has(p.id));

  return (
    <div className="space-y-6">
      {/* Team projects */}
      <div>
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
          In This Team ({teamProjects.length})
        </h3>
        {teamProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground pl-1">No projects assigned yet. Add from below.</p>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {teamProjects.map(project => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/50 dark:bg-violet-900/10"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <Badge variant="secondary" className="text-xs text-violet-600 dark:text-violet-400 hidden sm:flex">Shared</Badge>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingIds.has(project.id) || pending}
                    onClick={() => void unassign(project.id)}
                    className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 h-7 w-7 p-0"
                    title="Remove from team"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Available to add */}
      {availableProjects.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide mb-3">
            Available to Add ({availableProjects.length})
          </h3>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableProjects.map(project => (
              <div
                key={project.id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{project.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(project.createdAt).toLocaleDateString('en-US')}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={loadingIds.has(project.id) || pending}
                  onClick={() => void assign(project.id)}
                  className="text-muted-foreground hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 h-7 w-7 p-0 shrink-0"
                  title="Add to team"
                >
                  <Plus className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
