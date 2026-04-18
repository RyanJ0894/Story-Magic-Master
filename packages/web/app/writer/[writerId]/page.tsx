/**
 * Public writer profile — /writer/[writerId]
 * Shows the writer's listed scripts and subscriber count.
 */

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ExchangeScriptCard } from '@/components/exchange/exchange-script-card';
import { WriterSubscribeButton } from '@/components/exchange/writer-subscribe-button';
import { ArrowLeft, FileText, Users } from 'lucide-react';

interface PageProps {
  params: Promise<{ writerId: string }>;
}

async function getWriterData(writerId: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:22000';
  const res = await fetch(`${baseUrl}/api/writers/${writerId}`, {
    next: { revalidate: 60 },
  });
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export default async function WriterProfilePage({ params }: PageProps) {
  const { writerId } = await params;
  const { userId } = await auth();

  const data = await getWriterData(writerId);
  if (!data) notFound();

  const { writer, scripts } = data as {
    writer: {
      id: string;
      fullName: string | null;
      avatarUrl: string | null;
      memberSince: string;
      listedScripts: number;
      subscribers: number;
    };
    scripts: Array<{
      id: string;
      slug: string | null;
      name: string;
      tagline: string | null;
      genre: string | null;
      listedAt: string | null;
      pageCount: number;
      hasPreview: boolean;
      reviewCount: number;
    }>;
  };

  const isOwnProfile = userId === writer.id;
  const isLoggedIn = !!userId;

  return (
    <div className="min-h-screen bg-muted">
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/exchange">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exchange
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Writer card */}
        <Card>
          <CardContent className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4">
              <div className="flex items-center gap-4">
                {writer.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={writer.avatarUrl}
                    alt={writer.fullName ?? 'Writer'}
                    className="w-16 h-16 rounded-full"
                  />
                ) : (
                  <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {(writer.fullName ?? 'W')[0].toUpperCase()}
                  </div>
                )}
                <div>
                  <h1 className="text-xl font-bold">{writer.fullName ?? 'Writer'}</h1>
                  <div className="flex gap-4 text-sm text-muted-foreground mt-1">
                    <span className="flex items-center gap-1">
                      <FileText className="w-4 h-4" />
                      {writer.listedScripts} script{writer.listedScripts !== 1 ? 's' : ''}
                    </span>
                    <span className="flex items-center gap-1">
                      <Users className="w-4 h-4" />
                      {writer.subscribers} subscriber{writer.subscribers !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
              </div>
              <div className="sm:ml-auto flex gap-2">
                {isOwnProfile && (
                  <Link href="/writer">
                    <Button variant="outline" size="sm">
                      My Hub
                    </Button>
                  </Link>
                )}
                {isLoggedIn && !isOwnProfile && (
                  <WriterSubscribeButton writerId={writer.id} initialSubscribed={false} />
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scripts grid */}
        <div className="space-y-4">
          <h2 className="font-semibold text-lg">
            Listed Scripts ({scripts.length})
          </h2>
          {scripts.length === 0 ? (
            <p className="text-muted-foreground text-sm">No scripts listed yet.</p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {scripts.map((script) => (
                <ExchangeScriptCard
                  key={script.id}
                  script={{ ...script, writer: { id: writer.id, fullName: writer.fullName, avatarUrl: writer.avatarUrl } }}
                />
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
