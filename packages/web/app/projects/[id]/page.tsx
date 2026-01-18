import { createClient } from '@/lib/supabase/server';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import GenerateButton from './generate-button';
import AudioPlayer from './audio-player';

export default async function ProjectPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();

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

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link
              href="/dashboard"
              className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
            >
              ← Dashboard
            </Link>
            <h1 className="text-xl font-bold">{project.name}</h1>
            <span className={`px-2 py-1 text-xs rounded-full ${
              project.status === 'completed'
                ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                : project.status === 'processing'
                ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                : project.status === 'failed'
                ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
            }`}>
              {project.status}
            </span>
          </div>
          <span className="text-sm text-gray-500">
            {project.page_count} pages
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        {/* Generation Section */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Generate Audio</h2>

          {project.status === 'completed' && audioOutputs && audioOutputs.length > 0 ? (
            <div className="space-y-4">
              <p className="text-green-600 dark:text-green-400">
                Audio generation complete!
              </p>
              <AudioPlayer outputs={audioOutputs} />
              <GenerateButton
                projectId={project.id}
                pageCount={project.page_count}
                status={project.status}
                label="Regenerate"
              />
            </div>
          ) : project.status === 'processing' ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-brand-600 border-t-transparent rounded-full" />
                <span>Generating audio... This may take a few minutes.</span>
              </div>
              {latestJob?.progress && (
                <div className="text-sm text-gray-600 dark:text-gray-400">
                  Step: {latestJob.progress.step} ({latestJob.progress.percent}%)
                </div>
              )}
            </div>
          ) : project.status === 'failed' ? (
            <div className="space-y-4">
              <p className="text-red-600 dark:text-red-400">
                Generation failed. {latestJob?.error}
              </p>
              <GenerateButton
                projectId={project.id}
                pageCount={project.page_count}
                status={project.status}
                label="Retry"
              />
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-gray-600 dark:text-gray-400">
                Ready to generate. This will use {project.page_count} page{project.page_count !== 1 ? 's' : ''} from your quota.
              </p>
              <GenerateButton
                projectId={project.id}
                pageCount={project.page_count}
                status={project.status}
              />
            </div>
          )}
        </section>

        {/* Script Preview */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold mb-4">Script</h2>
          <pre className="whitespace-pre-wrap font-mono text-sm bg-gray-50 dark:bg-gray-900 p-4 rounded-lg overflow-auto max-h-96">
            {project.script_text}
          </pre>
        </section>

        {/* Danger Zone */}
        <section className="bg-white dark:bg-gray-800 rounded-lg p-6 border border-red-200 dark:border-red-900">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-4">
            Danger Zone
          </h2>
          <form action={`/api/projects/${project.id}/delete`} method="POST">
            <button
              type="submit"
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition"
              onClick={(e) => {
                if (!confirm('Are you sure you want to delete this project? This cannot be undone.')) {
                  e.preventDefault();
                }
              }}
            >
              Delete Project
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}
