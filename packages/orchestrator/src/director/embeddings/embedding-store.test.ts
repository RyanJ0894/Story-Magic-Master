/**
 * Tests for Embedding Store
 * Validates semantic search functionality using cosine similarity
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fs module - mock both named export and default
const mockReadFileSync = vi.fn();
vi.mock('fs', () => ({
  readFileSync: mockReadFileSync,
  default: { readFileSync: mockReadFileSync },
}));

// We need to import after mocking
const mockEmbeddings = [
  [1.0, 0.0, 0.0], // First vector
  [0.0, 1.0, 0.0], // Second vector - orthogonal
  [0.9, 0.1, 0.0], // Third vector - similar to first
  [0.5, 0.5, 0.0], // Fourth vector - between first and second
];

const mockVoiceMetadata = [
  { voice_id: 'v1', name: 'Adam', label: 'Male Adult', gender: 'Male', tone: ['Deep', 'Calm'], style: 'American' },
  { voice_id: 'v2', name: 'Sarah', label: 'Female Teen', gender: 'Female', tone: ['Bright', 'Energetic'], style: 'British' },
  { voice_id: 'v3', name: 'Marcus', label: 'Male Teen', gender: 'Male', tone: ['Young'], style: 'African American' },
  { voice_id: 'v4', name: 'Emma', label: 'Female Adult', gender: 'Female', tone: ['Warm'], style: 'American' },
];

const mockAudioMetadata = [
  { id: 'a1', file: 'music/epic_001.mp3', title: 'Epic Adventure', group: 'EPIC', mood: ['epic', 'exciting'], intensity: 80, loopable: true },
  { id: 'a2', file: 'music/sad_001.mp3', title: 'Melancholy', group: 'EMOTIONAL', mood: ['sad', 'mellow'], intensity: 30, loopable: true },
  { id: 'a3', file: 'music/tense_001.mp3', title: 'Suspense', group: 'THRILLER', mood: ['tense', 'dark'], intensity: 70, loopable: false },
  { id: 'a4', file: 'music/peaceful_001.mp3', title: 'Serenity', group: 'CALM', mood: ['peaceful', 'relaxing'], intensity: 20, loopable: true },
];

function setupMocks() {
  mockReadFileSync.mockImplementation((path: string) => {
    const pathStr = String(path);
    // Match embeddings files by suffix
    if (pathStr.endsWith('embeddings.json') || pathStr.endsWith('_embeddings.json')) {
      return JSON.stringify(mockEmbeddings);
    }
    // Match voice metadata
    if (pathStr.includes('voices_metadata') || pathStr.endsWith('voice_metadata.json')) {
      return JSON.stringify(mockVoiceMetadata);
    }
    // Match other metadata files
    if (pathStr.includes('metadata')) {
      return JSON.stringify(mockAudioMetadata);
    }
    throw new Error(`Unknown path: ${pathStr}`);
  });
}

describe('EmbeddingStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();

    // Mock console to suppress logging
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    setupMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Cosine Similarity', () => {
    it('should return 1.0 for identical vectors', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      const store = new TestStore();

      // Search for first vector - should match itself with score ~1.0
      const results = store.searchByEmbedding([1.0, 0.0, 0.0], 1);
      expect(results[0].score).toBeCloseTo(1.0, 5);
    });

    it('should return 0 for orthogonal vectors', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      const store = new TestStore();

      // Query with vector orthogonal to first two
      const results = store.searchByEmbedding([0.0, 0.0, 1.0], 4);

      // All stored vectors have 0 in z-component, so all scores should be 0
      results.forEach(r => {
        expect(r.score).toBeCloseTo(0.0, 5);
      });
    });

    it('should rank similar vectors higher', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      const store = new TestStore();

      // Search for vector similar to first
      const results = store.searchByEmbedding([1.0, 0.0, 0.0], 4);

      // First result should be exact match, third should be similar
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  describe('Top-K Results', () => {
    it('should return requested number of results', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      const store = new TestStore();

      const results = store.searchByEmbedding([1.0, 0.0, 0.0], 2);
      expect(results).toHaveLength(2);
    });

    it('should return all results if topK exceeds count', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      const store = new TestStore();

      const results = store.searchByEmbedding([1.0, 0.0, 0.0], 100);
      expect(results).toHaveLength(4); // Only 4 items in mock data
    });

    it('should sort results by descending score', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      const store = new TestStore();

      const results = store.searchByEmbedding([0.8, 0.2, 0.0], 4);

      for (let i = 0; i < results.length - 1; i++) {
        expect(results[i].score).toBeGreaterThanOrEqual(results[i + 1].score);
      }
    });
  });

  describe('Filtering', () => {
    it('should apply filter function', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<typeof mockVoiceMetadata[0]> {
        constructor() {
          super('embeddings.json', 'voices_metadata.json');
        }
      }
      const store = new TestStore();

      // Filter to only male voices
      const results = store.searchByEmbedding(
        [0.5, 0.5, 0.0],
        10,
        (item) => item.gender === 'Male'
      );

      results.forEach(r => {
        expect(r.item.gender).toBe('Male');
      });
    });

    it('should return empty array when filter matches nothing', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<typeof mockVoiceMetadata[0]> {
        constructor() {
          super('embeddings.json', 'voices_metadata.json');
        }
      }
      const store = new TestStore();

      const results = store.searchByEmbedding(
        [0.5, 0.5, 0.0],
        10,
        () => false // Filter out everything
      );

      expect(results).toHaveLength(0);
    });
  });

  describe('Data Access', () => {
    it('should get metadata by index', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<typeof mockVoiceMetadata[0]> {
        constructor() {
          super('embeddings.json', 'voices_metadata.json');
        }
      }
      const store = new TestStore();

      const metadata = store.getMetadata(0);
      expect(metadata).toEqual(mockVoiceMetadata[0]);
    });

    it('should return undefined for invalid index', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<typeof mockVoiceMetadata[0]> {
        constructor() {
          super('embeddings.json', 'voices_metadata.json');
        }
      }
      const store = new TestStore();

      const metadata = store.getMetadata(100);
      expect(metadata).toBeUndefined();
    });

    it('should get all metadata', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<typeof mockVoiceMetadata[0]> {
        constructor() {
          super('embeddings.json', 'voices_metadata.json');
        }
      }
      const store = new TestStore();

      const allMetadata = store.getAllMetadata();
      expect(allMetadata).toHaveLength(4);
    });

    it('should report correct count', async () => {
      const { EmbeddingStore } = await import('./embedding-store.js');

      class TestStore extends EmbeddingStore<typeof mockVoiceMetadata[0]> {
        constructor() {
          super('embeddings.json', 'voices_metadata.json');
        }
      }
      const store = new TestStore();

      expect(store.count).toBe(4);
    });
  });
});

describe('VoiceEmbeddingStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockReadFileSync.mockImplementation((path: string) => {
      const pathStr = String(path);
      // Check for _embeddings.json suffix vs metadata files
      if (pathStr.endsWith('_embeddings.json') || pathStr.endsWith('embeddings.json')) {
        return JSON.stringify(mockEmbeddings);
      }
      return JSON.stringify(mockVoiceMetadata);
    });
  });

  it('should filter by gender', async () => {
    const { VoiceEmbeddingStore } = await import('./embedding-store.js');
    const store = new VoiceEmbeddingStore();

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      gender: 'Female',
    });

    results.forEach(r => {
      expect(r.item.gender).toBe('Female');
    });
  });

  it('should filter by label', async () => {
    const { VoiceEmbeddingStore } = await import('./embedding-store.js');
    const store = new VoiceEmbeddingStore();

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      label: 'Teen',
    });

    results.forEach(r => {
      expect(r.item.label.toLowerCase()).toContain('teen');
    });
  });

  it('should filter by style', async () => {
    const { VoiceEmbeddingStore } = await import('./embedding-store.js');
    const store = new VoiceEmbeddingStore();

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      style: 'American',
    });

    results.forEach(r => {
      expect(r.item.style.toLowerCase()).toBe('american');
    });
  });

  it('should exclude specified voice IDs', async () => {
    const { VoiceEmbeddingStore } = await import('./embedding-store.js');
    const store = new VoiceEmbeddingStore();

    const results = store.search({
      queryEmbedding: [1.0, 0.0, 0.0],
      excludeVoiceIds: ['v1', 'v2'],
    });

    const ids = results.map(r => r.item.voice_id);
    expect(ids).not.toContain('v1');
    expect(ids).not.toContain('v2');
  });

  it('should find voice by ID', async () => {
    const { VoiceEmbeddingStore } = await import('./embedding-store.js');
    const store = new VoiceEmbeddingStore();

    const voice = store.findById('v1');
    expect(voice?.name).toBe('Adam');
  });

  it('should return undefined for unknown voice ID', async () => {
    const { VoiceEmbeddingStore } = await import('./embedding-store.js');
    const store = new VoiceEmbeddingStore();

    const voice = store.findById('unknown');
    expect(voice).toBeUndefined();
  });
});

describe('AudioEmbeddingStore', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    mockReadFileSync.mockImplementation((path: string) => {
      const pathStr = String(path);
      // Check for _embeddings.json vs _metadata.json suffix
      if (pathStr.endsWith('_embeddings.json')) {
        return JSON.stringify(mockEmbeddings);
      }
      return JSON.stringify(mockAudioMetadata);
    });
  });

  it('should filter by group', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      group: 'EPIC',
    });

    results.forEach(r => {
      expect(r.item.group).toBe('EPIC');
    });
  });

  it('should filter by mood', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      mood: 'sad',
    });

    results.forEach(r => {
      expect(r.item.mood?.some(m => m.includes('sad'))).toBe(true);
    });
  });

  it('should filter by intensity range', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      intensityMin: 50,
      intensityMax: 100,
    });

    results.forEach(r => {
      expect(r.item.intensity).toBeGreaterThanOrEqual(50);
      expect(r.item.intensity).toBeLessThanOrEqual(100);
    });
  });

  it('should filter by loopable', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const results = store.search({
      queryEmbedding: [0.5, 0.5, 0.0],
      loopable: true,
    });

    results.forEach(r => {
      expect(r.item.loopable).toBe(true);
    });
  });

  it('should find audio by ID', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const audio = store.findById('a1');
    expect(audio?.title).toBe('Epic Adventure');
  });

  it('should find audio by file path', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const audio = store.findByFile('music/epic_001.mp3');
    expect(audio?.title).toBe('Epic Adventure');
  });

  it('should find audio by partial file path', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('music');

    const audio = store.findByFile('epic_001.mp3');
    expect(audio?.title).toBe('Epic Adventure');
  });

  it('should track audio type', async () => {
    const { AudioEmbeddingStore } = await import('./embedding-store.js');
    const store = new AudioEmbeddingStore('ambience');

    expect(store.audioType).toBe('ambience');
  });
});

describe('Error Handling', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    vi.resetModules();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('should throw on file read error', async () => {
    mockReadFileSync.mockImplementation(() => {
      throw new Error('File not found');
    });

    const { EmbeddingStore } = await import('./embedding-store.js');

    expect(() => {
      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('bad-embeddings.json', 'bad-metadata.json');
        }
      }
      new TestStore();
    }).toThrow('File not found');
  });

  it('should throw on invalid JSON', async () => {
    mockReadFileSync.mockReturnValue('{ invalid json }');

    const { EmbeddingStore } = await import('./embedding-store.js');

    expect(() => {
      class TestStore extends EmbeddingStore<{ id: string }> {
        constructor() {
          super('embeddings.json', 'metadata.json');
        }
      }
      new TestStore();
    }).toThrow();
  });
});
