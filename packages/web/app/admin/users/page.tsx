import { createClient } from '@/lib/supabase/server';
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

interface Props {
  searchParams: Promise<{ page?: string; search?: string; type?: string }>;
}

export default async function AdminUsersPage({ searchParams }: Props) {
  const params = await searchParams;
  const supabase = await createClient();

  const page = parseInt(params.page || '1');
  const search = params.search || '';
  const userType = params.type || '';
  const limit = 20;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('profiles')
    .select(`
      id,
      full_name,
      user_type,
      writer_code,
      reader_code,
      created_at,
      updated_at,
      subscriptions(id, status, plan)
    `, { count: 'exact' });

  // Apply filters
  if (search) {
    query = query.or(`full_name.ilike.%${search}%,writer_code.ilike.%${search}%,reader_code.ilike.%${search}%`);
  }
  if (userType) {
    query = query.eq('user_type', userType);
  }

  // Apply pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: users, count } = await query;

  // Get user emails from auth (we'll need to join this data)
  const userIds = users?.map(u => u.id) || [];

  // Get project counts for each user
  const { data: projectCounts } = await supabase
    .from('projects')
    .select('user_id')
    .in('user_id', userIds);

  const projectCountMap = new Map<string, number>();
  projectCounts?.forEach(p => {
    projectCountMap.set(p.user_id, (projectCountMap.get(p.user_id) || 0) + 1);
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
              {users?.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-medium">
                        {user.full_name?.[0]?.toUpperCase() || '?'}
                      </div>
                      <div>
                        <p className="font-medium">{user.full_name || 'No name'}</p>
                        <p className="text-sm text-muted-foreground font-mono">{user.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>{getUserTypeBadge(user.user_type)}</TableCell>
                  <TableCell>
                    <code className="text-sm bg-muted px-2 py-1 rounded">
                      {user.writer_code || user.reader_code || '-'}
                    </code>
                  </TableCell>
                  <TableCell>
                    {getSubscriptionBadge(user.subscriptions as { status: string; plan: string }[] | null)}
                  </TableCell>
                  <TableCell>{projectCountMap.get(user.id) || 0}</TableCell>
                  <TableCell>
                    {new Date(user.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuLabel>Actions</DropdownMenuLabel>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem>
                          <Eye className="w-4 h-4 mr-2" />
                          View Details
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Mail className="w-4 h-4 mr-2" />
                          Send Email
                        </DropdownMenuItem>
                        <DropdownMenuItem>
                          <Shield className="w-4 h-4 mr-2" />
                          Change Role
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem className="text-destructive">
                          <Ban className="w-4 h-4 mr-2" />
                          Suspend User
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
