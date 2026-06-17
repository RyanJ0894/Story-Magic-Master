/**
 * @story-magic/shared — Prisma client and types
 *
 * Single source of truth for the database schema.
 * Import PrismaClient and all model types from here.
 *
 * Usage:
 *   import { PrismaClient, Prisma } from '@story-magic/shared';
 *   import type { Project, Profile } from '@story-magic/shared';
 */

export { PrismaClient, Prisma } from './generated/prisma/index.js';
export type {
  Project,
  Profile,
  Job,
  JobLog,
  Usage,
  Purchase,
  Subscription,
  WriterSubscription,
  CreditTransaction,
  ScriptCorpus,
  CorpusScore,
  StoryScore,
  ScriptShare,
  ScriptReview,
  ReaderLibrary,
  ActivityLog,
  Alert,
  AlertPreference,
  ApiKey,
  AuditLog,
  AudioOutput,
  ContentAccessLog,
  HumanReview,
  ImpactDonation,
  ImpactPartner,
  ImpactPrizeDraw,
  ImpactStory,
  PlatformSetting,
  PodcastFeed,
  ProjectComment,
  ProjectNote,
  Rewrite,
  Revision,
  Suggestion,
  Team,
  TeamMember,
  TeamShare,
  VoiceClone,
  VoiceMarketplaceInterest,
  WebhookDeliveryLog,
  WebhookEndpoint,
  // Orchestrator pipeline tables
  MixManifest,
  Timeline,
  Alignment,
  TtsStem,
  VoiceMap,
} from './generated/prisma/index.js';

// DirectorJson types — mirrors the orchestrator's zod schema at
// packages/orchestrator/src/schemas/director-json.ts. See that file's
// header for parity rules. Web consumers should import the type from
// here instead of using `directorJson as any` casts.
export {
  DIRECTOR_EMOTIONS,
  isDirectorJson,
  asDirectorJson,
} from './types/director-json.js';
export type {
  DirectorEmotion,
  DirectorDialogueLine,
  DirectorAudioCue,
  DirectorMixParams,
  DirectorScene,
  DirectorJson,
} from './types/director-json.js';
