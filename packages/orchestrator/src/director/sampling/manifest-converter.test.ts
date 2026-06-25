/**
 * Tests for the CharacterIndex → CharacterManifest converter (Phase C).
 *
 * Two layers of confidence:
 *   1. The converter produces a valid CharacterManifest from any
 *      well-formed CharacterIndex, including narrator detection.
 *   2. compareManifests produces sensible diffs for the hybrid-mode
 *      data-collection telemetry.
 */

import { describe, it, expect } from 'vitest';
import {
  characterIndexToManifest,
  compareManifests,
} from './manifest-converter.js';
import { buildCharacterIndex } from './character-index.js';

const SCRIPT = [
  'FADE IN:',
  '',
  'INT. KITCHEN - DAY',
  '',
  '          NARRATOR (V.O.)',
  '     Once upon a time...',
  '',
  '          ANNA',
  '     Morning.',
  '',
  '          BEN',
  '     You\'re up early.',
  '',
  'EXT. STREET - NIGHT',
  '',
  '          BEN',
  '     The city never sleeps.',
  '',
  '          ANNA',
  '     I\'ve been thinking.',
].join('\n');

const PROJECT_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

describe('characterIndexToManifest', () => {
  it('produces a CharacterEntry for every detected character', () => {
    const idx = buildCharacterIndex(SCRIPT);
    const manifest = characterIndexToManifest(PROJECT_ID, idx);
    const names = manifest.characters.map((c) => c.canonical_name).sort();
    expect(names).toContain('ANNA');
    expect(names).toContain('BEN');
    expect(names).toContain('NARRATOR');
  });

  it('flags NARRATOR with is_narrator: true', () => {
    const idx = buildCharacterIndex(SCRIPT);
    const manifest = characterIndexToManifest(PROJECT_ID, idx);
    const narrator = manifest.characters.find((c) => c.canonical_name === 'NARRATOR');
    expect(narrator).toBeTruthy();
    expect(narrator!.is_narrator).toBe(true);
  });

  it('does NOT flag regular characters as narrator', () => {
    const idx = buildCharacterIndex(SCRIPT);
    const manifest = characterIndexToManifest(PROJECT_ID, idx);
    const anna = manifest.characters.find((c) => c.canonical_name === 'ANNA');
    expect(anna!.is_narrator).toBe(false);
  });

  it('includes a useful description summarizing line + scene counts', () => {
    const idx = buildCharacterIndex(SCRIPT);
    const manifest = characterIndexToManifest(PROJECT_ID, idx);
    const ben = manifest.characters.find((c) => c.canonical_name === 'BEN');
    // BEN speaks once in scene 0 and once in scene 1 — 2 lines, 2 scenes.
    expect(ben!.description).toContain('BEN');
    expect(ben!.description).toContain('2');
  });

  it('leaves gender undefined — Phase B reads dialogue, no need for a guess', () => {
    const idx = buildCharacterIndex(SCRIPT);
    const manifest = characterIndexToManifest(PROJECT_ID, idx);
    for (const c of manifest.characters) {
      expect(c.gender).toBeUndefined();
    }
  });

  it('returns an empty character array when the index is empty', () => {
    const idx = buildCharacterIndex('Just plain prose, no slug lines, no cues.');
    const manifest = characterIndexToManifest(PROJECT_ID, idx);
    expect(manifest.project_id).toBe(PROJECT_ID);
    expect(manifest.characters).toEqual([]);
  });
});

describe('compareManifests', () => {
  it('jaccard = 1 when both manifests cover identical canonical names', () => {
    const a = characterIndexToManifest(PROJECT_ID, buildCharacterIndex(SCRIPT));
    const b = characterIndexToManifest(PROJECT_ID, buildCharacterIndex(SCRIPT));
    const cmp = compareManifests(a, b);
    expect(cmp.jaccard).toBe(1);
    expect(cmp.onlyInRegex).toEqual([]);
    expect(cmp.onlyInLlm).toEqual([]);
  });

  it('records the disjoint sides when manifests differ', () => {
    const a = characterIndexToManifest(PROJECT_ID, buildCharacterIndex(SCRIPT));
    const b: ReturnType<typeof characterIndexToManifest> = {
      project_id: PROJECT_ID,
      characters: [
        { name: 'ANNA', canonical_name: 'ANNA', aliases: [], description: '', is_narrator: false },
        { name: 'CHRIS', canonical_name: 'CHRIS', aliases: [], description: '', is_narrator: false },
      ],
    };
    const cmp = compareManifests(a, b);
    expect(cmp.onlyInRegex.sort()).toEqual(['BEN', 'NARRATOR']);
    expect(cmp.onlyInLlm).toEqual(['CHRIS']);
    expect(cmp.jaccard).toBeLessThan(1);
    expect(cmp.jaccard).toBeGreaterThan(0);
  });

  it('returns jaccard = 1 when both sides are empty (vacuously identical)', () => {
    const empty = { project_id: PROJECT_ID, characters: [] };
    const cmp = compareManifests(empty, empty);
    expect(cmp.jaccard).toBe(1);
  });

  it('canonical name comparison is case-insensitive', () => {
    const a = {
      project_id: PROJECT_ID,
      characters: [
        { name: 'anna', canonical_name: 'anna', aliases: [], description: '', is_narrator: false },
      ],
    };
    const b = {
      project_id: PROJECT_ID,
      characters: [
        { name: 'ANNA', canonical_name: 'ANNA', aliases: [], description: '', is_narrator: false },
      ],
    };
    const cmp = compareManifests(a, b);
    expect(cmp.jaccard).toBe(1);
  });
});
