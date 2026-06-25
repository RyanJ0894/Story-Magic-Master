/**
 * Tests for the chunk cue tagger (Phase D-2).
 *
 * The tagger inserts `[SPEAKER: NAME]` annotations above each character
 * cue line that falls within a chunk's byte range. Pass 3's tightened
 * prompt uses these annotations as the source of truth for speaker
 * attribution.
 *
 * Critical guards:
 *   - Insertion is offset-anchored — the cues land at the exact byte
 *     positions that buildCharacterIndex recorded
 *   - Cues OUTSIDE the chunk's range are not tagged (they belong to other
 *     chunks)
 *   - Multiple cues in the same chunk all get tagged
 *   - The tag count returned matches the number of insertions
 */

import { describe, it, expect } from 'vitest';
import { buildCharacterIndex } from './character-index.js';
import { tagChunkWithCues, filterIndexToRange } from './cue-tagger.js';

const STANDARD_SCRIPT = [
  'FADE IN:',
  '',
  'INT. KITCHEN - DAY',
  '',
  '          ANNA',
  '     Morning.',
  '',
  '          BEN',
  '     You\'re up early.',
  '',
  'EXT. STREET - NIGHT',
  '',
  '          STRANGER',
  '     Spare some change?',
  '',
  '          BEN',
  '     Sorry, man.',
].join('\n');

describe('tagChunkWithCues', () => {
  it('inserts a [SPEAKER: NAME] tag before each cue in the chunk', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    const { taggedText, tagCount } = tagChunkWithCues(STANDARD_SCRIPT, 0, idx);
    expect(tagCount).toBeGreaterThan(0);
    expect(taggedText).toContain('[SPEAKER: ANNA]');
    expect(taggedText).toContain('[SPEAKER: BEN]');
    expect(taggedText).toContain('[SPEAKER: STRANGER]');
  });

  it('tag count matches the number of cues in the chunk', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    let totalCues = 0;
    for (const a of idx.characters.values()) totalCues += a.cueOffsets.length;
    const { tagCount } = tagChunkWithCues(STANDARD_SCRIPT, 0, idx);
    expect(tagCount).toBe(totalCues);
  });

  it('only tags cues whose offsets fall inside the chunk window', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    // Pretend we have a chunk that only covers the second half of the script.
    const halfPoint = Math.floor(STANDARD_SCRIPT.length / 2);
    const secondHalf = STANDARD_SCRIPT.slice(halfPoint);
    const { tagCount } = tagChunkWithCues(secondHalf, halfPoint, idx);
    // STRANGER and the second BEN should be in the second half. ANNA + first
    // BEN should be in the first half.
    let expected = 0;
    for (const a of idx.characters.values()) {
      for (const o of a.cueOffsets) {
        if (o >= halfPoint && o < halfPoint + secondHalf.length) expected++;
      }
    }
    expect(tagCount).toBe(expected);
    expect(tagCount).toBeGreaterThan(0);
    expect(tagCount).toBeLessThan(4); // not all 4 cues land in the second half
  });

  it('returns the chunk text unchanged when there are no cues in range', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    // A chunk that doesn't intersect any cue offsets.
    const noCueChunk = 'INT. EMPTY ROOM - DAY\n\nA room. Empty. No characters.';
    const { taggedText, tagCount } = tagChunkWithCues(noCueChunk, 10_000, idx);
    expect(tagCount).toBe(0);
    expect(taggedText).toBe(noCueChunk);
  });

  it('insertion order does not corrupt later offsets (multi-cue stress)', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    const { taggedText } = tagChunkWithCues(STANDARD_SCRIPT, 0, idx);
    // Every character that's in the index should appear exactly once as a tag.
    const tagCount = (taggedText.match(/\[SPEAKER: /g) || []).length;
    let expected = 0;
    for (const a of idx.characters.values()) expected += a.cueOffsets.length;
    expect(tagCount).toBe(expected);
  });

  it('original chunk text is preserved verbatim around the inserted tags', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    const { taggedText } = tagChunkWithCues(STANDARD_SCRIPT, 0, idx);
    // The original screenplay lines should still appear after the tags get
    // stripped. Strip the inserted tags and the trailing newline they add.
    const stripped = taggedText.replace(/\[SPEAKER: [^\]]+\]\n/g, '');
    expect(stripped).toBe(STANDARD_SCRIPT);
  });
});

describe('filterIndexToRange', () => {
  it('keeps only characters whose cues land in the range', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    const halfPoint = Math.floor(STANDARD_SCRIPT.length / 2);
    const sub = filterIndexToRange(idx, halfPoint, STANDARD_SCRIPT.length);
    // STRANGER definitely in the second half; ANNA + first BEN definitely not.
    expect(sub.has('STRANGER')).toBe(true);
    expect(sub.get('STRANGER')!.cueOffsets.every((o) => o >= halfPoint)).toBe(true);
  });

  it('returns an empty map when no cues fall in the range', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    const sub = filterIndexToRange(idx, 100_000, 200_000);
    expect(sub.size).toBe(0);
  });

  it('preserves the full appearance for characters fully in range', () => {
    const idx = buildCharacterIndex(STANDARD_SCRIPT);
    const sub = filterIndexToRange(idx, 0, STANDARD_SCRIPT.length);
    expect(sub.size).toBe(idx.characters.size);
  });
});
