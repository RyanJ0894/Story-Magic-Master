export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Users,
  FileText,
  CreditCard,
  TrendingUp,
  DollarSign,
  Share2,
  Headphones,
  Activity,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export default async function AdminAnalyticsPage() {
  // Calculate date ranges
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const last7Days = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
  const last30Days = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
  const previousMonth = new Date(today.getTime() - 60 * 24 * 60 * 60 * 1000);

  // Fetch comprehensive stats in parallel
  const [
    totalUsers,
    newUsersToday,
    newUsersWeek,
    newUsersMonth,
    totalWriters,
    totalReaders,
    activeSubscriptions,
    newSubsThisMonth,
    newSubsLastMonth,
    canceledThisMonth,
    totalProjects,
    projectsThisMonth,
    totalShares,
    sharesThisMonth,
    recentProjects,
    recentShares,
    dailySignups,
  ] = await Promise.all([
    prisma.profile.count(),
    prisma.profile.count({ where: { createdAt: { gte: today } } }),
    prisma.profile.count({ where: { createdAt: { gte: last7Days } } }),
    prisma.profile.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.profile.count({ where: { userType: 'writer' } }),
    prisma.profile.count({ where: { userType: 'reader' } }),
    prisma.subscription.count({ where: { status: { in: ['active', 'trialing'] } } }),
    prisma.subscription.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.subscription.count({ where: { createdAt: { gte: previousMonth, lt: last30Days } } }),
    prisma.subscription.count({ where: { status: 'canceled', updatedAt: { gte: last30Days } } }),
    prisma.project.count(),
    prisma.project.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.scriptShare.count(),
    prisma.scriptShare.count({ where: { createdAt: { gte: last30Days } } }),
    prisma.project.findMany({
      select: {
        id: true,
        name: true,
        createdAt: true,
        user: { select: { fullName: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.scriptShare.findMany({
      select: {
        id: true,
        shareToken: true,
        createdAt: true,
        viewCount: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 5,
    }),
    prisma.profile.findMany({
      select: { createdAt: true },
      where: { createdAt: { gte: last30Days } },
      orderBy: { createdAt: 'asc' },
    }),
  ]);

  // Calculate growth percentages
  const subGrowth = newSubsLastMonth ? Math.round(((newSubsThisMonth || 0) - (newSubsLastMonth || 0)) / (newSubsLastMonth || 1) * 100) : 0;
  const mrrEstimate = (activeSubscriptions || 0) * 15; // $15 average
  const conversionRate = totalUsers ? Math.round(((activeSubscriptions || 0) / totalUsers) * 100) : 0;
  const churnRate = activeSubscriptions ? Math.round(((canceledThisMonth || 0) / (activeSubscriptions || 1)) * 100) : 0;

  // Process daily signups for a simple bar representation
  const signupsByDay = new Map<string, number>();
  dailySignups?.forEach(signup => {
    const day = new Date(signup.createdAt).toLocaleDateString();
    signupsByDay.set(day, (signupsByDay.get(day) || 0) + 1);
  });
  const last7DaysSignups = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() - (6 - i) * 24 * 60 * 60 * 1000);
    return {
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      count: signupsByDay.get(date.toLocaleDateString()) || 0,
    };
  });
  const maxSignups = Math.max(...last7DaysSignups.map(d => d.count), 1);

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Analytics</h1>
        <p className="text-muted-foreground">Platform performance and growth metrics</p>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">MRR (Est)</p>
              <DollarSign className="w-4 h-4 text-green-600" />
            </div>
            <p className="text-2xl font-bold">${mrrEstimate.toLocaleString()}</p>
            <div className="flex items-center gap-1 mt-1">
              {subGrowth >= 0 ? (
                <ArrowUp className="w-3 h-3 text-green-600" />
              ) : (
                <ArrowDown className="w-3 h-3 text-red-600" />
              )}
              <span className={`text-xs font-medium ${subGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {Math.abs(subGrowth)}%
              </span>
              <span className="text-xs text-muted-foreground">vs last month</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Conversion Rate</p>
              <TrendingUp className="w-4 h-4 text-violet-600" />
            </div>
            <p className="text-2xl font-bold">{conversionRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {activeSubscriptions || 0} paid of {totalUsers || 0} users
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Churn Rate</p>
              <Activity className="w-4 h-4 text-amber-600" />
            </div>
            <p className="text-2xl font-bold">{churnRate}%</p>
            <p className="text-xs text-muted-foreground mt-1">
              {canceledThisMonth || 0} canceled this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">New Users (30d)</p>
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <p className="text-2xl font-bold">{newUsersMonth || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              {newUsersToday || 0} today, {newUsersWeek || 0} this week
            </p>
          </CardContent>
        </Card>
      </div>

      {/* User Breakdown & Signups Chart */}
      <div className="grid lg:grid-cols-2 gap-8 mb-8">
        <Card>
          <CardHeader>
            <CardTitle>User Breakdown</CardTitle>
            <CardDescription>Distribution by user type</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-violet-600" />
                  </div>
                  <div>
                    <p className="font-medium">Writers</p>
                    <p className="text-sm text-muted-foreground">Content creators</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{totalWriters || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalUsers ? Math.round(((totalWriters || 0) / totalUsers) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                    <Headphones className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <p className="font-medium">Readers</p>
                    <p className="text-sm text-muted-foreground">Listeners/actors</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{totalReaders || 0}</p>
                  <p className="text-xs text-muted-foreground">
                    {totalUsers ? Math.round(((totalReaders || 0) / totalUsers) * 100) : 0}%
                  </p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <Users className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Total Users</p>
                    <p className="text-sm text-muted-foreground">All registered users</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold">{totalUsers || 0}</p>
                  <p className="text-xs text-muted-foreground">100%</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Daily Signups</CardTitle>
            <CardDescription>New users in the last 7 days</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-end justify-between h-40 gap-2">
              {last7DaysSignups.map((day, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-2">
                  <div className="w-full flex flex-col items-center">
                    <span className="text-xs font-medium mb-1">{day.count}</span>
                    <div
                      className="w-full bg-violet-500 rounded-t"
                      style={{ height: `${Math.max((day.count / maxSignups) * 100, 4)}px` }}
                    />
                  </div>
                  <span className="text-xs text-muted-foreground">{day.day}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Projects</p>
              <FileText className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalProjects || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{projectsThisMonth || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Total Shares</p>
              <Share2 className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{totalShares || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{sharesThisMonth || 0} this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Active Subscriptions</p>
              <CreditCard className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">{activeSubscriptions || 0}</p>
            <p className="text-xs text-muted-foreground mt-1">
              +{newSubsThisMonth || 0} new this month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">Avg Projects/User</p>
              <Activity className="w-4 h-4 text-muted-foreground" />
            </div>
            <p className="text-2xl font-bold">
              {totalWriters ? ((totalProjects || 0) / totalWriters).toFixed(1) : '0'}
            </p>
            <p className="text-xs text-muted-foreground mt-1">Per writer</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid lg:grid-cols-2 gap-8">
        <Card>
          <CardHeader>
            <CardTitle>Recent Projects</CardTitle>
            <CardDescription>Latest projects created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentProjects?.map((project) => {
                return (
                  <div key={project.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{project.name}</p>
                      <p className="text-sm text-muted-foreground">
                        by {project.user?.fullName || 'Unknown'} • {new Date(project.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <Badge variant="outline">New</Badge>
                  </div>
                );
              })}
              {(!recentProjects || recentProjects.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent projects</p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent Shares</CardTitle>
            <CardDescription>Latest share links created</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentShares?.map((share) => (
                <div key={share.id} className="flex items-center justify-between">
                  <div>
                    <p className="font-medium font-mono">{share.shareToken}</p>
                    <p className="text-sm text-muted-foreground">
                      {share.viewCount} views
                    </p>
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {new Date(share.createdAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
              {(!recentShares || recentShares.length === 0) && (
                <p className="text-sm text-muted-foreground text-center py-4">No recent shares</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
