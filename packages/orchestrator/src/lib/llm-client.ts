/**
 * LLM Client - Vercel AI SDK v6 wrapper (Multi-Provider Support)
 *
 * Provides a unified interface for LLM inference supporting:
 * - OpenAI (GPT-4, GPT-4.1, GPT-4o)
 * - Anthropic (Claude 3.5, Claude Sonnet 4.6)
 * - Google (Gemini 1.5 Pro, Gemini 2.0 Flash)
 * - Groq (Llama 3.3 70B)
 *
 * Model string format: "provider/model-name"
 * Examples:
 *   - "openai/gpt-4.1"
 *   - "anthropic/claude-sonnet-4-6"
 *   - "anthropic/claude-3-5-sonnet-20241022"
 *   - "google/gemini-1.5-pro"
 *   - "groq/llama-3.3-70b-versatile"
 *
 * Auto-failover: runAgentLoop and generateStructuredOutput will automatically
 * retry with a fallback provider if the primary fails due to billing exhaustion,
 * rate-limiting, or provider overload. Claude is always preferred; OpenAI is
 * the fallback. No manual Render env var changes needed.
 */

import { generateText, generateObject, tool, type ModelMessage, type Tool, type ToolResultPart } from 'ai';
import { openai, createOpenAI } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { log } from './logger.js';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'groq' | 'openrouter';

export interface ToolDefinition {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentOptions {
  model: string;
  systemPrompt: string;
  tools?: Record<string, Tool>;
  maxTokens?: number;
  /** Override the token budget used for final-output and forced-completion passes.
   *  Defaults to Math.max(32768, maxTokens).  Set lower for models with small
   *  output windows (e.g. groq/llama → 8192). */
  maxOutputTokens?: number;
  temperature?: number;
  maxIterations?: number;
}

/**
 * Parse a model string like "openai/gpt-4.1" or "groq/llama-3.3-70b-versatile".
 *
 * Splits on the FIRST slash only, so multi-segment model ids survive intact —
 * e.g. "openrouter/openai/gpt-4.1" → { provider: "openrouter", modelName:
 * "openai/gpt-4.1" }, which is exactly the model id OpenRouter expects. A bare
 * string with no slash defaults to the openai provider.
 */
function parseModelString(modelString: string): { provider: LLMProvider; modelName: string } {
  const slash = modelString.indexOf('/');
  if (slash === -1) {
    return { provider: 'openai', modelName: modelString };
  }
  return {
    provider: modelString.slice(0, slash).toLowerCase() as LLMProvider,
    modelName: modelString.slice(slash + 1),
  };
}

/**
 * Returns the ordered failover chain for a given primary model.
 * Chain is tried left-to-right after the primary fails.
 *
 *   anthropic/* → openrouter/openai/gpt-4.1 (if key present) → openai/gpt-4.1
 *   openrouter/* → openai/gpt-4.1
 *   others       → [] (no fallback)
 *
 * OpenRouter sits between Anthropic and direct OpenAI — it uses a separate
 * billing account, so Anthropic credit exhaustion doesn't block it.
 */
export function buildFailoverChain(primaryModel: string): string[] {
  const { provider } = parseModelString(primaryModel);
  switch (provider) {
    case 'anthropic':
      return [
        ...(process.env.OPENROUTER_API_KEY ? ['openrouter/openai/gpt-4.1'] : []),
        'openai/gpt-4.1',
      ];
    case 'openrouter':
      return process.env.OPENAI_API_KEY ? ['openai/gpt-4.1'] : [];
    default:
      return [];
  }
}

/**
 * Returns true for provider-side failures we can recover from by switching
 * providers: billing exhaustion, rate limits, and transient overload.
 *
 * Returns false for client errors (400 bad request, 401 auth, context-length
 * exceeded) that would fail on any provider — those should propagate.
 */
export function isFailoverableError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;

  const msg = err.message.toLowerCase();

