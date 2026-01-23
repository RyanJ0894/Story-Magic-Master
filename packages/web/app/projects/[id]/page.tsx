import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import DeleteProjectButton from './delete-button';
import { ProjectWorkflow } from './project-workflow';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ArrowLeft, FileText, CheckCircle, AlertCircle, Clock, Loader2, Trash2, ChevronDown } from 'lucide-react';

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    redirect('/login');
  }

  // Fetch project
  const { data: project, error } = await supabase
    .from('projects')
    .select('*')
    .eq('id', params.id)
    .single();

  if (error || !project) {
    notFound();
  }

  // Fetch ALL jobs for run history (sorted by run_number descending)
  const { data: allJobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', params.id)
    .order('run_number', { ascending: false });

  // Get the latest job (first in the sorted list)
  const latestJob = allJobs && allJobs.length > 0 ? allJobs[0] : null;

  // Fetch audio outputs with job_id so we can associate with runs
  const { data: audioOutputs } = await supabase
    .from('audio_outputs')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  // Group audio outputs by job_id for easy lookup
  const audioByJobId = new Map<string, typeof audioOutputs>();
  if (audioOutputs) {
    for (const audio of audioOutputs) {
      if (audio.job_id) {
        const existing = audioByJobId.get(audio.job_id) || [];
        existing.push(audio);
        audioByJobId.set(audio.job_id, existing);
      }
    }
  }

  // Enrich jobs with audio info
  const enrichedJobs = allJobs?.map(job => ({
    ...job,
    has_audio: audioByJobId.has(job.id),
    audio_outputs: audioByJobId.get(job.id) || [],
  })) || [];

  // Fetch story score
  const { data: storyScore } = await supabase
    .from('story_scores')
    .select('id, overall_score')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Calculate voice assignments from director_json
  let voiceAssignments = { total: 0, assigned: 0 };
  if (project.director_json?.scenes) {
    const characters = new Map<string, { assigned: boolean }>();
    for (const scene of project.director_json.scenes) {
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

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, icon: typeof CheckCircle, className?: string }> = {
    draft: { variant: 'secondary', label: 'Draft', icon: Clock },
    processing: { variant: 'default', label: 'Processing', icon: Loader2 },
    completed: { variant: 'outline', label: 'Completed', icon: CheckCircle, className: 'border-green-500 text-green-600 dark:text-green-400' },
    failed: { variant: 'destructive', label: 'Failed', icon: AlertCircle },
  };

  const status = statusConfig[project.status] || statusConfig.draft;
  const StatusIcon = status.icon;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200 dark:border-slate-800 bg-white/95 dark:bg-slate-950/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-700" />
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                  <FileText className="w-4 h-4 text-slate-600 dark:text-slate-400" />
                </div>
                <div>
                  <h1 className="font-semibold text-slate-900 dark:text-white leading-none">{project.name}</h1>
                  <p className="text-xs text-slate-500 mt-0.5">{project.page_count} pages</p>
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
            page_count: project.page_count,
            script_text: project.script_text,
            director_json: project.director_json,
            preferred_workflow_mode: project.preferred_workflow_mode,
            current_run_number: project.current_run_number ?? 0,
          }}
          storyScore={storyScore}
          audioOutputs={audioOutputs || undefined}
          latestJob={latestJob}
          allJobs={enrichedJobs}
          voiceAssignments={voiceAssignments}
        />

        {/* Script Preview - Collapsible */}
        <Collapsible>
          <Card>
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5" />
                    Script Preview
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </CardTitle>
                <CardDescription>
                  View your original screenplay text
                </CardDescription>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent>
                <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-50 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-96 border border-slate-200 dark:border-slate-700">
                  {project.script_text}
                </pre>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>

        {/* Danger Zone - Collapsible */}
        <Collapsible>
          <Card className="border-red-200 dark:border-red-900/50">
            <CollapsibleTrigger asChild>
              <CardHeader className="cursor-pointer hover:bg-red-50/50 dark:hover:bg-red-900/10 transition-colors">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <Trash2 className="w-5 h-5" />
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
