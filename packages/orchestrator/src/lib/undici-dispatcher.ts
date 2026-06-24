/**
 * Global undici dispatcher with bumped timeouts for long LLM streams.
 *
 * Node's default fetch (undici) ships with `headersTimeout` and `bodyTimeout`
 * both set to 300_000 ms (5 min). That's fine for most calls — but Claude
 * Sonnet on a 100+ page director prompt routinely takes longer than 5 min
 * just to *start* sending response headers (the model "thinks" before
 * streaming). When undici hits its timeout, the connection aborts with
 * "Headers Timeout Error" / "Cannot connect to API" — surfaced upstream
 * as a generic "Script parsing failed" with no actionable signal.
 *
 * Ryan's 77-page script on 2026-06-24 spent ~95 min across 3 retries × 3
 * internal retries, every attempt dying at ~26 min on this exact timeout.
 *
 * Bumping the dispatcher to 15 min global is safe because:
 *   - TTS calls (audio.ts:36) use their own 30 s AbortController which
 *     takes precedence over the dispatcher timeout
 *   - Inter-service SSE (orchestrate, generate-scenes, analyze, preview,
 *     stitch-segments) flushes headers immediately, so neither timer is
 *     load-bearing on those paths
 *   - The AI SDK has its own retry / abort hooks — anything that wants to
 *     fail faster can still do so via AbortSignal
 *
 * Must be imported BEFORE any module that constructs a fetch-using client
 * (AI SDK providers, http clients) so they see the global dispatcher when
 * they capture their reference to fetch.
 */

import { Agent, setGlobalDispatcher } from 'undici';

function readMsEnv(name: string, fallbackMs: number): number {
  const raw = process.env[name];
  if (!raw) return fallbackMs;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallbackMs;
  return parsed;
}

const HEADERS_TIMEOUT_MS = readMsEnv('LLM_HEADERS_TIMEOUT_MS', 900_000); // 15 min
const BODY_TIMEOUT_MS = readMsEnv('LLM_BODY_TIMEOUT_MS', 900_000);       // 15 min
const KEEP_ALIVE_TIMEOUT_MS = readMsEnv('LLM_KEEP_ALIVE_TIMEOUT_MS', 60_000);

setGlobalDispatcher(
  new Agent({
    headersTimeout: HEADERS_TIMEOUT_MS,
    bodyTimeout: BODY_TIMEOUT_MS,
    keepAliveTimeout: KEEP_ALIVE_TIMEOUT_MS,
    // Default 5; bump slightly to handle bursts when many parallel TTS or
    // LLM calls hit the same host. Anthropic / OpenAI / Groq each get a
    // pool — this is per-origin.
    connections: 16,
  }),
);

// Re-export so consumers can detect that the side effect has run
// (mostly useful for tests that want to assert ordering).
export const undiciDispatcherInitialized = true;
export const UNDICI_HEADERS_TIMEOUT_MS = HEADERS_TIMEOUT_MS;
export const UNDICI_BODY_TIMEOUT_MS = BODY_TIMEOUT_MS;
