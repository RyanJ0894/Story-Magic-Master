/**
 * Smoke test for the ElevenLabs API.
 *
 * Checks two things:
 *   1. Key validity + quota — hits /v1/user (zero character cost).
 *   2. Actual TTS synthesis — generates one short phrase and verifies
 *      the returned PCM buffer is non-empty.
 *
 * Run with:
 *   npx tsx scripts/smoke-test-elevenlabs.ts
 *
 * Uses ELEVENLABS_API_KEY from the environment (.env or Doppler).
 * Set ELEVENLABS_MODEL to override the model (default: eleven_turbo_v2_5).
 * Set SMOKE_TTS_VOICE_ID to use a different voice (default: Jessica cgSgspJ2msm6clMCkdW9).
 */

const TIMEOUT_MS = 15_000;

// Jessica — same default as DEFAULT_FEMALE_VOICE in voice-map.ts
const DEFAULT_VOICE_ID = process.env.SMOKE_TTS_VOICE_ID ?? 'cgSgspJ2msm6clMCkdW9';
const DEFAULT_MODEL    = process.env.ELEVENLABS_MODEL   ?? 'eleven_turbo_v2_5';
const TEST_TEXT        = 'Hello. This is a smoke test.';

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// ── Step 1: Key + quota check ────────────────────────────────────────────────

async function checkUser(apiKey: string): Promise<void> {
  process.stdout.write('Step 1 — GET /v1/user (key + quota check) … ');

  const res = await withTimeout(
    fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    }),
    TIMEOUT_MS,
    '/v1/user',
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const data = await res.json() as {
    subscription?: {
      character_count?: number;
      character_limit?: number;
      tier?: string;
    };
  };

  const sub = data.subscription ?? {};
  const used  = sub.character_count  ?? '?';
  const limit = sub.character_limit  ?? '?';
  const tier  = sub.tier             ?? 'unknown';

  console.log(`OK`);
  console.log(`       tier=${tier}  chars_used=${used}  chars_limit=${limit}`);
}

// ── Step 2: TTS synthesis ────────────────────────────────────────────────────

async function checkTTS(apiKey: string): Promise<void> {
  process.stdout.write(`Step 2 — TTS synthesis (model=${DEFAULT_MODEL}, voice=${DEFAULT_VOICE_ID}) … `);

  const res = await withTimeout(
    fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${DEFAULT_VOICE_ID}?output_format=pcm_24000`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json',
          Accept: 'audio/pcm',
        },
        body: JSON.stringify({
          text: TEST_TEXT,
          model_id: DEFAULT_MODEL,
          voice_settings: { stability: 0.4, similarity_boost: 0.7, use_speaker_boost: false },
        }),
      },
    ),
    TIMEOUT_MS,
    'TTS synthesis',
  );

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${body.slice(0, 200)}`);
  }

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('Response body is empty');

  // PCM 24 kHz mono s16le — rough sanity check on duration
  const durationSec = buf.length / (24000 * 2);
  console.log(`OK`);
  console.log(`       bytes=${buf.length}  ~${durationSec.toFixed(2)}s of audio`);
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function run(): Promise<void> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY is not set.');
    process.exit(1);
  }

  console.log('ElevenLabs smoke test\n');

  let failed = false;

  for (const [label, fn] of [
    ['checkUser', () => checkUser(apiKey)],
    ['checkTTS',  () => checkTTS(apiKey)],
  ] as [string, () => Promise<void>][]) {
    try {
      await fn();
    } catch (err) {
      console.log(`FAIL`);
      console.error(`  Error: ${(err as Error).message}\n`);
      failed = true;
    }
  }

  console.log('\n' + (failed ? 'RESULT: FAIL' : 'RESULT: PASS'));
  if (failed) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
