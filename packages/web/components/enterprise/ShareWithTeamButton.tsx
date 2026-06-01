'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api/fetch';
import { Users, Loader2 } from 'lucide-react';

interface Props {
  projectId: string;
  teamId: string;
}

export function ShareWithTeamButton({ projectId, teamId }: Props) {
  const [loading, setLoading] = useState(false);
  const [shared, setShared] = useState(false);
  const router = useRouter();

  const handleShare = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/teams/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, teamId }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to share project');
      }

      setShared(true);
      toast.success('Project shared with team');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to share');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      size="sm"
      className="w-full text-xs brand-gradient brand-gradient-hover"
      onClick={handleShare}
      disabled={loading || shared}
    >
      {loading ? (
        <>
          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
          Sharing...
        </>
      ) : (
        <>
          <Users className="w-3.5 h-3.5 mr-1.5" />
          Share with Team
        </>
      )}
    </Button>
  );
}
