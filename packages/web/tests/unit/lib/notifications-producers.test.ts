/**
 * Tests for the master notification feed producers (#174 PR β).
 *
 * Each producer is responsible for resolving the right recipient
 * (team owner / project owner / Stripe customer's profile) and writing
 * an Alert row with the right alertType + metadata. Tests verify:
 *   - Recipient resolution looks up the right entity
 *   - alertType + title shape matches what the frontend expects
 *   - DB failures during emit are swallowed (best-effort contract)
 *   - Stripe currency formatting is en-US, no-decimal-cents
 */

import { describe, it, expect, vi } from 'vitest';
import {
  emitTeamMemberJoined,
  emitTeamMemberLeft,
  emitTeamMemberDeactivated,
  emitTeamMemberQuotaExceeded,
  emitScriptGenerationComplete,
  emitScriptGenerationFailed,
  emitSubscriptionRenewed,
  emitSubscriptionFailed,
  emitProjectOpenedFirstTime,
  emitListenComplete,
  emitNoteAdded,
  emitDecisionMade,
  emitProjectCreated,
  emitScriptUploaded,
} from '@/lib/notifications/producers';

vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makePrisma() {
  const alertCreate = vi.fn(async (args: unknown) => ({ id: 'mock-alert', ...(args as Record<string, unknown>) }));
  const teamFind = vi.fn();
  const projectFind = vi.fn();
  const profileFind = vi.fn();

  return {
    alertCreate,
    teamFind,
    projectFind,
    profileFind,
    prisma: {
      alert: { create: alertCreate },
      team: { findUnique: teamFind },
      project: { findUnique: projectFind },
      profile: { findFirst: profileFind },
    } as unknown as Parameters<typeof emitTeamMemberLeft>[0],
  };
}

describe('emitTeamMemberJoined (#174 — 2026-06-17)', () => {
  it('writes alert to team owner with team_member_joined type', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'master_clerk_id', name: 'Acme' });

    await emitTeamMemberJoined(prisma, {
      teamId: 'team-1',
      memberUserId: 'sub_clerk_id',
      memberName: 'Alex Doe',
      memberEmail: 'alex@example.com',
    });

    expect(alertCreate).toHaveBeenCalledTimes(1);
    const data = alertCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('master_clerk_id');
    expect(data.alertType).toBe('team_member_joined');
    expect(data.title).toContain('Alex Doe');
    expect(data.title).toContain('Acme');
    expect(data.relatedUserId).toBe('sub_clerk_id');
    expect(data.metadata).toMatchObject({ memberName: 'Alex Doe', memberEmail: 'alex@example.com' });
  });

  it('falls back to email when memberName is null', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'master', name: 'Acme' });

    await emitTeamMemberJoined(prisma, {
      teamId: 't',
      memberUserId: 'm',
      memberName: null,
      memberEmail: 'alex@example.com',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.title).toContain('alex@example.com');
  });

  it('falls back to "Someone" when both name and email missing', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'master', name: 'Acme' });

    await emitTeamMemberJoined(prisma, {
      teamId: 't',
      memberUserId: 'm',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.title).toContain('Someone');
  });

  it('skips silently if team no longer exists', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce(null);

    await emitTeamMemberJoined(prisma, { teamId: 't', memberUserId: 'm' });
    expect(alertCreate).not.toHaveBeenCalled();
  });
});

describe('emitTeamMemberLeft', () => {
  it('writes alert to the team owner with team_member_left type', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'master_clerk_id', name: 'Acme' });

    await emitTeamMemberLeft(prisma, {
      teamId: 'team-1',
      memberUserId: 'sub_clerk_id',
      memberName: 'Alex Doe',
    });

    expect(alertCreate).toHaveBeenCalledTimes(1);
    const data = alertCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('master_clerk_id');
    expect(data.alertType).toBe('team_member_left');
    expect(data.title).toContain('Alex Doe');
    expect(data.title).toContain('Acme');
    expect(data.relatedUserId).toBe('sub_clerk_id');
  });

  it('skips silently if team no longer exists', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce(null);

    await emitTeamMemberLeft(prisma, { teamId: 't', memberUserId: 'm' });
    expect(alertCreate).not.toHaveBeenCalled();
  });
});

describe('emitTeamMemberDeactivated', () => {
  it('uses warn-tier alertType and includes the team name in the message', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'master', name: 'Studio One' });

    await emitTeamMemberDeactivated(prisma, {
      teamId: 't1',
      memberUserId: 'm1',
      memberName: 'Jordan',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('team_member_deactivated');
    expect(data.message).toContain('Studio One');
  });
});

