/**
 * StoryScore Training Data Ingestion Script
 *
 * Reads the Excel training dataset + PDF screenplays from docs/StoryScore Scripts/
 * Extracts structural metrics from each PDF
 * Upserts all data into the script_corpus table
 *
 * Usage:
 *   pnpm --filter @story-magic/web tsx scripts/ingest-training-scripts.ts
 *   pnpm --filter @story-magic/web tsx scripts/ingest-training-scripts.ts --dry-run
 */

import path from 'path';
import fs from 'fs';
import * as XLSX from 'xlsx';
import pdfParse from 'pdf-parse';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DRY_RUN = process.argv.includes('--dry-run');

// =============================================================================
// Paths
// =============================================================================

const REPO_ROOT = path.resolve(__dirname, '../../..');
const SCRIPTS_DIR = path.join(REPO_ROOT, 'docs', 'StoryScore Scripts');
const EXCEL_PATH = path.join(SCRIPTS_DIR, 'storyscore_50_script_training_dataset.xlsx');

// =============================================================================
// Excel Row Type
// =============================================================================

interface ExcelRow {
  title: string;
  type: string;         // Film | TV
  genre: string;
  datasetCategory: string;  // Oscar Winner, Black List, Produced Benchmark, Weak Film, TV Benchmark
  scriptPageLink: string;
  act1BreakPage: number | null;
  act2BreakPage: number | null;
  dialoguePct: number | null;
  sceneCount: number | null;
  conflictDensity: number | null;
  emotionalArcScore: number | null;
}

// =============================================================================
// Parse Excel
// =============================================================================

function parseExcel(): ExcelRow[] {
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });

  const results: ExcelRow[] = [];
  for (const row of rows) {
    const title = String(row['Title'] ?? '').trim();
    if (!title || title.startsWith('Future Script')) continue;

    results.push({
      title,
      type: String(row['Type'] ?? 'Film').trim(),
      genre: String(row['Genre'] ?? '').trim(),
      datasetCategory: String(row['Dataset Category'] ?? '').trim(),
      scriptPageLink: String(row['Script Page Link'] ?? '').trim(),
      act1BreakPage: toInt(row['Act 1 Break Page']),
      act2BreakPage: toInt(row['Act 2 Break Page']),
      dialoguePct: toFloat(row['Dialogue %']),
      sceneCount: toInt(row['Scene Count']),
      conflictDensity: toFloat(row['Conflict Density']),
      emotionalArcScore: toFloat(row['Emotional Arc Score']),
    });
  }

  return results;
}

function toInt(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isFinite(n) ? Math.round(n) : null;
}

function toFloat(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const n = Number(val);
  return isFinite(n) ? n : null;
}

// =============================================================================
// PDF Title → Filename Matching
// =============================================================================

