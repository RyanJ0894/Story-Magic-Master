import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { generateText } from 'ai';
import { resolveModel, MODELS } from '@/lib/ai/providers';
import { getCategoryById } from '@/lib/impact/categories';
import { STORY_WORD_LIMIT, STORY_WORD_MIN, STORY_RATE_LIMIT_HOURS, countWords } from '@/lib/impact/limits';
import { sendStorySubmittedAlert } from '@/lib/email/impact';

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

// POST /api/impact/stories — create a new story (authenticated users only)
export async function POST(req: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json(
      { error: 'You must be signed in to create an Impact story.' },
      { status: 401 }
    );
  }

  const body = await req.json();
  const { title, category, storyText, isPublic, prizeEligible, authorName, authorCity } = body;

  // ── 1. Input validation ───────────────────────────────────────────────────
  if (!title || !category || !storyText) {
    return NextResponse.json(
      { error: 'title, category, and storyText are required' },
      { status: 400 }
    );
  }

  const cat = getCategoryById(category);
  if (!cat) {
    return NextResponse.json({ error: 'Invalid category' }, { status: 400 });
  }

  // ── 2. Word count enforcement ─────────────────────────────────────────────
  const wordCount = countWords(storyText);

  if (wordCount < STORY_WORD_MIN) {
    return NextResponse.json(
      { error: `Story must be at least ${STORY_WORD_MIN} words.` },
      { status: 400 }
    );
  }

  if (wordCount > STORY_WORD_LIMIT) {
    return NextResponse.json(
      {
        error:
          `Story exceeds the ${STORY_WORD_LIMIT}-word limit (${wordCount} words submitted). ` +
          `Please shorten your story before submitting.`,
      },
      { status: 400 }
    );
  }

  // ── 3. Rate limiting (1 story per STORY_RATE_LIMIT_HOURS per authenticated user) ─
  const windowStart = new Date(Date.now() - STORY_RATE_LIMIT_HOURS * 60 * 60 * 1000);
  const recentCount = await prisma.impactStory.count({
    where: { userId, createdAt: { gte: windowStart } },
  });
  if (recentCount >= 1) {
    return NextResponse.json(
      {
        error:
          `You have already submitted a story in the last ${STORY_RATE_LIMIT_HOURS} hours. ` +
          `Please come back tomorrow — we look forward to hearing more from you.`,
      },
      { status: 429 }
    );
  }

  // ── 4. AI expansion ───────────────────────────────────────────────────────
  let expandedText: string | null = null;
  if (storyText.length >= 100) {
    try {
      const { text } = await generateText({
        model: resolveModel(MODELS.PRODUCTION),
        maxOutputTokens: 1200,
        messages: [
          {
            role: 'user',
            content:
              `You are a compassionate story editor helping a person share their personal journey. ` +
              `Below is their story in their own words. Expand it into a vivid, moving 300–450 word narrative ` +
              `that preserves their voice and every fact they shared. Do not invent new events. ` +
              `Do not change names or details. Keep the first-person voice. ` +
              `End with something that reflects their resilience or hope.\n\n` +
              `Their story:\n${storyText}\n\nExpanded narrative:`,
          },
        ],
      });
      expandedText = text.trim();
    } catch {
      // Expansion failure is non-fatal; proceed with original text
    }
  }

  // ── 5. Persist ─────────────────────────────────────────────────────────────
  const story = await prisma.impactStory.create({
    data: {
      userId,
      title,
      category,
      storyText,
      expandedText,
      authorName: authorName ?? null,
      authorCity: authorCity ?? null,
      isPublic: Boolean(isPublic),
      prizeEligible: prizeEligible !== false,
      attestedAt: new Date(),
      status: 'draft',
    },
  });

  // Fire-and-forget: alert admin when story is submitted for gallery
  if (story.isPublic) {
    sendStorySubmittedAlert({
      storyTitle: story.title,
      category: story.category,
      authorName: story.authorName,
      storyId: story.id,
    }).catch(() => {});
  }

  return NextResponse.json(story, { status: 201 });
}
