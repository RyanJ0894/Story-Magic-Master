/**
 * TEST_MODE mock provider (T3-1 of cost-opt Phase 2).
 *
 * When `TEST_MODE=mock` is set, every LLM and TTS call is intercepted and
 * returned from a canned-response pool instead of going to a real provider.
 * Peter's "click test, see what happens" iteration loop runs at $0/iteration
 * — no Anthropic, no OpenAI, no ElevenLabs charges.
 *
 * What's mocked:
 *   - `runAgentLoop`            → canned director JSON or generic tool-free text
 *   - `generateStructuredOutput`→ a stub object matching the requested Zod schema
 *
 * What's NOT mocked (out of scope for this PR):
 *   - TTS (ElevenLabs) — separate concern; per-line TTS already has a strong cache
 *   - Embeddings — already L1+L2 cached; OpenAI bill on a cached query is $0 anyway
 *
 * Activation:
 *   - `TEST_MODE=mock` enables. Any other value (or unset) disables.
 *   - At startup, `printEnvSummary()` prints a loud warning so no one ships
 *     production with this flag on.
 *
 * Safety:
 *   - `assertNotInProduction()` — if `NODE_ENV=production` and
 *     `TEST_MODE=mock`, throws on first use to prevent silently shipping
 *     mock output to paying users.
 *
 * Extensibility:
 *   - Drop new fixture JSON files into
 *     `packages/orchestrator/test-fixtures/canned-responses/` named after
 *     the input hash; mock provider picks them up automatically. Falls
 *     back to a generic stub when no fixture matches.
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { log } from './logger.js';

const FIXTURE_DIR = path.join(process.cwd(), 'test-fixtures', 'canned-responses');

export function isMockModeEnabled(): boolean {
  return process.env.TEST_MODE === 'mock';
}

/**
 * Hard stop on shipping mock output to production. Called from the bypass
 * paths so a misconfigured deploy throws immediately instead of returning
 * garbage to real users.
 */
export function assertNotInProduction(): void {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'TEST_MODE=mock cannot be enabled in NODE_ENV=production. ' +
        'Either unset TEST_MODE on the Render service, or change NODE_ENV. ' +
        'This guard exists so mock output never reaches paying users.',
    );
  }
}

/**
 * Hash the request payload (first 1KB is sufficient — director prompts have a
 * stable prefix per script). The hash is the fixture lookup key, so the same
 * test script always gets the same canned response.
 */
function hashRequest(payload: string): string {
  return crypto.createHash('sha256').update(payload.slice(0, 1024)).digest('hex').slice(0, 16);
}

/**
 * Closed set of fixture categories — any other value is rejected. Adding a
 * new category is an explicit code change here, which is the whole point of
 * the allowlist: the caller-supplied `operation` argument can never widen
 * the filesystem surface beyond this list.
 */
const ALLOWED_OPERATIONS = ['agent', 'structured'] as const;
type FixtureOperation = (typeof ALLOWED_OPERATIONS)[number];

/**
 * SHA-256 hex output — always 64 lowercase hex characters. We slice to 16 in
 * `hashRequest`, so 16 hex chars. Anything outside that pattern means the
 * caller is doing something other than a hash, which is suspicious.
 */
const HEX_HASH_RE = /^[a-f0-9]{1,64}$/;

/**
 * Try to load a fixture JSON file matching `requestHash`. Returns null on
 * miss; caller falls through to a generic stub.
 *
 * Defense in depth: even though the only callers in this file pass literal
 * `operation` strings and SHA-256-derived `requestHash` strings (no user
 * input reaches here), we still enforce an allowlist + hex-only pattern so
 * a future refactor can't accidentally wire user input into the filesystem.
 */
