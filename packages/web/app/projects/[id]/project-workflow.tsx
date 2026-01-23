'use client';

/**
 * ProjectWorkflow - Modular, priority-based project page
 *
 * Shows a graduated workflow with progressive reveals:
 * 1. Analyze & Improve (highest priority if not scored)
 * 2. Cast Voices (priority once improved)
 * 3. Generate Audio (priority once cast)
 * 4. Review & Share (priority once generated)
 */

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
  Lock,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { ImprovementWizardButton } from './improvement-wizard-button';
import { VoiceChooser } from './voice-chooser';
import GenerateButton from './generate-button';
import AudioPlayer from './audio-player';

// =============================================================================
// Types
// =============================================================================

interface WorkflowStep {
  id: string;
  title: string;
  description: string;
  icon: React.ReactNode;
  status: 'locked' | 'available' | 'in-progress' | 'complete';
  priority: number; // Lower = higher priority
}

interface ProjectWorkflowProps {
  project: {
    id: string;
    name: string;
    status: string;
    page_count: number;
    script_text: string;
    director_json?: any;
  };
  storyScore?: {
    id: string;
    overall_score?: number;
  } | null;
  audioOutputs?: Array<{
    id: string;
    file_name: string;
    file_path: string;
    duration_seconds?: number;
    format: string;
  }>;
  latestJob?: {
    progress?: {
      step?: string;
      percent?: number;
    };
    error?: string;
  } | null;
  voiceAssignments?: {
    total: number;
    assigned: number;
  };
}

// =============================================================================
// Step Status Badge
// =============================================================================

