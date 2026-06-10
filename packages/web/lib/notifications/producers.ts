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

function formatMoney(cents: number, currency: string): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency.toUpperCase(),
    maximumFractionDigits: 0,
  }).format(cents / 100);
}
