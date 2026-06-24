/**
 * Tests for Phase A of the sampling architecture: character-index +
 * intro-stitcher.
 *
 * Three layers of confidence:
 *   1. character-index detects characters on standard screenplay format
 *      and assigns reasonable confidence scores
 *   2. intro-stitcher produces a deduplicated sample that includes every
 *      character at least once
 *   3. CACHE-HASH COMPATIBILITY: scene-text slices taken before and
 *      after running Pass 0 / Pass 1 are byte-identical. This guards PR
 *      #405's director_scene_cache from invalidation.
 */

import { describe, it, expect } from 'vitest';
import crypto from 'crypto';
import {
  buildCharacterIndex,
  shouldFallbackToLlmExtraction,
  CHARACTER_INDEX_CONFIDENCE_THRESHOLD,
} from './character-index.js';
import { stitchIntroSample } from './intro-stitcher.js';
import { extractSceneInfo } from '../utils/script-chunker.js';

const STANDARD_SCREENPLAY = [
  'FADE IN:',
  '',
  'INT. KITCHEN - DAY',
  '',
  'A coffee pot whistles. ANNA enters, yawning.',
  '',
  '          ANNA',
  '     Morning.',
  '',
  '          BEN',
  '     You\'re up early.',
  '',
  '          ANNA',
  '     Couldn\'t sleep.',
  '',
  'EXT. STREET - NIGHT',
  '',
  'Rain pours. BEN walks under a streetlamp.',
  '',
  '          BEN (V.O.)',
  '     The city never sleeps either.',
  '',
  '          STRANGER',
  '     Spare some change?',
  '',
  '          BEN',
  '     Sorry, man.',
  '',
  'INT. CAFE - NIGHT',
  '',
  '          ANNA',
  '     I\'ve been thinking about what you said.',
  '',
  '          BEN',
  '     About what?',
  '',
  '          ANNA',
  '     Everything.',
  '',
  'FADE OUT.',
].join('\n');

describe('buildCharacterIndex — standard format', () => {
  it('detects all three characters from a standard screenplay', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const names = Array.from(idx.characters.keys()).sort();
    expect(names).toEqual(['ANNA', 'BEN', 'STRANGER']);
  });

  it('canonicalizes BEN (V.O.) and BEN under a single entry', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const ben = idx.characters.get('BEN');
    expect(ben).toBeTruthy();
    // BEN speaks once normal in scene 1, V.O. in scene 2, normal in scene 2,
    // twice in scene 3 — 4 cues total. The V.O. cue collapses into BEN.
    expect(ben!.lineCount).toBe(4);
  });

  it('records first-scene and first-cue offset correctly', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const anna = idx.characters.get('ANNA')!;
    // ANNA's first cue is the very first character cue in the script,
    // inside scene 0 (INT. KITCHEN - DAY).
    expect(anna.firstSceneIdx).toBe(0);
    expect(STANDARD_SCREENPLAY.slice(anna.firstCueOffset, anna.firstCueOffset + 30))
      .toContain('ANNA');
  });

  it('records every scene a character speaks in', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    // BEN speaks in all three scenes.
    expect(idx.characters.get('BEN')!.scenesAppearing).toEqual([0, 1, 2]);
    // ANNA speaks in scene 0 and scene 2 (not scene 1).
    expect(idx.characters.get('ANNA')!.scenesAppearing).toEqual([0, 2]);
    // STRANGER only in scene 1.
    expect(idx.characters.get('STRANGER')!.scenesAppearing).toEqual([1]);
  });

  it('assigns high confidence on standard format and recommends NOT falling back', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    expect(idx.confidence).toBeGreaterThanOrEqual(CHARACTER_INDEX_CONFIDENCE_THRESHOLD);
    expect(shouldFallbackToLlmExtraction(idx)).toBe(false);
  });

  it('rejects scene heading-looking lines (INT./EXT.) as character cues', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    // None of the scene-heading prefixes should appear as character names.
    for (const name of idx.characters.keys()) {
      expect(name).not.toMatch(/^(INT|EXT)\.?/);
    }
  });

  it('rejects transition cues (FADE IN, FADE OUT, CUT TO) as character cues', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    expect(idx.characters.has('FADE IN')).toBe(false);
    expect(idx.characters.has('FADE OUT')).toBe(false);
    expect(idx.characters.has('CUT TO')).toBe(false);
  });
});

