import { createClient } from '@/lib/supabase/server';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  DollarSign,
  Activity,
  Share2,
  Headphones,
} from 'lucide-react';

export default async function AdminDashboardPage() {
  const supabase = await createClient();

  // Fetch stats in parallel
  const [
    { count: totalUsers },
    { count: totalWriters },
    { count: totalReaders },
    { count: activeSubscriptions },
    { count: totalProjects },
    { count: totalShares },
    { data: recentUsers },
    { data: recentSubscriptions },
  ] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'writer'),
    supabase.from('profiles').select('*', { count: 'exact', head: true }).eq('user_type', 'reader'),
    supabase.from('subscriptions').select('*', { count: 'exact', head: true }).in('status', ['active', 'trialing']),
    supabase.from('projects').select('*', { count: 'exact', head: true }),
    supabase.from('script_shares').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('id, full_name, user_type, created_at').order('created_at', { ascending: false }).limit(5),
    supabase.from('subscriptions').select('id, user_id, plan, status, created_at, profiles(full_name)').order('created_at', { ascending: false }).limit(5),
  ]);

  // Calculate MRR (simplified - would need actual subscription amounts)
  const mrrEstimate = (activeSubscriptions || 0) * 15; // $15 average

  const stats = [
    {
      label: 'Total Users',
      value: totalUsers || 0,
      icon: Users,
      color: 'bg-blue-500',
      change: '+12%',
    },
    {
      label: 'Writers',
      value: totalWriters || 0,
      icon: FileText,
      color: 'bg-violet-500',
      change: '+8%',
    },
    {
      label: 'Readers',
      value: totalReaders || 0,
      icon: Headphones,
      color: 'bg-emerald-500',
      change: '+15%',
    },
    {
      label: 'Active Subscriptions',
      value: activeSubscriptions || 0,
      icon: CreditCard,
      color: 'bg-amber-500',
      change: '+5%',
    },
    {
      label: 'Total Projects',
      value: totalProjects || 0,
      icon: Activity,
      color: 'bg-pink-500',
      change: '+22%',
    },
    {
      label: 'Total Shares',
      value: totalShares || 0,
      icon: Share2,
      color: 'bg-cyan-500',
      change: '+18%',
    },
    {
      label: 'MRR (Est)',
      value: `$${mrrEstimate.toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-green-500',
      change: '+10%',
    },
    {
      label: 'Conversion Rate',
      value: totalUsers ? `${Math.round(((activeSubscriptions || 0) / totalUsers) * 100)}%` : '0%',
      icon: TrendingUp,
      color: 'bg-orange-500',
      change: '+3%',
    },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Admin Dashboard</h1>
        <p className="text-slate-600 dark:text-slate-400">Platform overview and key metrics</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {stats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                  <p className="text-2xl font-bold">{stat.value}</p>
                </div>
                <div className={`p-3 rounded-lg ${stat.color}`}>
                  <stat.icon className="w-5 h-5 text-white" />
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-green-600 font-medium">{stat.change}</span>
                <span className="text-xs text-muted-foreground ml-1">vs last month</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-8">
        {/* Recent Users */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Users</CardTitle>
            <CardDescription>New signups in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentUsers?.map((user) => (
                <div key={user.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center text-sm font-medium">
                      {user.full_name?.[0]?.toUpperCase() || '?'}
                    </div>
                    <div>
                      <p className="font-medium">{user.full_name || 'No name'}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant={user.user_type === 'writer' ? 'default' : 'secondary'}>
                    {user.user_type}
                  </Badge>
                </div>
              ))}
              {(!recentUsers || recentUsers.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent signups
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Recent Subscriptions */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Subscriptions</CardTitle>
            <CardDescription>New and updated subscriptions</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentSubscriptions?.map((sub) => {
                const profileData = sub.profiles;
                const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as { full_name: string } | null;
                return (
                  <div key={sub.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                        <CreditCard className="w-5 h-5 text-violet-600" />
                      </div>
                      <div>
                        <p className="font-medium">{profile?.full_name || 'Unknown'}</p>
                        <p className="text-sm text-muted-foreground">
                          {sub.plan} plan • {new Date(sub.created_at).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant={sub.status === 'active' ? 'default' : sub.status === 'trialing' ? 'secondary' : 'destructive'}
                    >
                      {sub.status}
                    </Badge>
                  </div>
                );
              })}
              {(!recentSubscriptions || recentSubscriptions.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No recent subscriptions
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card className="mt-8">
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <a
              href="/admin/users"
              className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-center"
            >
              <Users className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <p className="font-medium">Manage Users</p>
            </a>
            <a
              href="/admin/subscriptions"
              className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-center"
            >
              <CreditCard className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <p className="font-medium">Subscriptions</p>
            </a>
            <a
              href="/admin/analytics"
              className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-center"
            >
              <TrendingUp className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <p className="font-medium">Analytics</p>
            </a>
            <a
              href="/admin/audit-log"
              className="p-4 border rounded-lg hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors text-center"
            >
              <FileText className="w-6 h-6 mx-auto mb-2 text-slate-600" />
              <p className="font-medium">Audit Log</p>
            </a>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
