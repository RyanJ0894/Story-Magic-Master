/**
 * Shared OpenAI Client (Singleton)
 *
 * Lazy-initialized to avoid crashes when OPENAI_API_KEY is not set at import time.
 * All modules that need an OpenAI client should import from here.
 */

import OpenAI from 'openai';

let _instance: OpenAI | null = null;

/**
 * Returns a lazily-initialized OpenAI client singleton.
 * Throws if OPENAI_API_KEY is not set when first called.
 */
export function getOpenAI(): OpenAI {
  if (!_instance) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY is not set');
    }
    _instance = new OpenAI({ apiKey });
  }
  return _instance;
}
