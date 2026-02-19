'use client';

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { X, MessageSquare, Film } from 'lucide-react';
import type { ExplorerCharacter } from '../graph/build-explorer-graph';
import { getGenderColor } from '../graph/build-explorer-graph';

interface CharacterDetailPanelProps {
  character: ExplorerCharacter;
  onClose: () => void;
}

export function CharacterDetailPanel({ character, onClose }: CharacterDetailPanelProps) {
  const color = getGenderColor(character.gender);

  return (
    <div className="absolute top-0 right-0 w-80 h-full bg-card border-l shadow-lg z-10 overflow-y-auto animate-in slide-in-from-right-full duration-200">
      <div className="p-4 space-y-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-semibold text-foreground">{character.name}</h3>
            <div className="flex gap-1 mt-1">
              {character.gender && (
                <Badge
                  variant="outline"
                  className="text-xs capitalize"
                  style={{ borderColor: color, color }}
                >
                  {character.gender}
                </Badge>
              )}
              {character.age && (
                <Badge variant="outline" className="text-xs">
                  Age {character.age}
                </Badge>
              )}
              {character.ethnicity && (
                <Badge variant="outline" className="text-xs capitalize">
                  {character.ethnicity}
                </Badge>
              )}
            </div>
          </div>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
            <X className="w-4 h-4" />
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-muted rounded-lg p-3 text-center">
            <MessageSquare className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold text-foreground">{character.lineCount}</div>
            <div className="text-xs text-muted-foreground">Lines</div>
          </div>
          <div className="bg-muted rounded-lg p-3 text-center">
            <Film className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
            <div className="text-lg font-bold text-foreground">{character.sceneCount}</div>
            <div className="text-xs text-muted-foreground">Scenes</div>
          </div>
        </div>

        {character.sampleLines.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Sample Dialogue</div>
            <div className="space-y-2">
              {character.sampleLines.map((line, i) => (
                <blockquote
                  key={i}
                  className="text-sm text-foreground border-l-2 border-violet-300 pl-3 italic"
                >
                  &ldquo;{line}&rdquo;
                </blockquote>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t">
          <div className="text-xs font-medium text-muted-foreground mb-1">Appears in</div>
          <div className="flex flex-wrap gap-1">
            {character.scenes.map((sceneId) => (
              <Badge key={sceneId} variant="secondary" className="text-xs">
                {sceneId}
              </Badge>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
