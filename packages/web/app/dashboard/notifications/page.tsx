/**
 * Full notification feed page (#174 PR γ).
 *
 * Server shell + auth check; client list handles cursor pagination
 * and mark-all-read.
 */

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { NotificationsFullList } from './notifications-full-list';

export const dynamic = 'force-dynamic';

export default async function NotificationsPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold">Notifications</h1>
        <p className="mt-1 text-sm text-gray-600">
          Events from your team and account.
        </p>
      </header>
      <NotificationsFullList />
    </div>
  );
}
