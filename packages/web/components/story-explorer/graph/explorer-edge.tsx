'use client';

import { memo } from 'react';
import { BaseEdge, getStraightPath, type EdgeProps } from '@xyflow/react';

function ExplorerEdgeComponent({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  data,
  ...rest
}: EdgeProps) {
  const variant = (data as { variant?: string })?.variant ?? 'scene-flow';
  const weight = (data as { weight?: number })?.weight ?? 1;

  const [edgePath] = getStraightPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
  });

  const strokeWidth = variant === 'co-occurrence' ? Math.min(6, 1 + weight) : 1.5;
  const strokeDasharray = variant === 'scene-flow' ? '6 3' : undefined;
  const stroke = variant === 'scene-flow' ? 'hsl(var(--muted-foreground))' : 'hsl(var(--muted-foreground) / 0.6)';

  return (
    <BaseEdge
      id={id}
      path={edgePath}
      style={{
        strokeWidth,
        strokeDasharray,
        stroke,
      }}
      {...rest}
    />
  );
}

export const ExplorerEdge = memo(ExplorerEdgeComponent);
