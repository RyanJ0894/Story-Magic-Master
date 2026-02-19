/**
 * Story Explorer Graph Data Layer Tests
 *
 * Unit tests for pure functions: extractScenes, extractCharacters,
 * computeCoOccurrence, buildSceneFlowNodes, buildCharacterNetworkNodes.
 */

import { describe, it, expect } from 'vitest';
import {
  extractScenes,
  extractCharacters,
  computeCoOccurrence,
  buildSceneFlowNodes,
  buildCharacterNetworkNodes,
  getMoodColor,
  getGenderColor,
  MOOD_COLORS,
  GENDER_COLORS,
} from '@/components/story-explorer/graph/build-explorer-graph';

// =============================================================================
// Test Fixture
// =============================================================================

const mockDirectorJson = {
  scenes: [
    {
      scene_id: 'scene-1',
      heading: 'INT. OFFICE - DAY',
      summary: 'The team gathers for a meeting.',
      mood: 'tense',
      intensity: 7,
      dialogue: [
        { character: 'ALICE', text: 'We need to talk.', voice_key: 'v1', age: 35, gender: 'female', ethnicity: 'caucasian' },
        { character: 'BOB', text: 'About what?', voice_key: 'v2', age: 40, gender: 'male' },
        { character: 'ALICE', text: 'The merger.' },
      ],
      music: [{ track: 'tension_cue' }],
      ambience: [{ sound: 'office_hum' }],
      sfx: [],
    },
    {
      scene_id: 'scene-2',
      heading: 'EXT. PARKING LOT - NIGHT',
      mood: 'dark',
      intensity: 9,
      dialogue: [
        { character: 'BOB', text: 'This is dangerous.' },
        { character: 'CHARLIE', text: 'I know.', age: 28, gender: 'non-binary' },
      ],
      music: [],
      ambience: [],
      sfx: [{ sound: 'car_engine' }],
    },
  ],
};

// =============================================================================
// extractScenes
// =============================================================================

describe('extractScenes', () => {
  it('returns correct scene count', () => {
    const scenes = extractScenes(mockDirectorJson);
    expect(scenes).toHaveLength(2);
  });

  it('extracts scene metadata', () => {
    const scenes = extractScenes(mockDirectorJson);
    expect(scenes[0]).toMatchObject({
      sceneId: 'scene-1',
      heading: 'INT. OFFICE - DAY',
      mood: 'tense',
      intensity: 7,
      summary: 'The team gathers for a meeting.',
    });
  });

  it('counts dialogue lines correctly', () => {
    const scenes = extractScenes(mockDirectorJson);
    expect(scenes[0].dialogueCount).toBe(3);
    expect(scenes[1].dialogueCount).toBe(2);
  });

  it('extracts unique characters per scene', () => {
    const scenes = extractScenes(mockDirectorJson);
    expect(scenes[0].characters).toEqual(['ALICE', 'BOB']);
    expect(scenes[1].characters).toEqual(['BOB', 'CHARLIE']);
  });

  it('detects audio cues', () => {
    const scenes = extractScenes(mockDirectorJson);
    expect(scenes[0].hasMusic).toBe(true);
    expect(scenes[0].hasAmbience).toBe(true);
    expect(scenes[0].hasSfx).toBe(false);
    expect(scenes[1].hasSfx).toBe(true);
    expect(scenes[1].hasMusic).toBe(false);
  });

  it('generates scene IDs when missing', () => {
    const json = { scenes: [{ heading: 'Scene A' }] };
    const scenes = extractScenes(json);
    expect(scenes[0].sceneId).toBe('scene-1');
  });

  it('returns empty array for null input', () => {
    expect(extractScenes(null)).toEqual([]);
    expect(extractScenes(undefined)).toEqual([]);
  });

  it('returns empty array for empty scenes', () => {
    expect(extractScenes({ scenes: [] })).toEqual([]);
  });

  it('returns empty array for non-object input', () => {
    expect(extractScenes('invalid')).toEqual([]);
  });
});

// =============================================================================
// extractCharacters
// =============================================================================

describe('extractCharacters', () => {
  it('extracts unique characters', () => {
    const chars = extractCharacters(mockDirectorJson);
    const names = chars.map((c) => c.name);
    expect(names).toEqual(['ALICE', 'BOB', 'CHARLIE']);
  });

  it('counts total lines across scenes', () => {
    const chars = extractCharacters(mockDirectorJson);
    const alice = chars.find((c) => c.name === 'ALICE')!;
    expect(alice.lineCount).toBe(2);
    const bob = chars.find((c) => c.name === 'BOB')!;
    expect(bob.lineCount).toBe(2);
  });

  it('counts scenes per character', () => {
    const chars = extractCharacters(mockDirectorJson);
    const bob = chars.find((c) => c.name === 'BOB')!;
    expect(bob.sceneCount).toBe(2);
    const alice = chars.find((c) => c.name === 'ALICE')!;
    expect(alice.sceneCount).toBe(1);
  });

  it('captures first-occurrence metadata (age, gender, ethnicity)', () => {
    const chars = extractCharacters(mockDirectorJson);
    const alice = chars.find((c) => c.name === 'ALICE')!;
    expect(alice.age).toBe(35);
    expect(alice.gender).toBe('female');
    expect(alice.ethnicity).toBe('caucasian');
  });

  it('captures sample lines (max 3)', () => {
    const chars = extractCharacters(mockDirectorJson);
    const alice = chars.find((c) => c.name === 'ALICE')!;
    expect(alice.sampleLines).toEqual(['We need to talk.', 'The merger.']);
  });

  it('limits sample lines to 3', () => {
    const json = {
      scenes: [
        {
          dialogue: [
            { character: 'X', text: 'Line 1' },
            { character: 'X', text: 'Line 2' },
            { character: 'X', text: 'Line 3' },
            { character: 'X', text: 'Line 4' },
          ],
        },
      ],
    };
    const chars = extractCharacters(json);
    expect(chars[0].sampleLines).toHaveLength(3);
  });

  it('returns empty array for null input', () => {
    expect(extractCharacters(null)).toEqual([]);
  });

  it('returns empty array for no scenes', () => {
    expect(extractCharacters({})).toEqual([]);
  });
});

