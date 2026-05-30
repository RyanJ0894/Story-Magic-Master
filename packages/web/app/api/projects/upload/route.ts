/**
 * Projects Upload API Route
 *
 * POST /api/projects/upload - Upload a screenplay file and create a project.
 * Supported formats: .txt, .md, .docx, .pdf, .fountain, .fdx
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { parseScreenplay, getProjectNameFromFilename } from '@/lib/upload/parse-screenplay';
import { createProject } from '@/lib/services/projects';

const ACCEPTED_EXTENSIONS = new Set(['.txt', '.md', '.docx', '.pdf', '.fountain', '.fdx']);

function getExtension(filename: string): string {
  const dot = filename.lastIndexOf('.');
  return dot === -1 ? '' : filename.slice(dot).toLowerCase();
}

// Allow uploads up to 10MB (Next.js App Router defaults to 1MB)
export const maxDuration = 30;

export const POST = withAuth(
  async (request, { userId, prisma }) => {
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json(
        { error: 'Invalid form data', code: 'INVALID_FORM' },
        { status: 400 }
      );
    }

    const file = formData.get('file');
    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: 'No file provided', code: 'MISSING_FILE' },
        { status: 400 }
      );
    }

    const ext = getExtension(file.name);
    if (!ACCEPTED_EXTENSIONS.has(ext)) {
      return NextResponse.json(
        {
          error: `Unsupported file type "${ext}". Accepted formats: .txt, .md, .docx, .pdf, .fountain, .fdx`,
          code: 'UNSUPPORTED_TYPE',
        },
        { status: 400 }
      );
    }

    try {
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const { text, pageCount } = await parseScreenplay(buffer, file.name);

      const nameField = formData.get('name');
      const projectName =
        typeof nameField === 'string' && nameField.trim()
          ? nameField.trim()
          : getProjectNameFromFilename(file.name);

      const descriptionField = formData.get('description');
      if (typeof descriptionField === 'string' && descriptionField.length > 500) {
        return NextResponse.json(
          { error: 'Description too long (max 500 characters)', code: 'DESCRIPTION_TOO_LONG' },
          { status: 400 }
        );
      }
      const description =
        typeof descriptionField === 'string' && descriptionField.trim()
          ? descriptionField.trim()
          : null;

      const project = await createProject(prisma, userId, {
        name: projectName,
        description,
        scriptText: text || null,
        pageCount,
      });

      return NextResponse.json(
        { id: project.id, name: project.name, pageCount },
        { status: 201 }
      );
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to process file';
      return NextResponse.json(
        { error: message, code: 'PARSE_ERROR' },
        { status: 400 }
      );
    }
  },
  { rateLimit: 'strict' }
);
