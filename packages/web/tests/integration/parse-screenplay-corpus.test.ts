/**
 * H6 — Real-fixture integration test for parse-screenplay.
 *
 * Reads tests/fixtures/screenplay/corpus.json and runs the actual
 * parseScreenplay function (no mocks) against every listed fixture.
 * Each fixture asserts:
 *   - parser returns within a reasonable time (no hangs)
 *   - reported pageCount >= expectedMinPageCount
 *   - extracted text contains every string in expectedTextContains
 *
 * The corpus starts with three synthesised baselines (txt / fountain /
 * fdx). Real customer PDFs are added by follow-up PRs as we collect
 * them — see tests/fixtures/screenplay/README.md.
 *
 * Run locally:
 *   pnpm --filter @story-magic/web test -- --run tests/integration
 *
 * CI runs this on every PR touching lib/upload/.
 */

import { describe, it, expect } from 'vitest';
import path from 'path';
import { readFileSync } from 'fs';
import { parseScreenplay } from '@/lib/upload/parse-screenplay';

interface CorpusEntry {
  file: string;
  format: string;
  source: string;
  expectedMinPageCount: number;
  expectedTextContains: string[];
  anonymised: boolean;
  notes?: string;
}

interface Corpus {
  fixtures: CorpusEntry[];
}

// Fixtures live next to this file's logical parent — resolve via the
// repo-relative path so the test works regardless of where Vitest is
// invoked from.
const FIXTURES_DIR = `${__dirname}/../fixtures/screenplay`;

function loadCorpus(): Corpus {
  return JSON.parse(readFileSync(`${FIXTURES_DIR}/corpus.json`, 'utf-8')) as Corpus;
}

describe('parse-screenplay corpus (real fixtures)', () => {
  const { fixtures } = loadCorpus();

  if (fixtures.length === 0) {
    it.skip('corpus is empty — add fixtures per README.md', () => {});
    return;
  }

  for (const entry of fixtures) {
    it(`parses ${entry.file} (${entry.source})`, async () => {
      const buffer = readFileSync(`${FIXTURES_DIR}/${entry.file}`);

      const start = Date.now();
      const result = await parseScreenplay(buffer, entry.file);
      const ms = Date.now() - start;

      // 30 s ceiling — parser's own internal 20 s timeout for PDFs
      // plus a margin. Anything close to this in CI is a regression.
      expect(ms, `${entry.file} took ${ms}ms — investigate before bumping the ceiling`).toBeLessThan(30_000);

      expect(result.pageCount).toBeGreaterThanOrEqual(entry.expectedMinPageCount);

      for (const fragment of entry.expectedTextContains) {
        expect(result.text, `expected ${entry.file} text to contain "${fragment}"`).toContain(fragment);
      }

      // Snapshot the extracted text for PDF fixtures so any regression in
      // the unpdf extraction pipeline (newline collapse, encoding changes,
      // library upgrades) shows up as a diff rather than a silent failure.
      if (entry.format === 'pdf') {
        const snapshotKey = path.basename(entry.file, '.pdf');
        expect(result.text).toMatchSnapshot(snapshotKey);
      }
    });
  }
});
