/**
 * LLM Client - Vercel AI SDK wrapper (Multi-Provider Support)
 *
 * Provides a unified interface for LLM inference supporting:
 * - OpenAI (GPT-4, GPT-4.1, GPT-4o)
 * - Anthropic (Claude 3.5, Claude 3 Opus/Sonnet)
 * - Google (Gemini 1.5 Pro, Gemini 2.0 Flash)
 * - Groq (Llama 3.3 70B)
 *
 * This is the TypeScript replacement for Python's LiteLLM.
 *
 * Model string format: "provider/model-name"
 * Examples:
 *   - "openai/gpt-4.1"
 *   - "anthropic/claude-3-5-sonnet-20241022"
 *   - "google/gemini-1.5-pro"
 *   - "groq/llama-3.3-70b-versatile"
 */

import { generateText, tool, CoreMessage, CoreTool, LanguageModelV1 } from 'ai';
import { openai } from '@ai-sdk/openai';
import { createGroq } from '@ai-sdk/groq';
import { anthropic } from '@ai-sdk/anthropic';
import { google } from '@ai-sdk/google';

export type LLMProvider = 'openai' | 'anthropic' | 'google' | 'groq';

export interface ToolDefinition {
  description: string;
  parameters: Record<string, unknown>;
  execute: (args: Record<string, unknown>) => Promise<unknown>;
}

export interface AgentOptions {
  model: string;
  systemPrompt: string;
  tools?: Record<string, CoreTool>;
  maxTokens?: number;
  temperature?: number;
  maxIterations?: number;
}

/**
 * Parse a model string like "openai/gpt-4.1" or "groq/llama-3.3-70b-versatile"
 */
function parseModelString(modelString: string): { provider: LLMProvider; modelName: string } {
  const parts = modelString.split('/');
  if (parts.length !== 2) {
    // Default to OpenAI if no provider specified
    return { provider: 'openai', modelName: modelString };
  }

  const provider = parts[0].toLowerCase() as LLMProvider;
  const modelName = parts[1];

  return { provider, modelName };
}

/**
 * Get the appropriate model instance for Vercel AI SDK
 *
 * Supported providers and environment variables:
 * - openai: OPENAI_API_KEY (auto-detected by @ai-sdk/openai)
 * - anthropic: ANTHROPIC_API_KEY (auto-detected by @ai-sdk/anthropic)
 * - google: GOOGLE_GENERATIVE_AI_API_KEY (auto-detected by @ai-sdk/google)
 * - groq: GROQ_API_KEY
 */
function getModel(modelString: string): LanguageModelV1 {
  const { provider, modelName } = parseModelString(modelString);

  switch (provider) {
    case 'anthropic':
      // Claude models: claude-3-5-sonnet-20241022, claude-3-opus-20240229, etc.
      return anthropic(modelName) as unknown as LanguageModelV1;

    case 'google':
      // Gemini models: gemini-1.5-pro, gemini-2.0-flash-exp, etc.
      return google(modelName) as unknown as LanguageModelV1;

    case 'groq': {
      // Groq models: llama-3.3-70b-versatile, mixtral-8x7b-32768, etc.
      const groq = createGroq({
        apiKey: process.env.GROQ_API_KEY,
      });
      return groq(modelName) as LanguageModelV1;
    }

    case 'openai':
    default:
      // OpenAI models: gpt-4.1, gpt-4o, gpt-4-turbo, etc.
      return openai(modelName) as LanguageModelV1;
  }
}

/**
 * Run an agent loop with tool calling support
 *
 * This implements the same pattern as Python's LiteLLMAgent:
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

  const messages: CoreMessage[] = [{ role: 'user', content: userInput }];

  for (let iteration = 0; iteration < maxIterations; iteration++) {
    console.log(`[LLM] Iteration ${iteration + 1}/${maxIterations}`);

    try {
      const result = await generateText({
        model: getModel(model),
        system: systemPrompt,
        messages,
        tools,
        maxTokens,
        temperature,
      });

      // If no tool calls, return the text response
      if (!result.toolCalls || result.toolCalls.length === 0) {
        console.log(`[LLM] Completed - no more tool calls`);
        return result.text;
      }

      console.log(`[LLM] Processing ${result.toolCalls.length} tool calls`);

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: result.toolCalls.map((tc) => ({
          type: 'tool-call' as const,
          toolCallId: tc.toolCallId,
          toolName: tc.toolName,
          args: tc.args,
        })),
      });

      // Execute each tool call and collect results
      const toolResults: Array<{
        type: 'tool-result';
        toolCallId: string;
        toolName: string;
        result: unknown;
      }> = [];

      for (const toolCall of result.toolCalls) {
        const toolName = toolCall.toolName;
        const toolArgs = toolCall.args as Record<string, unknown>;

        console.log(`[LLM] Calling tool: ${toolName}`, JSON.stringify(toolArgs));

        // Get the tool and execute it
        const toolDef = tools[toolName];
        if (!toolDef) {
          console.error(`[LLM] Unknown tool: ${toolName}`);
          toolResults.push({
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName,
            result: { error: `Unknown tool: ${toolName}` },
          });
          continue;
        }

        try {
          // Execute the tool
          const toolResult = await (toolDef as CoreTool).execute!(toolArgs, {
            toolCallId: toolCall.toolCallId,
            messages: [],
            abortSignal: undefined as unknown as AbortSignal,
          });
          console.log(`[LLM] Tool result:`, JSON.stringify(toolResult).slice(0, 200));

          toolResults.push({
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName,
            result: toolResult,
          });
        } catch (err) {
          console.error(`[LLM] Tool execution error:`, err);
          toolResults.push({
            type: 'tool-result',
            toolCallId: toolCall.toolCallId,
            toolName,
            result: { error: err instanceof Error ? err.message : 'Unknown error' },
          });
        }
      }

      // Add tool results to messages
      messages.push({
        role: 'tool',
        content: toolResults,
      });
    } catch (err) {
      console.error(`[LLM] Error in iteration ${iteration + 1}:`, err);
      throw err;
    }
  }

  console.warn(`[LLM] Max iterations (${maxIterations}) reached`);

  // Return whatever we have
  const lastMessage = messages[messages.length - 1];
  if (typeof lastMessage.content === 'string') {
    return lastMessage.content;
  }

  return '';
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
    maxTokens: options.maxTokens || 4096,
    temperature: options.temperature || 0.7,
  });

  return result.text;
}

export { tool };
