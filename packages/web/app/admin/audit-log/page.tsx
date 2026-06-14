export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Prisma } from '@story-magic/shared';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  FileText,
  User,
  CreditCard,
  Share2,
  LogIn,
  LogOut,
  Settings,
  AlertTriangle,
  Clock,
  Filter,
} from 'lucide-react';
import Link from 'next/link';
import { DateTime } from '@/components/ui/date-time';

interface Props {
  searchParams: Promise<{ page?: string; action?: string; resource?: string }>;
}

// Icon mapping for different action types
const actionIcons: Record<string, React.ElementType> = {
  'user.login': LogIn,
  'user.logout': LogOut,
  'user.signup': User,
  'user.update': Settings,
  'project.create': FileText,
  'project.update': FileText,
  'project.delete': FileText,
  'share.create': Share2,
  'share.access': Share2,
  'share.delete': Share2,
  'subscription.create': CreditCard,
  'subscription.update': CreditCard,
  'subscription.cancel': CreditCard,
  'admin.action': AlertTriangle,
};

const getActionIcon = (action: string) => {
  const Icon = actionIcons[action] || Clock;
  return Icon;
};

const getActionBadgeVariant = (action: string): 'default' | 'secondary' | 'destructive' | 'outline' => {
  if (action.includes('delete') || action.includes('cancel')) return 'destructive';
  if (action.includes('create')) return 'default';
  if (action.includes('update')) return 'secondary';
  return 'outline';
};

export default async function AdminAuditLogPage({ searchParams }: Props) {
  const params = await searchParams;

  const page = parseInt(params.page || '1');
  const actionFilter = params.action || '';
  const resourceFilter = params.resource || '';
  const limit = 30;
  const offset = (page - 1) * limit;

  // Build where clause
  const where: Prisma.AuditLogWhereInput = {};
  if (actionFilter) {
    where.action = { contains: actionFilter, mode: 'insensitive' };
  }
  if (resourceFilter) {
    where.resourceType = resourceFilter;
  }

  let logs: (Awaited<ReturnType<typeof prisma.auditLog.findMany>>[number] & { user?: { fullName: string | null } | null })[] | null = null;
  let count = 0;
  let tableNotExists = false;

  try {
    [logs, count] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: { user: { select: { fullName: true } } },
        orderBy: { createdAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);
  } catch (error: unknown) {
    // Check if table doesn't exist
    const errMsg = error instanceof Error ? error.message : '';
    if (errMsg.includes('does not exist') || errMsg.includes('42P01')) {
      tableNotExists = true;
    }
  }

  const totalPages = Math.ceil((count || 0) / limit);

  // Get unique resource types for filter
  const resourceTypes = ['user', 'project', 'share', 'subscription', 'admin'];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground">Audit Log</h1>
        <p className="text-muted-foreground">Track all platform activity and changes</p>
      </div>

      {tableNotExists ? (
        <Card>
          <CardHeader>
            <CardTitle>Audit Logging Not Configured</CardTitle>
            <CardDescription>
              The audit_logs table needs to be created in your database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`-- Run the Prisma migration to create the audit_logs table:
npx prisma migrate dev`}</pre>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <form className="flex flex-wrap gap-4">
                <div className="flex items-center gap-2">
                  <Filter className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Filters:</span>
                </div>
                <input
                  type="text"
                  name="action"
                  placeholder="Action (e.g., user.login)"
                  defaultValue={actionFilter}
                  aria-label="Filter by action type"
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                />
                <select
                  name="resource"
                  defaultValue={resourceFilter}
                  aria-label="Filter by resource type"
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                >
                  <option value="">All Resources</option>
                  {resourceTypes.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <Button type="submit" size="sm">Apply</Button>
                {(actionFilter || resourceFilter) && (
                  <Link href="/admin/audit-log">
                    <Button variant="outline" size="sm">Clear</Button>
                  </Link>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Audit Log Table */}
          <Card>
            <CardHeader>
              <CardTitle>Activity Log ({count || 0} entries)</CardTitle>
              <CardDescription>
                Showing {offset + 1} - {Math.min(offset + limit, count || 0)} entries
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Action</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Resource</TableHead>
                    <TableHead>Details</TableHead>
                    <TableHead>IP Address</TableHead>
                    <TableHead>Timestamp</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs?.map((log) => {
                    const Icon = getActionIcon(log.action);
                    const details = log.details as Record<string, unknown> | null;

                    return (
                      <TableRow key={log.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                              <Icon className="w-4 h-4 text-muted-foreground" />
                            </div>
                            <Badge variant={getActionBadgeVariant(log.action)}>
                              {log.action}
                            </Badge>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium text-sm">{log.user?.fullName || 'System'}</p>
                            {log.userId && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {log.userId.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{log.resourceType}</p>
                            {log.resourceId && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {log.resourceId.slice(0, 12)}...
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          {details && Object.keys(details).length > 0 ? (
                            <code className="text-xs bg-muted px-2 py-1 rounded">
                              {JSON.stringify(details).slice(0, 50)}
                              {JSON.stringify(details).length > 50 ? '...' : ''}
                            </code>
                          ) : (
                            <span className="text-muted-foreground text-sm">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <code className="text-xs">{log.ipAddress || '-'}</code>
                        </TableCell>
                        <TableCell>
                          {/* Hydration-safe (#STORY-MAGIC-1F class): render in client. */}
                          <div>
                            <DateTime iso={new Date(log.createdAt).toISOString()} mode="date" className="text-sm" />
                            <DateTime iso={new Date(log.createdAt).toISOString()} mode="time" className="text-xs text-muted-foreground block" />
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {(!logs || logs.length === 0) && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        No audit log entries found
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
                      <Link href={`/admin/audit-log?page=${page - 1}${actionFilter ? `&action=${actionFilter}` : ''}${resourceFilter ? `&resource=${resourceFilter}` : ''}`}>
                        <Button variant="outline" size="sm">Previous</Button>
                      </Link>
                    )}
                    {page < totalPages && (
                      <Link href={`/admin/audit-log?page=${page + 1}${actionFilter ? `&action=${actionFilter}` : ''}${resourceFilter ? `&resource=${resourceFilter}` : ''}`}>
                        <Button variant="outline" size="sm">Next</Button>
                      </Link>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