  // Anthropic billing / credit exhaustion
  if (msg.includes('credit balance') || msg.includes('insufficient_credits') || msg.includes('billing')) {
    return true;
  }

  // Rate limiting or transient overload (provider-agnostic phrasing)
  if (msg.includes('rate limit') || msg.includes('too many requests') || msg.includes('overloaded')) {
    return true;
  }

  // AI SDK surfaces HTTP status codes in the error message
  if (msg.includes('429') || msg.includes('529') || msg.includes('402')) {
    return true;
  }

  // AI SDK APICallError exposes statusCode as a property
  const withStatus = err as { statusCode?: number };
  if (withStatus.statusCode === 402 || withStatus.statusCode === 429 || withStatus.statusCode === 529) {
    return true;
  }

  return false;
}

/**
 * Get the appropriate model instance for Vercel AI SDK v6.
 *
 * Supported providers and environment variables:
 * - openai: OPENAI_API_KEY
 * - anthropic: ANTHROPIC_API_KEY (supports claude-sonnet-4-6 with AI SDK v6)
 * - google: GOOGLE_GENERATIVE_AI_API_KEY
 * - groq: GROQ_API_KEY
 */
function getModel(modelString: string) {
  const { provider, modelName } = parseModelString(modelString);

  switch (provider) {
    case 'anthropic':
      return anthropic(modelName);

    case 'google':
      return google(modelName);

    case 'groq': {
      const groqClient = createGroq({ apiKey: process.env.GROQ_API_KEY });
      return groqClient(modelName);
    }

    case 'openrouter': {
      // OpenAI-compatible endpoint — uses OpenRouter's unified billing.
      // HTTP-Referer is required by OpenRouter for attribution/rate-limit tiers.
      const openrouterClient = createOpenAI({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: process.env.OPENROUTER_API_KEY,
        headers: {
          'HTTP-Referer': 'https://app.storymagicapp.net',
          'X-Title': 'Story Magic',
        },
      });
      return openrouterClient(modelName);
    }

    case 'openai':
    default:
      return openai(modelName);
  }
}

/**
 * Run an agent loop with tool calling support.
 *
 * Implements the same pattern as the original agent loop:
 * 1. Send message to LLM
 * 2. If LLM returns tool calls, execute them
 * 3. Send tool results back to LLM
 * 4. Repeat until LLM returns text without tool calls
 *
 * Automatically fails over to the fallback provider (OpenAI) if the primary
 * (Anthropic) rejects the request due to billing exhaustion, rate-limiting,
 * or transient overload. The full loop restarts from scratch — safe because
 * billing errors fire before any real LLM work is done (processing_time < 1s).
 */
export async function runAgentLoop(
  userInput: string,
  options: AgentOptions,
): Promise<string> {
  const chain = [options.model, ...buildFailoverChain(options.model)];

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const isRetry = i > 0;
    const isLast = i === chain.length - 1;

    if (isRetry) {
      log.warn('[LLM] runAgentLoop — failing over', {
        from: chain[i - 1],
        to: model,
        attempt: i + 1,
        chainLength: chain.length,
      });
    }

    try {
      return await runAgentLoopCore(userInput, { ...options, model });
    } catch (err) {
      if (isLast || !isFailoverableError(err)) {
        throw err;
      }
      log.warn('[LLM] runAgentLoop — provider rejected, trying next in chain', {
        model,
        reason: err instanceof Error ? err.message.slice(0, 120) : String(err),
        next: chain[i + 1],
      });
    }
  }

  // Unreachable — chain always has at least one element, and last always rethrows
  throw new Error('[LLM] Failover chain exhausted without result');
}

/**
 * Core agent loop implementation — single provider, no failover.
 * Called by runAgentLoop (with failover) and should not be exported.
 */
