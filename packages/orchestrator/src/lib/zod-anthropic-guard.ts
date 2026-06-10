/**
 * Anthropic-compatibility guard for Zod schemas (T3-6 of cost-opt Phase 2).
 *
 * Anthropic's structured-output API rejects JSON Schema constraints like
 * `minimum`, `maximum`, `minLength`, `maxLength`, `minItems`, `maxItems`,
 * `pattern`. When a Zod schema with `.min()` / `.max()` / etc. is passed to
 * `generateObject` or `generateStructuredOutput`, the AI SDK translates
 * those checks into JSON Schema and Anthropic 400s the call.
 *
 * PR #178 had to chase this bug across four schemas at the same time. This
 * module exists so the next regression is caught by a unit test the moment
 * someone reintroduces the pattern, instead of in Peter's testing logs.
 *
 * Walks a Zod schema recursively and returns every offending constraint
 * with its path. Returns an empty array when the schema is Anthropic-safe.
 */

import type { ZodTypeAny } from 'zod';

export interface ForbiddenConstraint {
  /** Dotted path to the schema node — `scenes.0.dialogue.text`, etc. */
  path: string;
  /** The Zod check kind that produces a forbidden JSON Schema constraint. */
  kind: string;
  /** The constrained value, when relevant. */
  value?: unknown;
  /** Human-readable hint about why this is rejected. */
  reason: string;
}

const FORBIDDEN_STRING_CHECKS = new Set([
  'min',     // → minLength
  'max',     // → maxLength
  'length',  // → minLength + maxLength
  'regex',   // → pattern
  'startsWith',
  'endsWith',
  'includes',
]);

const FORBIDDEN_NUMBER_CHECKS = new Set([
  'min',          // → minimum
  'max',          // → maximum
  'multipleOf',   // → multipleOf (also rejected)
]);

const FORBIDDEN_ARRAY_PROPS = new Set([
  'minLength',  // _def.minLength → minItems
  'maxLength',  // _def.maxLength → maxItems
]);

/**
 * Recursively walk a Zod schema and collect forbidden constraints. The
 * implementation reads `_def` directly because zod-to-json-schema is not
 * a dep and would be overkill — we just need to find leaves with the
 * wrong kind of constraint.
 */
export function findForbiddenConstraints(
  schema: ZodTypeAny,
  pathSoFar: string = '$',
): ForbiddenConstraint[] {
  const def = (schema as unknown as { _def?: Record<string, unknown> })._def;
  if (!def) return [];

  const typeName = String(def.typeName ?? '');
  const findings: ForbiddenConstraint[] = [];

  switch (typeName) {
    case 'ZodString': {
      const checks = (def.checks as Array<{ kind: string; value?: unknown }>) ?? [];
      for (const c of checks) {
        if (FORBIDDEN_STRING_CHECKS.has(c.kind)) {
          findings.push({
            path: pathSoFar,
            kind: `string.${c.kind}`,
            value: c.value,
            reason: `.${c.kind}() on z.string() → translates to JSON Schema "${stringCheckTo(c.kind)}" which Anthropic rejects`,
          });
        }
      }
      break;
    }

    case 'ZodNumber': {
      const checks = (def.checks as Array<{ kind: string; value?: unknown }>) ?? [];
      for (const c of checks) {
        if (FORBIDDEN_NUMBER_CHECKS.has(c.kind)) {
          findings.push({
            path: pathSoFar,
            kind: `number.${c.kind}`,
            value: c.value,
            reason: `.${c.kind}() on z.number() → JSON Schema "${numberCheckTo(c.kind)}" which Anthropic rejects`,
          });
        }
      }
      break;
    }

    case 'ZodArray': {
      // Array element constraints
      const inner = def.type as ZodTypeAny | undefined;
      if (inner) {
        findings.push(...findForbiddenConstraints(inner, `${pathSoFar}.<item>`));
      }
      // Array length constraints (.min(), .max(), .nonempty())
      for (const prop of FORBIDDEN_ARRAY_PROPS) {
        if (def[prop] != null) {
          findings.push({
            path: pathSoFar,
            kind: `array.${prop}`,
            value: (def[prop] as { value?: unknown })?.value,
            reason: `.${prop === 'minLength' ? 'min/nonempty' : 'max'}() on z.array() → minItems/maxItems which Anthropic rejects`,
          });
        }
      }
      // `.nonempty()` shorthand stores `minLength: { value: 1 }` — caught above.
      break;
    }

    case 'ZodObject': {
      // Walk every property in the shape.
      const shape = (def.shape as (() => Record<string, ZodTypeAny>) | undefined)?.();
      if (shape) {
        for (const [key, sub] of Object.entries(shape)) {
          findings.push(...findForbiddenConstraints(sub, `${pathSoFar}.${key}`));
        }
      }
      break;
    }

    case 'ZodOptional':
    case 'ZodNullable':
    case 'ZodDefault':
    case 'ZodReadonly':
    case 'ZodEffects':
    case 'ZodBranded': {
      // Wrapper types — unwrap and recurse.
      const inner = def.innerType as ZodTypeAny | undefined;
      if (inner) findings.push(...findForbiddenConstraints(inner, pathSoFar));
      // ZodEffects also has `schema` on some Zod versions.
      const alt = (def as { schema?: ZodTypeAny }).schema;
      if (alt) findings.push(...findForbiddenConstraints(alt, pathSoFar));
      break;
    }

    case 'ZodUnion':
    case 'ZodDiscriminatedUnion': {
      const opts = def.options as ZodTypeAny[] | undefined;
      if (opts) {
        opts.forEach((opt, i) =>
          findings.push(...findForbiddenConstraints(opt, `${pathSoFar}.<union[${i}]>`)),
        );
      }
      break;
    }

    case 'ZodIntersection': {
      const left = def.left as ZodTypeAny | undefined;
      const right = def.right as ZodTypeAny | undefined;
      if (left) findings.push(...findForbiddenConstraints(left, `${pathSoFar}.<left>`));
      if (right) findings.push(...findForbiddenConstraints(right, `${pathSoFar}.<right>`));
      break;
    }

    case 'ZodRecord': {
      const value = def.valueType as ZodTypeAny | undefined;
      if (value) findings.push(...findForbiddenConstraints(value, `${pathSoFar}.<value>`));
      break;
    }

    // Leaves with no possible forbidden constraints: ZodBoolean, ZodEnum,
    // ZodLiteral, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodNull, ZodUndefined.
    default:
      break;
  }

  return findings;
}

function stringCheckTo(kind: string): string {
  switch (kind) {
    case 'min':
    case 'length':
      return 'minLength';
    case 'max':
      return 'maxLength';
    case 'regex':
      return 'pattern';
    default:
      return kind;
  }
}

function numberCheckTo(kind: string): string {
  switch (kind) {
    case 'min':
      return 'minimum';
    case 'max':
      return 'maximum';
    default:
      return kind;
  }
}
