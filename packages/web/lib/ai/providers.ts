/**
 * AI Provider Factory
 *
 * Multi-provider abstraction using Vercel AI SDK.
 * Supports Anthropic (Claude) and Google (Gemini).
 * Falls back to raw OpenAI SDK for GPT models.
 */

import { generateText } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogleGenerativeAI } from '@ai-sdk/google';

export { generateText };

// =============================================================================
// Model Aliases
// =============================================================================

export const MODELS = {
  // Production scoring — best literary analysis, 200K context
  PRODUCTION: 'claude-sonnet-4-6' as const,
  // Batch corpus scoring — cheap, fast, 1M context
  BATCH: 'gemini-2.5-flash' as const,
  // Fallback
  FALLBACK: 'gpt-4o' as const,
} as const;

// =============================================================================
// Provider Instances (lazy)
// =============================================================================

let _anthropic: ReturnType<typeof createAnthropic> | null = null;
let _google: ReturnType<typeof createGoogleGenerativeAI> | null = null;

function getAnthropic() {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _anthropic = createAnthropic({ apiKey });
  }
  return _anthropic;
}

function getGoogle() {
  if (!_google) {
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_GENERATIVE_AI_API_KEY is not set');
    _google = createGoogleGenerativeAI({ apiKey });
  }
  return _google;
}

// =============================================================================
// Model Resolver
// =============================================================================

/**
 * Resolve a model string to a Vercel AI SDK model instance.
 * Supports: claude-*, gemini-* model IDs.
 */
// LanguageModelV1 vs LanguageModelV3 SDK mismatch — intentional any return
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK version mismatch: ai@4 expects LanguageModelV1, @ai-sdk/anthropic@3 returns LanguageModelV3
export function resolveModel(modelId: string): any {
  if (modelId.startsWith('claude-')) {
    return getAnthropic()(modelId);
  }
  if (modelId.startsWith('gemini-')) {
    return getGoogle()(modelId);
  }
  throw new Error(
    `Unsupported model: "${modelId}". Use a claude-* or gemini-* model ID. ` +
    `For OpenAI, add @ai-sdk/openai to dependencies.`
  );
}
