/**
 * Master-account notification feed producers (#174 PR β).
 *
 * Helpers that emit the right `Alert` rows when a feed-worthy event fires.
 *
 * Why a shared module:
 *   1. The producer call sites (team service, generation processor, Stripe
 *      webhook) live in very different parts of the code. A shared module
 *      stops them from drifting on metadata shape, alertType strings, or
 *      "who is the recipient" logic.
 *   2. The recipient is almost always "the master account" — and figuring
 *      out who that is from a sub-account user ID is the same lookup
 *      everywhere. Centralizing it here means the lookup is one place to
 *      review for correctness, performance, and edge cases.
 *
 * All emit functions are best-effort:
 *   - DB failure during the alert insert NEVER takes down the request
 *     that triggered the event (the team-member removal still happens,
 *     the job still completes). The alert just doesn't get written.
 *   - This is the same swallow-and-log pattern used by lib/scene-cache,
 *     lib/llm-call-log, and lib/embedding-cache.
 *
 * Recipient resolution:
 *   - For team-scoped events: alert.userId = team.ownerId (the master).
 *   - For project-scoped events: alert.userId = project.userId, which
 *     equals project.team.ownerId when the project is team-owned.
 *   - For Stripe subscription events: alert.userId = the profile that
 *     owns the Stripe customer.
 *
 * The `relatedUserId` field carries the SUB-ACCOUNT identity so the UI
 * can render "Alex (your subordinate) completed Script #142".
 */

import type { PrismaClient } from '@story-magic/shared';
import { log } from '@/lib/logger';

interface EmitParams {
  prisma: PrismaClient;
  recipientUserId: string;
  alertType: string;
  title: string;
  message?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  relatedUserId?: string | null;
  metadata?: Record<string, unknown>;
}

async function emit(params: EmitParams): Promise<void> {
  try {
    await params.prisma.alert.create({
      data: {
        userId: params.recipientUserId,
        alertType: params.alertType,
        title: params.title,
        message: params.message ?? null,
        projectId: params.projectId ?? null,
        teamId: params.teamId ?? null,
        relatedUserId: params.relatedUserId ?? null,
        metadata: (params.metadata ?? {}) as never,
      },
    });
  } catch (err) {
    log.warn('[notifications] producer emit failed; event lost', {
      alertType: params.alertType,
      recipientUserId: params.recipientUserId,
      err: err instanceof Error ? err.message : String(err),
    });
  }
}

// ─────────────────────────────────────────────────────────────────────
// Team events
// ─────────────────────────────────────────────────────────────────────

/**
 * #174 (2026-06-17): centralizes the alert write that was previously inlined
 * at app/api/invite/[token]/route.ts:251. Same shape, same alertType, same
 * Alert table — the consolidation just means future invite-accept changes
 * don't need to remember the alert side and producers can grow a single
 * audit / shaping pass without hunting for inline writes.
 */
export async function emitTeamMemberJoined(
  prisma: PrismaClient,
  args: {
    teamId: string;
    memberUserId: string;
    memberName?: string | null;
    memberEmail?: string | null;
  },
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: args.teamId },
    select: { ownerId: true, name: true },
  });
  if (!team) return;

  const memberLabel = args.memberName || args.memberEmail || 'Someone';
  await emit({
    prisma,
    recipientUserId: team.ownerId,
    alertType: 'team_member_joined',
    title: `${memberLabel} joined ${team.name}`,
    message: `${memberLabel} accepted your team invitation.`,
    teamId: args.teamId,
    relatedUserId: args.memberUserId,
    metadata: { memberName: args.memberName ?? null, memberEmail: args.memberEmail ?? null },
  });
}

export async function emitTeamMemberLeft(
  prisma: PrismaClient,
  args: { teamId: string; memberUserId: string; memberName?: string | null },
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: args.teamId },
    select: { ownerId: true, name: true },
  });
  if (!team) return; // team gone — nothing to alert about

  await emit({
    prisma,
    recipientUserId: team.ownerId,
    alertType: 'team_member_left',
    title: `${args.memberName ?? 'A team member'} left ${team.name}`,
    teamId: args.teamId,
    relatedUserId: args.memberUserId,
    metadata: { memberName: args.memberName ?? null },
  });
}

