/**
 * Story Explorer Graph Data Layer
 *
 * Pure functions to extract scene/character data from directorJson
 * and build React Flow node/edge structures with dagre layout.
 */

import dagre from 'dagre';
import type { Node, Edge } from '@xyflow/react';

// =============================================================================
// Types
// =============================================================================

export interface ExplorerScene {
  [key: string]: unknown;
  sceneId: string;
  heading: string;
  mood?: string;
  intensity?: number;
  dialogueCount: number;
  characters: string[];
  hasMusic: boolean;
  hasAmbience: boolean;
  hasSfx: boolean;
  summary?: string;
}

export interface ExplorerCharacter {
  [key: string]: unknown;
  name: string;
  lineCount: number;
  sceneCount: number;
  scenes: string[];
  age?: number;
  gender?: string;
  ethnicity?: string;
  sampleLines: string[];
}

export interface CoOccurrence {
  character1: string;
  character2: string;
  sharedScenes: number;
  sceneIds: string[];
}

// Director JSON shape (subset we care about)
interface DirectorScene {
  scene_id?: string;
  heading?: string;
  summary?: string;
  mood?: string;
  intensity?: number;
  dialogue?: Array<{
    character: string;
    text: string;
    voice_key?: string;
    age?: number;
    gender?: string;
    ethnicity?: string;
  }>;
  music?: unknown[];
  ambience?: unknown[];
  sfx?: unknown[];
}

interface DirectorJson {
  scenes?: DirectorScene[];
}

// =============================================================================
// Mood Color Map
// =============================================================================

export const MOOD_COLORS: Record<string, string> = {
  tense: '#ef4444',
  dark: '#7c3aed',
  suspenseful: '#f97316',
  dramatic: '#dc2626',
  romantic: '#ec4899',
  comedic: '#22c55e',
  lighthearted: '#34d399',
  hopeful: '#3b82f6',
  melancholic: '#6366f1',
  action: '#f59e0b',
  mysterious: '#8b5cf6',
  peaceful: '#06b6d4',
  neutral: '#6b7280',
};

export function getMoodColor(mood?: string): string {
  if (!mood) return MOOD_COLORS.neutral;
  return MOOD_COLORS[mood.toLowerCase()] ?? MOOD_COLORS.neutral;
}

// =============================================================================
// Gender Color Map
// =============================================================================

export const GENDER_COLORS: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
  'non-binary': '#8b5cf6',
  unknown: '#6b7280',
};

export function getGenderColor(gender?: string): string {
  if (!gender) return GENDER_COLORS.unknown;
  return GENDER_COLORS[gender.toLowerCase()] ?? GENDER_COLORS.unknown;
}

// =============================================================================
// Data Extraction
// =============================================================================

export function extractScenes(directorJson: unknown): ExplorerScene[] {
  if (!directorJson || typeof directorJson !== 'object') return [];
  const dj = directorJson as DirectorJson;
  if (!dj.scenes || !Array.isArray(dj.scenes)) return [];

  return dj.scenes.map((scene, index) => {
    const characters = new Set<string>();
    let dialogueCount = 0;

    if (scene.dialogue && Array.isArray(scene.dialogue)) {
      for (const line of scene.dialogue) {
        if (line.character) {
          characters.add(line.character);
        }
        dialogueCount++;
      }
    }

    return {
      sceneId: scene.scene_id || `scene-${index + 1}`,
      heading: scene.heading || `Scene ${index + 1}`,
      mood: scene.mood,
      intensity: scene.intensity,
      dialogueCount,
      characters: Array.from(characters),
      hasMusic: Array.isArray(scene.music) && scene.music.length > 0,
      hasAmbience: Array.isArray(scene.ambience) && scene.ambience.length > 0,
      hasSfx: Array.isArray(scene.sfx) && scene.sfx.length > 0,
      summary: scene.summary,
    };
  });
}

