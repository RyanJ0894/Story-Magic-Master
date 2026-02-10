import { createClient } from '@/lib/supabase/server';
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
  const supabase = await createClient();

  const page = parseInt(params.page || '1');
  const actionFilter = params.action || '';
  const resourceFilter = params.resource || '';
  const limit = 30;
  const offset = (page - 1) * limit;

  // Build query
  let query = supabase
    .from('audit_logs')
    .select(`
      id,
      user_id,
      action,
      resource_type,
      resource_id,
      details,
      ip_address,
      user_agent,
      created_at,
      profiles(full_name)
    `, { count: 'exact' });

  // Apply filters
  if (actionFilter) {
    query = query.ilike('action', `%${actionFilter}%`);
  }
  if (resourceFilter) {
    query = query.eq('resource_type', resourceFilter);
  }

  // Apply pagination and ordering
  query = query
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  const { data: logs, count, error } = await query;

  // If table doesn't exist yet, show empty state with setup instructions
  const tableNotExists = error?.code === '42P01'; // PostgreSQL "undefined table" error

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
              The audit_logs table needs to be created in your Supabase database.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-muted rounded-lg p-4 font-mono text-sm overflow-x-auto">
              <pre>{`-- Run this SQL in your Supabase SQL Editor:

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  details JSONB DEFAULT '{}',
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_action ON audit_logs(action);
CREATE INDEX idx_audit_logs_resource_type ON audit_logs(resource_type);

-- Enable RLS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit logs
CREATE POLICY "Admins can view audit logs" ON audit_logs
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
      AND profiles.user_type = 'admin'
    )
  );

-- Service role can insert (for logging from API routes)
CREATE POLICY "Service role can insert audit logs" ON audit_logs
  FOR INSERT
  WITH CHECK (true);`}</pre>
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
                  className="px-3 py-2 border rounded-md bg-background text-sm"
                />
                <select
                  name="resource"
                  defaultValue={resourceFilter}
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
                    const profileData = log.profiles;
                    const profile = (Array.isArray(profileData) ? profileData[0] : profileData) as { full_name: string | null } | null;
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
                            <p className="font-medium text-sm">{profile?.full_name || 'System'}</p>
                            {log.user_id && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {log.user_id.slice(0, 8)}...
                              </p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">{log.resource_type}</p>
                            {log.resource_id && (
                              <p className="text-xs text-muted-foreground font-mono">
                                {log.resource_id.slice(0, 12)}...
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
                          <code className="text-xs">{log.ip_address || '-'}</code>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="text-sm">
                              {new Date(log.created_at).toLocaleDateString()}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {new Date(log.created_at).toLocaleTimeString()}
                            </p>
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
