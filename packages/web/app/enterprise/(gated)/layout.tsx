import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';

export default async function EnterpriseGatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { subscriptionTier: true },
  });

  if (profile?.subscriptionTier !== 'enterprise') {
    redirect('/enterprise/contact');
  }

  return <>{children}</>;
}
