import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import GenerateButton from './generate-button';
import AudioPlayer from './audio-player';
import DeleteProjectButton from './delete-button';
import { VoiceChooser } from './voice-chooser';
import { Storygraph } from './storygraph';
import { StoryScoreSection } from '@/components/storyscore';
import { StoryAdviserSection } from '@/components/story-adviser';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ArrowLeft, FileText, Sparkles, Trash2, CheckCircle, AlertCircle, Clock, Loader2, Users, GitBranch } from 'lucide-react';

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

  // Fetch latest job if exists
  const { data: latestJob } = await supabase
    .from('jobs')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single();

  // Fetch audio outputs
  const { data: audioOutputs } = await supabase
    .from('audio_outputs')
    .select('*')
    .eq('project_id', params.id)
    .order('created_at', { ascending: false });

  const statusConfig: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, icon: typeof CheckCircle }> = {
    draft: { variant: 'secondary', label: 'Draft', icon: Clock },
    processing: { variant: 'default', label: 'Processing', icon: Loader2 },
    completed: { variant: 'outline', label: 'Completed', icon: CheckCircle },
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
            <Badge variant={status.variant} className="flex items-center gap-1" data-testid="project-status-badge">
              <StatusIcon className={`w-3 h-3 ${project.status === 'processing' ? 'animate-spin' : ''}`} />
              {status.label}
            </Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Generation Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-violet-500" />
              Generate Audio
            </CardTitle>
            <CardDescription>
              Transform your script into an immersive audio experience
            </CardDescription>
          </CardHeader>
          <CardContent>
            {project.status === 'completed' && audioOutputs && audioOutputs.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center gap-2 text-green-600 dark:text-green-400">
                  <CheckCircle className="w-5 h-5" />
                  <span className="font-medium">Audio generation complete!</span>
                </div>
                <AudioPlayer outputs={audioOutputs} />
                <GenerateButton
                  projectId={project.id}
                  pageCount={project.page_count}
                  status={project.status}
                  label="Regenerate Audio"
                />
              </div>
            ) : project.status === 'processing' ? (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Loader2 className="w-5 h-5 text-violet-500 animate-spin" />
                  <span className="text-slate-700 dark:text-slate-300">
                    Generating audio... This may take a few minutes.
                  </span>
                </div>
                {latestJob?.progress && (
                  <div className="space-y-2" data-testid="generation-progress">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-slate-600 dark:text-slate-400 capitalize">
                        {latestJob.progress.step?.replace(/_/g, ' ')}
                      </span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {latestJob.progress.percent}%
                      </span>
                    </div>
                    <Progress value={latestJob.progress.percent} className="h-2" />
                  </div>
                )}
              </div>
            ) : project.status === 'failed' ? (
              <div className="space-y-4">
                <div className="flex items-start gap-3 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-800 dark:text-red-200">Generation failed</p>
                    {latestJob?.error && (
                      <p className="text-sm text-red-600 dark:text-red-400 mt-1">{latestJob.error}</p>
                    )}
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
              <div className="space-y-4">
                <p className="text-slate-600 dark:text-slate-400">
                  Ready to generate. This will use <strong className="text-slate-900 dark:text-white">{project.page_count}</strong> page{project.page_count !== 1 ? 's' : ''} from your quota.
                </p>
                <GenerateButton
                  projectId={project.id}
                  pageCount={project.page_count}
                  status={project.status}
                />
              </div>
            )}
          </CardContent>
        </Card>

        {/* Voice Chooser - Show when draft or has director_json */}
        {(project.status === 'draft' || project.director_json) && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-violet-500" />
                Character Voices
              </CardTitle>
              <CardDescription>
                Preview and customize voice assignments for each character
              </CardDescription>
            </CardHeader>
            <CardContent>
              <VoiceChooser
                projectId={project.id}
                scriptText={project.script_text}
                directorJson={project.director_json}
                disabled={project.status === 'processing'}
              />
            </CardContent>
          </Card>
        )}

        {/* Storygraph - Show when processing or completed */}
        {(project.status === 'processing' || project.status === 'completed') && project.director_json && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <GitBranch className="w-5 h-5 text-violet-500" />
                Generation Progress
              </CardTitle>
              <CardDescription>
                Visual breakdown of scenes and dialogue processing
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Storygraph
                projectId={project.id}
                directorJson={project.director_json}
                jobProgress={latestJob?.progress}
              />
            </CardContent>
          </Card>
        )}

        {/* StoryScore - Feature flagged, shows "Coming Soon" when disabled */}
        <StoryScoreSection
          projectId={project.id}
          scriptText={project.script_text}
        />

        {/* Story-Adviser - Feature flagged, shows "Coming Soon" when disabled */}
        <StoryAdviserSection
          projectId={project.id}
          scriptText={project.script_text}
        />

        {/* Script Preview */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5" />
              Script
            </CardTitle>
            <CardDescription>
              Your original screenplay text
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap font-mono text-sm bg-slate-50 dark:bg-slate-900 p-4 rounded-lg overflow-auto max-h-96 border border-slate-200 dark:border-slate-700">
              {project.script_text}
            </pre>
          </CardContent>
        </Card>

        {/* Danger Zone */}
        <Card className="border-red-200 dark:border-red-900/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-red-600 dark:text-red-400">
              <Trash2 className="w-5 h-5" />
              Danger Zone
            </CardTitle>
            <CardDescription>
              Irreversible actions for this project
            </CardDescription>
          </CardHeader>
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
        </Card>
      </main>
    </div>
  );
}
