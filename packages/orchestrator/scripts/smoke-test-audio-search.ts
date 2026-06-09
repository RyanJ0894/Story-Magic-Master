/**
 * End-to-end smoke test for the unified embedding path.
 *
 * Exercises the full chain a real audio_search_music / _ambience / _sfx
 * tool call goes through:
 *
 *   1. EmbeddingStore loads the regenerated catalog (load-time guard runs).
 *   2. getQueryEmbedding hits OpenAI for a natural-language query.
 *   3. Runtime dimension guard runs.
 *   4. cosineSimilarity scores the query against every catalog item.
 *   5. Top-K results print so a human can eyeball whether matches make sense.
 *
 * Run with:
 *   doppler run -p story-magic -c prd --only-secrets OPENAI_API_KEY -- \
 *     npx tsx scripts/smoke-test-audio-search.ts
 *
 * A "PASS" here is two-part:
 *   - no exceptions thrown
 *   - top result is semantically related to the query (look at the printout)
 */

import { getQueryEmbedding } from '../src/director/embeddings/query-embedding.js';
import {
  getMusicStore,
  getAmbienceStore,
  getSfxStore,
} from '../src/director/embeddings/embedding-store.js';
import { EMBEDDING_DIMENSIONS, EMBEDDING_MODEL } from '../src/lib/embedding-config.js';

interface SmokeCase {
  category: 'music' | 'ambience' | 'sfx';
  query: string;
  /** Substrings that, if found in the top-3 result IDs/titles, indicate the match is sane. */
  expectedAnyOf: string[];
}

const cases: SmokeCase[] = [
  // Music
  { category: 'music', query: 'epic uplifting orchestral cinematic battle', expectedAnyOf: ['epic', 'uplifting', 'string', 'orchestra'] },
  { category: 'music', query: 'sad melancholy piano emotional scene', expectedAnyOf: ['sad', 'melancholy', 'emotional', 'piano', 'slow'] },
  { category: 'music', query: 'tense thriller suspense dark', expectedAnyOf: ['thriller', 'tense', 'dark', 'suspense'] },

  // Ambience
  { category: 'ambience', query: 'rainy night outside city street', expectedAnyOf: ['rain', 'night', 'city', 'street', 'outdoor'] },
  { category: 'ambience', query: 'busy coffee shop chatter background', expectedAnyOf: ['coffee', 'cafe', 'crowd', 'chatter', 'restaurant'] },

  // SFX
  { category: 'sfx', query: 'gunshot single pistol shot', expectedAnyOf: ['gun', 'shot', 'pistol'] },
  { category: 'sfx', query: 'door slam closing hard', expectedAnyOf: ['door'] },
  { category: 'sfx', query: 'dog barking outside', expectedAnyOf: ['dog', 'bark', 'animal'] },
  { category: 'sfx', query: 'phone ringing landline', expectedAnyOf: ['phone', 'ring'] },
];

function getStore(cat: 'music' | 'ambience' | 'sfx') {
  switch (cat) {
    case 'music': return getMusicStore();
    case 'ambience': return getAmbienceStore();
    case 'sfx': return getSfxStore();
  }
}

async function run(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set — cannot run real smoke test.');
    process.exit(1);
  }

  console.log(`Smoke test using ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d)\n`);

  let passes = 0;
  let warns = 0;
  let fails = 0;

  for (const tc of cases) {
    process.stdout.write(`[${tc.category.padEnd(8)}] "${tc.query}"\n`);

    let store: ReturnType<typeof getStore>;
    try {
      store = getStore(tc.category);
    } catch (err) {
      console.error(`  FAIL: store load threw: ${(err as Error).message}\n`);
      fails++;
      continue;
    }

    let queryVec: number[];
    try {
      queryVec = await getQueryEmbedding(tc.query);
    } catch (err) {
      console.error(`  FAIL: getQueryEmbedding threw: ${(err as Error).message}\n`);
      fails++;
      continue;
    }

    if (queryVec.length !== EMBEDDING_DIMENSIONS) {
      console.error(`  FAIL: query vec dim ${queryVec.length} ≠ expected ${EMBEDDING_DIMENSIONS}\n`);
      fails++;
      continue;
    }

    let results: ReturnType<typeof store.searchByEmbedding>;
    try {
      results = store.searchByEmbedding(queryVec, 3);
    } catch (err) {
      console.error(`  FAIL: searchByEmbedding threw: ${(err as Error).message}\n`);
      fails++;
      continue;
    }

    if (results.length === 0) {
      console.error(`  FAIL: zero results returned\n`);
      fails++;
      continue;
    }

    const top = results[0];
    const haystack = JSON.stringify(top.item).toLowerCase();
    const matchedHint = tc.expectedAnyOf.find((h) => haystack.includes(h.toLowerCase()));

    for (const r of results) {
      const item = r.item as { id?: string; title?: string; file?: string };
      const tag = item.id || item.title || item.file || '<unknown>';
      console.log(`    score=${r.score.toFixed(3)}  ${tag}`);
    }

    if (matchedHint) {
      console.log(`  PASS (top match contains "${matchedHint}")\n`);
      passes++;
    } else {
      console.warn(`  WARN: top match contains none of [${tc.expectedAnyOf.join(', ')}] — review manually\n`);
      warns++;
    }
  }

  console.log(`\n— Summary —`);
  console.log(`  Passes: ${passes}`);
  console.log(`  Warns:  ${warns}`);
  console.log(`  Fails:  ${fails}`);
  console.log(`  Total:  ${cases.length}`);

  if (fails > 0) process.exit(1);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
