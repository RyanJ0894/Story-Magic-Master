/**
 * Feature Flag System
 *
 * Protects current functionality while enabling incremental rollout of new features.
 *
 * Usage:
 *   import { isFeatureEnabled, FeatureFlag } from '@/lib/features/flags';
 *
 *   if (isFeatureEnabled('STORY_SCORE')) {
 *     // render StoryScore component
 *   }
 *
 * Environment Variables:
 *   NEXT_PUBLIC_FF_STORY_SCORE=true
 *   NEXT_PUBLIC_FF_STORY_ADVISER=true
 *   etc.
 */

// =============================================================================
// Feature Definitions
// =============================================================================

// Feature definition type
interface FeatureDefinition {
  key: string;
  name: string;
  description: string;
  defaultEnabled: boolean;
  dependsOn?: readonly string[];
  phase: number;
}

export const FEATURES: Record<string, FeatureDefinition> = {
  // StoryScore - 12-dimension script evaluation
  STORY_SCORE: {
    key: 'STORY_SCORE',
    name: 'StoryScore',
    description: 'AI-powered 12-dimension screenplay evaluation',
    defaultEnabled: true,
    phase: 1,
  },

  // Story-Adviser - Inline suggestions
  STORY_ADVISER: {
    key: 'STORY_ADVISER',
    name: 'Story-Adviser',
    description: 'Inline suggestions with AI rewrites',
    defaultEnabled: true,
    dependsOn: ['STORY_SCORE'], // Requires StoryScore
    phase: 2,
  },

  // Revision tracking
  REVISION_TRACKING: {
    key: 'REVISION_TRACKING',
    name: 'Revision Tracking',
    description: 'Track script versions and score trajectory',
    defaultEnabled: true,
    dependsOn: ['STORY_SCORE'],
    phase: 2,
  },

  // Script editor (advanced)
  SCRIPT_EDITOR: {
    key: 'SCRIPT_EDITOR',
    name: 'Script Editor',
    description: 'In-app script editing with CodeMirror',
    defaultEnabled: true,
    dependsOn: ['STORY_ADVISER'],
    phase: 2,
  },

  // Comparable scripts (requires corpus)
  COMPARABLE_SCRIPTS: {
    key: 'COMPARABLE_SCRIPTS',
    name: 'Comparable Scripts',
    description: 'Find similar scripts in corpus',
    defaultEnabled: true,
    dependsOn: ['STORY_SCORE'],
    phase: 3,
  },

  // Export reports
  EXPORT_REPORTS: {
    key: 'EXPORT_REPORTS',
    name: 'Export Reports',
    description: 'PDF export of StoryScore reports',
    defaultEnabled: true,
    dependsOn: ['STORY_SCORE'],
    phase: 3,
  },

  // Story Explorer - interactive graph visualization
  STORY_EXPLORER: {
    key: 'STORY_EXPLORER',
    name: 'Story Explorer',
    description: 'Interactive scene flow and character network visualization',
    defaultEnabled: true,
    phase: 2,
  },

  // Impact StoryBuilder - guided wizard for personal story audio production
  IMPACT_STORYBUILDER: {
    key: 'IMPACT_STORYBUILDER',
    name: 'Impact StoryBuilder',
    description: 'Guided wizard helping trauma survivors tell their story through AI-voiced audio',
    defaultEnabled: true,
    phase: 4,
  },

  // Impact Gallery - public gallery of shared impact stories
  IMPACT_GALLERY: {
    key: 'IMPACT_GALLERY',
    name: 'Impact Gallery',
    description: 'Public gallery of community impact stories',
    defaultEnabled: true,
    dependsOn: ['IMPACT_STORYBUILDER'],
    phase: 4,
  },

  // Impact Partners - corporate partner program pages
  IMPACT_PARTNERS: {
    key: 'IMPACT_PARTNERS',
    name: 'Impact Partners',
    description: 'Corporate partner program with tiered sponsorship',
    defaultEnabled: true,
    phase: 4,
  },
};

