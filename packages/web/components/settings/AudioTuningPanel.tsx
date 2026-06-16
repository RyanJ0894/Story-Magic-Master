'use client';

/**
 * B-005 — Audio Tuning sliders panel.
 *
 * The interactive surface Ryan asked for: 4 sliders + test sample + lock.
 *
 * The slider values are LOCAL until the user clicks either "Generate test
 * sample" (sends an un-persisted preview render) or "Lock these settings"
 * (PATCHes the AudioTuning row with `locked: true`). Until locked, real
 * generations use the in-code defaults — exploration is risk-free.
 */

import { useState, useEffect, useRef } from 'react';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Lock, Unlock, RotateCcw, Play } from 'lucide-react';
import { toast } from 'sonner';
import { TUNING_RANGES, DEFAULT_AUDIO_TUNING, type AudioTuningDto } from '@/lib/services/audio-tuning';

interface AudioTuningPanelProps {
  initial: AudioTuningDto;
}

// In-code orchestrator defaults so we can render the "absolute value" hint
// alongside the offset. If these drift in the orchestrator they should be
// updated here too — they're advisory only, the math still works.
const BASELINE_MUSIC_DB = -12;
const BASELINE_AMBIENCE_DB = -18;
const BASELINE_SFX_DB = -6;

export function AudioTuningPanel({ initial }: AudioTuningPanelProps) {
  const [musicOffset, setMusicOffset] = useState(initial.musicGainOffsetDb);
  const [ambienceOffset, setAmbienceOffset] = useState(initial.ambienceGainOffsetDb);
  const [sfxOffset, setSfxOffset] = useState(initial.sfxGainOffsetDb);
  const [narrationSpeed, setNarrationSpeed] = useState(initial.narrationSpeed);
  const [locked, setLocked] = useState(initial.locked);

  const [previewing, setPreviewing] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  // Detect dirty state — sliders moved since the last save/load.
  const dirty =
    musicOffset !== initial.musicGainOffsetDb ||
    ambienceOffset !== initial.ambienceGainOffsetDb ||
    sfxOffset !== initial.sfxGainOffsetDb ||
    narrationSpeed !== initial.narrationSpeed;

  useEffect(() => {
    // When a new preview lands, autoplay it for instant feedback.
    if (previewUrl && audioRef.current) {
      audioRef.current.load();
      void audioRef.current.play().catch(() => {});
    }
  }, [previewUrl]);

  function resetToDefaults() {
    setMusicOffset(0);
    setAmbienceOffset(0);
    setSfxOffset(0);
    setNarrationSpeed(1.0);
  }

  async function generatePreview() {
    setPreviewing(true);
    setPreviewUrl(null);
    try {
      const res = await fetch('/api/settings/audio-tuning/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'story-magic' },
        body: JSON.stringify({
          tuning: {
            musicGainOffsetDb: musicOffset,
            ambienceGainOffsetDb: ambienceOffset,
            sfxGainOffsetDb: sfxOffset,
            narrationSpeed,
          },
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Preview failed: ${data.error || 'Unknown error'}`);
        return;
      }
      setPreviewUrl(data.data.audioUrl);
      toast.success('Preview ready');
    } catch {
      toast.error('Preview failed — network error');
    } finally {
      setPreviewing(false);
    }
  }

  async function saveTuning(opts: { lock: boolean }) {
    setSaving(true);
    try {
      const res = await fetch('/api/settings/audio-tuning', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'story-magic' },
        body: JSON.stringify({
          musicGainOffsetDb: musicOffset,
          ambienceGainOffsetDb: ambienceOffset,
          sfxGainOffsetDb: sfxOffset,
          narrationSpeed,
          locked: opts.lock,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(`Save failed: ${data.error || 'Unknown error'}`);
        return;
      }
      setLocked(opts.lock);
      toast.success(opts.lock ? 'Settings locked — applied to future generations' : 'Settings unlocked');
    } catch {
      toast.error('Save failed — network error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Audio Tuning</CardTitle>
          <CardDescription>
            Adjust narration pace and the mix balance. Generate a test sample to hear
            the changes. Lock to apply to every future generation on your account.
          </CardDescription>
        </div>
        <Badge variant={locked ? 'default' : 'outline'}>
          {locked ? (
            <>
              <Lock className="w-3 h-3 mr-1" />
              Locked
            </>
          ) : (
            <>
              <Unlock className="w-3 h-3 mr-1" />
              Unlocked
            </>
          )}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-8">
        {/* Narration speed */}
        <SliderRow
          label="Narration speed"
          minLabel={`Slower (${TUNING_RANGES.narrationSpeed.min.toFixed(2)}x)`}
          maxLabel={`Faster (${TUNING_RANGES.narrationSpeed.max.toFixed(2)}x)`}
          min={TUNING_RANGES.narrationSpeed.min}
          max={TUNING_RANGES.narrationSpeed.max}
          step={TUNING_RANGES.narrationSpeed.step}
          value={narrationSpeed}
          onChange={setNarrationSpeed}
          displayValue={`${narrationSpeed.toFixed(2)}x`}
        />

        {/* Music */}
        <SliderRow
          label="Background music volume"
          minLabel="Quieter (-8 dB)"
          maxLabel="Louder (+8 dB)"
          min={TUNING_RANGES.musicGainOffsetDb.min}
          max={TUNING_RANGES.musicGainOffsetDb.max}
          step={TUNING_RANGES.musicGainOffsetDb.step}
          value={musicOffset}
          onChange={setMusicOffset}
          displayValue={formatGainOffset(musicOffset, BASELINE_MUSIC_DB)}
        />

        {/* Ambience */}
        <SliderRow
          label="Ambience volume"
          minLabel="Quieter (-8 dB)"
          maxLabel="Louder (+8 dB)"
          min={TUNING_RANGES.ambienceGainOffsetDb.min}
          max={TUNING_RANGES.ambienceGainOffsetDb.max}
          step={TUNING_RANGES.ambienceGainOffsetDb.step}
          value={ambienceOffset}
          onChange={setAmbienceOffset}
          displayValue={formatGainOffset(ambienceOffset, BASELINE_AMBIENCE_DB)}
        />

        {/* SFX */}
        <SliderRow
          label="Sound-effect volume"
          minLabel="Quieter (-8 dB)"
          maxLabel="Louder (+8 dB)"
          min={TUNING_RANGES.sfxGainOffsetDb.min}
          max={TUNING_RANGES.sfxGainOffsetDb.max}
          step={TUNING_RANGES.sfxGainOffsetDb.step}
          value={sfxOffset}
          onChange={setSfxOffset}
          displayValue={formatGainOffset(sfxOffset, BASELINE_SFX_DB)}
        />

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={resetToDefaults} disabled={previewing || saving}>
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to defaults
          </Button>
          <Button onClick={generatePreview} disabled={previewing || saving}>
            {previewing ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Generating preview…
              </>
            ) : (
              <>
                <Play className="w-4 h-4 mr-2" />
                Generate test sample
              </>
            )}
          </Button>
        </div>

        {/* Preview player */}
        {previewUrl && (
          <div className="rounded-lg border bg-muted/30 p-3">
            <p className="text-xs text-muted-foreground mb-2">Latest preview — scene 1 only:</p>
            <audio ref={audioRef} controls className="w-full" preload="metadata">
              <source src={previewUrl} />
              Your browser does not support the audio element.
            </audio>
          </div>
        )}

        {/* Lock card */}
        <div className="rounded-lg border bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800 p-4">
          <p className="text-sm text-amber-900 dark:text-amber-100 mb-3">
            {locked ? (
              <>
                <strong>Currently locked.</strong> Every future generation on your account
                uses these values. Unlock to experiment again.
              </>
            ) : (
              <>
                <strong>Not yet locked.</strong> Move the sliders and preview as much
                as you want. When you're happy, click <em>Lock these settings</em> to
                apply them to every future generation.
              </>
            )}
          </p>
          <div className="flex gap-2">
            {locked ? (
              <Button variant="outline" onClick={() => void saveTuning({ lock: false })} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Unlock className="w-4 h-4 mr-2" />
                )}
                Unlock
              </Button>
            ) : (
              <Button onClick={() => void saveTuning({ lock: true })} disabled={saving || !dirty}>
                {saving ? (
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <Lock className="w-4 h-4 mr-2" />
                )}
                Lock these settings
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface SliderRowProps {
  label: string;
  minLabel: string;
  maxLabel: string;
  min: number;
  max: number;
  step: number;
  value: number;
  onChange: (v: number) => void;
  displayValue: string;
}

function SliderRow({ label, minLabel, maxLabel, min, max, step, value, onChange, displayValue }: SliderRowProps) {
  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="text-sm font-medium">{label}</label>
        <span className="text-sm font-mono text-muted-foreground">{displayValue}</span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[value]}
        onValueChange={(vs) => onChange(vs[0])}
      />
      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
        <span>{minLabel}</span>
        <span>{maxLabel}</span>
      </div>
    </div>
  );
}

function formatGainOffset(offset: number, baseline: number): string {
  const sign = offset > 0 ? '+' : '';
  return `${sign}${offset} dB (default ${baseline} dB → ${baseline + offset})`;
}

// Re-exports for tests / consumers
export { DEFAULT_AUDIO_TUNING };
