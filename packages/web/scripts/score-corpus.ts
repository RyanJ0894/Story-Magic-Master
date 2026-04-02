/**
 * StoryScore Corpus Scoring Script
 *
 * Batch-scores all ingested training scripts in script_corpus.
 * Stores results in corpus_score table.
 * Prints a calibration report showing score distribution by dataset category.
 *
 * Usage:
 *   pnpm --filter @story-magic/web tsx scripts/score-corpus.ts
 *   pnpm --filter @story-magic/web tsx scripts/score-corpus.ts --model gemini-2.0-flash
 *   pnpm --filter @story-magic/web tsx scripts/score-corpus.ts --rescore   # re-score already scored
 *   pnpm --filter @story-magic/web tsx scripts/score-corpus.ts --dry-run
 */

import { PrismaClient } from '@prisma/client';
import { callScoringLLM } from '@/lib/scoring/service';
import { MODELS } from '@/lib/ai/providers';
import {
  DIMENSIONS,
  DimensionKey,
  calculateCategoryScore,
  calculateOverallScore,
} from '@/lib/scoring/types';

const prisma = new PrismaClient();

// =============================================================================
// CLI args
// =============================================================================

const DRY_RUN = process.argv.includes('--dry-run');
const RESCORE = process.argv.includes('--rescore');
const MODEL_ARG = process.argv.find(a => a.startsWith('--model='))?.split('=')[1]
  ?? (process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : null);
const MODEL = MODEL_ARG ?? MODELS.BATCH; // Default to Gemini Flash for cost efficiency

const CONCURRENCY = 3; // Parallel scoring jobs
const RATE_LIMIT_MS = 1000; // 1s between batches

// =============================================================================
// Score a single corpus script
// =============================================================================

async function scoreCorpusScript(script: {
  id: string;
  title: string;
  scriptText: string | null;
  datasetCategory: string | null;
  genre: string[];
  logline: string | null;
}): Promise<{ overallScore: number; category: string | null }> {
  if (!script.scriptText) {
    throw new Error('Script has no text — run ingest-training-scripts first');
  }

  const result = await callScoringLLM(script.scriptText, {
    title: script.title,
    genre: script.genre[0],
    logline: script.logline ?? undefined,
    model: MODEL,
    useCalibration: false, // Don't use calibration when building the calibration set
  });

  // Build dimension scores
  const dimensions: Record<DimensionKey, { score: number; reasoning: string }> = {} as never;
  for (const key of Object.keys(DIMENSIONS) as DimensionKey[]) {
    const dim = result.dimensions[key];
    if (!dim) throw new Error(`Missing dimension: ${key}`);
    dimensions[key] = { score: dim.score, reasoning: dim.reasoning };
  }

  const conceptScore = calculateCategoryScore(dimensions, 'concept');
  const structureScore = calculateCategoryScore(dimensions, 'structure');
  const characterScore = calculateCategoryScore(dimensions, 'character');
  const craftScore = calculateCategoryScore(dimensions, 'craft');
  const overallScore = calculateOverallScore(dimensions);

  if (!DRY_RUN) {
    await prisma.corpusScore.create({
      data: {
        corpusScriptId: script.id,
        modelVersion: MODEL,
        overallScore: overallScore.toString(),
        conceptScore: conceptScore.toString(),
        structureScore: structureScore.toString(),
        characterScore: characterScore.toString(),
        craftScore: craftScore.toString(),
        dimensions: dimensions as object,
        strengths: result.strengths,
        weaknesses: result.weaknesses,
        confidence: result.confidence.toString(),
      },
    });
  }

  return { overallScore, category: script.datasetCategory };
}

// =============================================================================
// Batch processing with concurrency
// =============================================================================

async function processBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = [];

  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);

    if (i + concurrency < items.length) {
      await new Promise(r => setTimeout(r, RATE_LIMIT_MS));
    }
  }

  return results;
}

// =============================================================================
// Calibration report
// =============================================================================

