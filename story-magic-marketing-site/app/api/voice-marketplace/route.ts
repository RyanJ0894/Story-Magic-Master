import { NextRequest, NextResponse } from 'next/server';

const TO_EMAIL = process.env.VOICE_MARKETPLACE_EMAIL ?? 'talent@storymagicapp.net';

// Formsubmit.co delivers email with zero API-key / domain-verification requirement.
// On the very first submission ever, Formsubmit sends an activation email to TO_EMAIL
// asking the recipient to click a confirmation link. After that, all submissions
// land directly. No ongoing setup needed.
const FORMSUBMIT_ENDPOINT = `https://formsubmit.co/ajax/${TO_EMAIL}`;

export async function POST(req: NextRequest) {
  let body: Record<string, string>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
  }

  const { name, email, voiceType, experience, demoUrl, genres, bio, consent } = body;

  // Validation
  if (!name || !email || !voiceType || !experience || !bio || consent !== 'true') {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 422 });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email address' }, { status: 422 });
  }

  // Always log — visible in Vercel function logs as a backup record
  console.log('[voice-marketplace] application received:', {
    name, email, voiceType, experience, demoUrl, genres,
    bio: bio.slice(0, 100),
  });

  const payload = {
    _subject: `Voice Marketplace Application — ${name}`,
    _replyto: email,
    _template: 'table',
    _captcha: 'false',
    Name: name,
    Email: email,
    'Voice Type': voiceType,
    'Experience Level': experience,
    'Demo URL': demoUrl || '(none provided)',
    Genres: genres || '(none selected)',
    'Bio / Pitch': bio,
    Source: 'storymagic.servicevision.io/voice-marketplace',
  };

  try {
    const res = await fetch(FORMSUBMIT_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        // Formsubmit.co requires these for server-side requests
        Referer: 'https://storymagic.servicevision.io/voice-marketplace',
        Origin: 'https://storymagic.servicevision.io',
      },
      body: JSON.stringify(payload),
    });

    const json = await res.json().catch(() => ({}));

    if (!res.ok || json.success === 'false') {
      console.error('[voice-marketplace] formsubmit error:', res.status, json);
      return NextResponse.json(
        { error: 'Failed to deliver your application. Please email talent@storymagicapp.net directly.' },
        { status: 500 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[voice-marketplace] network error:', err);
    return NextResponse.json(
      { error: 'Network error sending application. Please email talent@storymagicapp.net directly.' },
      { status: 500 }
    );
  }
}
