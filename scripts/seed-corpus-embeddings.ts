/**
 * Seed Corpus Embeddings Script
 *
 * One-time utility to populate logline_embedding for all script_corpus entries
 * that have NULL embeddings.
 *
 * Usage:
 *   npx tsx scripts/seed-corpus-embeddings.ts
 *
 * Requires:
 *   - OPENAI_API_KEY set in environment
 *   - NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY set in environment
 */

import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';

// =============================================================================
// Configuration
// =============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const openaiKey = process.env.OPENAI_API_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

if (!openaiKey) {
  console.error('Missing OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const openai = new OpenAI({ apiKey: openaiKey });

// =============================================================================
// Helpers
// =============================================================================

function preprocessLogline(logline: string): string {
  let processed = logline.trim();
  processed = processed.replace(/^(when|after|in a world where)/i, '');
  processed = processed.replace(/\s+/g, ' ').trim();
  return processed;
}

async function generateEmbedding(text: string): Promise<number[]> {
  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });
  return response.data[0].embedding;
}

function toPgvectorFormat(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('Fetching script_corpus entries with NULL embeddings...');

  const { data: scripts, error } = await supabase
    .from('script_corpus')
    .select('id, title, logline')
    .is('logline_embedding', null)
    .not('logline', 'is', null);

  if (error) {
    console.error('Failed to fetch scripts:', error.message);
    process.exit(1);
  }

  if (!scripts || scripts.length === 0) {
    console.log('No scripts with NULL embeddings found. Nothing to do.');
    return;
  }

  console.log(`Found ${scripts.length} scripts to embed.\n`);

  let updated = 0;
  let failed = 0;

  for (const script of scripts) {
    if (!script.logline) continue;

    try {
      const processed = preprocessLogline(script.logline);
      const embedding = await generateEmbedding(processed);

      const { error: updateError } = await supabase
        .from('script_corpus')
        .update({ logline_embedding: toPgvectorFormat(embedding) })
        .eq('id', script.id);

      if (updateError) {
        console.error(`  FAIL: ${script.title} — ${updateError.message}`);
        failed++;
      } else {
        console.log(`  OK: ${script.title}`);
        updated++;
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error(`  FAIL: ${script.title} — ${message}`);
      failed++;
    }
  }

  console.log(`\nDone. Updated: ${updated}, Failed: ${failed}`);
}

main().catch((err) => {
  console.error('Unhandled error:', err);
  process.exit(1);
});
