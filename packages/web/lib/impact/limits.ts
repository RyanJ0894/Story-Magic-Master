/**
 * Impact StoryBuilder — Usage limits and rate-limiting constants
 *
 * These are shared between the server (API routes) and client (UI warnings)
 * so the numbers stay in sync automatically.
 */

/** Maximum word count for the author's original story text */
export const STORY_WORD_LIMIT = 800;

/** Words at which we start showing a yellow "approaching limit" warning */
export const STORY_WORD_WARNING = 650;

/** Minimum word count before the story can be submitted */
export const STORY_WORD_MIN = 30;

/** Maximum one story creation per this many hours (per user or session) */
export const STORY_RATE_LIMIT_HOURS = 24;

/** Human-readable description of the rate limit for error messages */
export const STORY_RATE_LIMIT_LABEL = 'one story per day';

/** Count words in a string consistently (used on both client and server) */
export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}
