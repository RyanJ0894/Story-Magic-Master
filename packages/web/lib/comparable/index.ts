// Types
export * from './types';

// Services
export { searchComparables, searchComparablesByLogline, addToCorpus, getCorpusStats } from './service';

// Embeddings
export { generateEmbedding, generateLoglineEmbedding, cosineSimilarity } from './embeddings';
