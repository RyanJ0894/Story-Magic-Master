export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { VoiceCatalogActions } from './voice-catalog-actions';

export default async function AdminVoicesPage() {
  const entries = await prisma.voiceCatalogEntry.findMany({
    orderBy: [{ isActive: 'desc' }, { label: 'asc' }],
  });

  const activeCount = entries.filter((e) => e.isActive).length;
  const placeholderCount = entries.filter((e) => e.isPlaceholder).length;

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Voice Catalog</h1>
          <p className="text-muted-foreground">
            {activeCount} active · {placeholderCount} placeholders · {entries.length} total
          </p>
        </div>
        <VoiceCatalogActions />
      </div>

      {entries.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-muted-foreground">
            <p className="mb-2 font-medium">No voices in DB catalog</p>
            <p className="text-sm">
              Use &quot;Seed from JSON&quot; to populate from the shipped knowledge base files.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Voice Entries</CardTitle>
            <CardDescription>
              Runtime-configurable. Changes take effect within 5 minutes (TTL cache).
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Label</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>Gender</TableHead>
                  <TableHead>Style</TableHead>
                  <TableHead>Tone</TableHead>
                  <TableHead>Voice ID</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-[100px]">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {entries.map((entry) => (
                  <TableRow key={entry.id} className={!entry.isActive ? 'opacity-50' : ''}>
                    <TableCell className="font-medium">{entry.label}</TableCell>
                    <TableCell className="max-w-[200px] truncate">{entry.name}</TableCell>
                    <TableCell>{entry.gender}</TableCell>
                    <TableCell>{entry.style}</TableCell>
                    <TableCell>{entry.tone ?? '—'}</TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-1.5 py-0.5 rounded font-mono">
                        {entry.voiceId}
                      </code>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1 flex-wrap">
                        {entry.isPlaceholder && (
                          <Badge variant="secondary">Placeholder</Badge>
                        )}
                        {!entry.isActive && (
                          <Badge variant="outline" className="text-muted-foreground">Inactive</Badge>
                        )}
                        {entry.isActive && !entry.isPlaceholder && (
                          <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-0">
                            Active
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <VoiceCatalogActions entryId={entry.id} isActive={entry.isActive} voiceId={entry.voiceId} />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