function StepStatusBadge({ status }: { status: WorkflowStep['status'] }) {
  const config: Record<WorkflowStep['status'], { label: string; variant: 'default' | 'secondary' | 'outline'; icon: typeof Lock; className?: string }> = {
    locked: { label: 'Locked', variant: 'secondary', icon: Lock },
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
  const total = steps.length;
  const percent = (completed / total) * 100;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium">Workflow Progress</span>
        <span className="text-sm text-muted-foreground">{completed} of {total} steps</span>
      </div>
      <Progress value={percent} className="h-2" />
      <div className="flex justify-between mt-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex flex-col items-center">
            <div className={cn(
              'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all',
              step.status === 'complete' && 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
              step.status === 'in-progress' && 'bg-violet-100 text-violet-600 dark:bg-violet-900/30 dark:text-violet-400 ring-2 ring-violet-500',
              step.status === 'available' && 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
              step.status === 'locked' && 'bg-slate-100 text-slate-400 dark:bg-slate-800 dark:text-slate-500',
            )}>
              {step.status === 'complete' ? (
                <CheckCircle className="w-4 h-4" />
              ) : (
                i + 1
              )}
            </div>
            <span className={cn(
              'text-[10px] mt-1 text-center max-w-[60px]',
              step.status === 'complete' && 'text-green-600 dark:text-green-400',
              step.status === 'in-progress' && 'text-violet-600 dark:text-violet-400 font-medium',
              (step.status === 'available' || step.status === 'locked') && 'text-muted-foreground',
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
    <Card className="border-2 border-violet-300 dark:border-violet-700 bg-gradient-to-br from-violet-50/50 to-purple-50/50 dark:from-violet-950/20 dark:to-purple-950/20 mb-6">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge className="bg-violet-600">Current Step</Badge>
            <span className="text-sm text-muted-foreground">What to do next</span>
          </div>
          <ChevronRight className="w-5 h-5 text-violet-500" />
        </div>
        <CardTitle className="flex items-center gap-3 mt-2">
          <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
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
  storyScore,
  audioOutputs,
  latestJob,
  voiceAssignments = { total: 0, assigned: 0 },
}: ProjectWorkflowProps) {
  const router = useRouter();

  // Determine step statuses based on project state
  const hasScore = !!storyScore?.overall_score;
  const hasVoices = voiceAssignments.assigned > 0;
  const allVoicesAssigned = voiceAssignments.total > 0 && voiceAssignments.assigned === voiceAssignments.total;
  const isProcessing = project.status === 'processing';
  const isCompleted = project.status === 'completed' && audioOutputs && audioOutputs.length > 0;
  const hasFailed = project.status === 'failed';

  const steps: WorkflowStep[] = [
    {
      id: 'analyze',
      title: 'Analyze & Improve',
      description: 'Get your StoryScore and AI suggestions to polish your script',
      icon: <Wand2 className="w-5 h-5 text-violet-500" />,
      status: hasScore ? 'complete' : 'available',
      priority: hasScore ? 4 : 1,
    },
    {
      id: 'cast',
      title: 'Cast Voices',
      description: 'Assign unique voices to each character',
      icon: <Users className="w-5 h-5 text-blue-500" />,
      status: allVoicesAssigned ? 'complete' : hasVoices ? 'in-progress' : 'available',
      priority: allVoicesAssigned ? 4 : hasScore ? 1 : 2,
    },
    {
      id: 'generate',
      title: 'Generate Audio',
      description: 'Transform your script into an immersive audio experience',
      icon: <Sparkles className="w-5 h-5 text-amber-500" />,
      status: isCompleted ? 'complete' : isProcessing ? 'in-progress' : hasFailed ? 'available' : 'available',
      priority: isCompleted ? 4 : allVoicesAssigned ? 1 : 3,
    },
    {
      id: 'share',
      title: 'Review & Share',
      description: 'Listen, compare, and share your audio production',
      icon: <Share2 className="w-5 h-5 text-green-500" />,
      status: isCompleted ? 'available' : 'locked',
      priority: isCompleted ? 1 : 4,
    },
  ];

  // Find the current priority step
  const currentStep = [...steps].sort((a, b) => a.priority - b.priority)[0];

  // Determine which accordion items should be open by default
  const defaultOpenItems = [currentStep.id];

  return (
    <div className="space-y-6">
      {/* Progress Overview */}
      <WorkflowProgress steps={steps} />

      {/* Current Action Highlight */}
      {currentStep.status !== 'complete' && (
        <CurrentActionCard step={currentStep}>
          {currentStep.id === 'analyze' && (
            <div className="flex items-center justify-between">
              <div>
                {hasScore ? (
                  <div className="flex items-center gap-2">
                    <BarChart3 className="w-5 h-5 text-violet-500" />
                    <span className="font-medium">Score: {storyScore?.overall_score}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Start with the Improvement Wizard to analyze your script across 12 Hollywood dimensions.
                  </p>
                )}
              </div>
              <ImprovementWizardButton
                projectId={project.id}
                scriptText={project.script_text}
                existingScore={storyScore}
              />
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
          {currentStep.id === 'generate' && (
            <div className="flex items-center justify-between">
              <div>
                {isProcessing ? (
                  <div className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-violet-500" />
                    <span>Generating... {latestJob?.progress?.percent || 0}%</span>
                  </div>
                ) : hasFailed ? (
                  <div className="flex items-center gap-2 text-red-600">
                    <AlertCircle className="w-4 h-4" />
                    <span>Generation failed. {latestJob?.error}</span>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Ready to generate. Uses <strong>{project.page_count}</strong> page{project.page_count !== 1 ? 's' : ''} from quota.
                  </p>
                )}
              </div>
              {!isProcessing && (
                <GenerateButton
                  projectId={project.id}
                  pageCount={project.page_count}
                  status={project.status}
                  label={hasFailed ? 'Retry' : 'Generate'}
                />
              )}
            </div>
          )}
          {currentStep.id === 'share' && isCompleted && (
            <div className="space-y-4">
              <AudioPlayer outputs={audioOutputs!} />
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => router.push(`/projects/${project.id}/share`)}>
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
              step.status === 'locked' && 'opacity-50',
              step.id === currentStep.id && step.status !== 'complete' && 'border-violet-300 dark:border-violet-700',
            )}
          >
            <AccordionTrigger className="hover:no-underline">
              <div className="flex items-center gap-4 flex-1">
                <div className={cn(
                  'w-10 h-10 rounded-lg flex items-center justify-center',
                  step.status === 'complete' && 'bg-green-100 dark:bg-green-900/30',
                  step.status === 'in-progress' && 'bg-violet-100 dark:bg-violet-900/30',
                  step.status === 'available' && 'bg-slate-100 dark:bg-slate-800',
                  step.status === 'locked' && 'bg-slate-100 dark:bg-slate-800',
                )}>
                  {step.icon}
                </div>
                <div className="flex-1 text-left">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{step.title}</span>
                    <StepStatusBadge status={step.status} />
                  </div>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              </div>
            </AccordionTrigger>
            <AccordionContent className="pt-4 pb-6">
              {step.id === 'analyze' && (
                <div className="space-y-4">
                  {hasScore ? (
                    <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
                          <span className="text-2xl font-bold text-white">{storyScore?.overall_score}</span>
                        </div>
                        <div>
                          <p className="font-medium">StoryScore</p>
                          <p className="text-sm text-muted-foreground">Your script has been analyzed</p>
                        </div>
                      </div>
                      <ImprovementWizardButton
                        projectId={project.id}
                        scriptText={project.script_text}
                        existingScore={storyScore}
                      />
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Wand2 className="w-12 h-12 mx-auto mb-4 text-violet-500 opacity-50" />
                      <h4 className="font-medium mb-2">Ready to Improve Your Script?</h4>
                      <p className="text-sm text-muted-foreground mb-4 max-w-md mx-auto">
                        The Improvement Wizard analyzes your script across 12 professional dimensions
                        and provides AI-powered suggestions.
                      </p>
                      <ImprovementWizardButton
                        projectId={project.id}
                        scriptText={project.script_text}
                        existingScore={storyScore}
                      />
                    </div>
                  )}
                </div>
              )}

              {step.id === 'cast' && (
                <VoiceChooser
                  projectId={project.id}
                  scriptText={project.script_text}
                  directorJson={project.director_json}
                  disabled={isProcessing}
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
                      <AudioPlayer outputs={audioOutputs!} />
                      <GenerateButton
                        projectId={project.id}
                        pageCount={project.page_count}
                        status={project.status}
                        label="Regenerate"
                      />
                    </div>
                  ) : isProcessing ? (
                    <div className="space-y-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
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
                      <div className="p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0" />
                          <div>
                            <p className="font-medium text-red-800 dark:text-red-200">Generation failed</p>
                            {latestJob?.error && (
                              <p className="text-sm text-red-600 dark:text-red-400 mt-1">{latestJob.error}</p>
                            )}
                          </div>
                        </div>
                      </div>
                      <GenerateButton
                        projectId={project.id}
                        pageCount={project.page_count}
                        status={project.status}
                        label="Retry Generation"
                      />
                    </div>
                  ) : (
                    <div className="text-center py-6">
                      <Music className="w-12 h-12 mx-auto mb-4 text-amber-500 opacity-50" />
                      <h4 className="font-medium mb-2">Ready to Generate?</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        This will use <strong>{project.page_count}</strong> page{project.page_count !== 1 ? 's' : ''} from your quota.
                      </p>
                      <GenerateButton
                        projectId={project.id}
                        pageCount={project.page_count}
                        status={project.status}
                      />
                    </div>
                  )}
                </div>
              )}

              {step.id === 'share' && (
                <div className="space-y-4">
                  {isCompleted ? (
                    <>
                      <AudioPlayer outputs={audioOutputs!} />
                      <div className="flex gap-2 justify-center">
                        <Button variant="outline">
                          <Share2 className="w-4 h-4 mr-2" />
                          Share with Team
                        </Button>
                        <Button variant="outline">
                          <Play className="w-4 h-4 mr-2" />
                          Compare Scripts
                        </Button>
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-6 text-muted-foreground">
                      <Lock className="w-12 h-12 mx-auto mb-4 opacity-30" />
                      <p>Complete audio generation to unlock sharing options.</p>
                    </div>
                  )}
                </div>
              )}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  );
}

export default ProjectWorkflow;
