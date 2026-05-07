'use client';

import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, Loader2, Mic, Trash2 } from 'lucide-react';

interface VoiceClone {
  id: string;
  name: string;
  elevenLabsVoiceId: string;
  createdAt: string;
}

interface VoiceCloneUploaderProps {
  onCloneCreated?: (clone: VoiceClone) => void;
}

export function VoiceCloneUploader({ onCloneCreated }: VoiceCloneUploaderProps) {
  const [clones, setClones] = useState<VoiceClone[]>([]);
  const [loadingClones, setLoadingClones] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [name, setName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadClones = async () => {
    if (loaded) return;
    setLoadingClones(true);
    try {
      const res = await fetch('/api/voices/clones');
      if (res.ok) {
        const data = await res.json();
        setClones(data.clones ?? []);
        setLoaded(true);
      }
    } finally {
      setLoadingClones(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !name.trim()) return;

    setUploading(true);
    setError(null);

    const form = new FormData();
    form.append('name', name.trim());
    form.append('file', file);

    try {
      const res = await fetch('/api/voices/clones', { method: 'POST', body: form });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error ?? 'Upload failed.');
        return;
      }

      const newClone: VoiceClone = data.clone;
      setClones((prev) => [newClone, ...prev]);
      setName('');
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      onCloneCreated?.(newClone);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium mb-1 flex items-center gap-2">
          <Mic className="h-4 w-4 text-violet-500" />
          Clone Your Voice
        </h3>
        <p className="text-xs text-muted-foreground">
          Upload 30–120 seconds of clean audio. Supports MP3, WAV, M4A (max 10 MB).
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="clone-name">Voice name</Label>
          <Input
            id="clone-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. My Voice, Character A"
            maxLength={64}
            disabled={uploading}
          />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="clone-file">Audio sample</Label>
          <Input
            ref={fileInputRef}
            id="clone-file"
            type="file"
            accept="audio/mpeg,audio/wav,audio/x-wav,audio/mp4,audio/m4a,audio/x-m4a"
            disabled={uploading}
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setFile(f);
              setError(null);
            }}
          />
        </div>

        {error && <p className="text-xs text-destructive">{error}</p>}

        <Button
          type="submit"
          disabled={uploading || !name.trim() || !file}
          className="w-full"
          size="sm"
        >
          {uploading ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Creating clone…
            </>
          ) : (
            <>
              <Upload className="h-4 w-4 mr-2" />
              Create voice clone
            </>
          )}
        </Button>
      </form>

      <div>
        <button
          onClick={loadClones}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          disabled={loadingClones}
        >
          {loadingClones ? 'Loading…' : loaded ? `Your clones (${clones.length})` : 'View your clones ▸'}
        </button>

        {loaded && clones.length > 0 && (
          <ul className="mt-2 space-y-1">
            {clones.map((c) => (
              <li key={c.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded-md bg-muted/50">
                <span className="font-medium truncate">{c.name}</span>
                <span className="text-muted-foreground ml-2 font-mono shrink-0">{c.elevenLabsVoiceId.slice(0, 8)}…</span>
              </li>
            ))}
          </ul>
        )}

        {loaded && clones.length === 0 && (
          <p className="mt-2 text-xs text-muted-foreground">No voice clones yet.</p>
        )}
      </div>
    </div>
  );
}