export async function emitTeamMemberDeactivated(
  prisma: PrismaClient,
  args: { teamId: string; memberUserId: string; memberName?: string | null },
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: args.teamId },
    select: { ownerId: true, name: true },
  });
  if (!team) return;

  await emit({
    prisma,
    recipientUserId: team.ownerId,
    alertType: 'team_member_deactivated',
    title: `${args.memberName ?? 'A team member'} was deactivated`,
    message: `Their access to ${team.name} has been revoked.`,
    teamId: args.teamId,
    relatedUserId: args.memberUserId,
    metadata: { memberName: args.memberName ?? null },
  });
}

export async function emitTeamMemberQuotaExceeded(
  prisma: PrismaClient,
  args: {
    teamId: string;
    memberUserId: string;
    memberName?: string | null;
    quotaType: string;
    usage: number;
    limit: number;
  },
): Promise<void> {
  const team = await prisma.team.findUnique({
    where: { id: args.teamId },
    select: { ownerId: true, name: true },
  });
  if (!team) return;

  await emit({
    prisma,
    recipientUserId: team.ownerId,
    alertType: 'team_member_quota_exceeded',
    title: `${args.memberName ?? 'A team member'} hit their ${args.quotaType} limit`,
    message: `Usage ${args.usage} of ${args.limit}. Consider raising the limit or talking to them.`,
    teamId: args.teamId,
    relatedUserId: args.memberUserId,
    metadata: {
      memberName: args.memberName ?? null,
      quotaType: args.quotaType,
      usage: args.usage,
      limit: args.limit,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Generation events
// ─────────────────────────────────────────────────────────────────────

/**
 * Both complete + failed alerts route to the project owner. If the
 * project is team-owned, that's already the team owner (master). If a
 * sub-account ran the generation, populate `relatedUserId` so the UI can
 * say "Alex's script #142 completed".
 */
export async function emitScriptGenerationComplete(
  prisma: PrismaClient,
  args: {
    projectId: string;
    triggeredByUserId?: string | null;
    projectName?: string | null;
  },
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: args.projectId },
    select: { userId: true, name: true },
  });
  if (!project) return;

  await emit({
    prisma,
    recipientUserId: project.userId,
    alertType: 'script_generation_complete',
    title: `Script "${args.projectName ?? project.name}" finished generating`,
    projectId: args.projectId,
    relatedUserId: args.triggeredByUserId ?? null,
  });
}

export async function emitScriptGenerationFailed(
  prisma: PrismaClient,
  args: {
    projectId: string;
    triggeredByUserId?: string | null;
    projectName?: string | null;
    errorSummary?: string | null;
  },
): Promise<void> {
  const project = await prisma.project.findUnique({
    where: { id: args.projectId },
    select: { userId: true, name: true },
  });
  if (!project) return;

  await emit({
    prisma,
    recipientUserId: project.userId,
    alertType: 'script_generation_failed',
    title: `Script "${args.projectName ?? project.name}" failed to generate`,
    message: args.errorSummary ?? 'See the project page for details.',
    projectId: args.projectId,
    relatedUserId: args.triggeredByUserId ?? null,
    metadata: { errorSummary: args.errorSummary ?? null },
  });
}

// ─────────────────────────────────────────────────────────────────────
// Stripe / billing events
// ─────────────────────────────────────────────────────────────────────

export async function emitSubscriptionRenewed(
  prisma: PrismaClient,
  args: {
    stripeCustomerId: string;
    amountCents: number;
    currency: string;
    nextRenewal?: Date | null;
  },
): Promise<void> {
  const profile = await prisma.profile.findFirst({
    where: { stripeCustomerId: args.stripeCustomerId },
    select: { id: true },
  });
  if (!profile) return;

  await emit({
    prisma,
    recipientUserId: profile.id,
    alertType: 'subscription_renewed',
    title: 'Subscription renewed',
    message: `Your plan renewed for ${formatMoney(args.amountCents, args.currency)}.`,
    metadata: {
      amountCents: args.amountCents,
      currency: args.currency,
      nextRenewal: args.nextRenewal?.toISOString() ?? null,
    },
  });
}

export async function emitSubscriptionFailed(
  prisma: PrismaClient,
  args: {
    stripeCustomerId: string;
    amountCents?: number | null;
    currency?: string | null;
    failureReason?: string | null;
  },
): Promise<void> {
  const profile = await prisma.profile.findFirst({
    where: { stripeCustomerId: args.stripeCustomerId },
    select: { id: true },
  });
  if (!profile) return;

  await emit({
    prisma,
    recipientUserId: profile.id,
    alertType: 'subscription_failed',
    title: 'Subscription renewal failed',
    message:
      args.failureReason ??
      'Your most recent payment could not be processed. Update your payment method to keep your access active.',
    metadata: {
      amountCents: args.amountCents ?? null,
      currency: args.currency ?? null,
      failureReason: args.failureReason ?? null,
    },
  });
}

// ─────────────────────────────────────────────────────────────────────
// #331 — Project-engagement triggers (2026-06-17)
// ─────────────────────────────────────────────────────────────────────
//
// Recipient resolution: for project-scoped events, the master is the
// project owner (which equals team.ownerId when the project is team-
// owned). The sub-account (the actor) goes into relatedUserId. Skip
// emitting if actor IS the owner — no master wants notifications about
// their own activity on their own projects.

async function resolveProjectMaster(
  prisma: PrismaClient,
  projectId: string,
  actorUserId: string,
): Promise<{ ownerId: string; projectName: string } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: { userId: true, name: true },
  });
  if (!project) return null;
  if (project.userId === actorUserId) return null; // owner acting on own project — skip
  return { ownerId: project.userId, projectName: project.name };
}

