export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Prisma } from '@story-magic/shared';
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
import { Search, MoreHorizontal, Mail, Ban, Shield, Eye } from 'lucide-react';
import Link from 'next/link';
import { GrantCreditsButton } from '@/components/admin/GrantCreditsButton';

interface Props {
  searchParams: Promise<{ page?: string; search?: string; type?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;

  const page = parseInt(params.page || '1');
  const search = params.search || '';
  const userType = params.type || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.ProfileWhereInput = {};
  if (search) {
    where.OR = [
      { fullName: { contains: search, mode: 'insensitive' } },
      { writerCode: { contains: search, mode: 'insensitive' } },
      { readerCode: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (userType) {
    where.userType = userType;
  }

  const [users, count] = await Promise.all([
    prisma.profile.findMany({
      where,
      select: {
        id: true,
        fullName: true,
        userType: true,
        writerCode: true,
        readerCode: true,
        createdAt: true,
        updatedAt: true,
        subscriptions: { select: { id: true, status: true, plan: true } },
      },
      orderBy: { createdAt: 'desc' },
      skip: offset,
      take: limit,
    }),
    prisma.profile.count({ where }),
  ]);

  // Get project counts for each user
  const userIds = users?.map((u: { id: string }) => u.id) || [];
  const projectCounts = await prisma.project.groupBy({
    by: ['userId'],
    where: { userId: { in: userIds } },
    _count: { id: true },
  });

  const projectCountMap = new Map<string, number>();
  projectCounts.forEach((p: { userId: string; _count: { id: number } }) => {
    projectCountMap.set(p.userId, p._count.id);
  });

  const totalPages = Math.ceil((count || 0) / limit);

  const getSubscriptionBadge = (subscriptions: { status: string; plan: string }[] | null) => {
    const sub = subscriptions?.[0];
    if (!sub) return <Badge variant="outline">Free</Badge>;

    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      active: 'default',
      trialing: 'secondary',
      canceled: 'destructive',
      past_due: 'destructive',
    };

    return (
      <Badge variant={variants[sub.status] || 'outline'}>
        {sub.plan} ({sub.status})
      </Badge>
    );
  };

  const getUserTypeBadge = (type: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'outline'> = {
      admin: 'default',
      writer: 'secondary',
      reader: 'outline',
    };

    return <Badge variant={variants[type] || 'outline'}>{type}</Badge>;
  };

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">User Management</h1>
        <p className="text-muted-foreground">View and manage all platform users</p>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  name="search"
                  placeholder="Search by name or code..."
                  defaultValue={search}
                  className="pl-10"
                />
              </div>
            </div>
            <select
              name="type"
              defaultValue={userType}
              className="px-3 py-2 border rounded-md bg-background"
            >
              <option value="">All Types</option>
              <option value="writer">Writers</option>
              <option value="reader">Readers</option>
              <option value="admin">Admins</option>
            </select>
            <Button type="submit">Filter</Button>
            {(search || userType) && (
              <Link href="/admin/users">
                <Button variant="outline">Clear</Button>
              </Link>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardHeader>
          <CardTitle>Users ({count || 0})</CardTitle>
          <CardDescription>
            Showing {offset + 1} - {Math.min(offset + limit, count || 0)} of {count || 0} users
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>User</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Code</TableHead>
                <TableHead>Subscription</TableHead>
                <TableHead>Projects</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead className="w-[50px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users?.map((user: { id: string; fullName: string | null; userType: string; writerCode: string | null; readerCode: string | null; createdAt: Date; updatedAt: Date; subscriptions: { id: string; status: string; plan: string }[] }) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {user.fullName?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{user.fullName || 'No name'}</p>
                        <p className="text-sm text-muted-foreground font-mono">{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getUserTypeBadge(user.userType)}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {user.writerCode || user.readerCode || '-'}
                    </code>
                  </TableCell>
                  <TableCell>
                    {getSubscriptionBadge(user.subscriptions as { status: string; plan: string }[] | null)}
                  </TableCell>
                  <TableCell>{projectCountMap.get(user.id) || 0}</TableCell>
                  <TableCell>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" aria-label="User actions">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details (coming soon)
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Mail className="w-4 h-4 mr-2" />
                          Send Email (coming soon)
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled>
                          <Shield className="w-4 h-4 mr-2" />
                          Change Role (coming soon)
                        </DropdownMenuItem>
                        <DropdownMenuItem asChild>
                          <GrantCreditsButton
                            userId={user.id}
                            userName={user.fullName ?? 'Unknown'}
                          />
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem disabled className="text-destructive">
                          <Ban className="w-4 h-4 mr-2" />
                          Suspend User (coming soon)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
              {(!users || users.length === 0) && (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                    No users found
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
                  <Link href={`/admin/users?page=${page - 1}${search ? `&search=${search}` : ''}${userType ? `&type=${userType}` : ''}`}>
                    <Button variant="outline" size="sm">Previous</Button>
                  </Link>
                )}
                {page < totalPages && (
                  <Link href={`/admin/users?page=${page + 1}${search ? `&search=${search}` : ''}${userType ? `&type=${userType}` : ''}`}>
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
