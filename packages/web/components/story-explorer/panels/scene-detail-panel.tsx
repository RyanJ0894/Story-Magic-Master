'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Music, Wind, Zap, X, Users } from 'lucide-react';
import type { ExplorerScene } from '../graph/build-explorer-graph';
import { getMoodColor } from '../graph/build-explorer-graph';

interface SceneDetailPanelProps {
  scene: ExplorerScene;
  onClose: () => void;
}

export function SceneDetailPanel({ scene, onClose }: SceneDetailPanelProps) {
  const moodColor = getMoodColor(scene.mood);

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-card border-l shadow-lg z-10 overflow-y-auto animate-in slide-in-from-right-full duration-200">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-sm text-foreground">{scene.heading}</h3>
            {scene.mood && (
              <Badge
                variant="outline"
                className="mt-1 capitalize"
                style={{ borderColor: moodColor, color: moodColor }}
              >
                {scene.mood}
              </Badge>
            )}
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        {typeof scene.intensity === 'number' && (
          <div>
            <div className="text-xs text-muted-foreground mb-1">Intensity</div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, scene.intensity * 10)}%`,
                  backgroundColor: moodColor,
                }}
              />
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 text-right">
              {scene.intensity}/10
            </div>
          </div>
        )}

        {scene.summary && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-1">Summary</div>
            <p className="text-sm text-foreground">{scene.summary}</p>
          </div>
        )}

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1 flex items-center gap-1">
            <Users className="w-3 h-3" /> Characters ({scene.characters.length})
          </div>
          <div className="flex flex-wrap gap-1">
            {scene.characters.map((char) => (
              <Badge key={char} variant="secondary" className="text-xs">
                {char}
              </Badge>
            ))}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-1">Audio Cues</div>
          <div className="flex gap-2">
            {scene.hasMusic && (
              <div className="flex items-center gap-1 text-xs text-violet-500">
                <Music className="w-3 h-3" /> Music
              </div>
            )}
            {scene.hasAmbience && (
              <div className="flex items-center gap-1 text-xs text-blue-500">
                <Wind className="w-3 h-3" /> Ambience
              </div>
            )}
            {scene.hasSfx && (
              <div className="flex items-center gap-1 text-xs text-amber-500">
                <Zap className="w-3 h-3" /> SFX
              </div>
            )}
            {!scene.hasMusic && !scene.hasAmbience && !scene.hasSfx && (
              <div className="text-xs text-muted-foreground">None</div>
            )}
          </div>
        </div>

        <div className="text-xs text-muted-foreground pt-2 border-t">
          {scene.dialogueCount} dialogue {scene.dialogueCount === 1 ? 'line' : 'lines'}
        </div>
      </div>
    </div>
  );
}
