import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import DeleteProjectButton from './delete-button';
import { ProjectWorkflow } from './project-workflow';
import { StoryScoreSection } from '@/components/storyscore';
import { StoryAdviserSection } from '@/components/story-adviser';
import { RevisionSection } from '@/components/revisions';
import { ComparableSection } from '@/components/comparable';
import { StoryExplorerSection } from '@/components/story-explorer';
import { ScriptEditorWrapper } from '@/components/script-editor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Clock, Loader2, Trash2, ChevronDown } from 'lucide-react';

export default async function ProjectPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Fetch project
  const project = await prisma.project.findUnique({
    where: { id: params.id },
  });

  if (!project) {
    notFound();
  }

  // Fetch ALL jobs for run history (sorted by run_number descending)
  const allJobs = await prisma.job.findMany({
    where: { projectId: params.id },
    orderBy: { runNumber: 'desc' },
  });

  // Get the latest job (first in the sorted list)
  const latestJob = allJobs && allJobs.length > 0 ? allJobs[0] : null;

  // Fetch audio outputs with job_id so we can associate with runs
  const audioOutputs = await prisma.audioOutput.findMany({
    where: { projectId: params.id },
    orderBy: { createdAt: 'desc' },
  });

  // Group audio outputs by jobId for easy lookup
  const audioByJobId = new Map<string, typeof audioOutputs>();
  if (audioOutputs) {
    for (const audio of audioOutputs) {
      if (audio.jobId) {
        const existing = audioByJobId.get(audio.jobId) || [];
        existing.push(audio);
        audioByJobId.set(audio.jobId, existing);
      }
    }
  }

  // Enrich jobs with audio info
  const enrichedJobs = allJobs?.map((job: typeof allJobs[number]) => {
    const jobAudio = audioByJobId.get(job.id) || [];
    return {
      id: job.id,
      runNumber: job.runNumber ?? 0,
      workflowMode: (job.workflowMode as 'automatic' | 'fine_tuned') ?? 'automatic',
      status: job.status as 'queued' | 'processing' | 'completed' | 'failed',
      createdAt: job.createdAt.toISOString(),
      completedAt: job.completedAt?.toISOString(),
      hasAudio: jobAudio.length > 0,
      audioOutputs: jobAudio.map((a: typeof jobAudio[number]) => ({
        id: a.id,
        fileName: a.fileName,
        filePath: a.filePath,
        durationSeconds: a.durationSeconds ? Number(a.durationSeconds) : undefined,
      })),
      error: job.error ?? undefined,
      progress: job.progress as { step?: string; percent?: number } | undefined,
    };
  }) || [];

  // Fetch story score
  const storyScore = await prisma.storyScore.findFirst({
    where: { projectId: params.id },
    select: { id: true, overallScore: true },
    orderBy: { createdAt: 'desc' },
  });

  // Fetch remaining preview budget
  const usageRow = await prisma.usage.findFirst({
    where: { userId, period: new Date().toISOString().slice(0, 7) },
    select: { previewsUsed: true },
  });
  const remainingPreviews = Math.max(0, 10 - (usageRow?.previewsUsed ?? 0));

  // Calculate voice assignments from directorJson
  let voiceAssignments = { total: 0, assigned: 0 };
  const directorJson = project.directorJson as Record<string, unknown> | null;
  if ((directorJson as { scenes?: unknown[] })?.scenes) {
    const characters = new Map<string, { assigned: boolean }>();
    for (const scene of (directorJson as { scenes: { dialogue?: { character: string; voice_key?: string }[] }[] }).scenes) {
      for (const line of scene.dialogue || []) {
        if (line.character && !characters.has(line.character)) {
          characters.set(line.character, {
            assigned: !!line.voice_key,
          });
        }
      }
    }
    voiceAssignments = {
      total: characters.size,
      assigned: Array.from(characters.values()).filter(c => c.assigned).length,
    };
  }

  // Calculate audio override stats
  let audioOverrideStats = { totalScenes: 0, scenesWithOverrides: 0 };
  if ((directorJson as { scenes?: unknown[] })?.scenes) {
    const totalScenes = (directorJson as { scenes: unknown[] }).scenes.length;
    // audioOverrides JSONB stores snake_case keys (from orchestrator pipeline)
    const audioOverrides = Array.isArray(project.audioOverrides) ? project.audioOverrides as Array<{ user_selected?: boolean; scene_id?: string }> : [];
    const scenesWithOverrides = new Set(
      audioOverrides
        .filter((o) => o.user_selected)
        .map((o) => o.scene_id)
    ).size;
    audioOverrideStats = { totalScenes, scenesWithOverrides };
  }

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, icon: typeof CheckCircle, className?: string }> = {
    draft: { variant: 'secondary', label: 'Draft', icon: Clock },
    processing: { variant: 'default', label: 'Processing', icon: Loader2 },
    completed: { variant: 'outline', label: 'Completed', icon: CheckCircle, className: 'border-green-500 text-green-600 dark:text-green-400' },
    failed: { variant: 'destructive', label: 'Failed', icon: AlertCircle },
  };

  const status = statusConfig[project.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-muted" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="font-semibold text-foreground leading-none">{project.name}</h1>
                  <p className="text-xs text-muted-foreground mt-0.5">{project.pageCount} pages</p>
                </div>
              </div>
            </div>
            <Badge variant={status.variant} className={`flex items-center gap-1 ${status.className || ''}`} data-testid="project-status-badge">
              <StatusIcon className={`w-3 h-3 ${project.status === 'processing' ? 'animate-spin' : ''}`} />
              {status.label}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Workflow */}
        <ProjectWorkflow
          project={{
            id: project.id,
            name: project.name,
            status: project.status,
            pageCount: project.pageCount,
            scriptText: project.scriptText ?? '',
            directorJson: project.directorJson,
            preferredWorkflowMode: (project.preferredWorkflowMode as 'automatic' | 'fine_tuned' | undefined) ?? undefined,
            currentRunNumber: project.currentRunNumber ?? 0,
          }}
          storyScore={storyScore ? { id: storyScore.id, overallScore: Number(storyScore.overallScore) } : null}
          audioOutputs={audioOutputs?.map((a: typeof audioOutputs[number]) => ({
            id: a.id,
            fileName: a.fileName,
            filePath: a.filePath,
            durationSeconds: a.durationSeconds ? Number(a.durationSeconds) : undefined,
            format: a.format,
          }))}
          latestJob={latestJob ? {
            runNumber: latestJob.runNumber ?? undefined,
            workflowMode: (latestJob.workflowMode as 'automatic' | 'fine_tuned' | undefined) ?? undefined,
            progress: latestJob.progress as { step?: string; percent?: number } | undefined,
            error: latestJob.error ?? undefined,
          } : null}
          allJobs={enrichedJobs}
          voiceAssignments={voiceAssignments}
          audioOverrides={audioOverrideStats}
          remainingPreviews={remainingPreviews ?? 0}
        />

        {/* Story Explorer */}
        <StoryExplorerSection directorJson={project.directorJson} />

        {/* Intelligence Features */}
        <StoryScoreSection
          projectId={project.id}
          scriptText={project.scriptText || ''}
        />

        <div id="story-adviser-section">
          <StoryAdviserSection
            projectId={project.id}
            scriptText={project.scriptText || ''}
          />
        </div>

        <div id="revision-section">
          <RevisionSection projectId={project.id} />
        </div>

        <ComparableSection projectId={project.id} hasScore={!!storyScore} />

        {/* Script Editor */}
        <ScriptEditorWrapper
          projectId={project.id}
          initialScriptText={project.scriptText ?? ''}
          suggestions={[]}
        />

        {/* Danger Zone - Collapsible */}
        <Collapsible>
          <Card className="border-red-200 dark:border-red-900/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-900/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Trash2 className="w-5 h-5" aria-hidden="true" />
                    Danger Zone
                  </div>
                  <ChevronDown className="w-4 h-4 text-red-400" />
                </CardTitle>
                <CardDescription>
                  Irreversible actions for this project
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <div className="flex items-center justify-between p-4 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-200">Delete this project</p>
                    <p className="text-sm text-red-600 dark:text-red-400">
                      Once deleted, this project and all its data cannot be recovered.
                    </p>
                  </div>
                  <DeleteProjectButton projectId={project.id} />
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      </main>
    </div>
  );
}
