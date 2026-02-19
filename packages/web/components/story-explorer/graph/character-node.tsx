'use client';

import { memo } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import type { ExplorerCharacter } from './build-explorer-graph';
import { getGenderColor } from './build-explorer-graph';

function CharacterNodeComponent({ data, selected }: NodeProps) {
  const char = data as unknown as ExplorerCharacter;
  const color = getGenderColor(char.gender);
  const size = Math.max(60, Math.min(120, 40 + char.lineCount * 4));

  return (
    <div
      className={`rounded-full flex flex-col items-center justify-center border-2 bg-card shadow-sm transition-shadow ${
        selected ? 'ring-2 ring-violet-500 shadow-md' : ''
      }`}
      style={{
        width: size,
        height: size,
        borderColor: color,
      }}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />

      <div
        className="text-xs font-semibold text-foreground truncate max-w-[90%] text-center"
        title={char.name}
      >
        {char.name}
      </div>
      <div className="text-[10px] text-muted-foreground">
        {char.lineCount} lines
      </div>

      <Handle type="source" position={Position.Bottom} className="!bg-muted-foreground" />
    </div>
  );
}

export const CharacterNode = memo(CharacterNodeComponent);
