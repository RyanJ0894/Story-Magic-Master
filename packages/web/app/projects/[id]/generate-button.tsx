'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface GenerateButtonProps {
  projectId: string;
  pageCount: number;
  status: string;
  label?: string;
}

export default function GenerateButton({
  projectId,
  pageCount,
  status,
  label = 'Generate Audio',
}: GenerateButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleGenerate = async () => {
    setLoading(true);

    const supabase = createClient();

    // Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      toast.error('Please sign in');
      router.push('/login');
      return;
    }

    // Check usage limit
    const { data: remaining } = await supabase.rpc('get_remaining_pages', {
      p_user_id: user.id,
    });

    if (remaining !== null && pageCount > remaining) {
      toast.error(`You only have ${remaining} pages remaining. Upgrade to continue.`);
      setLoading(false);
      return;
    }

    // Update project status
    await supabase
      .from('projects')
      .update({ status: 'processing' })
      .eq('id', projectId);

    // Create job
    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({
        project_id: projectId,
        user_id: user.id,
        status: 'queued',
      })
      .select()
      .single();

    if (jobError) {
      toast.error('Failed to create job');
      setLoading(false);
      return;
    }

    // Trigger generation via API
    try {
      const response = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          jobId: job.id,
        }),
      });

      if (!response.ok) {
        throw new Error('Generation failed');
      }

      toast.success('Generation started!');
      router.refresh();
    } catch (error) {
      toast.error('Failed to start generation');

      // Update job status to failed
      await supabase
        .from('jobs')
        .update({ status: 'failed', error: 'Failed to start generation' })
        .eq('id', job.id);

      await supabase
        .from('projects')
        .update({ status: 'failed' })
        .eq('id', projectId);
    }

    setLoading(false);
  };

  return (
    <button
      onClick={handleGenerate}
      disabled={loading || status === 'processing'}
      className="px-6 py-3 bg-brand-600 text-white font-semibold rounded-lg hover:bg-brand-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
    >
      {loading ? 'Starting...' : label}
    </button>
  );
}
