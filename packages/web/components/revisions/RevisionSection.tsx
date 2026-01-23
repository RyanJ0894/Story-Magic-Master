'use client';

/**
 * Revision Section with Feature Flag
 *
 * Usage in server components:
 *   <RevisionSection projectId={project.id} />
 */

import { RevisionTimeline } from './RevisionTimeline';
import { FeatureGate } from '@/lib/features';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { History, FlaskConical } from 'lucide-react';

interface RevisionSectionProps {
  projectId: string;
  onSelectRevision?: (revisionId: string) => void;
  onCompare?: (fromId: string, toId: string) => void;
}

/**
 * Fallback shown when feature is disabled
 */
function RevisionPreview() {
  return (
    <Card className="border-dashed border-2 opacity-60">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="w-5 h-5 text-slate-500" />
          Revision History
          <Badge variant="outline" className="ml-2">
            <FlaskConical className="w-3 h-3 mr-1" />
            Coming Soon
          </Badge>
        </CardTitle>
        <CardDescription>
          Track changes to your script and see how your score improves over time.
          This feature is currently in development.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="text-sm text-muted-foreground space-y-2">
          <p>Revision Tracking will provide:</p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Automatic versioning of script changes</li>
            <li>Score trajectory visualization</li>
            <li>Side-by-side diff comparison</li>
            <li>Version labels and notes</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

export function RevisionSection({
  projectId,
  onSelectRevision,
  onCompare,
}: RevisionSectionProps) {
  return (
    <FeatureGate
      feature="REVISION_TRACKING"
      fallback={<RevisionPreview />}
    >
      <RevisionTimeline
        projectId={projectId}
        onSelectRevision={onSelectRevision}
        onCompare={onCompare}
      />
    </FeatureGate>
  );
}

export default RevisionSection;
