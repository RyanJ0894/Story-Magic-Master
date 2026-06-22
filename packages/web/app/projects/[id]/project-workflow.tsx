'use client';

/**
 * ProjectWorkflow - Modular, priority-based project page
 *
 * Shows a graduated workflow with progressive reveals:
 * 1. Mode Selection (Automatic vs Fine-Tuned)
 * 2. Analyze & Improve (highest priority if not scored) - Fine-Tuned only
 * 3. Cast Voices (priority once improved) - Fine-Tuned only
 * 4. Generate Audio (priority once cast)
 * 5. Review & Share (priority once generated)
 */

import { useState, useEffect } from 'react';
import { apiFetch } from '@/lib/api/fetch';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import type { DirectorJson } from '@story-magic/shared';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle,
  Circle,
  ChevronRight,
  Wand2,
  Users,
  Sparkles,
  Share2,
  Play,
  AlertCircle,
  Loader2,
  BarChart3,
  Music,
  Volume2,
  SkipForward,
  RotateCcw,
  UserMinus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImprovementWizardButton } from './improvement-wizard-button';
import { VoiceChooser } from './voice-chooser';
import { AudioChooser } from './audio-chooser';
import GenerateButton from './generate-button';
import AudioPlayer from './audio-player';
import { ScreenplayPlayer, type NoteComment } from '@/components/project/ScreenplayPlayer';
import { NotesPanel } from '@/components/project/NotesPanel';
import { ProjectReactionBar, type ProjectReactionType } from '@/components/project/ProjectReactionBar';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { PreviewButton } from './preview-button';
import { WorkflowModeSelector } from './workflow-mode-selector';
import { RunSelector, type Run } from './run-selector';
import { RunHistory } from './run-history';
import { RunComparison } from './run-comparison';

type WorkflowMode = 'automatic' | 'fine_tuned';

// Extended job type with audio info
interface EnrichedJob {
  id: string;
  runNumber: number;
  workflowMode: WorkflowMode;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  createdAt: string;
  completedAt?: string;
  hasAudio: boolean;
  audioOutputs: Array<{
    id: string;
    fileName: string;
    filePath: string;
    durationSeconds?: number;
    format?: string;
  }>;
  error?: string;
  progress?: {
    step?: string;
    percent?: number;
  };
}

// =============================================================================
// Types
// =============================================================================

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'skipped' | 'available' | 'in-progress' | 'complete';
  priority: number; // Lower = higher priority
  canSkip: boolean;
}

interface ProjectWorkflowProps {
  project: {
    id: string;
    name: string;
    status: string;
    pageCount: number;
    scriptText: string;
    // T-02 (Sprint C): typed via the shared DirectorJson interface so downstream
    // VoiceChooser/AudioChooser receive a structured shape instead of `any`.
    // Their inline narrowings still apply; this just gives us a real top-level
    // contract at the page boundary.
    directorJson?: DirectorJson | null;
    preferredWorkflowMode?: WorkflowMode;
    currentRunNumber: number;
  };
  currentUserId: string;
  storyScore?: {
    id: string;
    overallScore?: number;
  } | null;
  audioOutputs?: Array<{
    id: string;
    fileName: string;
    filePath: string;
    durationSeconds?: number;
    format: string;
  }>;
  latestJob?: {
    runNumber?: number;
    workflowMode?: WorkflowMode;
    progress?: {
      step?: string;
      percent?: number;
    };
    error?: string;
  } | null;
  allJobs?: EnrichedJob[];
  voiceAssignments?: {
    total: number;
    assigned: number;
  };
  audioOverrides?: {
    totalScenes: number;
    scenesWithOverrides: number;
  };
  remainingPreviews?: number;
  teamShares?: Array<{ id: string; teamId: string; teamName: string }>;
}

// =============================================================================
// Step Status Badge
// =============================================================================

function StepStatusBadge({ status }: { status: WorkflowStep['status'] }) {
  const config: Record<WorkflowStep['status'], { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof Circle; className?: string }> = {
    skipped: { label: 'Skipped', variant: 'secondary', icon: SkipForward, className: 'opacity-60' },
    available: { label: 'Start', variant: 'outline', icon: Circle },
    'in-progress': { label: 'In Progress', variant: 'default', icon: Loader2 },
    complete: { label: 'Complete', variant: 'outline', icon: CheckCircle, className: 'border-green-500 text-green-600' },
  };

  const { label, variant, icon: Icon, className } = config[status];

  return (
    <Badge variant={variant} className={cn('gap-1', className)}>
      <Icon className={cn('w-3 h-3', status === 'in-progress' && 'animate-spin')} />
      {label}
    </Badge>
  );
}

// =============================================================================
// Progress Overview
// =============================================================================

