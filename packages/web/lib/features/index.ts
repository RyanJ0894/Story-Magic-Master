/**
 * Feature Flags - Public API
 *
 * Usage:
 *   import { isFeatureEnabled, FeatureGate } from '@/lib/features';
 */

export {
  // Core functions
  isFeatureEnabled,
  areFeaturesEnabled,
  getEnabledFeatures,
  getFeature,

  // React components
  FeatureGate,
  MultiFeatureGate,

  // Development utilities
  logFeatureFlags,
  getFeatureFlagStatus,

  // Types & constants
  FEATURES,
  type FeatureKey,
} from './flags';