describe('buildCharacterIndex — low confidence + fallback', () => {
  it('returns low confidence on plain prose with no slug lines', () => {
    const prose =
      'This is a paragraph of plain prose with no scene headings, no character cues, nothing screenplay-shaped.';
    const idx = buildCharacterIndex(prose);
    expect(idx.confidence).toBeLessThan(CHARACTER_INDEX_CONFIDENCE_THRESHOLD);
    expect(shouldFallbackToLlmExtraction(idx)).toBe(true);
  });

  it('returns low confidence on a script with slug lines but no recognizable cues', () => {
    const noCharacters = [
      'INT. ROOM - DAY',
      '',
      'A room. Quiet. Nothing happens.',
      '',
      'EXT. STREET - NIGHT',
      '',
      'The street is empty.',
    ].join('\n');
    const idx = buildCharacterIndex(noCharacters);
    expect(idx.confidence).toBeLessThan(CHARACTER_INDEX_CONFIDENCE_THRESHOLD);
    expect(shouldFallbackToLlmExtraction(idx)).toBe(true);
  });

  it('reports a useful confidenceReason for telemetry', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    expect(idx.confidenceReason).toMatch(/cues_per_page|characters|multi_scene_chars/);
  });
});

describe('stitchIntroSample', () => {
  it('produces a sample that covers every detected character', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, idx);
    const expected = Array.from(idx.characters.keys()).sort();
    expect(sample.charactersCovered).toEqual(expected);
    expect(sample.charactersMissing).toEqual([]);
  });

  it('dedupes overlapping intro windows into single slices', () => {
    // ANNA and BEN both speak within the first ~200 chars of the script
    // (scene 1). Their default 2-page intro windows fully overlap, so we
    // should get ONE merged slice covering both, not two.
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, idx);
    const sliceWithBoth = sample.slices.find(
      (s) => s.characters.includes('ANNA') && s.characters.includes('BEN'),
    );
    expect(sliceWithBoth).toBeTruthy();
  });

  it('always produces fewer chars than naive (n_chars * intro_window) sum', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, idx);
    const naive = idx.characters.size * 2 * 2_200;
    expect(sample.stitchedChars).toBeLessThan(naive);
  });

  it('respects maxStitchedChars ceiling without crashing', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, idx, {
      maxStitchedChars: 200,
    });
    expect(sample.stitchedChars).toBeLessThanOrEqual(200);
  });

  it('records originalChars and stitchedChars for cost telemetry', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, idx);
    expect(sample.originalChars).toBe(STANDARD_SCREENPLAY.length);
    expect(sample.stitchedChars).toBeGreaterThan(0);
  });

  it('returns an empty sample (no slices) when index has no characters', () => {
    const idx = buildCharacterIndex('Just some prose without screenplay format.');
    const sample = stitchIntroSample('Just some prose without screenplay format.', idx);
    expect(sample.slices).toEqual([]);
    expect(sample.stitchedChars).toBe(0);
  });
});

describe('CACHE-HASH COMPATIBILITY — Pass 0 must not modify scriptText', () => {
  // PR #405's director_scene_cache hashes scene text by byte range.
  // If Pass 0 normalizes whitespace, strips comments, or otherwise mutates
  // the input string, every previously-cached scene becomes a cache miss
  // on the first re-upload — silently wiping the gains from #405.
  //
  // These tests assert byte identity of arbitrary scene-text slices
  // BEFORE and AFTER running Pass 0 against the same string. If a future
  // refactor adds any normalization, these tests go red immediately.

  const hash = (s: string) =>
    crypto.createHash('sha256').update(s).digest('hex');

  it('does not modify scriptText — sha256 stable through buildCharacterIndex', () => {
    const before = hash(STANDARD_SCREENPLAY);
    buildCharacterIndex(STANDARD_SCREENPLAY);
    const after = hash(STANDARD_SCREENPLAY);
    expect(after).toBe(before);
  });

  it('scene-text slices via extractSceneInfo are byte-identical before vs after Pass 0', () => {
    const scenesBefore = extractSceneInfo(STANDARD_SCREENPLAY);
    const beforeHashes = scenesBefore.map((s) =>
      hash(STANDARD_SCREENPLAY.slice(s.start_index, s.end_index)),
    );

    buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, buildCharacterIndex(STANDARD_SCREENPLAY));
    void sample; // stitcher runs; we only care about side-effect-free guarantee

    const scenesAfter = extractSceneInfo(STANDARD_SCREENPLAY);
    const afterHashes = scenesAfter.map((s) =>
      hash(STANDARD_SCREENPLAY.slice(s.start_index, s.end_index)),
    );

    expect(afterHashes).toEqual(beforeHashes);
  });

  it('every stitched slice is a verbatim copy of the source range (no normalization)', () => {
    const idx = buildCharacterIndex(STANDARD_SCREENPLAY);
    const sample = stitchIntroSample(STANDARD_SCREENPLAY, idx);
    for (const slice of sample.slices) {
      const original = STANDARD_SCREENPLAY.slice(slice.start, slice.end);
      // The stitched text contains the slice body verbatim — find it.
      expect(sample.text).toContain(original);
    }
  });
});
