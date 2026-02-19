'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Network, FlaskConical } from 'lucide-react';
import { FeatureGate } from '@/lib/features';
import { StoryExplorer } from './StoryExplorer';

interface StoryExplorerSectionProps {
  directorJson: unknown;
}

function StoryExplorerPlaceholder() {
  return (
    <Card className="border-dashed border-2 opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5 text-muted-foreground" />
          Story Explorer
          <Badge variant="outline" className="ml-2">
            <FlaskConical className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
        <CardDescription>
          Interactive scene flow and character network visualization.
          This feature is currently in development.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

function StoryExplorerEmptyState() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Network className="w-5 h-5 text-violet-500" />
          Story Explorer
        </CardTitle>
        <CardDescription>
          Generate audio to unlock interactive scene and character visualization.
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export function StoryExplorerSection({ directorJson }: StoryExplorerSectionProps) {
  return (
    <FeatureGate feature="STORY_EXPLORER" fallback={<StoryExplorerPlaceholder />}>
      {!directorJson ? (
        <StoryExplorerEmptyState />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="w-5 h-5 text-violet-500" />
              Story Explorer
            </CardTitle>
            <CardDescription>
              Explore your script&apos;s scene flow and character relationships
            </CardDescription>
          </CardHeader>
          <CardContent>
            <StoryExplorer directorJson={directorJson} />
          </CardContent>
        </Card>
      )}
    </FeatureGate>
  );
}
