#!/usr/bin/env -S npx tsx
/**
 * Audit every isActive=true voice in the catalog against ElevenLabs TTS.
 *
 * Mirrors the 2026-06-17 ad-hoc audit that found 3 broken voices (f8L… 500,
 * IzzIUm… 403 revoked, GKEN… 500). Run periodically and after Ryan adds new
 * voices to the catalog to keep the runtime path free of dead voice IDs.
 *
 * Usage (DRY RUN — reports broken voices, makes no writes):
 *   doppler run --project story-magic --config prd -- \
 *     pnpm --filter @story-magic/orchestrator exec tsx scripts/audit-voices.ts
 *
 * Usage (--apply — deactivates broken voices in the catalog):
 *   doppler run --project story-magic --config prd -- \
 *     pnpm --filter @story-magic/orchestrator exec tsx scripts/audit-voices.ts --apply
 *
 * Usage (--reactivate — flips isActive=false → true for voices that now
 * probe OK; used to revive voices wrongly deactivated by a past transient
 * 5xx from ElevenLabs, before the 2026-06-25 server_degraded fix):
 *   doppler run --project story-magic --config prd -- \
 *     pnpm --filter @story-magic/orchestrator exec tsx scripts/audit-voices.ts --reactivate
 *   # add --apply to actually write the change.
 */

import { PrismaClient } from '@story-magic/shared';
import { probeVoices } from '../src/lib/voice-validator.js';

const APPLY = process.argv.includes('--apply');
const REACTIVATE = process.argv.includes('--reactivate');

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    console.error('ELEVENLABS_API_KEY missing — abort.');
    process.exit(1);
  }

  const prisma = new PrismaClient();
  try {
    if (REACTIVATE) {
      await runReactivate(prisma, apiKey);
      return;
    }
    const voices = await prisma.voiceCatalogEntry.findMany({
      where: { isActive: true },
      select: { voiceId: true, label: true, name: true },
      orderBy: { label: 'asc' },
    });
    console.log(`Auditing ${voices.length} active voices...\n`);

    const start = Date.now();
    const results = await probeVoices(
      voices.map((v) => v.voiceId),
      apiKey,
    );
    const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

    // Re-join probe results with catalog labels for the report.
    const byId = new Map(voices.map((v) => [v.voiceId, v]));
    const broken = results
      .filter((r) => !r.ok)
      .map((r) => ({ ...r, ...byId.get(r.voiceId)! }));

    console.log(`\n=== Summary (${elapsedSec}s) ===`);
    console.log(`OK:     ${results.filter((r) => r.ok).length}`);
    console.log(`BROKEN: ${broken.length}`);

    if (broken.length > 0) {
      console.log('\n=== Broken voices ===');
      for (const b of broken) {
        const labelPad = (b.label || b.name || '').padEnd(40);
        console.log(`  [${b.status}] ${labelPad} ${b.voiceId}  reason=${b.reason}`);
        if (b.errorBody) console.log(`         ${b.errorBody.slice(0, 140)}`);
      }
    }

    if (!APPLY) {
      console.log('\nDRY RUN. Re-run with --apply to deactivate broken voices.');
      return;
    }

    if (broken.length === 0) {
      console.log('\nNo broken voices found. Nothing to apply.');
      return;
    }

    // Only deactivate permanent-broken classes — same rule as the runtime
    // pre-flight. Per 2026-06-25 fix, server_degraded (5xx) is treated as
    // transient and never auto-deactivates here either.
    const eligible = broken.filter((b) =>
      b.reason && ['revoked', 'not_found'].includes(b.reason),
    );
    console.log(`\n=== Deactivating ${eligible.length} permanently-broken voices ===`);
    for (const b of eligible) {
      await prisma.voiceCatalogEntry.update({
        where: { voiceId: b.voiceId },
        data: { isActive: false },
      });
      console.log(`  Deactivated ${b.voiceId} (${b.label || b.name})`);
    }
    const skipped = broken.length - eligible.length;
    if (skipped > 0) {
      console.log(
        `\n${skipped} voices NOT deactivated (transient: rate limit, network, auth). Re-run the audit later.`,
      );
    }
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Walk every isActive=false catalog entry, probe it, and flip back to
 * isActive=true if it now responds OK. Use after a server_degraded incident
 * to revive voices that were wrongly deactivated by the old policy. Without
 * --apply, this is dry-run.
 */
async function runReactivate(prisma: PrismaClient, apiKey: string) {
  const dead = await prisma.voiceCatalogEntry.findMany({
    where: { isActive: false },
    select: { voiceId: true, label: true, name: true },
    orderBy: { label: 'asc' },
  });
  console.log(`Re-checking ${dead.length} deactivated voices...\n`);
  if (dead.length === 0) return;

  const start = Date.now();
  const results = await probeVoices(dead.map((v) => v.voiceId), apiKey);
  const elapsedSec = ((Date.now() - start) / 1000).toFixed(1);

  const byId = new Map(dead.map((v) => [v.voiceId, v]));
  const recovered = results.filter((r) => r.ok);
  const stillBroken = results.filter((r) => !r.ok);

  console.log(`\n=== Reactivate sweep summary (${elapsedSec}s) ===`);
  console.log(`Recovered:    ${recovered.length}`);
  console.log(`Still broken: ${stillBroken.length}`);

  if (recovered.length > 0) {
    console.log('\n=== Voices that now probe OK ===');
    for (const r of recovered) {
      const meta = byId.get(r.voiceId)!;
      console.log(`  ${(meta.label || meta.name || '').padEnd(40)} ${r.voiceId}`);
    }
  }

  if (!APPLY) {
    console.log('\nDRY RUN. Re-run with --reactivate --apply to flip isActive back to true.');
    return;
  }

  if (recovered.length === 0) {
    console.log('\nNothing to reactivate.');
    return;
  }

  console.log(`\n=== Reactivating ${recovered.length} voices ===`);
  for (const r of recovered) {
    await prisma.voiceCatalogEntry.update({
      where: { voiceId: r.voiceId },
      data: { isActive: true },
    });
    const meta = byId.get(r.voiceId)!;
    console.log(`  Reactivated ${r.voiceId} (${meta.label || meta.name})`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
