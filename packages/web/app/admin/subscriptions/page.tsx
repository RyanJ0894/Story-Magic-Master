export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Prisma } from '@prisma/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Search, MoreHorizontal, CreditCard, RefreshCw, XCircle, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Props {
  searchParams: Promise<{ page?: string; status?: string; plan?: string }>;
}

export default async function AdminSubscriptionsPage({ searchParams }: Props) {
  const params = await searchParams;

  const page = parseInt(params.page || '1');
  const status = params.status || '';
  const plan = params.plan || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.SubscriptionWhereInput = {};
  if (status) {
    where.status = status;
  }
  if (plan) {
    where.plan = plan;
  }

  const [subscriptions, count] = await Promise.all([
    prisma.subscription.findMany({
      where,
      include: { user: { select: { id: true, fullName: true, userType: true } } },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.subscription.count({ where }),
  ]);

  // Get stats
  const [totalActive, totalTrialing, totalCanceled] = await Promise.all([
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.count({ where: { status: 'trialing' } }),
    prisma.subscription.count({ where: { status: 'canceled' } }),
  ]);

  const totalPages = Math.ceil((count || 0) / limit);

  const getStatusBadge = (subStatus: string, cancelAtPeriodEnd: boolean) => {
    if (cancelAtPeriodEnd) {
      return <Badge variant="outline" className="text-amber-600">Canceling</Badge>;
    }

    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trialing: 'secondary',
      canceled: 'destructive',
      past_due: 'destructive',
      incomplete: 'outline',
      incomplete_expired: 'destructive',
      unpaid: 'destructive',
    };

    return <Badge variant={variants[subStatus] || 'outline'}>{subStatus}</Badge>;
  };

  const getPlanBadge = (subPlan: string) => {
    const colors: Record<string, string> = {
      free: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200',
      creator: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
      pro: 'bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200',
      studio: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
    };

    return (
      <span className={`px-2 py-1 rounded-full text-xs font-medium ${colors[subPlan] || 'bg-muted text-foreground'}`}>
        {subPlan}
      </span>
    );
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Subscriptions</h1>
        <p className="text-muted-foreground">Manage platform subscriptions and billing</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Total</p>
            <p className="text-2xl font-bold">{count || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Active</p>
            <p className="text-2xl font-bold text-green-600">{totalActive || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Trialing</p>
            <p className="text-2xl font-bold text-blue-600">{totalTrialing || 0}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <p className="text-sm text-muted-foreground">Canceled</p>
            <p className="text-2xl font-bold text-red-600">{totalCanceled || 0}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-4">
            <select
              name="status"
              defaultValue={status}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Statuses</option>
              <option value="active">Active</option>
              <option value="trialing">Trialing</option>
              <option value="canceled">Canceled</option>
              <option value="past_due">Past Due</option>
            </select>
            <select
              name="plan"
              defaultValue={plan}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Plans</option>
              <option value="creator">Creator</option>
              <option value="pro">Pro</option>
              <option value="studio">Studio</option>
            </select>
            <Button type="submit">Filter</Button>
            {(status || plan) && (
              <Link href="/admin/subscriptions">
                <Button variant="outline">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Subscriptions Table */}
      <Card>
        <CardHeader>
          <CardTitle>Subscriptions ({count || 0})</CardTitle>
          <CardDescription>
            Showing {offset + 1} - {Math.min(offset + limit, count || 0)} of {count || 0} subscriptions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Current Period</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {subscriptions?.map((sub: { id: string; userId: string; plan: string; status: string; stripeCustomerId: string | null; cancelAtPeriodEnd: boolean; currentPeriodStart: Date | null; currentPeriodEnd: Date | null; createdAt: Date; user: { id: string; fullName: string | null; userType: string } | null }) => {
                return (
                  <TableRow key={sub.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
                          <CreditCard className="w-5 h-5 text-violet-600" />
                        </div>
                        <div>
                          <p className="font-medium">{sub.user?.fullName || 'Unknown'}</p>
                          <p className="text-sm text-muted-foreground font-mono">
                            {sub.stripeCustomerId?.slice(0, 18)}...
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getPlanBadge(sub.plan)}</TableCell>
                    <TableCell>{getStatusBadge(sub.status, sub.cancelAtPeriodEnd)}</TableCell>
                    <TableCell>
                      <div className="text-sm">
                        <p>{sub.currentPeriodStart ? new Date(sub.currentPeriodStart).toLocaleDateString() : '-'}</p>
                        <p className="text-muted-foreground">
                          to {sub.currentPeriodEnd ? new Date(sub.currentPeriodEnd).toLocaleDateString() : '-'}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(sub.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" aria-label="Subscription actions">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled>
                            <ExternalLink className="w-4 h-4 mr-2" />
                            View in Stripe (coming soon)
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled>
                            <RefreshCw className="w-4 h-4 mr-2" />
                            Sync with Stripe (coming soon)
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem disabled className="text-destructive">
                            <XCircle className="w-4 h-4 mr-2" />
                            Cancel Subscription (coming soon)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!subscriptions || subscriptions.length === 0) && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                    No subscriptions found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                Page {page} of {totalPages}
              </p>
              <div className="flex gap-2">
                {page > 1 && (
                  <Link href={`/admin/subscriptions?page=${page - 1}${status ? `&status=${status}` : ''}${plan ? `&plan=${plan}` : ''}`}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/admin/subscriptions?page=${page + 1}${status ? `&status=${status}` : ''}${plan ? `&plan=${plan}` : ''}`}>
                    <Button variant="outline" size="sm">Next</Button>
                  </Link>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
