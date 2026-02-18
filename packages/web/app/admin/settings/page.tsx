export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import AdminSettingsClient from './admin-settings-client';

export default async function AdminSettingsPage() {
  const { userId } = await auth();

  // Server-side env checks for read-only display
  const stripeMode: 'live' | 'test' = process.env.STRIPE_SECRET_KEY?.startsWith('sk_live') ? 'live' : 'test';

  const envInfo = {
    stripeMode,
    elevenLabsConnected: !!process.env.ELEVENLABS_API_KEY,
    stripeConnected: !!process.env.STRIPE_SECRET_KEY,
    nodeEnv: process.env.NODE_ENV ?? 'unknown',
    nodeVersion: process.version || 'N/A',
    userId: userId ?? 'unknown',
  };

  return <AdminSettingsClient envInfo={envInfo} />;
}
