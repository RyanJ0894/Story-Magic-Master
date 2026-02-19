'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { Music, Wind, Zap } from 'lucide-react';
import type { ExplorerScene } from './build-explorer-graph';
import { getMoodColor } from './build-explorer-graph';

function SceneNodeComponent({ data, selected }: NodeProps) {
  const scene = data as unknown as ExplorerScene;
  const moodColor = getMoodColor(scene.mood);

  return (
    <div
      className={`rounded-lg border bg-card shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-violet-500 shadow-md' : ''
      }`}
      style={{ borderLeftWidth: 4, borderLeftColor: moodColor, width: 220 }}
    >
      <Handle type="target" position={Position.Left} className="!bg-muted-foreground" />

      <div className="p-3">
        <div className="text-xs font-medium text-foreground truncate" title={scene.heading}>
          {scene.heading}
        </div>

        {scene.mood && (
          <div className="text-[10px] text-muted-foreground capitalize mt-0.5">
            {scene.mood}
          </div>
        )}

        {typeof scene.intensity === 'number' && (
          <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.min(100, scene.intensity * 10)}%`,
                backgroundColor: moodColor,
              }}
            />
          </div>
        )}

        <div className="flex items-center justify-between mt-2">
          <div className="flex -space-x-1">
            {scene.characters.slice(0, 4).map((char) => (
              <div
                key={char}
                className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] font-medium text-muted-foreground"
                title={char}
              >
                {char.charAt(0)}
              </div>
            ))}
            {scene.characters.length > 4 && (
              <div className="w-5 h-5 rounded-full bg-muted border border-background flex items-center justify-center text-[8px] text-muted-foreground">
                +{scene.characters.length - 4}
              </div>
            )}
          </div>

          <div className="flex gap-1">
            {scene.hasMusic && <Music className="w-3 h-3 text-violet-400" />}
            {scene.hasAmbience && <Wind className="w-3 h-3 text-blue-400" />}
            {scene.hasSfx && <Zap className="w-3 h-3 text-amber-400" />}
          </div>
        </div>
      </div>

      <Handle type="source" position={Position.Right} className="!bg-muted-foreground" />
    </div>
  );
}

export const SceneNode = memo(SceneNodeComponent);
