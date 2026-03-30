import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { generateText } from 'ai';
import { resolveModel, MODELS } from '@/lib/ai/providers';
import { getCategoryById } from '@/lib/impact/categories';

// GET /api/impact/stories — public gallery (approved + public only)
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get('category');
  const page = Math.max(1, Number(searchParams.get('page') ?? '1'));
  const limit = 12;

  const where = {
    isPublic: true,
    isApproved: true,
    status: 'complete',
    ...(category ? { category } : {}),
  };

  const [stories, total] = await Promise.all([
    prisma.impactStory.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        authorName: true,
        authorCity: true,
        audioUrl: true,
        playCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.impactStory.count({ where }),
  ]);

  return NextResponse.json({ stories, total, page, pages: Math.ceil(total / limit) });
}

// POST /api/impact/stories — create a new story (draft)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  const body = await req.json();

  const { title, category, storyText, sessionId, authorName, authorCity, isPublic, prizeEligible } = body;

  if (!title || !category || !storyText) {
    return NextResponse.json({ error: 'title, category, and storyText are required' }, { status: 400 });
  }

  const cat = getCategoryById(category);
  if (!cat) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  // AI expansion: enrich the story with a natural narrative voice
  let expandedText: string | null = null;
  if (storyText.length >= 100) {
    try {
      const { text } = await generateText({
        model: resolveModel(MODELS.PRODUCTION),
        maxOutputTokens: 1200,
        messages: [
          {
            role: 'user',
            content: `You are a compassionate story editor helping a person share their personal journey. Below is their story in their own words. Expand it into a vivid, moving 300–450 word narrative that preserves their voice and every fact they shared. Do not invent new events. Do not change names or details. Keep the first-person voice. End with something that reflects their resilience or hope.

Their story:
${storyText}

Expanded narrative:`,
          },
        ],
      });
      expandedText = text.trim();
    } catch {
      // Expansion failure is non-fatal; proceed with original text
    }
  }

  const story = await prisma.impactStory.create({
    data: {
      userId: userId ?? null,
      sessionId: sessionId ?? null,
      title,
      category,
      storyText,
      expandedText,
      authorName: authorName ?? null,
      authorCity: authorCity ?? null,
      isPublic: Boolean(isPublic),
      prizeEligible: prizeEligible !== false,
      status: 'draft',
    },
  });

  return NextResponse.json(story, { status: 201 });
}
