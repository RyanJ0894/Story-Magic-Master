'use client';

import { MOOD_COLORS } from '../graph/build-explorer-graph';

export function LegendPanel() {
  return (
    <div className="absolute bottom-4 left-4 bg-card/90 backdrop-blur border rounded-lg p-3 z-10 max-w-[200px]">
      <div className="text-xs font-medium text-foreground mb-2">Mood Colors</div>
      <div className="grid grid-cols-2 gap-x-3 gap-y-1">
        {Object.entries(MOOD_COLORS).map(([mood, color]) => (
          <div key={mood} className="flex items-center gap-1.5">
            <div
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: color }}
            />
            <span className="text-[10px] text-muted-foreground capitalize truncate">
              {mood}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
