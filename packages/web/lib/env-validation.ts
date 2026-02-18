/**
 * Environment Variable Validation
 *
 * Validates required and optional environment variables at startup.
 * Uses Zod for schema validation with descriptive error messages.
 */

import { z } from 'zod';

// =============================================================================
// Schema
// =============================================================================

const requiredEnvSchema = z.object({
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required for database connectivity'),
  CLERK_SECRET_KEY: z.string().min(1, 'CLERK_SECRET_KEY is required for authentication'),
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: z.string().min(1, 'NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is required for authentication'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required for LLM operations'),
  STRIPE_SECRET_KEY: z.string().min(1, 'STRIPE_SECRET_KEY is required for payment processing'),
  ELEVENLABS_API_KEY: z.string().min(1, 'ELEVENLABS_API_KEY is required for text-to-speech'),
  ORCHESTRATOR_URL: z.string().url('ORCHESTRATOR_URL must be a valid URL'),
});

const optionalEnvVars: { name: string; description: string }[] = [
  { name: 'STRIPE_WEBHOOK_SECRET', description: 'Stripe webhook signature verification' },
  { name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY', description: 'Stripe client-side key' },
  { name: 'SERVICE_SECRET_KEY', description: 'Inter-service authentication key' },
  { name: 'SENTRY_DSN', description: 'Sentry error tracking' },
  { name: 'GROQ_API_KEY', description: 'Groq LLM fallback' },
  { name: 'AUDIO_OUTPUT_DIR', description: 'Local audio output directory' },
  { name: 'STORAGE_BUCKET_URL', description: 'Remote storage bucket URL' },
];

// =============================================================================
// Validation Function
// =============================================================================

/**
 * Validate environment variables at startup.
 *
 * - Errors for missing required variables (logged but does not throw to avoid
 *   breaking the app during build/preview where env vars may not be set).
 * - Warnings for missing optional variables.
 */
export function validateEnv(): { valid: boolean; errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate required env vars
  const result = requiredEnvSchema.safeParse(process.env);

  if (!result.success) {
    for (const issue of result.error.issues) {
      errors.push(`${issue.path.join('.')}: ${issue.message}`);
    }
  }

  // Check optional env vars
  for (const { name, description } of optionalEnvVars) {
    if (!process.env[name]) {
      warnings.push(`${name} is not set (${description})`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
