/**
 * Audio Scoring - Client-side scoring for audio track suggestions
 *
 * Scores audio tracks against scene context using weighted dimensions:
 *
 * | Dimension          | Music | Ambience | SFX  |
 * |--------------------|-------|----------|------|
 * | Mood match         | 0.40  | 0.30     | 0.10 |
 * | Intensity proximity| 0.25  | 0.20     | 0.10 |
 * | Style/tags match   | 0.20  | 0.20     | 0.20 |
 * | Group affinity     | 0.15  | 0.30     | 0.60 |
 *
 * SFX weights group heavily because SFX are action-driven
 * (e.g., "Fighting" group for combat scenes).
 */

import type {
  AudioTrackMetadata,
  AudioCategory,
  SceneContext,
  ScoredAudioTrack,
  MatchLabel,
} from '@/lib/types/audio';

// =============================================================================
// Scoring Weights
// =============================================================================

interface ScoringWeights {
  mood: number;
  intensity: number;
  style: number;
  group: number;
}

const WEIGHTS: Record<AudioCategory, ScoringWeights> = {
  music: { mood: 0.40, intensity: 0.25, style: 0.20, group: 0.15 },
  ambience: { mood: 0.30, intensity: 0.20, style: 0.20, group: 0.30 },
  sfx: { mood: 0.10, intensity: 0.10, style: 0.20, group: 0.60 },
};

// =============================================================================
// Match Label Thresholds
// =============================================================================

function getMatchLabel(score: number): MatchLabel {
  if (score >= 0.7) return 'Excellent';
  if (score >= 0.5) return 'Good';
  if (score >= 0.3) return 'Fair';
  return 'Low';
}

// =============================================================================
// Scoring Functions
// =============================================================================

/**
 * Score mood match (0-1)
 * Compares track mood array against scene mood and summary keywords
 */
function scoreMood(track: AudioTrackMetadata, context: SceneContext): number {
  const sceneWords = [
    context.mood || '',
    context.summary || '',
    ...(context.action_keywords || []),
  ]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (sceneWords.length === 0) return 0.3; // neutral baseline when no context

  const trackMoods = track.mood.map(m => m.toLowerCase());
  const trackTags = track.tags.map(t => t.toLowerCase());
  const allTrackWords = [...trackMoods, ...trackTags];

  let matches = 0;
  for (const word of sceneWords) {
    if (allTrackWords.some(tw => tw.includes(word) || word.includes(tw))) {
      matches++;
    }
  }

  return Math.min(1, matches / Math.max(1, sceneWords.length * 0.3));
}

/**
 * Score intensity proximity (0-1)
 * Closer intensity values score higher
 */
function scoreIntensity(track: AudioTrackMetadata, context: SceneContext): number {
  if (context.intensity === undefined || context.intensity === null) return 0.5;

  const distance = Math.abs(track.intensity - context.intensity);
  return Math.max(0, 1 - distance / 100);
}

/**
 * Score style/tags match (0-1)
 * Matches track style and tags against scene setting and keywords
 */
function scoreStyle(track: AudioTrackMetadata, context: SceneContext): number {
  const sceneWords = [
    context.setting || '',
    context.summary || '',
    ...(context.action_keywords || []),
  ]
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);

  if (sceneWords.length === 0) return 0.2;

  const trackText = `${track.style} ${track.tags.join(' ')} ${track.title}`.toLowerCase();

  let matches = 0;
  for (const word of sceneWords) {
    if (trackText.includes(word)) {
      matches++;
    }
  }

  return Math.min(1, matches / Math.max(1, sceneWords.length * 0.3));
}

/**
 * Score group affinity (0-1)
 * Matches track group against scene context keywords
 */
function scoreGroup(track: AudioTrackMetadata, context: SceneContext): number {
  const groupLower = track.group.toLowerCase();
  const contextText = [
    context.mood || '',
    context.summary || '',
    context.setting || '',
    ...(context.action_keywords || []),
  ]
    .join(' ')
    .toLowerCase();

  if (!contextText || contextText.trim().length === 0) return 0.2;

  // Direct group name match in context
  if (contextText.includes(groupLower)) return 1.0;

  // Check individual words from group name
  const groupWords = groupLower.split(/[\s,/()]+/).filter(w => w.length > 2);
  let matches = 0;
  for (const word of groupWords) {
    if (contextText.includes(word)) matches++;
  }

  if (groupWords.length > 0 && matches > 0) {
    return Math.min(1, matches / groupWords.length);
  }

  return 0;
}

// =============================================================================
// Public API
// =============================================================================

/**
 * Score a single audio track against scene context for a given category
 */
export function scoreAudioTrack(
  track: AudioTrackMetadata,
  sceneContext: SceneContext,
  category: AudioCategory
): number {
  const weights = WEIGHTS[category];

  const moodScore = scoreMood(track, sceneContext);
  const intensityScore = scoreIntensity(track, sceneContext);
  const styleScore = scoreStyle(track, sceneContext);
  const groupScore = scoreGroup(track, sceneContext);

  return (
    weights.mood * moodScore +
    weights.intensity * intensityScore +
    weights.style * styleScore +
    weights.group * groupScore
  );
}

/**
 * Score and sort all tracks for a scene context
 */
export function getScoredTracks(
  tracks: AudioTrackMetadata[],
  sceneContext: SceneContext,
  category: AudioCategory
): ScoredAudioTrack[] {
  const scored = tracks.map(track => {
    const score = scoreAudioTrack(track, sceneContext, category);
    return {
      track,
      score,
      matchLabel: getMatchLabel(score),
    };
  });

  // Sort by score descending, then alphabetically by title
  scored.sort((a, b) => {
    if (Math.abs(a.score - b.score) > 0.01) return b.score - a.score;
    return a.track.title.localeCompare(b.track.title);
  });

  return scored;
}
