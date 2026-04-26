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
 */

import { generateText, generateObject, tool, type ModelMessage, type Tool, type ToolResultPart } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';
import { z } from 'zod';
import { log } from './logger.js';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'groq';

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
 * Parse a model string like "openai/gpt-4.1" or "groq/llama-3.3-70b-versatile"
 */
function parseModelString(modelString: string): { provider: LLMProvider; modelName: string } {
  const parts = modelString.split('/');
  if (parts.length !== 2) {
    return { provider: 'openai', modelName: modelString };
  }
  return { provider: parts[0].toLowerCase() as LLMProvider, modelName: parts[1] };
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
 */
export async function runAgentLoop(
  userInput: string,
  options: AgentOptions
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
 * Simple text generation without tools
 */
export async function generateSimpleText(
  prompt: string,
  options: {
    model: string;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<string> {
  const result = await generateText({
    model: getModel(options.model),
    system: options.systemPrompt,
    prompt,
    maxOutputTokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
  });

  return result.text;
}

/**
 * Generate a structured object using Zod schema enforcement.
 *
 * Uses the AI SDK's native structured output feature which guarantees
 * valid JSON output matching the provided schema.
 */
export async function generateStructuredOutput<T>(
  prompt: string,
  options: {
    model: string;
    schema: z.ZodSchema<T>;
    systemPrompt?: string;
    maxTokens?: number;
    temperature?: number;
  }
): Promise<T> {
  const result = await generateObject({
    model: getModel(options.model),
    schema: options.schema,
    system: options.systemPrompt,
    prompt,
    maxOutputTokens: options.maxTokens || 8192,
    temperature: options.temperature || 0.7,
  });

  return result.object;
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
