'use client';

/**
 * StoryAdviser Section with Feature Flag
 *
 * Usage in server components:
 *   <StoryAdviserSection projectId={project.id} scriptText={project.script_text} />
 */

import { StoryAdviser } from './StoryAdviser';
import { FeatureGate } from '@/lib/features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb, FlaskConical } from 'lucide-react';

interface StoryAdviserSectionProps {
  projectId: string;
  scriptText: string;
  onNavigate?: (startLine: number, endLine: number) => void;
}

/**
 * Fallback shown when feature is disabled
 */
function StoryAdviserPreview() {
  return (
    <Card className="border-dashed border-2 opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          Story-Adviser
          <Badge variant="outline" className="ml-2">
            <FlaskConical className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
        <CardDescription>
          AI-powered inline suggestions to improve your screenplay.
          This feature is currently in development.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Story-Adviser will provide:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Specific, actionable suggestions linked to script locations</li>
            <li>AI-generated rewrite options</li>
            <li>Accept/reject workflow to track improvements</li>
            <li>Integration with StoryScore for targeted feedback</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function StoryAdviserSection({
  projectId,
  scriptText,
  onNavigate,
}: StoryAdviserSectionProps) {
  return (
    <FeatureGate
      feature="STORY_ADVISER"
      fallback={<StoryAdviserPreview />}
    >
      <StoryAdviser
        projectId={projectId}
        scriptText={scriptText}
        onNavigate={onNavigate}
      />
    </FeatureGate>
  );
}

export default StoryAdviserSection;