function normalizeTitleForMatch(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findPdfForTitle(title: string, pdfFiles: string[]): string | null {
  const norm = normalizeTitleForMatch(title);

  // Exact normalized match
  for (const f of pdfFiles) {
    const fNorm = normalizeTitleForMatch(path.basename(f, '.pdf'));
    if (fNorm === norm) return f;
  }

  // Substring match (handle "The Matrix" → "The Matrix.pdf")
  for (const f of pdfFiles) {
    const fNorm = normalizeTitleForMatch(path.basename(f, '.pdf'));
    if (fNorm.includes(norm) || norm.includes(fNorm)) return f;
  }

  // Token overlap match (handle "Raiders" → "Raiders of the Lost Ark")
  const normTokens = norm.split(' ').filter(t => t.length > 3);
  for (const f of pdfFiles) {
    const fNorm = normalizeTitleForMatch(path.basename(f, '.pdf'));
    const fTokens = fNorm.split(' ');
    const overlap = normTokens.filter(t => fTokens.includes(t));
    if (overlap.length >= Math.min(2, normTokens.length)) return f;
  }

  return null;
}

// =============================================================================
// Structural Metric Extraction
// =============================================================================

interface StructuralMetrics {
  pageCount: number;
  sceneCount: number;
  dialoguePct: number;
  act1BreakPage: number | null;
  act2BreakPage: number | null;
  conflictDensity: number;
}

// Scene heading patterns: INT./EXT. at line start
const SCENE_HEADING_RE = /^(?:INT\.|EXT\.|INT\/EXT\.|I\/E\.)[\s\S]{0,80}$/gm;

// Dialogue block detection: character cue = all-caps line, followed by dialogue
// We estimate dialogue % as ratio of dialogue lines to total lines
const CHAR_CUE_RE = /^\s{16,}[A-Z][A-Z\s'().]+\s*$/gm;
const DIALOGUE_LINE_RE = /^\s{8,15}\S/gm;
const ACTION_LINE_RE = /^\S|\s{0,7}\S/gm;

// Conflict keywords for conflict density (conflicts per 10 pages)
const CONFLICT_KEYWORDS = [
  'shoots', 'attacks', 'fight', 'punch', 'stab', 'crash', 'explodes', 'chases',
  'threatens', 'kills', 'dies', 'screams', 'struggles', 'confronts', 'argument',
  'anger', 'rage', 'battle', 'war', 'danger', 'escape', 'trapped', 'betrayal',
];
const CONFLICT_RE = new RegExp(`\\b(${CONFLICT_KEYWORDS.join('|')})\\b`, 'gi');

function extractMetrics(text: string): StructuralMetrics {
  const lines = text.split('\n');

  // Scene count
  const sceneMatches = text.match(SCENE_HEADING_RE) ?? [];
  const sceneCount = sceneMatches.length;

  // Page count estimate: screenplays are roughly 55 lines per page
  const pageCount = Math.round(lines.length / 55);

  // Dialogue %: lines with 8-15 leading spaces are typically dialogue
  const dialogueLines = (text.match(DIALOGUE_LINE_RE) ?? []).length;
  const totalContentLines = lines.filter(l => l.trim().length > 0).length;
  const dialoguePct = totalContentLines > 0
    ? Math.round((dialogueLines / totalContentLines) * 100 * 10) / 10
    : 0;

  // Act break pages using structural heuristics
  // Act 1 break: ~25% through, Act 2 break: ~75%
  const act1BreakPage = pageCount > 0 ? Math.round(pageCount * 0.25) : null;
  const act2BreakPage = pageCount > 0 ? Math.round(pageCount * 0.75) : null;

  // Conflict density: conflict keyword hits per 10 pages
  const conflictMatches = (text.match(CONFLICT_RE) ?? []).length;
  const conflictDensity = pageCount > 0
    ? Math.round((conflictMatches / pageCount) * 10 * 100) / 100
    : 0;

  return { pageCount, sceneCount, dialoguePct, act1BreakPage, act2BreakPage, conflictDensity };
}

// =============================================================================
// Ingest a single script
// =============================================================================

async function ingestScript(
  row: ExcelRow,
  pdfPath: string
): Promise<{ title: string; status: 'upserted' | 'skipped'; reason?: string }> {
  const pdfBuffer = fs.readFileSync(pdfPath);
  let pdfData: Awaited<ReturnType<typeof pdfParse>>;

  try {
    pdfData = await pdfParse(pdfBuffer);
  } catch (err) {
    return { title: row.title, status: 'skipped', reason: `PDF parse error: ${String(err)}` };
  }

  const scriptText = pdfData.text;
  if (!scriptText || scriptText.length < 500) {
    return { title: row.title, status: 'skipped', reason: 'PDF text too short (scanned/image PDF?)' };
  }

  // Extract metrics — prefer Excel values, fall back to computed
  const computed = extractMetrics(scriptText);
  const act1BreakPage = row.act1BreakPage ?? computed.act1BreakPage;
  const act2BreakPage = row.act2BreakPage ?? computed.act2BreakPage;
  const dialoguePct = row.dialoguePct ?? computed.dialoguePct;
  const sceneCount = row.sceneCount ?? computed.sceneCount;
  const conflictDensity = row.conflictDensity ?? computed.conflictDensity;
  const emotionalArcScore = row.emotionalArcScore;

  // Map genre string to array
  const genres = row.genre ? row.genre.split(/[,/]/).map(g => g.trim()).filter(Boolean) : [];

  // Map productionStatus from dataset category
  const productionStatusMap: Record<string, string> = {
    'Oscar Winner': 'produced',
    'Black List': 'blacklist',
    'Produced Benchmark': 'produced',
    'Weak Film': 'produced',
    'TV Benchmark': 'produced',
  };
  const productionStatus = productionStatusMap[row.datasetCategory] ?? 'unknown';

  const pdfFilename = path.basename(pdfPath);

  if (DRY_RUN) {
    console.log(`  [DRY RUN] Would upsert: "${row.title}" (${row.datasetCategory}, ${sceneCount} scenes, ${dialoguePct}% dialogue, pg ${computed.pageCount})`);
    return { title: row.title, status: 'upserted' };
  }

  const data = {
    scriptText,
    datasetCategory: row.datasetCategory,
    act1BreakPage,
    act2BreakPage,
    dialoguePct: dialoguePct != null ? dialoguePct.toString() : null,
    sceneCount,
    conflictDensity: conflictDensity != null ? conflictDensity.toString() : null,
    emotionalArcScore: emotionalArcScore != null ? emotionalArcScore.toString() : null,
    pageCount: computed.pageCount,
    pdfFilename,
    genre: genres,
    productionStatus,
  };

  const existing = await prisma.scriptCorpus.findFirst({ where: { title: row.title } });
  if (existing) {
    await prisma.scriptCorpus.update({ where: { id: existing.id }, data });
  } else {
    await prisma.scriptCorpus.create({
      data: {
        title: row.title,
        source: row.type === 'TV' ? 'tv_benchmark' : 'training_dataset',
        isPublic: false,
        ...data,
      },
    });
  }

  return { title: row.title, status: 'upserted' };
}

// =============================================================================
// Main
// =============================================================================

async function main() {
  console.log('=== StoryScore Training Data Ingestion ===');
  if (DRY_RUN) console.log('*** DRY RUN MODE — no database writes ***\n');

  // Load Excel
  console.log(`Loading Excel: ${EXCEL_PATH}`);
  const rows = parseExcel();
  console.log(`Found ${rows.length} training scripts in Excel\n`);

  // List PDFs
  const allPdfs = fs.readdirSync(SCRIPTS_DIR)
    .filter(f => f.endsWith('.pdf'))
    .map(f => path.join(SCRIPTS_DIR, f));
  console.log(`Found ${allPdfs.length} PDFs on disk\n`);

  // Process each row
  const results: { title: string; pdf: string | null; status: string; reason?: string }[] = [];

  for (const row of rows) {
    const pdf = findPdfForTitle(row.title, allPdfs);
    if (!pdf) {
      console.log(`  ✗ No PDF match for: "${row.title}"`);
      results.push({ title: row.title, pdf: null, status: 'skipped', reason: 'No PDF found' });
      continue;
    }

    process.stdout.write(`  Processing "${row.title}" (${row.datasetCategory})... `);
    const result = await ingestScript(row, pdf);
    if (result.status === 'upserted') {
      console.log('✓');
    } else {
      console.log(`✗ ${result.reason}`);
    }
    results.push({ pdf, ...result });
  }

  // Summary
  console.log('\n=== Summary ===');
  const upserted = results.filter(r => r.status === 'upserted').length;
  const skipped = results.filter(r => r.status === 'skipped').length;
  console.log(`Upserted: ${upserted}`);
  console.log(`Skipped:  ${skipped}`);

  if (skipped > 0) {
    console.log('\nSkipped:');
    results.filter(r => r.status === 'skipped').forEach(r => {
      console.log(`  - ${r.title}: ${r.reason}`);
    });
  }

  console.log('\nCategory breakdown:');
  const byCategory: Record<string, number> = {};
  for (const row of rows) {
    byCategory[row.datasetCategory] = (byCategory[row.datasetCategory] ?? 0) + 1;
  }
  for (const [cat, count] of Object.entries(byCategory)) {
    const ingested = results.filter(r => r.status === 'upserted' && rows.find(row => row.title === r.title)?.datasetCategory === cat).length;
    console.log(`  ${cat}: ${ingested}/${count} ingested`);
  }

  if (!DRY_RUN) {
    console.log('\nNext step: run score-corpus.ts to batch-score the ingested scripts');
  }

  await prisma.$disconnect();
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
