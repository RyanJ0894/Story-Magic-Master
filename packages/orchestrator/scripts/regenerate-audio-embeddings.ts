/**
 * Regenerate audio catalog embeddings (music + ambience + sfx).
 *
 * Why: the catalog vectors were originally produced by Python's
 * `all-MiniLM-L6-v2` (384d). The TypeScript orchestrator's query path uses
 * OpenAI `text-embedding-3-small` (1536d). Cosine similarity between vectors
 * from different embedding spaces is meaningless — and in our case the length
 * mismatch made every audio-search tool call throw outright.
 *
 * This script re-embeds the catalog metadata with the canonical model from
 * `src/lib/embedding-config.ts`, so the stored vectors match what the runtime
 * query path produces.
 *
 * Usage:
 *   OPENAI_API_KEY=... pnpm --filter @story-magic/orchestrator exec \
 *     tsx scripts/regenerate-audio-embeddings.ts
 *
 * Cost: ~208 short strings × ~50 tokens × $0.02 / 1M tokens ≈ $0.0002.
 *
 * The output JSON files are committed to the repo so production deploys ship
 * with embeddings already in place.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { embed } from 'ai';
import { openai } from '@ai-sdk/openai';
import {
  EMBEDDING_MODEL,
  EMBEDDING_DIMENSIONS,
  assertEmbeddingDimension,
} from '../src/lib/embedding-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const KNOWLEDGE_BASE_PATH = join(__dirname, '..', 'knowledge_bases');

interface AudioMeta {
  id: string;
  file: string;
  title: string;
  group: string;
  style?: string;
  mood?: string[];
  intensity?: number;
  loopable?: boolean;
  tags?: string[];
  [k: string]: unknown;
}

/**
 * Build the natural-language string that represents a catalog item for
 * embedding. Mirrors how the LLM phrases search queries
 * ("epic uplifting orchestral, soaring strings, cinematic") so cosine
 * similarity captures real semantic overlap.
 */
function buildEmbeddingText(item: AudioMeta): string {
  const parts: string[] = [];
  if (item.title) parts.push(item.title);
  if (item.group) parts.push(item.group.toLowerCase());
  if (item.style) parts.push(item.style);
  if (Array.isArray(item.mood) && item.mood.length) parts.push(item.mood.join(', '));
  if (Array.isArray(item.tags) && item.tags.length) parts.push(item.tags.join(', '));
  if (typeof item.intensity === 'number') {
    parts.push(item.intensity >= 70 ? 'high intensity' : item.intensity >= 40 ? 'medium intensity' : 'low intensity');
  }
  if (item.loopable === true) parts.push('loopable');
  return parts.join(' — ');
}

async function embedOne(text: string): Promise<number[]> {
  const { embedding } = await embed({
    model: openai.embedding(EMBEDDING_MODEL),
    value: text,
  });
  assertEmbeddingDimension(embedding, `embed("${text.slice(0, 40)}")`);
  return embedding;
}

async function regenerateCategory(category: 'music' | 'ambience' | 'sfx'): Promise<void> {
  // `category` is a literal-union parameter — only the three values can flow
  // here (compile-time guaranteed, and the for-loop in main() iterates a
  // hard-coded `as const` tuple). Not user input.
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const base = join(KNOWLEDGE_BASE_PATH, 'audio_embeddings_store', category);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const metadataPath = join(base, `${category}_metadata.json`);
  // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  const embeddingsPath = join(base, `${category}_embeddings.json`);

  console.log(`\n→ ${category}: reading ${metadataPath}`);
  const metadata: AudioMeta[] = JSON.parse(readFileSync(metadataPath, 'utf-8'));
  console.log(`  ${metadata.length} items`);

  const vectors: number[][] = [];
  for (let i = 0; i < metadata.length; i++) {
    const item = metadata[i];
    const text = buildEmbeddingText(item);
    process.stdout.write(`  [${i + 1}/${metadata.length}] ${item.id}: ${text.slice(0, 60)}...`);
    const vec = await embedOne(text);
    vectors.push(vec);
    process.stdout.write(` ✓ (${vec.length}d)\n`);
  }

  writeFileSync(embeddingsPath, JSON.stringify(vectors));
  console.log(`  wrote ${vectors.length} × ${EMBEDDING_DIMENSIONS}d → ${embeddingsPath}`);
}

async function main(): Promise<void> {
  if (!process.env.OPENAI_API_KEY) {
    console.error('OPENAI_API_KEY is not set. Aborting.');
    process.exit(1);
  }

  console.log(`Regenerating audio embeddings with ${EMBEDDING_MODEL} (${EMBEDDING_DIMENSIONS}d)`);

  for (const category of ['music', 'ambience', 'sfx'] as const) {
    await regenerateCategory(category);
  }

  console.log('\nDone. Commit the *_embeddings.json files.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
