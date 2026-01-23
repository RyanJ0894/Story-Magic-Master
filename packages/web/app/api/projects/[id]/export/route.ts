/**
 * Export API Route
 *
 * GET /api/projects/[id]/export - Generate and download PDF report
 */

import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/features';
import { pdf } from '@react-pdf/renderer';
import { StoryScorePDF } from '@/lib/export/StoryScorePDF';
import { getLatestScore } from '@/lib/scoring/service';

// =============================================================================
// GET - Generate PDF
// =============================================================================

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!isFeatureEnabled('EXPORT_REPORTS')) {
    return NextResponse.json(
      { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
      { status: 403 }
    );
  }

  const supabase = await createClient();
  const { id: projectId } = await params;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: 'Unauthorized', code: 'AUTH_REQUIRED' },
      { status: 401 }
    );
  }

  // Fetch project
  const { data: project } = await supabase
    .from('projects')
    .select('id, name, user_id')
    .eq('id', projectId)
    .eq('user_id', user.id)
    .single();

  if (!project) {
    return NextResponse.json(
      { error: 'Project not found', code: 'NOT_FOUND' },
      { status: 404 }
    );
  }

  try {
    // Get the latest StoryScore
    const score = await getLatestScore(projectId);

    if (!score) {
      return NextResponse.json(
        { error: 'No StoryScore found for this project. Generate a score first.', code: 'NO_SCORE' },
        { status: 400 }
      );
    }

    // Generate PDF
    const pdfDoc = pdf(
      StoryScorePDF({
        score,
        projectName: project.name,
        generatedAt: new Date(),
      })
    );

    const pdfBlob = await pdfDoc.toBlob();
    const pdfArrayBuffer = await pdfBlob.arrayBuffer();

    // Return PDF as download
    const filename = `StoryScore-${project.name.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;

    return new NextResponse(pdfArrayBuffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfArrayBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    console.error('[Export] Error generating PDF:', error);
    return NextResponse.json(
      {
        error: 'Failed to generate PDF',
        code: 'GENERATION_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}