async function lookupActorName(
  prisma: PrismaClient,
  userId: string,
): Promise<string> {
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { fullName: true, email: true },
  });
  return profile?.fullName || profile?.email || 'A team member';
}

export async function emitProjectOpenedFirstTime(
  prisma: PrismaClient,
  args: { projectId: string; actorUserId: string },
): Promise<void> {
  const master = await resolveProjectMaster(prisma, args.projectId, args.actorUserId);
  if (!master) return;
  const actorName = await lookupActorName(prisma, args.actorUserId);
  await emit({
    prisma,
    recipientUserId: master.ownerId,
    alertType: 'project_opened_first_time',
    title: `${actorName} opened "${master.projectName}" for the first time`,
    projectId: args.projectId,
    relatedUserId: args.actorUserId,
    metadata: { actorName },
  });
}

export async function emitListenComplete(
  prisma: PrismaClient,
  args: { projectId: string; actorUserId: string },
): Promise<void> {
  const master = await resolveProjectMaster(prisma, args.projectId, args.actorUserId);
  if (!master) return;
  const actorName = await lookupActorName(prisma, args.actorUserId);
  await emit({
    prisma,
    recipientUserId: master.ownerId,
    alertType: 'listen_complete',
    title: `${actorName} finished listening to "${master.projectName}"`,
    projectId: args.projectId,
    relatedUserId: args.actorUserId,
    metadata: { actorName },
  });
}

export async function emitNoteAdded(
  prisma: PrismaClient,
  args: { projectId: string; actorUserId: string; notePreview?: string | null },
): Promise<void> {
  const master = await resolveProjectMaster(prisma, args.projectId, args.actorUserId);
  if (!master) return;
  const actorName = await lookupActorName(prisma, args.actorUserId);
  const preview = args.notePreview ? args.notePreview.slice(0, 140) : null;
  await emit({
    prisma,
    recipientUserId: master.ownerId,
    alertType: 'note_added',
    title: `${actorName} added a note on "${master.projectName}"`,
    message: preview,
    projectId: args.projectId,
    relatedUserId: args.actorUserId,
    metadata: { actorName, preview },
  });
}

export async function emitDecisionMade(
  prisma: PrismaClient,
  args: {
    projectId: string;
    actorUserId: string;
    decision: string; // 'like' | 'pass' | 'undecided' (or whatever reactionType value)
    sceneIndex?: number | null;
  },
): Promise<void> {
  const master = await resolveProjectMaster(prisma, args.projectId, args.actorUserId);
  if (!master) return;
  const actorName = await lookupActorName(prisma, args.actorUserId);
  await emit({
    prisma,
    recipientUserId: master.ownerId,
    alertType: 'decision_made',
    title: `${actorName} marked "${master.projectName}" as ${args.decision}`,
    projectId: args.projectId,
    relatedUserId: args.actorUserId,
    metadata: { actorName, decision: args.decision, sceneIndex: args.sceneIndex ?? null },
  });
}

// ─────────────────────────────────────────────────────────────────────

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
