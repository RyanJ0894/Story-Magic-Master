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

export const FEATURES = {
  // StoryScore - 12-dimension script evaluation
  STORY_SCORE: {
    key: 'STORY_SCORE',
    name: 'StoryScore',
    description: 'AI-powered 12-dimension screenplay evaluation',
    defaultEnabled: false,
    phase: 1,
  },

  // Story-Adviser - Inline suggestions
  STORY_ADVISER: {
    key: 'STORY_ADVISER',
    name: 'Story-Adviser',
    description: 'Inline suggestions with AI rewrites',
    defaultEnabled: false,
    dependsOn: ['STORY_SCORE'], // Requires StoryScore
    phase: 2,
  },

  // Revision tracking
  REVISION_TRACKING: {
    key: 'REVISION_TRACKING',
    name: 'Revision Tracking',
    description: 'Track script versions and score trajectory',
    defaultEnabled: false,
    dependsOn: ['STORY_SCORE'],
    phase: 2,
  },

  // Script editor (advanced)
  SCRIPT_EDITOR: {
    key: 'SCRIPT_EDITOR',
    name: 'Script Editor',
    description: 'In-app script editing with CodeMirror',
    defaultEnabled: false,
    dependsOn: ['STORY_ADVISER'],
    phase: 2,
  },

  // Comparable scripts (requires corpus)
  COMPARABLE_SCRIPTS: {
    key: 'COMPARABLE_SCRIPTS',
    name: 'Comparable Scripts',
    description: 'Find similar scripts in corpus',
    defaultEnabled: false,
    dependsOn: ['STORY_SCORE'],
    phase: 3,
  },

  // Export reports
  EXPORT_REPORTS: {
    key: 'EXPORT_REPORTS',
    name: 'Export Reports',
    description: 'PDF export of StoryScore reports',
    defaultEnabled: false,
    dependsOn: ['STORY_SCORE'],
    phase: 3,
  },
} as const;

export type FeatureKey = keyof typeof FEATURES;

// =============================================================================
// Feature Flag Checking
// =============================================================================

/**
 * Check if a feature is enabled.
 *
 * Priority:
 * 1. Environment variable (NEXT_PUBLIC_FF_<KEY>=true/false)
 * 2. URL parameter in development (?ff_<key>=true)
 * 3. Default value from feature definition
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

  // 2. In development, check URL params (client-side only)
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const urlParams = new URLSearchParams(window.location.search);
    const urlValue = urlParams.get(`ff_${key.toLowerCase()}`);
    if (urlValue !== null) {
      return urlValue === 'true' || urlValue === '1';
    }
  }

  // 3. Check dependencies - if any dependency is disabled, this is disabled
  if (feature.dependsOn) {
    for (const dep of feature.dependsOn) {
      if (!isFeatureEnabled(dep as FeatureKey)) {
        return false;
      }
    }
  }

  // 4. Return default
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

  console.group('🚩 Feature Flags');
  for (const [key, feature] of Object.entries(FEATURES)) {
    const enabled = isFeatureEnabled(key as FeatureKey);
    console.log(
      `${enabled ? '✅' : '❌'} ${feature.name} (Phase ${feature.phase})`,
      enabled ? '' : `- Set NEXT_PUBLIC_FF_${key}=true to enable`
    );
  }
  console.groupEnd();
}

/**
 * Feature flag admin panel data
 */
export function getFeatureFlagStatus() {
  return Object.entries(FEATURES).map(([key, feature]) => ({
    key,
    ...feature,
    enabled: isFeatureEnabled(key as FeatureKey),
    envVar: `NEXT_PUBLIC_FF_${key}`,
    urlParam: `ff_${key.toLowerCase()}`,
  }));
}
