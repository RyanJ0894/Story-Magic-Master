import { describe, it, expect } from 'vitest';
import { extractSceneInfo, chunkScript, countScenes } from './script-chunker.js';

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