export type FeatureKey = 'STORY_SCORE' | 'STORY_ADVISER' | 'REVISION_TRACKING' | 'SCRIPT_EDITOR' | 'COMPARABLE_SCRIPTS' | 'EXPORT_REPORTS' | 'STORY_EXPLORER' | 'IMPACT_STORYBUILDER' | 'IMPACT_GALLERY' | 'IMPACT_PARTNERS';

// =============================================================================
// Feature Flag Checking
// =============================================================================

/**
 * Check if a feature is enabled.
 *
 * Priority:
 * 1. Environment variable (NEXT_PUBLIC_FF_<KEY>=true/false)
 * 2. Default value from feature definition
 *
 * Intentionally deterministic — same result on server and client — to prevent
 * React hydration mismatches. Do not add typeof-window branches here.
 * To override flags in development, set NEXT_PUBLIC_FF_<KEY>=false/.env.local.
 */
export function isFeatureEnabled(key: FeatureKey): boolean {
  const feature = FEATURES[key];
  if (!feature) return false;

  // 1. Check environment variable
  const envKey = `NEXT_PUBLIC_FF_${key}`;
  const envValue = process.env[envKey];

  if (envValue !== undefined) {
    return envValue === 'true' || envValue === '1';
  }

  // 2. Check dependencies - if any dependency is disabled, this is disabled
  if (feature.dependsOn) {
    for (const dep of feature.dependsOn) {
      if (!isFeatureEnabled(dep as FeatureKey)) {
        return false;
      }
    }
  }

  // 3. Return default
  return feature.defaultEnabled;
}

/**
 * Check multiple features at once
 */
export function areFeaturesEnabled(keys: FeatureKey[]): boolean {
  return keys.every(key => isFeatureEnabled(key));
}

/**
 * Get all enabled features
 */
export function getEnabledFeatures(): FeatureKey[] {
  return (Object.keys(FEATURES) as FeatureKey[]).filter(isFeatureEnabled);
}

/**
 * Get feature metadata
 */
export function getFeature(key: FeatureKey) {
  return FEATURES[key];
}

// =============================================================================
// React Hooks & Components
// =============================================================================

import { log } from '@/lib/logger';
import { ReactNode } from 'react';

interface FeatureGateProps {
  feature: FeatureKey;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally render children based on feature flag.
 *
 * Usage:
 *   <FeatureGate feature="STORY_SCORE">
 *     <StoryScore projectId={id} />
 *   </FeatureGate>
 */
export function FeatureGate({ feature, children, fallback = null }: FeatureGateProps) {
  if (isFeatureEnabled(feature)) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

interface MultiFeatureGateProps {
  features: FeatureKey[];
  mode?: 'all' | 'any';
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Gate that checks multiple features.
 *
 * Usage:
 *   <MultiFeatureGate features={['STORY_SCORE', 'STORY_ADVISER']} mode="all">
 *     <AdvancedEditor />
 *   </MultiFeatureGate>
 */
export function MultiFeatureGate({
  features,
  mode = 'all',
  children,
  fallback = null
}: MultiFeatureGateProps) {
  const check = mode === 'all'
    ? features.every(f => isFeatureEnabled(f))
    : features.some(f => isFeatureEnabled(f));

  if (check) {
    return <>{children}</>;
  }
  return <>{fallback}</>;
}

// =============================================================================
// Development Utilities
// =============================================================================

/**
 * Log feature flag status (development only)
 */
export function logFeatureFlags(): void {
  if (process.env.NODE_ENV !== 'development') return;

  const flags: Record<string, string> = {};
  for (const [key, feature] of Object.entries(FEATURES)) {
    const enabled = isFeatureEnabled(key as FeatureKey);
    flags[key] = enabled
      ? `enabled (Phase ${feature.phase})`
      : `disabled (Phase ${feature.phase}) - Set NEXT_PUBLIC_FF_${key}=true to enable`;
  }
  log.debug('Feature Flags', flags);
}

/**
 * Feature flag admin panel data
 */
export function getFeatureFlagStatus() {
  return Object.entries(FEATURES).map(([featureKey, feature]) => ({
    ...feature,
    enabled: isFeatureEnabled(featureKey as FeatureKey),
    envVar: `NEXT_PUBLIC_FF_${featureKey}`,
    urlParam: `ff_${featureKey.toLowerCase()}`,
  }));
}
