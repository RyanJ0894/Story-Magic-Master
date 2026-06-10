/**
 * Snapshot guard for Anthropic-bound Zod schemas (T3-6 of cost-opt Phase 2).
 *
 * Asserts that no schema passed to `generateObject` / `generateStructuredOutput`
 * contains a `.min()` / `.max()` / `.length()` / `.regex()` chain that the AI SDK
 * would translate into `minimum` / `maximum` / `minLength` / `maxLength` /
 * `minItems` / `maxItems` / `pattern` — all of which Anthropic 400s.
 *
 * If this test fails after a schema edit:
 *   - Strip the offending constraint from the schema
 *   - Communicate the intended range via `.describe()` and enforce server-side
 *     after the LLM responds (see `assertHttpDirectorJSONInvariants` in
 *     orchestrator/pipeline.ts and `clampScore` in analysis/script-score-service.ts
 *     for examples)
 *
 * History: PR #178 had to chase this bug across four schemas. This guard
 * exists to catch the next regression at unit-test time.
 */

import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { findForbiddenConstraints } from './zod-anthropic-guard.js';

// ── LLM-bound schemas under guard ────────────────────────────────────────
//
// Anything imported below is what the orchestrator passes to Anthropic via
// the AI SDK. Adding a new LLM-bound schema means adding an import here.

import {
  DirectorJSONSchema,
  SceneAudioJSONSchema,
  SceneSchema,
  DialogueLineSchema,
  AudioCueSchema,
} from '../schemas/director-json.js';
import {
  CharacterManifestSchema,
  CharacterEntrySchema,
} from '../schemas/character-manifest.js';
import {
  VoiceMapSchema,
  VoiceAssignmentSchema,
} from '../schemas/voice-map.js';

const LLM_BOUND_SCHEMAS: Array<[string, z.ZodTypeAny]> = [
  ['DirectorJSONSchema', DirectorJSONSchema],
  ['SceneAudioJSONSchema', SceneAudioJSONSchema],
  ['SceneSchema', SceneSchema],
  ['DialogueLineSchema', DialogueLineSchema],
  ['AudioCueSchema', AudioCueSchema],
  ['CharacterManifestSchema', CharacterManifestSchema],
  ['CharacterEntrySchema', CharacterEntrySchema],
  ['VoiceMapSchema', VoiceMapSchema],
  ['VoiceAssignmentSchema', VoiceAssignmentSchema],
];

describe('Anthropic-bound Zod schemas must not contain JSON Schema constraints', () => {
  for (const [name, schema] of LLM_BOUND_SCHEMAS) {
    it(`${name}: no .min/.max/.length/.regex anywhere in the tree`, () => {
      const findings = findForbiddenConstraints(schema, name);
      if (findings.length > 0) {
        const detail = findings
          .map((f) => `  - ${f.path}: ${f.kind} (${f.reason})`)
          .join('\n');
        throw new Error(
          `${name} contains constraints Anthropic rejects:\n${detail}\n\n` +
            `Fix: remove the .min/.max/.length/.regex chain, document the intent ` +
            `via .describe(), and enforce server-side after the LLM response.`,
        );
      }
      expect(findings).toEqual([]);
    });
  }
});

// ── Unit tests for the walker itself ─────────────────────────────────────
//
// Without these, a bug in the walker could silently let a real regression
// slip through.

describe('findForbiddenConstraints', () => {
  it('flags z.string().min()', () => {
    const schema = z.object({ name: z.string().min(1) });
    const findings = findForbiddenConstraints(schema);
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0].kind).toContain('string.min');
  });

  it('flags z.string().max()', () => {
    const schema = z.object({ name: z.string().max(100) });
    expect(findForbiddenConstraints(schema).map((f) => f.kind)).toContain('string.max');
  });

  it('flags z.string().regex()', () => {
    const schema = z.object({ id: z.string().regex(/^[a-z]+$/) });
    expect(findForbiddenConstraints(schema).map((f) => f.kind)).toContain('string.regex');
  });

  it('flags z.number().min()/.max()', () => {
    const schema = z.object({ score: z.number().min(1).max(10) });
    const kinds = findForbiddenConstraints(schema).map((f) => f.kind);
    expect(kinds).toContain('number.min');
    expect(kinds).toContain('number.max');
  });

  it('flags z.array().min() (.nonempty)', () => {
    const schema = z.object({ items: z.array(z.string()).min(1) });
    const kinds = findForbiddenConstraints(schema).map((f) => f.kind);
    expect(kinds.some((k) => k.startsWith('array.'))).toBe(true);
  });

  it('walks ZodOptional / ZodNullable / ZodDefault wrappers', () => {
    const schema = z.object({
      a: z.string().min(1).optional(),
      b: z.string().min(1).nullable(),
      c: z.string().min(1).default('x'),
    });
    const findings = findForbiddenConstraints(schema);
    // Three offending strings, one per wrapper kind.
    expect(findings.length).toBe(3);
  });

  it('walks nested objects', () => {
    const schema = z.object({
      outer: z.object({
        inner: z.object({
          deep: z.string().min(5),
        }),
      }),
    });
    const findings = findForbiddenConstraints(schema);
    expect(findings.length).toBe(1);
    expect(findings[0].path).toContain('outer');
    expect(findings[0].path).toContain('inner');
    expect(findings[0].path).toContain('deep');
  });

  it('walks array elements', () => {
    const schema = z.object({
      lines: z.array(z.object({ text: z.string().min(1) })),
    });
    const findings = findForbiddenConstraints(schema);
    expect(findings.length).toBe(1);
    expect(findings[0].path).toContain('<item>');
  });

  it('passes a clean schema (no findings)', () => {
    const schema = z.object({
      name: z.string().describe('non-empty in spirit but unconstrained here'),
      score: z.number().describe('1-10'),
      verdict: z.enum(['pass', 'consider', 'recommend']),
      tags: z.array(z.string()),
      nested: z.object({ flag: z.boolean() }).optional(),
    });
    expect(findForbiddenConstraints(schema)).toEqual([]);
  });

  it('does NOT flag .describe() (descriptions are Anthropic-safe)', () => {
    const schema = z.object({ text: z.string().describe('any text') });
    expect(findForbiddenConstraints(schema)).toEqual([]);
  });

  it('walks ZodUnion options', () => {
    const schema = z.object({
      payload: z.union([z.string().min(1), z.number().max(10)]),
    });
    expect(findForbiddenConstraints(schema).length).toBe(2);
  });
});
