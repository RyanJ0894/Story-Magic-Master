/**
 * Embedding Service
 *
 * Generates text embeddings using OpenAI's text-embedding-3-small model.
 */

import { getOpenAI } from '@/lib/ai/openai';

// =============================================================================
// Configuration
// =============================================================================

const EMBEDDING_MODEL = 'text-embedding-3-small';
const EMBEDDING_DIMENSIONS = 1536;

// =============================================================================
// Embedding Functions
// =============================================================================

/**
 * Generate an embedding for a single text
 */
export async function generateEmbedding(text: string): Promise<number[]> {
  if (!text.trim()) {
    throw new Error('Cannot generate embedding for empty text');
  }

  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: text,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data[0].embedding;
}

/**
 * Generate embeddings for multiple texts (batch)
 */
export async function generateEmbeddings(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) {
    return [];
  }

  const validTexts = texts.filter((t) => t.trim());
  if (validTexts.length === 0) {
    throw new Error('No valid texts to embed');
  }

  const openai = getOpenAI();

  const response = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: validTexts,
    dimensions: EMBEDDING_DIMENSIONS,
  });

  return response.data.map((item) => item.embedding);
}

/**
 * Generate embedding for a logline (preprocessed)
 */
export async function generateLoglineEmbedding(logline: string): Promise<number[]> {
  // Preprocess logline for better embedding quality
  const processed = preprocessLogline(logline);
  return generateEmbedding(processed);
}

// =============================================================================
// Preprocessing
// =============================================================================

/**
 * Preprocess a logline for embedding generation
 */
function preprocessLogline(logline: string): string {
  // Clean up the logline
  let processed = logline.trim();

  // Remove common filler phrases
  processed = processed.replace(/^(when|after|in a world where)/i, '');

  // Normalize whitespace
  processed = processed.replace(/\s+/g, ' ').trim();

  return processed;
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * Calculate cosine similarity between two embeddings
 * (Useful for client-side similarity checks)
 */
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Embeddings must have the same dimension');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
  if (magnitude === 0) return 0;

  return dotProduct / magnitude;
}

/**
 * Convert embedding array to pgvector format string
 */
export function toPgvectorFormat(embedding: number[]): string {
  return `[${embedding.join(',')}]`;
}
