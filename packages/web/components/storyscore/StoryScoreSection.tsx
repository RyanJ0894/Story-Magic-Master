'use client';

/**
 * StoryScore Section with Feature Flag
 *
 * This component handles the feature flag check client-side and renders
 * the StoryScore component only when the flag is enabled.
 *
 * Usage in server components:
 *   <StoryScoreSection projectId={project.id} scriptText={project.script_text} />
 */

import { StoryScore } from './StoryScore';
import { FeatureGate } from '@/lib/features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { BarChart3, FlaskConical } from 'lucide-react';

interface StoryScoreSectionProps {
  projectId: string;
  scriptText: string;
}

/**
 * Fallback shown when feature is disabled
 */
function StoryScorePreview() {
  return (
    <Card className="border-dashed border-2 opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-violet-500" />
          StoryScore
          <Badge variant="outline" className="ml-2">
            <FlaskConical className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
        <CardDescription>
          AI-powered screenplay evaluation across 12 dimensions.
          This feature is currently in development.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>StoryScore will analyze your script for:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Premise Originality & Commercial Viability</li>
            <li>Structure, Pacing & Stakes</li>
            <li>Character Arcs & Castability</li>
            <li>Dialogue Quality & Visual Storytelling</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function StoryScoreSection({
  projectId,
  scriptText,
}: StoryScoreSectionProps) {
  return (
    <FeatureGate
      feature="STORY_SCORE"
      fallback={<StoryScorePreview />}
    >
      <StoryScore
        projectId={projectId}
        scriptText={scriptText}
      />
    </FeatureGate>
  );
}

export default StoryScoreSection;