// =============================================================================
// computeCoOccurrence
// =============================================================================

describe('computeCoOccurrence', () => {
  it('finds co-occurring character pairs', () => {
    const scenes = extractScenes(mockDirectorJson);
    const coOcc = computeCoOccurrence(scenes);
    expect(coOcc.length).toBeGreaterThan(0);
  });

  it('counts shared scenes correctly', () => {
    const scenes = extractScenes(mockDirectorJson);
    const coOcc = computeCoOccurrence(scenes);
    const aliceBob = coOcc.find(
      (c) =>
        (c.character1 === 'ALICE' && c.character2 === 'BOB') ||
        (c.character1 === 'BOB' && c.character2 === 'ALICE')
    );
    expect(aliceBob).toBeDefined();
    expect(aliceBob!.sharedScenes).toBe(1);
  });

  it('excludes pairs with 0 shared scenes', () => {
    const scenes = extractScenes(mockDirectorJson);
    const coOcc = computeCoOccurrence(scenes);
    const aliceCharlie = coOcc.find(
      (c) =>
        (c.character1 === 'ALICE' && c.character2 === 'CHARLIE') ||
        (c.character1 === 'CHARLIE' && c.character2 === 'ALICE')
    );
    expect(aliceCharlie).toBeUndefined();
  });

  it('handles single-character scenes', () => {
    const scenes = [{ sceneId: 's1', heading: 'X', characters: ['SOLO'], dialogueCount: 1, hasMusic: false, hasAmbience: false, hasSfx: false }];
    const coOcc = computeCoOccurrence(scenes);
    expect(coOcc).toEqual([]);
  });

  it('returns empty for empty input', () => {
    expect(computeCoOccurrence([])).toEqual([]);
  });
});

// =============================================================================
// buildSceneFlowNodes
// =============================================================================

describe('buildSceneFlowNodes', () => {
  it('creates nodes equal to scene count', () => {
    const scenes = extractScenes(mockDirectorJson);
    const { nodes } = buildSceneFlowNodes(scenes);
    expect(nodes).toHaveLength(2);
  });

  it('creates edges = scenes - 1', () => {
    const scenes = extractScenes(mockDirectorJson);
    const { edges } = buildSceneFlowNodes(scenes);
    expect(edges).toHaveLength(1);
  });

  it('sets dagre positions on nodes', () => {
    const scenes = extractScenes(mockDirectorJson);
    const { nodes } = buildSceneFlowNodes(scenes);
    for (const node of nodes) {
      expect(typeof node.position.x).toBe('number');
      expect(typeof node.position.y).toBe('number');
    }
  });

  it('returns empty for empty input', () => {
    const { nodes, edges } = buildSceneFlowNodes([]);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('uses sceneNode type', () => {
    const scenes = extractScenes(mockDirectorJson);
    const { nodes } = buildSceneFlowNodes(scenes);
    expect(nodes[0].type).toBe('sceneNode');
  });
});

// =============================================================================
// buildCharacterNetworkNodes
// =============================================================================

describe('buildCharacterNetworkNodes', () => {
  it('creates nodes equal to character count', () => {
    const chars = extractCharacters(mockDirectorJson);
    const scenes = extractScenes(mockDirectorJson);
    const coOcc = computeCoOccurrence(scenes);
    const { nodes } = buildCharacterNetworkNodes(chars, coOcc);
    expect(nodes).toHaveLength(3);
  });

  it('creates edges from co-occurrences', () => {
    const chars = extractCharacters(mockDirectorJson);
    const scenes = extractScenes(mockDirectorJson);
    const coOcc = computeCoOccurrence(scenes);
    const { edges } = buildCharacterNetworkNodes(chars, coOcc);
    expect(edges.length).toBe(coOcc.length);
  });

  it('returns empty for empty input', () => {
    const { nodes, edges } = buildCharacterNetworkNodes([], []);
    expect(nodes).toEqual([]);
    expect(edges).toEqual([]);
  });

  it('uses characterNode type', () => {
    const chars = extractCharacters(mockDirectorJson);
    const { nodes } = buildCharacterNetworkNodes(chars, []);
    expect(nodes[0].type).toBe('characterNode');
  });
});

// =============================================================================
// Color helpers
// =============================================================================

describe('getMoodColor', () => {
  it('returns color for known mood', () => {
    expect(getMoodColor('tense')).toBe(MOOD_COLORS.tense);
  });

  it('returns neutral for unknown mood', () => {
    expect(getMoodColor('xyz')).toBe(MOOD_COLORS.neutral);
  });

  it('returns neutral for undefined', () => {
    expect(getMoodColor(undefined)).toBe(MOOD_COLORS.neutral);
  });
});

describe('getGenderColor', () => {
  it('returns color for known gender', () => {
    expect(getGenderColor('male')).toBe(GENDER_COLORS.male);
  });

  it('returns unknown for undefined', () => {
    expect(getGenderColor(undefined)).toBe(GENDER_COLORS.unknown);
  });
});
