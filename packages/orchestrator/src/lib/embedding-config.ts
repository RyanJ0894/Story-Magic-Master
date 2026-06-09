/**
 * Embedding model configuration — single source of truth.
 *
 * Every place in the orchestrator that touches embeddings (query generation,
 * stored catalog vectors, the EmbeddingStore dimension guard) MUST import
 * these constants. The same model + dimension is also used by the web
 * package's `lib/comparable/embeddings.ts` (kept in sync manually since the
 * two packages don't share runtime code).
 *
 * # Why one model
 *
 * Before unification (PR fixing dimension mismatch), the audio catalogs were
 * embedded with `all-MiniLM-L6-v2` (384d) — a leftover from the Python
 * prototype — while the query path generated OpenAI `text-embedding-3-small`
 * (1536d) vectors. Every audio-search tool call hit
 * `Vector length mismatch: 1536 vs 384` in cosineSimilarity.
 *
 * # Why text-embedding-3-small specifically
 *
 * - The web `script_corpus.logline_embedding` pgvector column is already
 *   `vector(1536)` and populated with this model.
 * - It is OpenAI's cheapest current-generation embedding model (~$0.02 / 1M
 *   tokens). The whole audio catalog re-embedding costs fractions of a cent.
 * - Vercel AI SDK has first-class support via `openai.embedding(...)`.
 * - Embeddings have no Anthropic equivalent, so OpenAI is unavoidable here
 *   regardless of the rest of the LLM stack.
 *
 * # Changing the model
 *
 * If you ever swap models, you MUST regenerate the audio catalog JSONs in
 * the same PR — they are tightly coupled. See
 * `scripts/regenerate-audio-embeddings.ts`.
 */

export const EMBEDDING_MODEL = 'text-embedding-3-small' as const;
export const EMBEDDING_DIMENSIONS = 1536 as const;

/**
 * Throws a clear error if `vec.length !== EMBEDDING_DIMENSIONS`. Use this at
 * load time and at every search-time entry point so a future model change
 * fails loudly instead of returning nonsensical similarity scores.
 */
export function assertEmbeddingDimension(vec: number[], context: string): void {
  if (vec.length !== EMBEDDING_DIMENSIONS) {
    throw new Error(
      `Embedding dimension mismatch in ${context}: expected ${EMBEDDING_DIMENSIONS} ` +
        `(${EMBEDDING_MODEL}) but got ${vec.length}. The catalog may have been ` +
        `embedded with a different model. Regenerate via ` +
        `scripts/regenerate-audio-embeddings.ts.`,
    );
  }
}
