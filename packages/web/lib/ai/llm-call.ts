/**
 * Shared LLM Call + Parse + Validate Utility
 *
 * Extracts the common pattern found across the codebase:
 *   1. Call OpenAI with system/user prompts
 *   2. Parse JSON from the response
 *   3. Validate with a Zod schema
 *   4. Return typed result
 *
 * Usage:
 *   const result = await callLLMAndParse({
 *     systemPrompt: 'You are a helpful assistant.',
 *     userPrompt: 'Analyze this text...',
 *     schema: myZodSchema,
 *   });
 *
 * Callers in:
 *   - lib/adviser/service.ts (generateSuggestions, generateRewrites)
 *   - lib/scoring/service.ts (generateScore)
 *   - app/api/generate-demo-script/route.ts
 *
 * @module lib/ai/llm-call
 */

import { z } from 'zod';
import { getOpenAI } from '@/lib/ai/openai';

// =============================================================================
// Types
// =============================================================================

export interface CallLLMOptions<T> {
  /** OpenAI model to use (default: 'gpt-4o') */
  model?: string;
  /** System prompt setting the LLM's role and instructions */
  systemPrompt: string;
  /** User prompt with the actual request / data */
  userPrompt: string;
  /** Zod schema to validate and type the parsed JSON response */
  schema: z.ZodSchema<T>;
  /** Sampling temperature (default: 0.3) */
  temperature?: number;
  /** Maximum tokens in the response (default: 4096) */
  maxTokens?: number;
  /**
   * Whether to request JSON mode from OpenAI.
   * When true, sends `response_format: { type: 'json_object' }`.
   * Default: true
   */
  jsonMode?: boolean;
}

export class LLMCallError extends Error {
  public readonly phase: 'api_call' | 'empty_response' | 'json_parse' | 'validation';
  public readonly raw?: string;

  constructor(
    message: string,
    phase: LLMCallError['phase'],
    raw?: string
  ) {
    super(message);
    this.name = 'LLMCallError';
    this.phase = phase;
    this.raw = raw;
  }
}

// =============================================================================
// Main Function
// =============================================================================

/**
 * Call an LLM, parse the JSON response, and validate it against a Zod schema.
 *
 * This consolidates the repeated pattern of:
 *   1. `getOpenAI().chat.completions.create(...)` with system + user messages
 *   2. Extract `choices[0].message.content`
 *   3. `JSON.parse(content)`
 *   4. Validate the parsed object
 *   5. Return a fully-typed result
 *
 * @throws {LLMCallError} with `phase` indicating where the failure occurred
 */
export async function callLLMAndParse<T>(options: CallLLMOptions<T>): Promise<T> {
  const {
    model = 'gpt-4o',
    systemPrompt,
    userPrompt,
    schema,
    temperature = 0.3,
    maxTokens = 4096,
    jsonMode = true,
  } = options;

  // Step 1: Call the LLM
  let content: string | null;
  try {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
      ...(jsonMode && { response_format: { type: 'json_object' as const } }),
    });

    content = response.choices[0]?.message?.content ?? null;
  } catch (error) {
    throw new LLMCallError(
      `OpenAI API call failed: ${error instanceof Error ? error.message : String(error)}`,
      'api_call'
    );
  }

  // Step 2: Check for empty response
  if (!content) {
    throw new LLMCallError('No response from LLM', 'empty_response');
  }

  // Step 3: Parse JSON from the response
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new LLMCallError(
      'Failed to parse LLM response as JSON',
      'json_parse',
      content
    );
  }

  // Step 4: Validate with Zod schema
  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new LLMCallError(
      `LLM response does not match expected schema: ${result.error.message}`,
      'validation',
      content
    );
  }

  return result.data;
}

// =============================================================================
// Convenience: Plain text (non-JSON) LLM call
// =============================================================================

export interface CallLLMTextOptions {
  /** OpenAI model to use (default: 'gpt-4o') */
  model?: string;
  /** System prompt setting the LLM's role and instructions */
  systemPrompt: string;
  /** User prompt with the actual request / data */
  userPrompt: string;
  /** Sampling temperature (default: 0.7) */
  temperature?: number;
  /** Maximum tokens in the response (default: 4096) */
  maxTokens?: number;
}

/**
 * Call an LLM and return the raw text response (no JSON parsing or validation).
 *
 * Useful for callers like generate-demo-script that return plain text
 * (e.g., screenplay content) rather than structured JSON.
 *
 * @throws {LLMCallError} with `phase` indicating where the failure occurred
 */
export async function callLLMText(options: CallLLMTextOptions): Promise<string> {
  const {
    model = 'gpt-4o',
    systemPrompt,
    userPrompt,
    temperature = 0.7,
    maxTokens = 4096,
  } = options;

  let content: string | null;
  try {
    const response = await getOpenAI().chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      max_tokens: maxTokens,
    });

    content = response.choices[0]?.message?.content ?? null;
  } catch (error) {
    throw new LLMCallError(
      `OpenAI API call failed: ${error instanceof Error ? error.message : String(error)}`,
      'api_call'
    );
  }

  if (!content) {
    throw new LLMCallError('No response from LLM', 'empty_response');
  }

  return content.trim();
}
