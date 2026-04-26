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
import { CharacterManifestSchema, type CharacterManifest } from '../../schemas/character-manifest.js';

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
   * Returns a validated CharacterManifest.
   */
  async extract(input: CharacterExtractionInput): Promise<CharacterManifest> {
    const start = Date.now();
    log.info('[CharacterExtraction] starting', {
      model: this.model,
      scriptLength: input.script_text.length,
    });

    const prompt = `Extract every speaking character from the following screenplay.\n\nSCRIPT:\n${input.script_text}`;

    let raw: unknown;
    try {
      raw = await generateStructuredOutput(prompt, {
        model: this.model,
        schema: CharacterManifestSchema.extend({
          project_id: CharacterManifestSchema.shape.project_id.default(input.project_id),
        }),
        systemPrompt: CHARACTER_EXTRACTION_SYSTEM_PROMPT,
        maxTokens: 8192,
        temperature: 0,
      });
    } catch (err) {
      log.error('[CharacterExtraction] generateStructuredOutput failed', err instanceof Error ? err : undefined);
      throw new Error(`CharacterExtractionAgent failed: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Inject project_id in case the model omitted it
    const withId = { project_id: input.project_id, ...(raw as Record<string, unknown>) };

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

    const manifest = validation.data;
    const elapsedSec = Math.round((Date.now() - start) / 1000);
    log.info('[CharacterExtraction] complete', {
      elapsedSec,
      characterCount: manifest.characters.length,
      hasNarrator: manifest.characters.some((c) => c.is_narrator),
    });

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
}
