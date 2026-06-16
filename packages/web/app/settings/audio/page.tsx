/**
 * /settings/audio — B-005 audio-tuning sliders page.
 *
 * Server component: loads the user's current AudioTuning row (or defaults
 * if none exists) and hands it to the client-side panel where the actual
 * slider state lives.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { prisma } from '@/lib/db';
import { getAudioTuning } from '@/lib/services/audio-tuning';
import { AudioTuningPanel } from '@/components/settings/AudioTuningPanel';

export const dynamic = 'force-dynamic';

export default async function AudioSettingsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const tuning = await getAudioTuning(prisma, userId);

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="flex items-center justify-between">
        <Link href="/settings">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to settings
          </Button>
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold">Audio Tuning</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Customize narration pace and mix balance to match your taste. Preview as
          much as you want, then lock the settings to apply them to every future
          generation.
        </p>
      </div>

      <AudioTuningPanel initial={tuning} />
    </div>
  );
}