function printCalibrationReport(
  scored: { title: string; category: string | null; score: number }[]
) {
  const categories = Array.from(new Set(scored.map(s => s.category ?? 'Unknown')));

  console.log('\n=== Calibration Report ===\n');
  console.log('Score distribution by dataset category:\n');

  const allScores = scored.map(s => s.score);
  console.log(`Overall range: ${Math.min(...allScores).toFixed(1)} – ${Math.max(...allScores).toFixed(1)}`);
  console.log(`Overall mean:  ${(allScores.reduce((a, b) => a + b, 0) / allScores.length).toFixed(2)}\n`);

  const categoryOrder = ['Oscar Winner', 'Black List', 'Produced Benchmark', 'TV Benchmark', 'Weak Film'];
  const sortedCats = [...categories].sort((a, b) => {
    const ai = categoryOrder.indexOf(a);
    const bi = categoryOrder.indexOf(b);
    return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
  });

  for (const cat of sortedCats) {
    const catScores = scored.filter(s => (s.category ?? 'Unknown') === cat).map(s => s.score);
    if (catScores.length === 0) continue;
    const avg = catScores.reduce((a, b) => a + b, 0) / catScores.length;
    const min = Math.min(...catScores);
    const max = Math.max(...catScores);
    console.log(`${cat.padEnd(22)} n=${catScores.length}  avg=${avg.toFixed(2)}  range=${min.toFixed(1)}-${max.toFixed(1)}`);
  }

  console.log('\nIndividual scores:');
  const sorted = [...scored].sort((a, b) => b.score - a.score);
  for (const s of sorted) {
    console.log(`  ${s.score.toFixed(2).padStart(5)}  ${(s.category ?? '').padEnd(22)}  ${s.title}`);
  }

  // Calibration health check
  const oscarAvg = scored.filter(s => s.category === 'Oscar Winner').reduce((a, b) => a + b.score, 0) /
    Math.max(1, scored.filter(s => s.category === 'Oscar Winner').length);
  const weakAvg = scored.filter(s => s.category === 'Weak Film').reduce((a, b) => a + b.score, 0) /
    Math.max(1, scored.filter(s => s.category === 'Weak Film').length);
  const spread = oscarAvg - weakAvg;

  console.log('\n=== Calibration Health ===');
  console.log(`Oscar Winner avg:   ${oscarAvg.toFixed(2)}`);
  console.log(`Weak Film avg:      ${weakAvg.toFixed(2)}`);
  console.log(`Spread:             ${spread.toFixed(2)}`);

  if (spread < 1.5) {
    console.log('⚠️  WARNING: Low spread — model may be clustering scores. Consider re-scoring with calibration examples.');
  } else if (spread >= 2.5) {
    console.log('✓  Good spread — scores are well-differentiated.');
  } else {
    console.log('~  Acceptable spread.');
  }
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('=== StoryScore Corpus Scoring ===');
  console.log(`Model:    ${MODEL}`);
  if (DRY_RUN) console.log('*** DRY RUN MODE — no database writes ***');
  if (RESCORE) console.log('*** RESCORE MODE — re-scoring already scored scripts ***');
  console.log('');

  // Find scripts to score
  const scripts = await prisma.scriptCorpus.findMany({
    where: {
      scriptText: { not: null },
      datasetCategory: { not: null },
      ...(RESCORE ? {} : {
        corpusScores: {
          none: { modelVersion: MODEL },
        },
      }),
    },
    select: {
      id: true,
      title: true,
      scriptText: true,
      datasetCategory: true,
      genre: true,
      logline: true,
    },
  });

  if (scripts.length === 0) {
    console.log('No scripts to score. Either:');
    console.log('  1. Run ingest-training-scripts.ts first');
    console.log('  2. Use --rescore to re-score already scored scripts');
    await prisma.$disconnect();
    return;
  }

  console.log(`Scoring ${scripts.length} scripts with ${MODEL}...\n`);

  const scored: { title: string; category: string | null; score: number }[] = [];
  let successCount = 0;
  let errorCount = 0;

  if (DRY_RUN) {
    for (const s of scripts) {
      console.log(`  [DRY RUN] Would score: "${s.title}" (${s.datasetCategory})`);
    }
    await prisma.$disconnect();
    return;
  }

  const results = await processBatch(
    scripts,
    async (script) => {
      process.stdout.write(`  Scoring "${script.title}"... `);
      const result = await scoreCorpusScript(script);
      console.log(`${result.overallScore.toFixed(2)} (${script.datasetCategory})`);
      return { title: script.title, category: script.datasetCategory, score: result.overallScore };
    },
    CONCURRENCY
  );

  for (const r of results) {
    if (r.status === 'fulfilled') {
      scored.push(r.value);
      successCount++;
    } else {
      console.log(`  ✗ Error: ${r.reason}`);
      errorCount++;
    }
  }

  console.log(`\nScored: ${successCount}  Errors: ${errorCount}`);

  if (scored.length > 0) {
    printCalibrationReport(scored);
  }

  console.log('\nCalibration data is now available. Production scoring will use these anchors via buildCalibrationExamples().');

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
