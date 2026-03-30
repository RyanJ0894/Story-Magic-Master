import { auth, currentUser } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { AdminSidebar, type AdminNavItem } from '@/components/admin/admin-sidebar';

const navigation: AdminNavItem[] = [
  { name: 'Dashboard', href: '/admin', icon: 'LayoutDashboard' },
  { name: 'Users', href: '/admin/users', icon: 'Users' },
  { name: 'Subscriptions', href: '/admin/subscriptions', icon: 'CreditCard' },
  { name: 'Analytics', href: '/admin/analytics', icon: 'BarChart3' },
  { name: 'Audit Log', href: '/admin/audit-log', icon: 'FileText' },
  { name: 'Corpus', href: '/admin/corpus', icon: 'BookOpen' },
  { name: 'Impact', href: '/admin/impact', icon: 'Heart' },
  { name: 'Settings', href: '/admin/settings', icon: 'Settings' },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  const clerkUser = await currentUser();

  // Check if user is admin
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: { userType: true },
  });

  if (profile?.userType !== 'admin') {
    redirect('/');
  }

  const userEmail = clerkUser?.emailAddresses[0]?.emailAddress ?? '';

  return (
    <div className="min-h-screen bg-muted">
      <AdminSidebar navigation={navigation} userEmail={userEmail} />

      {/* Main Content */}
      <main className="md:pl-64">
        <div className="min-h-screen">
          {children}
        </div>
      </main>
    </div>
  );
}
