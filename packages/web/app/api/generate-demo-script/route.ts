import { NextResponse } from 'next/server';
import OpenAI from 'openai';

// Trim the API key to remove any accidental whitespace/newlines
const apiKey = process.env.OPENAI_API_KEY?.trim();

const openai = new OpenAI({
  apiKey,
});

export async function POST(request: Request) {
  try {
    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Prompt is required' }, { status: 400 });
    }

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
          content: `Generate a short 2-4 word title for a screenplay about: ${prompt}. Output ONLY the title, nothing else.`,
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
    console.error('Demo script generation error:', error);
    return NextResponse.json(
      { error: 'Failed to generate script' },
      { status: 500 }
    );
  }
}
