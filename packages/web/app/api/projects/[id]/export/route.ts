/**
 * Export API Route
 *
 * GET /api/projects/[id]/export - Generate and download PDF report
 */

import { NextResponse } from 'next/server';
import { isFeatureEnabled } from '@/lib/features';
import { withProjectAuth } from '@/lib/api/middleware';
import { pdf } from '@react-pdf/renderer';
import { StoryScorePDF } from '@/lib/export/StoryScorePDF';
import { getLatestScore } from '@/lib/scoring/service';

// =============================================================================
// GET - Generate PDF
// =============================================================================

export const GET = withProjectAuth(
  async (_request, { projectId, project }) => {
    if (!isFeatureEnabled('EXPORT_REPORTS')) {
      return NextResponse.json(
        { error: 'Feature not enabled', code: 'FEATURE_DISABLED' },
        { status: 403 }
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

      const projectName = project.name as string;

      // Generate PDF
      const pdfDoc = pdf(
        StoryScorePDF({
          score,
          projectName,
          generatedAt: new Date(),
        })
      );

      const pdfBlob = await pdfDoc.toBlob();
      const pdfArrayBuffer = await pdfBlob.arrayBuffer();

      // Return PDF as download
      const filename = `StoryScore-${projectName.replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf`;

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
        },
        { status: 500 }
      );
    }
  },
  { rateLimit: 'normal' }
);
