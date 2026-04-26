import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { AdviserWizard } from '@/components/story-adviser/AdviserWizard';
import { FeatureGate } from '@/lib/features';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, FileText, Lightbulb, FlaskConical } from 'lucide-react';

// =============================================================================
// Feature-disabled fallback
// =============================================================================

function AdviserDisabled() {
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
            <li>AI-generated rewrite options with side-by-side diff view</li>
            <li>Accept/reject/dismiss workflow to track improvements</li>
            <li>Batch actions for bulk review</li>
            <li>One-click apply rewrite back to your script</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}

// =============================================================================
// Page
// =============================================================================

export default async function AdviserPage(
  props: {
    params: Promise<{ id: string }>;
  }
) {
  const params = await props.params;
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const project = await prisma.project.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      name: true,
      pageCount: true,
      scriptText: true,
      userId: true,
    },
  });

  if (!project) notFound();

  // Ownership check
  if (project.userId !== userId) notFound();

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href={`/projects/${project.id}`}>
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back to project
              </Button>
            </Link>
            <div className="h-6 w-px bg-muted" />
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-amber-500" />
              </div>
              <div>
                <h1 className="font-semibold text-foreground leading-none">
                  Story-Adviser
                </h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {project.name} · {project.pageCount} pages
                </p>
              </div>
            </div>
            <Badge variant="secondary" className="ml-auto">Beta</Badge>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <FeatureGate feature="STORY_ADVISER" fallback={<AdviserDisabled />}>
          <AdviserWizard
            projectId={project.id}
            scriptText={project.scriptText ?? ''}
          />
        </FeatureGate>
      </main>
    </div>
  );
}
