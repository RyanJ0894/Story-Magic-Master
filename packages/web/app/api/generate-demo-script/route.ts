import { withAuth, parseBody } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import OpenAI from 'openai';
import { z } from 'zod';
import { log } from '@/lib/logger';

// Trim the API key to remove any accidental whitespace/newlines
const apiKey = process.env.OPENAI_API_KEY?.trim();

const openai = new OpenAI({
  apiKey,
});

const DemoScriptRequestSchema = z.object({
  prompt: z.string().min(1, 'Prompt is required').max(500),
});

export const POST = withAuth(async (request) => {
  try {
    const parsed = await parseBody(request, DemoScriptRequestSchema);
    if ('error' in parsed) return parsed.error;

    // Sanitize: trim, strip control characters
    const prompt = parsed.data.prompt
      .trim()
      // eslint-disable-next-line no-control-regex
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');

    if (!apiKey) {
      return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 800,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `You are a screenplay writer. Generate a SHORT 1-page screenplay scene (about 200-300 words) based on the user's description.

Format it properly with:
- Scene heading (INT./EXT. LOCATION - TIME)
- Character introductions with age in parentheses
- Dialogue with character names in CAPS
- Brief action descriptions
- Keep it to 2-4 characters maximum
- Make it emotionally engaging but concise

Output ONLY the screenplay text, no explanations.`,
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const script = completion.choices[0]?.message?.content?.trim() || '';

    // Generate a title from the prompt
    const titleCompletion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      max_tokens: 20,
      messages: [
        {
          role: 'user',
          content: `Generate a short 2-4 word title for a screenplay about: ${prompt.slice(0, 200)}. Output ONLY the title, nothing else.`,
        },
      ],
    });

    const title = titleCompletion.choices[0]?.message?.content?.trim() || 'Untitled Scene';

    return NextResponse.json({
      script,
      title,
      description: prompt,
    });
  } catch (error) {
    log.error('Demo script generation error', error);
    return NextResponse.json(
      { error: 'Failed to generate script' },
      { status: 500 }
    );
  }
}, { rateLimit: 'strict' });