async function runAgentLoopCore(
  userInput: string,
  options: AgentOptions,
): Promise<string> {
  const {
    model,
    systemPrompt,
    tools = {},
    maxTokens = 16384,
    temperature = 1,
    maxIterations = 20,
  } = options;

  // For JSON-output passes (force-completion and final), use a larger token
  // budget so large screenplay JSON is not truncated.
  // Callers can pass maxOutputTokens to lower this for models with small output
  // windows (e.g. groq/llama capped at 8192).
  const MAX_OUTPUT_TOKENS = options.maxOutputTokens ?? Math.max(32768, maxTokens);

  const messages: ModelMessage[] = [{ role: 'user', content: userInput }];
  const loopStart = Date.now();
  let totalToolCalls = 0;

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    const iterElapsed = Math.round((Date.now() - loopStart) / 1000);
    log.info('[LLM] iteration', { iteration: iteration + 1, maxIterations, elapsedSec: iterElapsed, totalToolCalls });

    // Two iterations before the limit: inject a force-completion message so the
    // model stops calling tools and emits its final JSON output.
    const isOutputIteration = iteration >= maxIterations - 2 && totalToolCalls > 0;
    if (iteration === maxIterations - 2 && totalToolCalls > 0) {
      log.warn('[LLM] approaching iteration limit — injecting force-completion prompt', { iteration: iteration + 1 });
      messages.push({
        role: 'user',
        content:
          'CRITICAL: You have nearly exhausted your available iterations. ' +
          'You MUST immediately output your complete final JSON object. ' +
          'Do NOT call any more tools. Output ONLY the raw JSON — no prose, no markdown.',
      });
    }

    try {
      const result = await generateText({
        model: getModel(model),
        system: systemPrompt,
        messages,
        tools,
        // Use the expanded token budget for output iterations so large JSON is not truncated.
        maxOutputTokens: isOutputIteration ? MAX_OUTPUT_TOKENS : maxTokens,
        temperature,
      });

      const usage = result.usage;

      if (!result.toolCalls || result.toolCalls.length === 0) {
        log.info('[LLM] completed — final text received', {
          iteration: iteration + 1,
          textLength: result.text.length,
          finishReason: result.finishReason,
          totalTokens: usage?.totalTokens,
          elapsedSec: Math.round((Date.now() - loopStart) / 1000),
        });
        return result.text;
      }

      const toolNames = result.toolCalls.map((tc) => tc.toolName);
      totalToolCalls += result.toolCalls.length;
      log.info('[LLM] tool calls', {
        iteration: iteration + 1,
        count: result.toolCalls.length,
        tools: toolNames,
        totalTokens: usage?.totalTokens,
      });

      // Add assistant message with tool calls (v6: input field instead of args)
      messages.push({
        role: 'assistant',
        content: result.toolCalls.map((tc) => ({
          type: 'tool-call' as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          input: tc.input,
        })),
      });

      // Execute each tool call and collect results
      const toolResults: ToolResultPart[] = [];

      for (const toolCall of result.toolCalls) {
        const toolName = toolCall.toolName;
        const toolInput = toolCall.input as Record<string, unknown>;

        log.info('[LLM] executing tool', { toolName, query: (toolInput.query as string | undefined)?.slice(0, 80) });

        const toolDef = tools[toolName] as Tool | undefined;
        if (!toolDef) {
          log.error('LLM unknown tool', undefined, { toolName });
          toolResults.push({
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName,
            output: { type: 'json', value: { error: `Unknown tool: ${toolName}` } },
          });
          continue;
        }

        try {
          const toolResult = await toolDef.execute!(toolInput, {
            toolCallId: toolCall.toolCallId,
            messages: [],
            abortSignal: undefined as unknown as AbortSignal,
          });
          log.info('[LLM] tool result', { toolName, resultPreview: JSON.stringify(toolResult).slice(0, 150) });

          toolResults.push({
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName,
            output: { type: 'json' as const, value: toolResult as Parameters<typeof JSON.parse>[0] },
          });
        } catch (err) {
          log.error('LLM tool execution error', err instanceof Error ? err : undefined, { toolName });
          toolResults.push({
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName,
            output: { type: 'json', value: { error: err instanceof Error ? err.message : 'Unknown error' } },
          });
        }
      }

      // Add tool results (v6: output field instead of result)
      messages.push({
        role: 'tool',
        content: toolResults,
      });
    } catch (err) {
      log.error('LLM error in iteration', err instanceof Error ? err : undefined, { iteration: iteration + 1 });
      throw err;
    }
  }

  // Max iterations exhausted. The last message in the array is tool results (an array),
  // not a string. Do one final generation pass with NO tools to force text output.
  log.warn('[LLM] max iterations reached — forcing final generation without tools', {
    maxIterations,
    totalToolCalls,
    elapsedSec: Math.round((Date.now() - loopStart) / 1000),
  });

  messages.push({
    role: 'user',
    content:
      'FINAL INSTRUCTION: Output your complete JSON object now. No more tool calls. Raw JSON only.',
  });

  try {
    const finalResult = await generateText({
      model: getModel(model),
      system: systemPrompt,
      messages,
      // No tools — forces pure text response. Use full token budget so
      // large script JSON is not truncated.
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: 0,
    });

    log.info('[LLM] forced final output', {
      textLength: finalResult.text.length,
      finishReason: finalResult.finishReason,
      totalTokens: finalResult.usage?.totalTokens,
    });

    return finalResult.text;
  } catch (err) {
    log.error('[LLM] forced final generation failed', err instanceof Error ? err : undefined);
    return '';
  }
}

