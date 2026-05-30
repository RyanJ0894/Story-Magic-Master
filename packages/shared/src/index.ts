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
