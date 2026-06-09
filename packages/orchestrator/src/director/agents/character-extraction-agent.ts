/**
 * Character Extraction Agent — Pass 1 of 3
 *
 * Reads the full script text and extracts a structured CharacterManifest
 * listing every speaking character with their attributes and aliases.
 *
 * Uses generateStructuredOutput (no tool calls). Output is enforced by
 * CharacterManifestSchema, so no JSON repair is needed.
 */

import { generateStructuredOutput } from '../../lib/llm-client.js';
import { log } from '../../lib/logger.js';
import { CHARACTER_EXTRACTION_SYSTEM_PROMPT } from '../prompts/character-extraction-prompt.js';
import { CharacterManifestSchema, type CharacterManifest, type CharacterEntry } from '../../schemas/character-manifest.js';
import {
  chunkScriptForExtraction,
  mergeCharacterLists,
  EXTRACTION_CHUNK_THRESHOLD,
} from '../utils/script-chunker.js';

const DEFAULT_MODEL = process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';

export interface CharacterExtractionOptions {
  model?: string;
}

export interface CharacterExtractionInput {
  project_id: string;
  script_text: string;
}

export class CharacterExtractionAgent {
  private model: string;

  constructor(options: CharacterExtractionOptions = {}) {
    this.model = options.model || DEFAULT_MODEL;
  }

  /**
   * Extract all characters from the screenplay.
   * For long scripts (> 30K chars), splits into chunks and extracts in parallel.
   * Returns a validated CharacterManifest.
   */
  async extract(input: CharacterExtractionInput): Promise<CharacterManifest> {
    const start = Date.now();
    const isLong = input.script_text.length > EXTRACTION_CHUNK_THRESHOLD;

    log.info('[CharacterExtraction] starting', {
      model: this.model,
      scriptLength: input.script_text.length,
      mode: isLong ? 'chunked-parallel' : 'single-pass',
    });

    const characters: CharacterEntry[] = isLong
      ? await this.extractChunked(input)
      : await this.extractSingle(input.script_text);

    const withId = { project_id: input.project_id, characters };

    const validation = CharacterManifestSchema.safeParse(withId);
    if (!validation.success) {
      log.error('[CharacterExtraction] schema validation failed', undefined, {
        issues: validation.error.issues,
      });
      throw new Error(
        `CharacterExtractionAgent output failed schema validation: ` +
          validation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
      );
    }

    // Post-LLM length guard: the Anthropic-compatible schema cannot encode
    // `.min(1)` on the characters array (Anthropic rejects `minItems`), so
    // enforce "at least one character" here.
    if (validation.data.characters.length === 0) {
      throw new Error(
        'CharacterExtractionAgent output failed schema validation: characters: at least one speaking character required (got 0)'
      );
    }

    const manifest = validation.data;
    const elapsedSec = Math.round((Date.now() - start) / 1000);
    log.info('[CharacterExtraction] complete', {
      elapsedSec,
      characterCount: manifest.characters.length,
      hasNarrator: manifest.characters.some((c) => c.is_narrator),
    });

    // Sanity check: very few characters relative to script length may indicate
    // extraction failure or a non-standard script format
    const expectedMin = Math.max(2, Math.floor(input.script_text.length / 10000) * 3);
    if (manifest.characters.length < expectedMin) {
      log.warn('[CharacterExtraction] character count below expected minimum — extraction may be incomplete', {
        characterCount: manifest.characters.length,
        expectedMin,
        scriptLength: input.script_text.length,
      });
    }

    // Ensure NARRATOR is always present
    if (!manifest.characters.some((c) => c.is_narrator)) {
      log.warn('[CharacterExtraction] no NARRATOR found — injecting default');
      manifest.characters.push({
        name: 'NARRATOR',
        canonical_name: 'NARRATOR',
        aliases: [],
        description: 'Narrator voice for action descriptions and screenplay directions',
        is_narrator: true,
      });
    }

    return manifest;
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  /** Extract characters from a single script text (used directly for short scripts). */
  private async extractSingle(scriptText: string): Promise<CharacterEntry[]> {
    const prompt = `Extract every speaking character from the following screenplay.\n\nSCRIPT:\n${scriptText}`;
    let raw: unknown;
    try {
      raw = await generateStructuredOutput(prompt, {
        model: this.model,
        schema: CharacterManifestSchema,
        systemPrompt: CHARACTER_EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 8192,
        temperature: 0,
      });
    } catch (err) {
      throw new Error(`CharacterExtractionAgent failed: ${err instanceof Error ? err.message : String(err)}`);
    }
    const result = raw as { characters?: CharacterEntry[] };
    return result.characters ?? [];
  }

  /**
   * Extract characters from a long script by splitting it into chunks,
   * running extraction in parallel, and merging + deduplicating results.
   */
  private async extractChunked(input: CharacterExtractionInput): Promise<CharacterEntry[]> {
    const chunks = chunkScriptForExtraction(input.script_text);

    log.info('[CharacterExtraction] chunked extraction', {
      chunkCount: chunks.length,
      scriptLength: input.script_text.length,
    });

    const results = await Promise.allSettled(
      chunks.map((chunk) => this.extractSingle(chunk.text))
    );

    const successful: CharacterEntry[][] = [];
    for (let i = 0; i < results.length; i++) {
      const r = results[i];
      if (r.status === 'fulfilled') {
        successful.push(r.value);
      } else {
        log.warn('[CharacterExtraction] chunk extraction failed', {
          chunk_index: i,
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }

    if (successful.length === 0) {
      throw new Error('CharacterExtractionAgent failed: all chunks failed');
    }

    const merged = mergeCharacterLists(successful);
    log.info('[CharacterExtraction] chunked merge complete', {
      chunksSucceeded: successful.length,
      chunksTotal: chunks.length,
      characterCount: merged.length,
    });
    return merged;
  }
}