describe('emitTeamMemberQuotaExceeded', () => {
  it('records the usage + limit in metadata for UI display', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'm', name: 'Acme' });

    await emitTeamMemberQuotaExceeded(prisma, {
      teamId: 't',
      memberUserId: 'u',
      memberName: 'Sam',
      quotaType: 'pages_per_month',
      usage: 120,
      limit: 100,
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('team_member_quota_exceeded');
    expect(data.metadata.quotaType).toBe('pages_per_month');
    expect(data.metadata.usage).toBe(120);
    expect(data.metadata.limit).toBe(100);
  });
});

describe('emitScriptGenerationComplete', () => {
  it('writes alert to the project owner with the right type', async () => {
    const { prisma, projectFind, alertCreate } = makePrisma();
    projectFind.mockResolvedValueOnce({ userId: 'owner_clerk', name: 'My Script' });

    await emitScriptGenerationComplete(prisma, {
      projectId: 'proj-1',
      triggeredByUserId: 'sub_clerk',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('owner_clerk');
    expect(data.alertType).toBe('script_generation_complete');
    expect(data.relatedUserId).toBe('sub_clerk');
    expect(data.projectId).toBe('proj-1');
    expect(data.title).toContain('My Script');
  });

  it('skips silently if the project no longer exists', async () => {
    const { prisma, projectFind, alertCreate } = makePrisma();
    projectFind.mockResolvedValueOnce(null);

    await emitScriptGenerationComplete(prisma, { projectId: 'gone' });
    expect(alertCreate).not.toHaveBeenCalled();
  });
});

describe('emitScriptGenerationFailed', () => {
  it('captures errorSummary in title-or-message + metadata', async () => {
    const { prisma, projectFind, alertCreate } = makePrisma();
    projectFind.mockResolvedValueOnce({ userId: 'owner', name: 'Bad Script' });

    await emitScriptGenerationFailed(prisma, {
      projectId: 'proj-2',
      errorSummary: 'OpenAI rate limit',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('script_generation_failed');
    expect(data.metadata.errorSummary).toBe('OpenAI rate limit');
    expect(data.message).toContain('OpenAI rate limit');
  });
});

describe('emitSubscriptionRenewed', () => {
  it('finds profile by stripeCustomerId and formats amount as en-US currency', async () => {
    const { prisma, profileFind, alertCreate } = makePrisma();
    profileFind.mockResolvedValueOnce({ id: 'profile_clerk_id' });

    await emitSubscriptionRenewed(prisma, {
      stripeCustomerId: 'cus_test',
      amountCents: 4900, // $49.00
      currency: 'usd',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('profile_clerk_id');
    expect(data.alertType).toBe('subscription_renewed');
    // en-US formatting with no decimals → "$49"
    expect(data.message).toContain('$49');
  });

  it('skips silently if no profile matches the customer', async () => {
    const { prisma, profileFind, alertCreate } = makePrisma();
    profileFind.mockResolvedValueOnce(null);

    await emitSubscriptionRenewed(prisma, {
      stripeCustomerId: 'cus_unknown',
      amountCents: 100,
      currency: 'usd',
    });
    expect(alertCreate).not.toHaveBeenCalled();
  });
});

describe('emitSubscriptionFailed', () => {
  it('uses critical-tier alertType + records failureReason in metadata', async () => {
    const { prisma, profileFind, alertCreate } = makePrisma();
    profileFind.mockResolvedValueOnce({ id: 'profile_id' });

    await emitSubscriptionFailed(prisma, {
      stripeCustomerId: 'cus_x',
      failureReason: 'card_declined',
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('subscription_failed');
    expect(data.metadata.failureReason).toBe('card_declined');
  });
});

describe('producer best-effort contract', () => {
  it('swallows DB errors during alert insert — never throws', async () => {
    const { prisma, teamFind, alertCreate } = makePrisma();
    teamFind.mockResolvedValueOnce({ ownerId: 'm', name: 'A' });
    alertCreate.mockRejectedValueOnce(new Error('connection refused'));

    await expect(
      emitTeamMemberLeft(prisma, { teamId: 't', memberUserId: 'u' }),
    ).resolves.toBeUndefined();
  });
});

// ──────────────────────────────────────────────────────────────────────
// #331 (2026-06-17) — Project-engagement producers
// ──────────────────────────────────────────────────────────────────────

function makeProjectPrisma() {
  const alertCreate = vi.fn(async (args: unknown) => ({ id: 'mock', ...(args as Record<string, unknown>) }));
  const projectFind = vi.fn();
  const profileFind = vi.fn();
  return {
    alertCreate, projectFind, profileFind,
    prisma: {
      alert: { create: alertCreate },
      project: { findUnique: projectFind },
      profile: { findUnique: profileFind },
    } as unknown as Parameters<typeof emitProjectOpenedFirstTime>[0],
  };
}

describe('emitProjectOpenedFirstTime (#331)', () => {
  it('writes alert to project owner with project_opened_first_time type', async () => {
    const { prisma, projectFind, profileFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'master_id', name: 'Manhattan' });
    profileFind.mockResolvedValueOnce({ fullName: 'Alex Doe', email: 'alex@example.com' });

    await emitProjectOpenedFirstTime(prisma, { projectId: 'proj-1', actorUserId: 'sub_id' });

    expect(alertCreate).toHaveBeenCalledTimes(1);
    const data = alertCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('master_id');
    expect(data.alertType).toBe('project_opened_first_time');
    expect(data.title).toContain('Alex Doe');
    expect(data.title).toContain('Manhattan');
    expect(data.title).toContain('first time');
    expect(data.relatedUserId).toBe('sub_id');
  });

  it('does NOT emit when actor IS the project owner', async () => {
    const { prisma, projectFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'same_user', name: 'A' });

    await emitProjectOpenedFirstTime(prisma, { projectId: 'p', actorUserId: 'same_user' });

    expect(alertCreate).not.toHaveBeenCalled();
  });

  it('skips silently if project no longer exists', async () => {
    const { prisma, projectFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce(null);

    await emitProjectOpenedFirstTime(prisma, { projectId: 'p', actorUserId: 'u' });

    expect(alertCreate).not.toHaveBeenCalled();
  });
});

describe('emitListenComplete (#331)', () => {
  it('writes alert with listen_complete type', async () => {
    const { prisma, projectFind, profileFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'master', name: 'Hamilton' });
    profileFind.mockResolvedValueOnce({ fullName: 'Sub User' });

    await emitListenComplete(prisma, { projectId: 'p', actorUserId: 'sub' });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('listen_complete');
    expect(data.title).toContain('Sub User');
    expect(data.title).toContain('Hamilton');
    expect(data.title).toContain('finished listening');
  });
});

describe('emitNoteAdded (#331)', () => {
  it('writes alert with note_added type + 140-char preview', async () => {
    const { prisma, projectFind, profileFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'master', name: 'Wicked' });
    profileFind.mockResolvedValueOnce({ fullName: 'Sub User' });

    const longNote = 'a'.repeat(200);
    await emitNoteAdded(prisma, { projectId: 'p', actorUserId: 'sub', notePreview: longNote });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('note_added');
    expect(data.message).toHaveLength(140);
    expect(data.metadata.preview).toHaveLength(140);
  });

  it('handles null notePreview', async () => {
    const { prisma, projectFind, profileFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'master', name: 'A' });
    profileFind.mockResolvedValueOnce({ fullName: 'Sub' });

    await emitNoteAdded(prisma, { projectId: 'p', actorUserId: 'sub', notePreview: null });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.message).toBeNull();
  });
});

describe('emitDecisionMade (#331)', () => {
  it('writes alert with decision_made type + decision metadata', async () => {
    const { prisma, projectFind, profileFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'master', name: 'Cats' });
    profileFind.mockResolvedValueOnce({ fullName: 'Sub' });

    await emitDecisionMade(prisma, {
      projectId: 'p',
      actorUserId: 'sub',
      decision: 'like',
      sceneIndex: 3,
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('decision_made');
    expect(data.title).toContain('marked');
    expect(data.title).toContain('like');
    expect(data.metadata).toMatchObject({ decision: 'like', sceneIndex: 3 });
  });

  it('falls back to "A team member" when actor profile not found', async () => {
    const { prisma, projectFind, profileFind, alertCreate } = makeProjectPrisma();
    projectFind.mockResolvedValueOnce({ userId: 'master', name: 'A' });
    profileFind.mockResolvedValueOnce(null);

    await emitDecisionMade(prisma, { projectId: 'p', actorUserId: 'sub', decision: 'pass' });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.title).toContain('A team member');
  });
});

// ──────────────────────────────────────────────────────────────────────
// 2026-06-20 — Ryan project-visibility clarification producers
// emitProjectCreated + emitScriptUploaded use a different resolver path
// than #331 producers: they look up via TeamMember (not Project.userId).
// ──────────────────────────────────────────────────────────────────────

function makeTeamActorPrisma() {
  const alertCreate = vi.fn(async (args: unknown) => ({ id: 'mock', ...(args as Record<string, unknown>) }));
  const teamMemberFind = vi.fn();
  const profileFind = vi.fn();
  return {
    alertCreate, teamMemberFind, profileFind,
    prisma: {
      alert: { create: alertCreate },
      teamMember: { findMany: teamMemberFind },
      profile: { findUnique: profileFind },
    } as unknown as Parameters<typeof emitProjectCreated>[0],
  };
}

describe('emitProjectCreated (2026-06-20, Ryan project-visibility)', () => {
  it('writes alert to each master team owner of the actor', async () => {
    const { prisma, teamMemberFind, profileFind, alertCreate } = makeTeamActorPrisma();
    teamMemberFind.mockResolvedValueOnce([
      { team: { ownerId: 'master_id', name: 'Acme' } },
    ]);
    profileFind.mockResolvedValueOnce({ fullName: 'Alex Doe', email: 'alex@example.com' });

    await emitProjectCreated(prisma, {
      projectId: 'proj-1',
      actorUserId: 'sub_id',
      projectName: 'Manhattan',
    });

    expect(alertCreate).toHaveBeenCalledTimes(1);
    const data = alertCreate.mock.calls[0][0].data;
    expect(data.userId).toBe('master_id');
    expect(data.alertType).toBe('project_created');
    expect(data.title).toContain('Alex Doe');
    expect(data.title).toContain('Manhattan');
    expect(data.title).toContain('created');
    expect(data.relatedUserId).toBe('sub_id');
    expect(data.metadata).toMatchObject({ teamName: 'Acme' });
  });

  it('emits one alert per master when actor belongs to multiple teams', async () => {
    const { prisma, teamMemberFind, profileFind, alertCreate } = makeTeamActorPrisma();
    teamMemberFind.mockResolvedValueOnce([
      { team: { ownerId: 'master_a', name: 'Acme' } },
      { team: { ownerId: 'master_b', name: 'Beta' } },
    ]);
    profileFind.mockResolvedValueOnce({ fullName: 'Sub' });

    await emitProjectCreated(prisma, {
      projectId: 'p',
      actorUserId: 'sub',
      projectName: 'X',
    });

    expect(alertCreate).toHaveBeenCalledTimes(2);
  });

  it('does NOT emit when actor IS the team owner (self-action)', async () => {
    const { prisma, teamMemberFind, alertCreate } = makeTeamActorPrisma();
    teamMemberFind.mockResolvedValueOnce([
      { team: { ownerId: 'same_user', name: 'Acme' } },
    ]);

    await emitProjectCreated(prisma, {
      projectId: 'p',
      actorUserId: 'same_user',
      projectName: 'X',
    });

    expect(alertCreate).not.toHaveBeenCalled();
  });

  it('skips silently when actor has no team memberships', async () => {
    const { prisma, teamMemberFind, alertCreate } = makeTeamActorPrisma();
    teamMemberFind.mockResolvedValueOnce([]);

    await emitProjectCreated(prisma, {
      projectId: 'p',
      actorUserId: 'solo_user',
      projectName: 'X',
    });

    expect(alertCreate).not.toHaveBeenCalled();
  });
});

describe('emitScriptUploaded (2026-06-20, Ryan project-visibility)', () => {
  it('writes alert with page count in title when provided', async () => {
    const { prisma, teamMemberFind, profileFind, alertCreate } = makeTeamActorPrisma();
    teamMemberFind.mockResolvedValueOnce([
      { team: { ownerId: 'master', name: 'Acme' } },
    ]);
    profileFind.mockResolvedValueOnce({ fullName: 'Sub' });

    await emitScriptUploaded(prisma, {
      projectId: 'p',
      actorUserId: 'sub',
      projectName: 'Hamilton',
      pageCount: 87,
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.alertType).toBe('script_uploaded');
    expect(data.title).toContain('Hamilton');
    expect(data.title).toContain('87-page');
    expect(data.metadata).toMatchObject({ pageCount: 87 });
  });

  it('omits page descriptor when pageCount is null/missing', async () => {
    const { prisma, teamMemberFind, profileFind, alertCreate } = makeTeamActorPrisma();
    teamMemberFind.mockResolvedValueOnce([
      { team: { ownerId: 'master', name: 'Acme' } },
    ]);
    profileFind.mockResolvedValueOnce({ fullName: 'Sub' });

    await emitScriptUploaded(prisma, {
      projectId: 'p',
      actorUserId: 'sub',
      projectName: 'Untitled',
      pageCount: null,
    });

    const data = alertCreate.mock.calls[0][0].data;
    expect(data.title).not.toContain('-page');
  });
});
