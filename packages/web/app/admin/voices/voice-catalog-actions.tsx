'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Loader2, RefreshCw, ToggleLeft, ToggleRight } from 'lucide-react';

// ---------------------------------------------------------------------------
// Page-level actions (seed from JSON)
// ---------------------------------------------------------------------------

export function VoiceCatalogActions(): React.ReactElement;

// ---------------------------------------------------------------------------
// Row-level actions (toggle active)
// ---------------------------------------------------------------------------

export function VoiceCatalogActions(props: {
  entryId: string;
  isActive: boolean;
  voiceId: string;
}): React.ReactElement;

export function VoiceCatalogActions(props?: { entryId?: string; isActive?: boolean; voiceId?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Row-level: toggle active/inactive
  if (props?.entryId) {
    const { entryId, isActive } = props;

    async function toggleActive() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/admin/voices/${entryId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ is_active: !isActive }),
        });
        if (!res.ok) {
          const d = await res.json() as { error?: string };
          setError(d.error ?? 'Failed to update');
          return;
        }
        router.refresh();
      } catch {
        setError('Network error');
      } finally {
        setLoading(false);
      }
    }

    return (
      <div>
        <Button
          variant="ghost"
          size="icon"
          title={isActive ? 'Deactivate' : 'Activate'}
          disabled={loading}
          onClick={() => void toggleActive()}
        >
          {loading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : isActive ? (
            <ToggleRight className="w-4 h-4 text-green-600" />
          ) : (
            <ToggleLeft className="w-4 h-4 text-muted-foreground" />
          )}
        </Button>
        {error && <p className="text-xs text-destructive mt-1">{error}</p>}
      </div>
    );
  }

  // Page-level: seed from JSON
  async function seedCatalog() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/voices/seed', { method: 'POST' });
      const d = await res.json() as { upserted?: number; error?: string };
      if (!res.ok) {
        setError(d.error ?? 'Seed failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      {error && <p className="text-sm text-destructive">{error}</p>}
      <Button variant="outline" size="sm" disabled={loading} onClick={() => void seedCatalog()}>
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <RefreshCw className="w-4 h-4 mr-2" />}
        Seed from JSON
      </Button>
    </div>
  );
}