function WorkflowProgress({ steps }: { steps: WorkflowStep[] }) {
  const completed = steps.filter(s => s.status === 'complete').length;
  const skipped = steps.filter(s => s.status === 'skipped').length;
  const total = steps.length;
  const percent = ((completed + skipped) / total) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Workflow Progress</span>
        <span className="text-sm text-muted-foreground">
          {completed} complete{skipped > 0 && `, ${skipped} skipped`}
        </span>
      </div>
      <Progress value={percent} className="h-2" />
      <div className="flex justify-between mt-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step.status === 'complete' && 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
              step.status === 'in-progress' && 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 ring-2 ring-blue-500',
              step.status === 'available' && 'bg-muted text-muted-foreground',
              step.status === 'skipped' && 'bg-muted text-muted-foreground opacity-60',
            )}>
              {step.status === 'complete' ? (
                <CheckCircle className="w-4 h-4" />
              ) : step.status === 'skipped' ? (
                <SkipForward className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className={cn(
              'hidden sm:block text-[10px] mt-1 text-center max-w-[60px]',
              step.status === 'complete' && 'text-green-600 dark:text-green-400',
              step.status === 'in-progress' && 'text-blue-600 dark:text-blue-400 font-medium',
              step.status === 'available' && 'text-muted-foreground',
              step.status === 'skipped' && 'text-muted-foreground opacity-60 line-through',
            )}>
              {step.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Current Action Card
// =============================================================================

function CurrentActionCard({ step, children }: { step: WorkflowStep; children: React.ReactNode }) {
  return (
    <Card className="border-2 border-blue-300 dark:border-blue-700 bg-gradient-to-br from-blue-50/50 to-blue-50/50 dark:from-blue-950/20 dark:to-blue-950/20 mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-blue-600">Current Step</Badge>
            <span className="text-sm text-muted-foreground">What to do next</span>
          </div>
          <ChevronRight className="w-5 h-5 text-blue-500" />
        </div>
        <CardTitle className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            {step.icon}
          </div>
          {step.title}
        </CardTitle>
        <CardDescription>{step.description}</CardDescription>
      </CardHeader>
      <CardContent>
        {children}
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ProjectWorkflow({
  project,
  currentUserId,
  storyScore,
  audioOutputs,
  latestJob,
  allJobs = [],
  voiceAssignments = { total: 0, assigned: 0 },
  audioOverrides,
  remainingPreviews: initialRemainingPreviews = 0,
  teamShares = [],
}: ProjectWorkflowProps) {
  const router = useRouter();

  // Track which run we're currently viewing (null = latest/new run)
  const [viewingRunNumber, setViewingRunNumber] = useState<number | null>(
    latestJob?.runNumber || null
  );

  // Track workflow mode for current run (persisted in localStorage per run).
  // SSR-safe: initialise from server-available data only; localStorage hydrated in useEffect below.
  const [selectedMode, setSelectedMode] = useState<WorkflowMode | null>(
    latestJob?.workflowMode ?? null,
  );

  // Track which steps have been skipped (persisted in localStorage).
  // SSR-safe: empty Set on first render; localStorage hydrated in useEffect below.
  const [skippedSteps, setSkippedSteps] = useState<Set<string>>(new Set());

  // Preview budget state (can be updated when previews are used)
  const [remainingPreviews, setRemainingPreviews] = useState(initialRemainingPreviews);

  // Team share/unshare confirmation — replaces window.confirm at the two team
  // action buttons below. Discriminated union keeps the dialog generic.
  const [confirmTeamAction, setConfirmTeamAction] = useState<
    | { kind: 'unshare'; teamId: string; teamName: string }
    | { kind: 'share'; teamId: string; teamName: string }
    | null
  >(null);

  async function executeUnshareFromTeam(teamId: string, teamName: string) {
    try {
      const res = await apiFetch('/api/teams/share', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, teamId }),
      });
      if (res.ok) {
        toast.success(`Removed from team "${teamName}"`);
        router.refresh();
      } else {
        const err = await res.json();
        toast.error(err.error || 'Failed to unshare');
      }
    } catch {
      toast.error('Failed to unshare from team');
    }
  }

  async function executeShareWithTeam(teamId: string, teamName: string) {
    try {
      const shareRes = await apiFetch('/api/teams/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId: project.id, teamId, accessLevel: 'stream' }),
      });
      if (shareRes.ok) {
        const result = await shareRes.json();
        toast.success(result.message || 'Shared with team!');
        router.refresh();
      } else {
        const err = await shareRes.json();
        toast.error(err.error || 'Failed to share');
      }
    } catch {
      toast.error(`Failed to share with team "${teamName}"`);
    }
  }

  // Run history modal state
  const [showHistory, setShowHistory] = useState(false);

  // Track when a retry has been kicked off so we can collapse the old error
  const [retryStarted, setRetryStarted] = useState(false);
  const [errorExpanded, setErrorExpanded] = useState(false);

  // Comparison state
  const [comparisonRuns, setComparisonRuns] = useState<{ runA: number; runB: number } | null>(null);

  // Sprint M: last comment added via ScreenplayPlayer — propagated to NotesPanel
  const [lastAddedComment, setLastAddedComment] = useState<NoteComment | undefined>();

  // Sprint L Fast Start: URL of the first available audio segment (before full job completion)
  const [progressiveAudioUrl, setProgressiveAudioUrl] = useState<string | null>(null);
  // Sprint L-2b: ordered list of all ready segment URLs for sequential playback
  const [progressiveSegmentUrls, setProgressiveSegmentUrls] = useState<string[]>([]);

  // Save skipped steps to localStorage
  useEffect(() => {
    localStorage.setItem(`project-${project.id}-skipped-steps`, JSON.stringify(Array.from(skippedSteps)));
  }, [skippedSteps, project.id]);

  // Save selected mode to localStorage
  useEffect(() => {
    if (selectedMode) {
      const key = `project-${project.id}-run-${project.currentRunNumber + 1}-mode`;
      localStorage.setItem(key, selectedMode);
    }
  }, [selectedMode, project.id, project.currentRunNumber]);

  // Hydrate localStorage state after mount so SSR and first client render match exactly.
  // Runs once — any subsequent changes go through the save effects above.
  useEffect(() => {
    if (!selectedMode) {
      const key = `project-${project.id}-run-${project.currentRunNumber + 1}-mode`;
      const saved = localStorage.getItem(key);
      if (saved) setSelectedMode(saved as WorkflowMode);
    }
    const savedSkips = localStorage.getItem(`project-${project.id}-skipped-steps`);
    if (savedSkips) {
      try {
        setSkippedSteps(new Set(JSON.parse(savedSkips) as string[]));
      } catch {
        // malformed JSON — leave empty Set
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // mount-only: localStorage hydration after SSR

  const handleModeSelected = (mode: WorkflowMode) => {
    setSelectedMode(mode);
  };

  const handleStartNewRun = () => {
    // Clear mode selection to show mode selector again
    setSelectedMode(null);
    setViewingRunNumber(null);
    // Clear localStorage for next run
    const key = `project-${project.id}-run-${project.currentRunNumber + 1}-mode`;
    localStorage.removeItem(key);
  };

  const handleSelectRun = (runNumber: number | null) => {
    setViewingRunNumber(runNumber);
    // If viewing a past run, set its mode
    if (runNumber) {
      const run = allJobs.find(j => j.runNumber === runNumber);
      if (run) {
        setSelectedMode(run.workflowMode);
      }
    }
  };

  const handleCompareRuns = (runA: number, runB: number) => {
    setComparisonRuns({ runA, runB });
  };

  const handleCopySettings = (runNumber: number) => {
    const run = allJobs.find(j => j.runNumber === runNumber);
    if (run) {
      setSelectedMode(run.workflowMode);
      setViewingRunNumber(null);
      toast.success(
        `Copied settings from Run #${runNumber}. Voice and audio assignments are preserved.`
      );
    }
  };

  // Convert allJobs to Run[] format for RunSelector
  const runs: Run[] = allJobs.map(job => ({
    id: job.id,
    runNumber: job.runNumber,
    workflowMode: job.workflowMode,
    status: job.status,
    createdAt: job.createdAt,
    completedAt: job.completedAt,
    hasAudio: job.hasAudio,
  }));

  // Get the run being viewed (or latest)
  const currentViewedRun = viewingRunNumber
    ? allJobs.find(j => j.runNumber === viewingRunNumber)
    : latestJob
      ? allJobs.find(j => j.runNumber === latestJob.runNumber) || allJobs[0]
      : allJobs[0] ?? null;

  // Get audio for the current viewed run.
  // Note: empty array is truthy so we can't use || — check length explicitly.
  const currentRunAudio =
    (currentViewedRun?.audioOutputs?.length ?? 0) > 0
      ? currentViewedRun!.audioOutputs
      : audioOutputs;

  const handleSkip = (stepId: string) => {
    setSkippedSteps(prev => new Set(Array.from(prev).concat(stepId)));
  };

  const handleUnskip = (stepId: string) => {
    setSkippedSteps(prev => {
      const next = new Set(prev);
      next.delete(stepId);
      return next;
    });
  };

  // Determine step statuses based on project state
  const hasScore = !!storyScore?.overallScore;
  const hasVoices = voiceAssignments.assigned > 0;
  const allVoicesAssigned = voiceAssignments.total > 0 && voiceAssignments.assigned === voiceAssignments.total;
  const hasDirectorJson = !!project.directorJson?.scenes;
  const hasAudioOverrides = (audioOverrides?.scenesWithOverrides ?? 0) > 0;
  const isProcessing = project.status === 'processing' && !allJobs.some(j => j.status === 'completed');
  // Also check enriched jobs in case project.status hasn't propagated yet when router.refresh() fires
  const hasAnyCompletedRunWithAudio = allJobs.some(j => j.status === 'completed' && j.hasAudio);
  // A failed latest job must always surface the error — never let a prior completed run mask it
  const latestEnrichedJob = allJobs[0] ?? null;
  const latestJobFailed = latestEnrichedJob?.status === 'failed';
  const isCompleted = !latestJobFailed
    && (project.status === 'completed' || hasAnyCompletedRunWithAudio)
    && ((audioOutputs?.length ?? 0) > 0 || hasAnyCompletedRunWithAudio);
  const hasFailed = latestJobFailed;
  const isAutomatic = selectedMode === 'automatic';

  // Helper to determine status considering skips
  const getStatus = (stepId: string, naturalStatus: WorkflowStep['status']): WorkflowStep['status'] => {
    if (naturalStatus === 'complete') return 'complete';
    if (naturalStatus === 'in-progress') return 'in-progress';
    if (skippedSteps.has(stepId)) return 'skipped';
    return naturalStatus;
  };

  const steps: WorkflowStep[] = [
    {
      id: 'analyze',
      title: 'Analyze & Improve',
      description: 'Get your StoryScore and AI suggestions to polish your script',
      icon: <Wand2 className="w-5 h-5 text-blue-500" />,
      status: getStatus('analyze', hasScore ? 'complete' : 'available'),
      priority: hasScore || skippedSteps.has('analyze') ? 4 : 1,
      canSkip: !hasScore,
    },
    {
      id: 'cast',
      title: 'Cast Voices',
      description: 'Assign unique voices to each character',
      icon: <Users className="w-5 h-5 text-blue-500" />,
      status: getStatus('cast', allVoicesAssigned ? 'complete' : hasVoices ? 'in-progress' : 'available'),
      priority: allVoicesAssigned || skippedSteps.has('cast') ? 4 : (hasScore || skippedSteps.has('analyze')) ? 1 : 2,
      canSkip: !allVoicesAssigned,
    },
    ...(hasDirectorJson ? [{
      id: 'audio',
      title: 'Set Audio',
      description: 'Fine-tune music, ambience, and sound effects',
      icon: <Volume2 className="w-5 h-5 text-indigo-500" />,
      status: getStatus('audio', hasAudioOverrides ? 'complete' : 'available'),
      priority: hasAudioOverrides || skippedSteps.has('audio')
        ? 5
        : (allVoicesAssigned || skippedSteps.has('cast')) ? 1 : 3,
      canSkip: true,
    } as WorkflowStep] : []),
    {
      id: 'generate',
      title: 'Generate Audio',
      description: 'Transform your script into an immersive audio experience',
      icon: <Sparkles className="w-5 h-5 text-amber-500" />,
      status: getStatus('generate', isCompleted ? 'complete' : isProcessing ? 'in-progress' : 'available'),
      priority: isCompleted ? 5 : (allVoicesAssigned || skippedSteps.has('cast') || skippedSteps.has('audio')) ? 1 : 3,
      canSkip: false, // Can't skip - this is the main purpose
    },
    {
      id: 'share',
      title: 'Review & Share',
      description: 'Listen, compare, and share your audio production',
      icon: <Share2 className="w-5 h-5 text-green-500" />,
      status: isCompleted ? 'complete' : 'available',
      priority: isCompleted ? 1 : 4,
      canSkip: false, // Always available, no need to skip
    },
  ];

  // Find the current priority step (excluding skipped and complete)
  const currentStep = [...steps]
    .filter(s => s.status !== 'complete' && s.status !== 'skipped')
    .sort((a, b) => a.priority - b.priority)[0] || steps[steps.length - 1];

  // Determine which accordion items should be open by default
  const defaultOpenItems = [currentStep.id];

  const nextRunNumber = project.currentRunNumber + 1;

  // Show mode selector if no mode selected for current run (and not completed/processing)
  if (!selectedMode && !isCompleted && !isProcessing) {
    return (
      <Card>
        <CardContent className="pt-6">
          <WorkflowModeSelector
            projectId={project.id}
            projectName={project.name}
            currentRunNumber={project.currentRunNumber}
            preferredMode={project.preferredWorkflowMode}
            onModeSelected={handleModeSelected}
          />
        </CardContent>
      </Card>
    );
  }

  // Get comparison run data
  const comparisonRunA = comparisonRuns
    ? allJobs.find(j => j.runNumber === comparisonRuns.runA)
    : null;
  const comparisonRunB = comparisonRuns
    ? allJobs.find(j => j.runNumber === comparisonRuns.runB)
    : null;

  return (
    <div className="space-y-6">
      {/* Run Comparison Dialog */}
      <RunComparison
        open={!!comparisonRuns}
        onClose={() => setComparisonRuns(null)}
        runA={comparisonRunA ? {
          runNumber: comparisonRunA.runNumber,
          workflowMode: comparisonRunA.workflowMode,
          createdAt: comparisonRunA.createdAt,
          audioOutputs: comparisonRunA.audioOutputs,
        } : null}
        runB={comparisonRunB ? {
          runNumber: comparisonRunB.runNumber,
          workflowMode: comparisonRunB.workflowMode,
          createdAt: comparisonRunB.createdAt,
          audioOutputs: comparisonRunB.audioOutputs,
        } : null}
      />

      {/* Run Header with Selector */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {runs.length > 0 ? (
            <RunSelector
              runs={runs}
              currentRunNumber={viewingRunNumber}
              onSelectRun={handleSelectRun}
              onStartNewRun={handleStartNewRun}
              onViewHistory={() => setShowHistory(true)}
            />
          ) : (
            <Badge variant="outline" className="text-sm px-3 py-1">
              <Sparkles className="w-3 h-3 mr-1" />
              Run #{nextRunNumber}
            </Badge>
          )}
          <Badge variant={isAutomatic ? 'secondary' : 'default'} className="text-xs">
            {isAutomatic ? 'Automatic' : 'Fine-Tuned'}
          </Badge>
        </div>
        {isCompleted && (
          <Button variant="outline" size="sm" onClick={handleStartNewRun}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Start New Run
          </Button>
        )}
      </div>

      {/* Progress Overview - only show for Fine-Tuned mode */}
      {!isAutomatic && <WorkflowProgress steps={steps} />}

      {/* AUTOMATIC MODE - Simplified Generate Flow */}
      {isAutomatic && (
        <Card className="border-2 border-amber-300 dark:border-amber-700 bg-gradient-to-br from-amber-50/50 to-orange-50/50 dark:from-amber-950/20 dark:to-orange-950/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-amber-500" />
              </div>
              {isCompleted ? 'Audio Ready' : isProcessing ? 'Generating...' : 'Quick Generate'}
            </CardTitle>
            <CardDescription>
              {isCompleted
                ? 'Your audio production is complete. Listen and share below.'
                : isProcessing
                  ? 'AI is selecting voices, music, and generating your audio...'
                  : 'AI will automatically select the best voices, music, and ambience for your script.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isCompleted ? (
              <>
                <AudioPlayer outputs={currentRunAudio!} />
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => router.push(`/projects/${project.id}/listen`)}>
                    <Share2 className="w-4 h-4 mr-2" />
                    Share
                  </Button>
                  <GenerateButton
                    projectId={project.id}
                    pageCount={project.pageCount}
                    status={project.status}
                    hasScript={!!project.scriptText}
                    hasDirectorCache={hasDirectorJson}
                    label="Regenerate"
                    workflowMode="automatic"
                  />
                </div>
                {project.scriptText && (
                  <>
                    {/* 2026-06-21 — Ryan 6/21 item n: project-level Like /
                        Pass / Undecided toolbar above the screenplay. Replaces
                        the old per-scene reactions inside the player. */}
                    <div className="pb-2">
                      <ProjectReactionBar projectId={project.id} />
                    </div>
                    <div className="flex flex-col sm:grid sm:grid-cols-[1fr_280px] border border-border rounded-lg overflow-hidden sm:h-[560px]">
                      <div className="overflow-y-auto p-4 max-h-72 sm:max-h-none">
                        <ScreenplayPlayer
                          projectId={project.id}
                          scriptText={project.scriptText}
                          currentUserId={currentUserId}
                          onCommentAdded={setLastAddedComment}
                        />
                      </div>
                      <NotesPanel
                        projectId={project.id}
                        currentUserId={currentUserId}
                        newComment={lastAddedComment}
                      />
                    </div>
                  </>
                )}
              </>
            ) : isProcessing ? (
              <div className="space-y-4">
                {/* Fast Start: show audio player as soon as first segment is ready */}
                {progressiveAudioUrl && (
                  <div className="space-y-1">
                    <p className="text-sm text-emerald-700 dark:text-emerald-300 font-semibold">
                      ▶ Your screenplay is ready — press play. The rest streams as it generates.
                    </p>
                    <AudioPlayer
                      outputs={[{ id: 'progressive', fileName: 'preview.m4a', filePath: '' }]}
                      directUrl={progressiveSegmentUrls.length === 0 ? progressiveAudioUrl : undefined}
                      segmentUrls={progressiveSegmentUrls.length > 0 ? progressiveSegmentUrls : undefined}
                      showBufferIndicator
                    />
                  </div>
                )}
                {/* 2026-06-21: hide the "Generating audio…" copy once the first
                    chunk has shipped — it contradicts the "ready, press play"
                    message above. Keep the inline progress bar so the user can
                    still see how much of the script has rendered. */}
                {!progressiveAudioUrl && (
                  <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 text-amber-500 animate-spin" />
                    <span>Generating audio... This may take a few minutes.</span>
                  </div>
                )}
                {latestJob?.progress && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground capitalize">
                        {latestJob.progress.step?.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium">{latestJob.progress.percent}%</span>
                    </div>
                    <Progress value={latestJob.progress.percent} className="h-2" />
                  </div>
                )}
              </div>
            ) : hasFailed ? (
              <div className="space-y-4">
                {retryStarted ? (
                  /* Minimized previous-error pill */
                  <button
                    onClick={() => setErrorExpanded(v => !v)}
                    className="w-full text-left"
                  >
                    <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                      <span className="font-medium">Previous run failed</span>
                      <span className="text-muted-foreground ml-auto">{errorExpanded ? '▲ hide' : '▼ details'}</span>
                    </div>
                    {errorExpanded && latestJob?.error && (
                      <div className="mt-1 max-h-32 overflow-y-auto overflow-x-hidden rounded border border-red-200 dark:border-red-800 bg-red-950/20 p-2 text-xs font-mono text-red-400 break-all">
                        {latestJob.error}
                      </div>
                    )}
                  </button>
                ) : (
                  <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                    <div className="flex items-start gap-3">
                      <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-red-800 dark:text-red-200">Generation failed</p>
                        {latestJob?.error && (
                          <div className="mt-2 max-h-32 overflow-y-auto overflow-x-hidden rounded bg-red-950/20 dark:bg-red-950/40 p-2 text-xs font-mono text-red-600 dark:text-red-400 break-all">
                            {latestJob.error}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
                <GenerateButton
                  projectId={project.id}
                  pageCount={project.pageCount}
                  status={project.status}
                  hasScript={!!project.scriptText}
                  hasDirectorCache={hasDirectorJson}
                  label="Retry"
                  workflowMode="automatic"
                  onJobStarted={() => { setRetryStarted(true); setErrorExpanded(false); setProgressiveAudioUrl(null); setProgressiveSegmentUrls([]); }}
                  onFirstAudioReady={setProgressiveAudioUrl}
                  onSegmentsUpdate={setProgressiveSegmentUrls}
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">
                      Uses <strong>{project.pageCount}</strong> page{project.pageCount !== 1 ? 's' : ''} from your quota.
                    </p>
                  </div>
                  <GenerateButton
                    projectId={project.id}
                    pageCount={project.pageCount}
                    status={project.status}
                    hasScript={!!project.scriptText}
                    hasDirectorCache={hasDirectorJson}
                    label="Generate Now"
                    workflowMode="automatic"
                    onJobStarted={() => { setProgressiveAudioUrl(null); setProgressiveSegmentUrls([]); }}
                    onFirstAudioReady={setProgressiveAudioUrl}
                    onSegmentsUpdate={setProgressiveSegmentUrls}
                  />
                </div>
                {/* Quick Preview — only shown when scenes are already parsed */}
                {(() => {
                  const firstSceneId = (project.directorJson as { scenes?: Array<{ scene_id?: string }> } | null)?.scenes?.[0]?.scene_id;
                  if (!firstSceneId) return null;
                  return (
                    <div className="flex items-center justify-between pt-2 border-t border-amber-200 dark:border-amber-800">
                      <p className="text-xs text-muted-foreground">
                        Hear Scene 1 first &mdash; preview ready in ~90s
                      </p>
                      <PreviewButton
                        projectId={project.id}
                        sceneId={firstSceneId}
                        remainingPreviews={remainingPreviews}
                        onRemainingChanged={setRemainingPreviews}
                      />
                    </div>
                  );
                })()}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* FINE-TUNED MODE - Full Workflow */}
      {!isAutomatic && (
        <>
      {/* Current Action Highlight */}
      {currentStep.status !== 'complete' && (
        <CurrentActionCard step={currentStep}>
          {currentStep.id === 'analyze' && (
            <div>
              {hasScore ? (
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-blue-500" />
                  <span className="font-medium">Score: {storyScore?.overallScore}</span>
                  <span className="text-sm text-muted-foreground">- Open the step below to improve</span>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Open the Analyze step below to start the Improvement Wizard.
                </p>
              )}
            </div>
          )}
          {currentStep.id === 'cast' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{voiceAssignments.assigned}</p>
                    <p className="text-xs text-muted-foreground">Assigned</p>
                  </div>
                  <div className="text-muted-foreground">/</div>
                  <div className="text-center">
                    <p className="text-2xl font-bold">{voiceAssignments.total}</p>
                    <p className="text-xs text-muted-foreground">Characters</p>
                  </div>
                </div>
                <Progress
                  value={voiceAssignments.total ? (voiceAssignments.assigned / voiceAssignments.total) * 100 : 0}
                  className="w-32 h-2"
                />
              </div>
              <p className="text-sm text-muted-foreground">
                Assign voices below to give each character a unique sound.
              </p>
            </div>
          )}
          {currentStep.id === 'audio' && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">
                Review and customize the AI-selected music, ambience, and sound effects for each scene.
              </p>
              {hasAudioOverrides && (
                <Badge variant="outline" className="text-xs border-blue-300 text-blue-600">
                  {audioOverrides?.scenesWithOverrides} scene{(audioOverrides?.scenesWithOverrides ?? 0) !== 1 ? 's' : ''} customized
                </Badge>
              )}
            </div>
          )}
          {currentStep.id === 'generate' && (
            <div className="flex items-center justify-between">
              <div>
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-blue-500" />
                    <span>Generating... {latestJob?.progress?.percent || 0}%</span>
                  </div>
                ) : hasFailed ? (
                  <div className="flex items-start gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <span className="font-medium">Generation failed.</span>
                      {latestJob?.error && (
                        <div className="mt-1 max-h-20 overflow-y-auto overflow-x-hidden text-xs font-mono text-red-500 break-all">
                          {latestJob.error}
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ready to generate. Uses <strong>{project.pageCount}</strong> page{project.pageCount !== 1 ? 's' : ''} from quota.
                  </p>
                )}
              </div>
              {!isProcessing && (
                <GenerateButton
                  projectId={project.id}
                  pageCount={project.pageCount}
                  status={project.status}
                  hasScript={!!project.scriptText}
                  hasDirectorCache={hasDirectorJson}
                  label={hasFailed ? 'Retry' : 'Generate'}
                />
              )}
            </div>
          )}
          {currentStep.id === 'share' && isCompleted && (
            <div className="space-y-4">
              <AudioPlayer outputs={currentRunAudio!} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/projects/${project.id}/listen`)}>
                  <Share2 className="w-4 h-4 mr-2" />
                  Share
                </Button>
              </div>
            </div>
          )}
        </CurrentActionCard>
      )}

      {/* All Steps Accordion */}
      <Accordion type="multiple" defaultValue={defaultOpenItems} className="space-y-2">
        {steps.map((step, index) => (
          <AccordionItem
            key={step.id}
            value={step.id}
            className={cn(
              'border rounded-lg px-4',
              step.status === 'skipped' && 'opacity-60',
              step.id === currentStep.id && step.status !== 'complete' && step.status !== 'skipped' && 'border-blue-300 dark:border-blue-700',
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 flex-1">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  step.status === 'complete' && 'bg-green-100 dark:bg-green-900/30',
                  step.status === 'in-progress' && 'bg-blue-100 dark:bg-blue-900/30',
                  step.status === 'available' && 'bg-muted',
                  step.status === 'skipped' && 'bg-muted',
                )}>
                  {step.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className={cn('font-medium', step.status === 'skipped' && 'line-through')}>{step.title}</span>
                    <StepStatusBadge status={step.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
                {/* Skip/Unskip button */}
                {step.canSkip && step.status !== 'complete' && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (step.status === 'skipped') {
                        handleUnskip(step.id);
                      } else {
                        handleSkip(step.id);
                      }
                    }}
                  >
                    {step.status === 'skipped' ? (
                      <>
                        <Circle className="w-4 h-4 mr-1" />
                        Unskip
                      </>
                    ) : (
                      <>
                        <SkipForward className="w-4 h-4 mr-1" />
                        Skip
                      </>
                    )}
                  </Button>
                )}
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              {step.id === 'analyze' && (
                <div className="space-y-4">
                  {hasScore ? (
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white">{storyScore?.overallScore}</span>
                        </div>
                        <div>
                          <p className="font-medium">StoryScore</p>
                          <p className="text-sm text-muted-foreground">Your script has been analyzed</p>
                        </div>
                      </div>
                      <ImprovementWizardButton
                        projectId={project.id}
                        scriptText={project.scriptText}
                        existingScore={storyScore}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Wand2 className="w-12 h-12 mx-auto mb-4 text-blue-500 opacity-50" />
                      <h4 className="font-medium mb-2">Ready to Improve Your Script?</h4>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                        The Improvement Wizard analyzes your script across 12 professional dimensions
                        and provides AI-powered suggestions.
                      </p>
                      <ImprovementWizardButton
                        projectId={project.id}
                        scriptText={project.scriptText}
                        existingScore={storyScore}
                      />
                    </div>
                  )}
                </div>
              )}

              {step.id === 'cast' && (
                <VoiceChooser
                  projectId={project.id}
                  scriptText={project.scriptText}
                  // Choosers' inline shapes don't accept null — coerce.
                  directorJson={project.directorJson ?? undefined}
                  disabled={isProcessing}
                />
              )}

              {step.id === 'audio' && (
                <AudioChooser
                  projectId={project.id}
                  directorJson={project.directorJson ?? undefined}
                  disabled={isProcessing}
                  remainingPreviews={remainingPreviews}
                  onRemainingPreviewsChanged={setRemainingPreviews}
                />
              )}

              {step.id === 'generate' && (
                <div className="space-y-4">
                  {isCompleted ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2 text-green-600">
                        <CheckCircle className="w-5 h-5" />
                        <span className="font-medium">Audio generation complete!</span>
                      </div>
                      <AudioPlayer outputs={currentRunAudio!} />
                      <GenerateButton
                        projectId={project.id}
                        pageCount={project.pageCount}
                        status={project.status}
                        hasScript={!!project.scriptText}
                        hasDirectorCache={hasDirectorJson}
                        label="Regenerate"
                      />
                    </div>
                  ) : isProcessing ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                        <span>Generating audio... This may take a few minutes.</span>
                      </div>
                      {latestJob?.progress && (
                        <div className="space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground capitalize">
                              {latestJob.progress.step?.replace(/_/g, ' ')}
                            </span>
                            <span className="font-medium">{latestJob.progress.percent}%</span>
                          </div>
                          <Progress value={latestJob.progress.percent} className="h-2" />
                        </div>
                      )}
                    </div>
                  ) : hasFailed ? (
                    <div className="space-y-4">
                      {retryStarted ? (
                        <button
                          onClick={() => setErrorExpanded(v => !v)}
                          className="w-full text-left"
                        >
                          <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50/50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400">
                            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-medium">Previous run failed</span>
                            <span className="text-muted-foreground ml-auto">{errorExpanded ? '▲ hide' : '▼ details'}</span>
                          </div>
                          {errorExpanded && latestJob?.error && (
                            <div className="mt-1 max-h-32 overflow-y-auto overflow-x-hidden rounded border border-red-200 dark:border-red-800 bg-red-950/20 p-2 text-xs font-mono text-red-400 break-all">
                              {latestJob.error}
                            </div>
                          )}
                        </button>
                      ) : (
                        <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-red-800 dark:text-red-200">Generation failed</p>
                              {latestJob?.error && (
                                <div className="mt-2 max-h-32 overflow-y-auto overflow-x-hidden rounded bg-red-950/20 dark:bg-red-950/40 p-2 text-xs font-mono text-red-600 dark:text-red-400 break-all">
                                  {latestJob.error}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                      <GenerateButton
                        projectId={project.id}
                        pageCount={project.pageCount}
                        status={project.status}
                        hasScript={!!project.scriptText}
                        hasDirectorCache={hasDirectorJson}
                        label="Retry Generation"
                        onJobStarted={() => { setRetryStarted(true); setErrorExpanded(false); }}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Music className="w-12 h-12 mx-auto mb-4 text-amber-500 opacity-50" />
                      <h4 className="font-medium mb-2">Ready to Generate?</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        This will use <strong>{project.pageCount}</strong> page{project.pageCount !== 1 ? 's' : ''} from your quota.
                      </p>
                      <GenerateButton
                        projectId={project.id}
                        pageCount={project.pageCount}
                        status={project.status}
                        hasScript={!!project.scriptText}
                        hasDirectorCache={hasDirectorJson}
                      />
                    </div>
                  )}
                </div>
              )}

              {step.id === 'share' && (
                <div className="space-y-4">
                  {isCompleted ? (
                    <>
                      <AudioPlayer outputs={currentRunAudio!} />
                      <div className="flex gap-2 justify-center">
                        {teamShares.length > 0 ? (
                          teamShares.map((share) => (
                            <Button
                              key={share.teamId}
                              variant="outline"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10"
                              onClick={() => setConfirmTeamAction({ kind: 'unshare', teamId: share.teamId, teamName: share.teamName })}
                            >
                              <UserMinus className="w-4 h-4 mr-2" />
                              Remove from {share.teamName}
                            </Button>
                          ))
                        ) : (
                          <Button
                            variant="outline"
                            onClick={async () => {
                              try {
                                const res = await apiFetch('/api/teams');
                                if (!res.ok) {
                                  toast.error('Failed to load teams');
                                  return;
                                }
                                const data = await res.json();
                                const teams = data.teams || [];
                                if (teams.length === 0) {
                                  toast.info('No teams found. Create a team first in Settings.');
                                  return;
                                }
                                // Share with first team (for MVP — multi-team picker coming with #107)
                                const team = teams[0];
                                setConfirmTeamAction({ kind: 'share', teamId: team.id, teamName: team.name });
                              } catch {
                                toast.error('Failed to load teams');
                              }
                            }}
                          >
                            <Share2 className="w-4 h-4 mr-2" />
                            Share with Team
                          </Button>
                        )}
                        <Button
                          variant="outline"
                          disabled={allJobs.length < 2}
                          onClick={() => handleCompareRuns(allJobs[0].runNumber, allJobs[1].runNumber)}
                        >
                          <Play className="w-4 h-4 mr-2" />
                          Compare Scripts
                        </Button>
                      </div>
                      {project.scriptText && (
                        <div className="flex flex-col sm:grid sm:grid-cols-[1fr_280px] border border-border rounded-lg overflow-hidden sm:h-[560px]">
                          <div className="overflow-y-auto p-4 max-h-72 sm:max-h-none">
                            <ScreenplayPlayer
                              projectId={project.id}
                              scriptText={project.scriptText}
                              currentUserId={currentUserId}
                              onCommentAdded={setLastAddedComment}
                            />
                          </div>
                          <NotesPanel
                            projectId={project.id}
                            currentUserId={currentUserId}
                            newComment={lastAddedComment}
                          />
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Share2 className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Generate audio first, then share and review your production here.</p>
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
        </>
      )}

      {/* Run History (shown when there are past runs) */}
      {allJobs.length > 0 && (
        <RunHistory
          runs={allJobs}
          currentRunNumber={viewingRunNumber}
          onSelectRun={handleSelectRun}
          onCompareRuns={handleCompareRuns}
          onCopySettings={handleCopySettings}
        />
      )}

      <ConfirmDialog
        open={confirmTeamAction !== null}
        title={confirmTeamAction?.kind === 'unshare' ? 'Remove project from team?' : 'Share project with team?'}
        description={
          confirmTeamAction?.kind === 'unshare'
            ? `"${project.name}" will be removed from team "${confirmTeamAction.teamName}". Team members will lose access.`
            : confirmTeamAction?.kind === 'share'
              ? `"${project.name}" will be shared with team "${confirmTeamAction.teamName}". All team members will gain stream access.`
              : ''
        }
        confirmLabel={confirmTeamAction?.kind === 'unshare' ? 'Remove' : 'Share'}
        variant={confirmTeamAction?.kind === 'unshare' ? 'destructive' : 'default'}
        onConfirm={() => {
          const pending = confirmTeamAction;
          setConfirmTeamAction(null);
          if (pending?.kind === 'unshare') void executeUnshareFromTeam(pending.teamId, pending.teamName);
          else if (pending?.kind === 'share') void executeShareWithTeam(pending.teamId, pending.teamName);
        }}
        onCancel={() => setConfirmTeamAction(null)}
      />
    </div>
  );
}

export default ProjectWorkflow;
