import { describe, it, expect } from 'vitest';
import {
  extractSceneInfo,
  chunkScript,
  countScenes,
  chunkScriptForExtraction,
  mergeCharacterLists,
  EXTRACTION_CHUNK_THRESHOLD,
} from './script-chunker.js';

// ─────────────────────────────────────────────────────────────────────────────
// Fixtures
// ─────────────────────────────────────────────────────────────────────────────

const SINGLE_SCENE = `INT. OFFICE - DAY

JOHN
Hello there.

SARAH
Hi.`;

const TWO_SCENES = `INT. OFFICE - DAY

JOHN
Hello.

EXT. PARKING LOT - NIGHT

SARAH
Goodbye.`;

function makeScript(sceneCount: number): string {
  return Array.from({ length: sceneCount }, (_, i) =>
    `INT. LOCATION ${i + 1} - DAY\n\nCHARACTER\nLine ${i + 1}.`
  ).join('\n\n');
}

// ─────────────────────────────────────────────────────────────────────────────
// extractSceneInfo
// ─────────────────────────────────────────────────────────────────────────────

describe('extractSceneInfo', () => {
  it('returns empty array for text with no scene headings', () => {
    expect(extractSceneInfo('no headings here')).toHaveLength(0);
  });

  it('detects INT. headings', () => {
    const scenes = extractSceneInfo(SINGLE_SCENE);
    expect(scenes).toHaveLength(1);
    expect(scenes[0].heading).toContain('INT. OFFICE');
    expect(scenes[0].scene_num).toBe(1);
  });

  it('detects EXT. headings', () => {
    const scenes = extractSceneInfo('EXT. BEACH - DAY\n\nACTOR\nHello.');
    expect(scenes).toHaveLength(1);
    expect(scenes[0].heading).toContain('EXT. BEACH');
  });

  it('detects INT/EXT. headings', () => {
    const scenes = extractSceneInfo('INT/EXT. CAR - MOVING\n\nDRIVER\nDriving.');
    expect(scenes).toHaveLength(1);
  });

  it('sets correct end_index for multiple scenes', () => {
    const scenes = extractSceneInfo(TWO_SCENES);
    expect(scenes).toHaveLength(2);
    // end of first scene = start of second scene
    expect(scenes[0].end_index).toBe(scenes[1].start_index);
    // end of last scene = end of text
    expect(scenes[1].end_index).toBe(TWO_SCENES.length);
  });

  it('assigns sequential scene_num values', () => {
    const scenes = extractSceneInfo(makeScript(5));
    expect(scenes.map((s) => s.scene_num)).toEqual([1, 2, 3, 4, 5]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// chunkScript
// ─────────────────────────────────────────────────────────────────────────────

describe('chunkScript', () => {
  it('returns a single chunk for text with no scene headings', () => {
    const chunks = chunkScript('no headings', 15);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunk_index).toBe(0);
    expect(chunks[0].start_scene_num).toBe(1);
    expect(chunks[0].end_scene_num).toBe(1);
    expect(chunks[0].text).toBe('no headings');
  });

  it('returns a single chunk when scene count < scenesPerChunk', () => {
    const script = makeScript(5);
    const chunks = chunkScript(script, 15);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].start_scene_num).toBe(1);
    expect(chunks[0].end_scene_num).toBe(5);
  });

  it('splits exactly on chunk boundary', () => {
    const script = makeScript(15);
    const chunks = chunkScript(script, 15);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].end_scene_num).toBe(15);
  });

  it('produces two chunks when scenes > scenesPerChunk', () => {
    const script = makeScript(20);
    const chunks = chunkScript(script, 15);
    expect(chunks).toHaveLength(2);
    expect(chunks[0].start_scene_num).toBe(1);
    expect(chunks[0].end_scene_num).toBe(15);
    expect(chunks[1].start_scene_num).toBe(16);
    expect(chunks[1].end_scene_num).toBe(20);
  });

  it('chunk text starts with the scene heading', () => {
    const script = makeScript(20);
    const chunks = chunkScript(script, 15);
    expect(chunks[1].text.trim()).toMatch(/^INT\. LOCATION 16/);
  });

  it('includes scene_headings array on each chunk', () => {
    const script = makeScript(5);
    const chunks = chunkScript(script, 5);
    expect(chunks[0].scene_headings).toHaveLength(5);
    expect(chunks[0].scene_headings[0]).toContain('INT. LOCATION 1');
  });

  it('covers all scenes with no gaps between chunks', () => {
    const script = makeScript(32);
    const chunks = chunkScript(script, 10);
    // Verify contiguous coverage
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].start_scene_num).toBe(chunks[i - 1].end_scene_num + 1);
    }
  });

  it('90-page equivalent (58 scenes, default 15/chunk) → 4 chunks', () => {
    // 58 real screenplay scenes ≈ 90 pages at ~1.5 pages/scene
    const script = makeScript(58);
    const chunks = chunkScript(script, 15);
    expect(chunks).toHaveLength(4);
    expect(chunks[chunks.length - 1].end_scene_num).toBe(58);
  });

  it('150-page equivalent (90 scenes, default 15/chunk) → 6 chunks', () => {
    // 90 real screenplay scenes ≈ 150 pages at ~1.5–2 pages/scene
    const script = makeScript(90);
    const chunks = chunkScript(script, 15);
    expect(chunks).toHaveLength(6);
    expect(chunks[chunks.length - 1].end_scene_num).toBe(90);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// countScenes
// ─────────────────────────────────────────────────────────────────────────────

describe('countScenes', () => {
  it('returns 0 for text without scene headings', () => {
    expect(countScenes('no headings')).toBe(0);
  });

  it('counts scenes accurately', () => {
    expect(countScenes(makeScript(7))).toBe(7);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// chunkScript — large-script boundary conditions (30-page scale)
// ─────────────────────────────────────────────────────────────────────────────

describe('chunkScript — large-script boundary conditions', () => {
  it('no scenes are dropped between chunks on a 30-scene script', () => {
    const script = makeScript(30);
    const chunks = chunkScript(script, 15); // 2 chunks
    const allSceneNums = chunks.flatMap((c) =>
      Array.from({ length: c.end_scene_num - c.start_scene_num + 1 }, (_, i) => c.start_scene_num + i)
    );
    expect(allSceneNums).toEqual(Array.from({ length: 30 }, (_, i) => i + 1));
  });

  it('no scenes are duplicated at chunk boundaries on a 30-scene script', () => {
    const script = makeScript(30);
    const chunks = chunkScript(script, 15);
    const allSceneNums = chunks.flatMap((c) =>
      Array.from({ length: c.end_scene_num - c.start_scene_num + 1 }, (_, i) => c.start_scene_num + i)
    );
    expect(new Set(allSceneNums).size).toBe(allSceneNums.length);
  });

  it('leading text before the first INT./EXT. heading is not included in any chunk', () => {
    // Screenplays sometimes start with FADE IN: or title-page text before
    // the first scene heading. chunkScript starts at the first heading —
    // that preamble is correctly excluded (it has no dialogue or audio cues).
    const scriptWithPreamble =
      'FADE IN:\n\nTITLE CARD: "A long time ago..."\n\n' + makeScript(5);
    const chunks = chunkScript(scriptWithPreamble, 15);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].text.trim()).toMatch(/^INT\. LOCATION 1/);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// chunkScriptForExtraction — 30-page scale
// ─────────────────────────────────────────────────────────────────────────────

describe('chunkScriptForExtraction', () => {
  it('returns a single chunk for script below the threshold', () => {
    const shortScript = makeScript(5); // well under 30K chars
    expect(shortScript.length).toBeLessThan(EXTRACTION_CHUNK_THRESHOLD);
    const chunks = chunkScriptForExtraction(shortScript);
    expect(chunks).toHaveLength(1);
    expect(chunks[0].chunk_index).toBe(0);
  });

  it('splits a 30-page-scale script (66K chars) into multiple extraction chunks', () => {
    // ~2,200 chars per scene, 30 scenes = ~66K chars — each scene is realistic size.
    // 'DIALOG LINE. ' = 13 chars; 170 repeats ≈ 2,210 chars per scene.
    const denseScript = Array.from({ length: 30 }, (_, i) =>
      `INT. LOCATION ${i + 1} - DAY\n\n` + 'DIALOG LINE. '.repeat(170)
    ).join('\n\n');
    expect(denseScript.length).toBeGreaterThan(EXTRACTION_CHUNK_THRESHOLD);
    const chunks = chunkScriptForExtraction(denseScript);
    expect(chunks.length).toBeGreaterThanOrEqual(2);
  });

  it('chunk_index values are sequential starting from 0', () => {
    const longScript = makeScript(30) + 'X'.repeat(50_000);
    const chunks = chunkScriptForExtraction(longScript);
    expect(chunks.map((c) => c.chunk_index)).toEqual(Array.from({ length: chunks.length }, (_, i) => i));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// mergeCharacterLists — large cast (30-page scale)
// ─────────────────────────────────────────────────────────────────────────────

describe('mergeCharacterLists', () => {
  function makeChar(name: string, extras: Partial<{ description: string; gender: 'Male' | 'Female'; aliases: string[] }> = {}) {
    return {
      name,
      canonical_name: name,
      aliases: extras.aliases ?? [],
      description: extras.description,
      gender: extras.gender,
      is_narrator: name === 'NARRATOR',
    };
  }

  it('merges two non-overlapping character lists', () => {
    const a = [makeChar('ALICE'), makeChar('BOB')];
    const b = [makeChar('CAROL'), makeChar('DAVE')];
    const merged = mergeCharacterLists([a, b]);
    expect(merged).toHaveLength(4);
  });

  it('deduplicates characters across chunks (case-insensitive match)', () => {
    const a = [makeChar('ALICE', { description: 'short' })];
    const b = [makeChar('Alice', { description: 'a longer richer description' })];
    const merged = mergeCharacterLists([a, b]);
    expect(merged).toHaveLength(1);
    // Keeps the richer description
    expect(merged[0].description).toBe('a longer richer description');
  });

  it('is_narrator=true always wins on merge', () => {
    const a = [makeChar('NARRATOR', { })];
    const b = [{ ...makeChar('NARRATOR'), is_narrator: false }];
    const merged = mergeCharacterLists([a, b]);
    expect(merged).toHaveLength(1);
    expect(merged[0].is_narrator).toBe(true);
  });

  it('merges aliases across chunks for the same character', () => {
    const a = [{ ...makeChar('BOB'), aliases: ['BOBBY'] }];
    const b = [{ ...makeChar('BOB'), aliases: ['ROBERT'] }];
    const merged = mergeCharacterLists([a, b]);
    expect(merged[0].aliases).toContain('BOBBY');
    expect(merged[0].aliases).toContain('ROBERT');
  });

  it('handles 30-character cast spread across 3 chunks with full dedup', () => {
    // All 30 characters appear in chunk 0; chunks 1+2 repeat them (as happens
    // when the same character appears in different parts of a long script).
    const allChars = Array.from({ length: 30 }, (_, i) => makeChar(`CHAR_${i + 1}`));
    const merged = mergeCharacterLists([allChars, allChars, allChars]);
    expect(merged).toHaveLength(30);
  });
});