function tryLoadFixture(operation: FixtureOperation, requestHash: string): unknown | null {
  // Belt-and-suspenders: TypeScript already restricts `operation` to the
  // literal union, but the runtime check protects against `as any` callers.
  if (!ALLOWED_OPERATIONS.includes(operation)) return null;
  if (!HEX_HASH_RE.test(requestHash)) return null;

  // Both inputs are validated immediately above:
  //   - `operation` is constrained to the ALLOWED_OPERATIONS literal union
  //   - `requestHash` matches /^[a-f0-9]{1,64}$/ which cannot contain
  //     path separators (/, \) or traversal sequences (..)
  // The path.join call below is therefore safe from CWE-22.
  const fixturePath = path.join(FIXTURE_DIR, operation, `${requestHash}.json`); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal
  if (!fs.existsSync(fixturePath)) return null;
  try {
    const raw = fs.readFileSync(fixturePath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    log.warn('[mock-provider] failed to parse fixture; using generic stub', {
      fixturePath,
      err: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/**
 * Return a string response for `runAgentLoop` in mock mode.
 *
 * If a fixture exists for the request hash, returns its serialized form.
 * Otherwise returns a generic "no tool calls, here's some JSON" stub that
 * downstream JSON parsers should accept.
 */
export function mockAgentResponse(userInput: string, _systemPrompt: string): string {
  assertNotInProduction();
  const requestHash = hashRequest(userInput);
  const fixture = tryLoadFixture('agent', requestHash);

  if (fixture) {
    log.info('[mock-provider] agent fixture HIT', { requestHash });
    return typeof fixture === 'string' ? fixture : JSON.stringify(fixture);
  }

  log.warn('[mock-provider] agent fixture MISS — returning generic stub', {
    requestHash,
    inputPreview: userInput.slice(0, 80),
    hint: `Drop a fixture at test-fixtures/canned-responses/agent/${requestHash}.json to capture this case.`,
  });

  // Generic stub: empty director-style JSON. Downstream consumers should
  // tolerate it because mock mode is for clicking through the UI, not
  // verifying output correctness.
  return JSON.stringify({
    project_id: 'mock-project-id',
    scenes: [],
    _mock: true,
    _mockNote: 'Generic stub from mock-provider. Add a fixture for this request hash.',
  });
}

/**
 * Build a default value for any Zod schema. Walks the schema tree and
 * returns the most reasonable empty/default value for each branch. Used
 * for `generateStructuredOutput` in mock mode when no fixture matches.
 *
 * This is deliberately heuristic — mock mode is for UI iteration, not
 * correctness verification. Some schemas may need a fixture for the
 * stub to round-trip through Zod parsing.
 */
function stubValueFor(schema: z.ZodType): unknown {
  // The Zod public API doesn't expose the type tag uniformly across v3
  // generations. We read `_def.typeName` defensively.
  const def = (schema as unknown as { _def?: { typeName?: string } })._def;
  const typeName = def?.typeName ?? 'unknown';

  switch (typeName) {
    case 'ZodString':
      return 'mock-string';
    case 'ZodNumber':
      return 0;
    case 'ZodBoolean':
      return false;
    case 'ZodArray':
      return [];
    case 'ZodNull':
      return null;
    case 'ZodOptional':
    case 'ZodNullable': {
      // Unwrap and recurse — but for optional/nullable on top-level fields,
      // we can also just return undefined / null.
      return undefined;
    }
    case 'ZodObject': {
      const shape = (def as { shape?: () => Record<string, z.ZodType> } | undefined)?.shape?.() ?? {};
      const obj: Record<string, unknown> = {};
      for (const key of Object.keys(shape)) {
        obj[key] = stubValueFor(shape[key]);
      }
      return obj;
    }
    case 'ZodEnum': {
      const values = (def as { values?: readonly string[] } | undefined)?.values ?? [];
      return values[0] ?? 'mock-enum';
    }
    default:
      // Best effort — return undefined and hope the consumer treats it as
      // optional, or fall back to an empty object.
      return undefined;
  }
}

/**
 * Return a structured object response for `generateStructuredOutput` in
 * mock mode. Tries a fixture first; falls back to a Zod-walked stub.
 */
export function mockStructuredResponse<T>(
  prompt: string,
  schema: z.ZodType<T>,
): T {
  assertNotInProduction();
  const requestHash = hashRequest(prompt);
  const fixture = tryLoadFixture('structured', requestHash);

  if (fixture) {
    log.info('[mock-provider] structured fixture HIT', { requestHash });
    // Validate against the schema so a stale fixture surfaces as a test
    // failure instead of a silent type mismatch downstream.
    const validated = schema.safeParse(fixture);
    if (validated.success) return validated.data;
    log.warn('[mock-provider] structured fixture failed schema validation', {
      requestHash,
      issues: validated.error.flatten(),
    });
  }

  log.warn('[mock-provider] structured fixture MISS — returning Zod-walked stub', {
    requestHash,
    hint: `Drop a fixture at test-fixtures/canned-responses/structured/${requestHash}.json.`,
  });

  const stub = stubValueFor(schema);
  // Re-validate to surface broken stubs as a clear error early.
  const validated = schema.safeParse(stub);
  if (validated.success) return validated.data;
  log.error('[mock-provider] Zod-walked stub does not satisfy the schema', undefined, {
    requestHash,
    issues: validated.error.flatten(),
  });
  // Last resort: return the unparsed stub. Caller may crash later, but that
  // crash points at the missing fixture which is exactly the right signal.
  return stub as T;
}