/**
 * Generate a structured object using Zod schema enforcement.
 *
 * Uses the AI SDK's native structured output feature which guarantees
 * valid JSON output matching the provided schema.
 *
 * Auto-fails over to OpenAI if the primary (Anthropic) provider rejects
 * due to billing exhaustion, rate-limiting, or transient overload.
 */
export async function generateStructuredOutput<T>(
  prompt: string,
  options: {
    model: string;
    schema: z.ZodSchema<T>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<T> {
  const run = async (model: string) =>
    generateObject({
      model: getModel(model),
      schema: options.schema,
      system: options.systemPrompt,
      prompt,
      maxOutputTokens: options.maxTokens || 8192,
      temperature: options.temperature || 0.7,
    });

  const chain = [options.model, ...buildFailoverChain(options.model)];

  for (let i = 0; i < chain.length; i++) {
    const model = chain[i];
    const isRetry = i > 0;
    const isLast = i === chain.length - 1;

    if (isRetry) {
      log.warn('[LLM] generateStructuredOutput — failing over', {
        from: chain[i - 1],
        to: model,
        attempt: i + 1,
        chainLength: chain.length,
      });
    }

    try {
      return (await run(model)).object;
    } catch (err) {
      if (isLast || !isFailoverableError(err)) {
        throw err;
      }
      log.warn('[LLM] generateStructuredOutput — provider rejected, trying next in chain', {
        model,
        reason: err instanceof Error ? err.message.slice(0, 120) : String(err),
        next: chain[i + 1],
      });
    }
  }

  // Unreachable — chain always has at least one element, and last always rethrows
  throw new Error('[LLM] Failover chain exhausted without result');
}

/**
 * Convert raw LLM text output to structured JSON using a second pass.
 */
export async function structureTextAsJSON<T>(
  rawText: string,
  options: {
    model?: string;
    schema: z.ZodSchema<T>;
    context?: string;
  }
): Promise<T> {
  const model = options.model || process.env.DIRECTOR_MODEL || 'openai/gpt-4.1';

  const prompt = `Convert the following text into valid JSON matching the required schema.
Extract all relevant information and format it correctly.
Only output the JSON, nothing else.

${options.context ? `Context: ${options.context}\n\n` : ''}Text to convert:
${rawText}`;

  const result = await generateObject({
    model: getModel(model),
    schema: options.schema,
    prompt,
    maxOutputTokens: 16384,
    temperature: 0,
  });

  return result.object;
}

export { tool };
