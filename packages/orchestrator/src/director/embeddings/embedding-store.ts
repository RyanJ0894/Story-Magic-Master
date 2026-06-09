/**
 * Embedding Store — semantic search using pre-computed catalog embeddings.
 *
 * Catalog vectors live as JSON next to the metadata files. The expected
 * model + dimension is set in `lib/embedding-config.ts` — load-time and
 * search-time guards ensure stored vectors actually match it. To swap the
 * model, update embedding-config.ts AND regenerate the catalog JSONs via
 * `scripts/regenerate-audio-embeddings.ts`.
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { log } from '../../lib/logger.js';
import { assertEmbeddingDimension } from '../../lib/embedding-config.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Base path for knowledge bases (relative to dist/director/embeddings/)
const KNOWLEDGE_BASE_PATH = join(__dirname, '../../../knowledge_bases');

export interface VoiceMetadata {
  voice_id: string;
  name: string;
  label: string;
  gender: 'Male' | 'Female';
  tone: string[];
  style: string;
  description?: string;
  [key: string]: unknown;
}

export interface AudioMetadata {
  id: string;
  file: string;
  title: string;
  group: string;
  style?: string;
  mood?: string[];
  intensity?: number;
  loopable?: boolean;
  tags?: string[];
  [key: string]: unknown;
}

export interface SearchResult<T> {
  item: T;
  score: number;
}

/**
 * Calculate cosine similarity between two vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error(`Vector length mismatch: ${a.length} vs ${b.length}`);
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Generic embedding store base class
 */
export class EmbeddingStore<T extends Record<string, unknown>> {
  protected embeddings: number[][] = [];
  protected metadata: T[] = [];

  constructor(embeddingsPath: string, metadataPath: string) {
    this.loadData(embeddingsPath, metadataPath);
  }

  private loadData(embeddingsPath: string, metadataPath: string): void {
    try {
      const embeddingsJson = readFileSync(embeddingsPath, 'utf-8');
      this.embeddings = JSON.parse(embeddingsJson);
      const dims = this.embeddings[0]?.length || 0;
      log.info('EmbeddingStore loaded embeddings', { count: this.embeddings.length, dimensions: dims });

      // Catch silent model drift at boot: if the catalog file was regenerated
      // with a different model, every cosineSimilarity call will throw or
      // produce nonsense scores. Fail at startup instead.
      if (this.embeddings.length > 0) {
        assertEmbeddingDimension(this.embeddings[0], `${embeddingsPath} (first vector)`);
      }

      const metadataJson = readFileSync(metadataPath, 'utf-8');
      this.metadata = JSON.parse(metadataJson);
      log.info('EmbeddingStore loaded metadata records', { count: this.metadata.length });

      if (this.embeddings.length !== this.metadata.length) {
        log.warn('EmbeddingStore count mismatch', { embeddingCount: this.embeddings.length, metadataCount: this.metadata.length });
      }
    } catch (err) {
      log.error('EmbeddingStore error loading data', err instanceof Error ? err : undefined);
      throw err;
    }
  }

  /**
   * Search for similar items using a query embedding
   */
  searchByEmbedding(
    queryEmbedding: number[],
    topK: number = 3,
    filter?: (item: T, index: number) => boolean
  ): SearchResult<T>[] {
    // Apply filter if provided
    const indices = filter
      ? this.metadata.map((_, i) => i).filter((i) => filter(this.metadata[i], i))
      : this.metadata.map((_, i) => i);

    if (indices.length === 0) {
      return [];
    }

    // Calculate similarities
    const scored = indices.map((i) => ({
      index: i,
      score: cosineSimilarity(queryEmbedding, this.embeddings[i]),
    }));

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    // Return top-k
    return scored.slice(0, topK).map((s) => ({
      item: this.metadata[s.index],
      score: s.score,
    }));
  }

  /**
   * Get metadata by index
   */
  getMetadata(index: number): T | undefined {
    return this.metadata[index];
  }

  /**
   * Get all metadata
   */
  getAllMetadata(): T[] {
    return this.metadata;
  }

  /**
   * Get embedding by index
   */
  getEmbedding(index: number): number[] | undefined {
    return this.embeddings[index];
  }

  /**
   * Get count of items
   */
  get count(): number {
    return this.metadata.length;
  }
}

/**
 * Voice Embedding Store - for searching ElevenLabs voices
 */
export class VoiceEmbeddingStore extends EmbeddingStore<VoiceMetadata> {
  constructor() {
    const basePath = join(KNOWLEDGE_BASE_PATH, 'voice_embeddings_store');
    super(
      join(basePath, 'voice_embeddings.json'),
      join(basePath, 'voices_metadata.json')
    );
  }