export function extractCharacters(directorJson: unknown): ExplorerCharacter[] {
  if (!directorJson || typeof directorJson !== 'object') return [];
  const dj = directorJson as DirectorJson;
  if (!dj.scenes || !Array.isArray(dj.scenes)) return [];

  const characterMap = new Map<
    string,
    {
      lineCount: number;
      scenes: Set<string>;
      age?: number;
      gender?: string;
      ethnicity?: string;
      sampleLines: string[];
    }
  >();

  for (let sceneIndex = 0; sceneIndex < dj.scenes.length; sceneIndex++) {
    const scene = dj.scenes[sceneIndex];
    const sceneId = scene.scene_id || `scene-${sceneIndex + 1}`;

    if (scene.dialogue && Array.isArray(scene.dialogue)) {
      for (const line of scene.dialogue) {
        if (!line.character) continue;

        const existing = characterMap.get(line.character);
        if (existing) {
          existing.lineCount++;
          existing.scenes.add(sceneId);
          if (existing.sampleLines.length < 3 && line.text) {
            existing.sampleLines.push(line.text);
          }
        } else {
          characterMap.set(line.character, {
            lineCount: 1,
            scenes: new Set([sceneId]),
            age: line.age,
            gender: line.gender,
            ethnicity: line.ethnicity,
            sampleLines: line.text ? [line.text] : [],
          });
        }
      }
    }
  }

  return Array.from(characterMap.entries()).map(([name, data]) => ({
    name,
    lineCount: data.lineCount,
    sceneCount: data.scenes.size,
    scenes: Array.from(data.scenes),
    age: data.age,
    gender: data.gender,
    ethnicity: data.ethnicity,
    sampleLines: data.sampleLines,
  }));
}

export function computeCoOccurrence(scenes: ExplorerScene[]): CoOccurrence[] {
  const pairMap = new Map<string, { sharedScenes: number; sceneIds: string[] }>();

  for (const scene of scenes) {
    const chars = scene.characters;
    for (let i = 0; i < chars.length; i++) {
      for (let j = i + 1; j < chars.length; j++) {
        const key = [chars[i], chars[j]].sort().join('::');
        const existing = pairMap.get(key);
        if (existing) {
          existing.sharedScenes++;
          existing.sceneIds.push(scene.sceneId);
        } else {
          pairMap.set(key, { sharedScenes: 1, sceneIds: [scene.sceneId] });
        }
      }
    }
  }

  return Array.from(pairMap.entries()).map(([key, data]) => {
    const [character1, character2] = key.split('::');
    return {
      character1,
      character2,
      sharedScenes: data.sharedScenes,
      sceneIds: data.sceneIds,
    };
  });
}

// =============================================================================
// React Flow Graph Builders
// =============================================================================

const SCENE_NODE_WIDTH = 220;
const SCENE_NODE_HEIGHT = 100;
const CHARACTER_NODE_SIZE = 80;

function applyDagreLayout(
  nodes: Node[],
  edges: Edge[],
  direction: 'LR' | 'TB',
  nodeWidth: number,
  nodeHeight: number
): Node[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: direction, nodesep: 60, ranksep: 80 });

  for (const node of nodes) {
    g.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  }
  for (const edge of edges) {
    g.setEdge(edge.source, edge.target);
  }

  dagre.layout(g);

  return nodes.map((node) => {
    const pos = g.node(node.id);
    return {
      ...node,
      position: {
        x: pos.x - nodeWidth / 2,
        y: pos.y - nodeHeight / 2,
      },
    };
  });
}

export function buildSceneFlowNodes(scenes: ExplorerScene[]): {
  nodes: Node[];
  edges: Edge[];
} {
  if (scenes.length === 0) return { nodes: [], edges: [] };

  const nodes: Node[] = scenes.map((scene) => ({
    id: scene.sceneId,
    type: 'sceneNode',
    position: { x: 0, y: 0 },
    data: scene,
  }));

  const edges: Edge[] = [];
  for (let i = 0; i < scenes.length - 1; i++) {
    edges.push({
      id: `e-${scenes[i].sceneId}-${scenes[i + 1].sceneId}`,
      source: scenes[i].sceneId,
      target: scenes[i + 1].sceneId,
      type: 'explorerEdge',
      data: { variant: 'scene-flow' },
      animated: true,
    });
  }

  const layoutNodes = applyDagreLayout(
    nodes,
    edges,
    'LR',
    SCENE_NODE_WIDTH,
    SCENE_NODE_HEIGHT
  );

  return { nodes: layoutNodes, edges };
}

export function buildCharacterNetworkNodes(
  characters: ExplorerCharacter[],
  coOccurrences: CoOccurrence[]
): { nodes: Node[]; edges: Edge[] } {
  if (characters.length === 0) return { nodes: [], edges: [] };

  const nodes: Node[] = characters.map((char) => ({
    id: char.name,
    type: 'characterNode',
    position: { x: 0, y: 0 },
    data: char,
  }));

  const edges: Edge[] = coOccurrences.map((co) => ({
    id: `e-${co.character1}-${co.character2}`,
    source: co.character1,
    target: co.character2,
    type: 'explorerEdge',
    data: { variant: 'co-occurrence', weight: co.sharedScenes },
  }));

  const layoutNodes = applyDagreLayout(
    nodes,
    edges,
    'TB',
    CHARACTER_NODE_SIZE,
    CHARACTER_NODE_SIZE
  );

  return { nodes: layoutNodes, edges };
}