  /**
   * Search for voices with optional filters
   */
  search(options: {
    queryEmbedding: number[];
    topK?: number;
    gender?: 'Male' | 'Female';
    tone?: string;
    style?: string;
    label?: string;
    excludeVoiceIds?: string[];
  }): SearchResult<VoiceMetadata>[] {
    const { queryEmbedding, topK = 3, gender, tone, style, label, excludeVoiceIds = [] } = options;

    const filter = (item: VoiceMetadata): boolean => {
      // Exclude already used voices
      if (excludeVoiceIds.includes(item.voice_id)) return false;

      // Apply gender filter
      if (gender && item.gender !== gender) return false;

      // Apply label filter (e.g., "Male Teen", "Narrator")
      if (label && !item.label?.toLowerCase().includes(label.toLowerCase())) return false;

      // Apply style filter (e.g., "African American", "American")
      if (style && item.style?.toLowerCase() !== style.toLowerCase()) return false;

      // Apply tone filter
      if (tone && !item.tone?.some((t) => t.toLowerCase().includes(tone.toLowerCase()))) return false;

      return true;
    };

    return this.searchByEmbedding(queryEmbedding, topK, filter);
  }

  /**
   * Find voice by ID
   */
  findById(voiceId: string): VoiceMetadata | undefined {
    return this.metadata.find((v) => v.voice_id === voiceId);
  }
}

/**
 * Audio Embedding Store - for searching music, ambience, or SFX
 */
export class AudioEmbeddingStore extends EmbeddingStore<AudioMetadata> {
  readonly audioType: 'music' | 'ambience' | 'sfx';

  constructor(audioType: 'music' | 'ambience' | 'sfx') {
    // audioType is a literal-union typed parameter — only the three values
    // can ever flow here (enforced by TS at compile time, and the singletons
    // at the bottom of this file pass hard-coded strings). Not user input.
    // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
    const basePath = join(KNOWLEDGE_BASE_PATH, 'audio_embeddings_store', audioType);
    super(
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
      join(basePath, `${audioType}_embeddings.json`),
      // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
      join(basePath, `${audioType}_metadata.json`)
    );
    this.audioType = audioType;
  }

  /**
   * Search for audio with optional filters
   */
  search(options: {
    queryEmbedding: number[];
    topK?: number;
    group?: string;
    style?: string;
    mood?: string;
    intensityMin?: number;
    intensityMax?: number;
    loopable?: boolean;
  }): SearchResult<AudioMetadata>[] {
    const { queryEmbedding, topK = 3, group, style, mood, intensityMin, intensityMax, loopable } = options;

    const filter = (item: AudioMetadata): boolean => {
      // Apply group filter
      if (group && item.group?.toLowerCase() !== group.toLowerCase()) return false;

      // Apply style filter
      if (style && item.style?.toLowerCase() !== style.toLowerCase()) return false;

      // Apply mood filter
      if (mood && !item.mood?.some((m) => m.toLowerCase().includes(mood.toLowerCase()))) return false;

      // Apply intensity range filter
      if (intensityMin !== undefined && (item.intensity ?? 0) < intensityMin) return false;
      if (intensityMax !== undefined && (item.intensity ?? 100) > intensityMax) return false;

      // Apply loopable filter
      if (loopable !== undefined && item.loopable !== loopable) return false;

      return true;
    };

    return this.searchByEmbedding(queryEmbedding, topK, filter);
  }

  /**
   * Find audio by ID
   */
  findById(id: string): AudioMetadata | undefined {
    return this.metadata.find((a) => a.id === id);
  }

  /**
   * Find audio by file path
   */
  findByFile(file: string): AudioMetadata | undefined {
    return this.metadata.find((a) => a.file === file || a.file.endsWith(file));
  }
}

// Singleton instances (lazy loaded)
let voiceStore: VoiceEmbeddingStore | null = null;
let musicStore: AudioEmbeddingStore | null = null;
let ambienceStore: AudioEmbeddingStore | null = null;
let sfxStore: AudioEmbeddingStore | null = null;

export function getVoiceStore(): VoiceEmbeddingStore {
  if (!voiceStore) {
    voiceStore = new VoiceEmbeddingStore();
  }
  return voiceStore;
}

export function getMusicStore(): AudioEmbeddingStore {
  if (!musicStore) {
    musicStore = new AudioEmbeddingStore('music');
  }
  return musicStore;
}

export function getAmbienceStore(): AudioEmbeddingStore {
  if (!ambienceStore) {
    ambienceStore = new AudioEmbeddingStore('ambience');
  }
  return ambienceStore;
}

export function getSfxStore(): AudioEmbeddingStore {
  if (!sfxStore) {
    sfxStore = new AudioEmbeddingStore('sfx');
  }
  return sfxStore;
}
