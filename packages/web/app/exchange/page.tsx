import { Suspense } from 'react';
import Link from 'next/link';
import { ExchangeScriptCard } from '@/components/exchange/exchange-script-card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';

interface PageProps {
  searchParams: Promise<{ genre?: string; page?: string }>;
}

async function ExchangeGrid({ genre, page }: { genre?: string; page: number }) {
  const params = new URLSearchParams({ page: String(page) });
  if (genre) params.set('genre', genre);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:22000';
  const res = await fetch(`${baseUrl}/api/exchange?${params}`, {
    next: { revalidate: 60 },
  });

  if (!res.ok) {
    return <p className="text-muted-foreground">Failed to load scripts.</p>;
  }

  const data = await res.json();
  const { listings, genres, pagination } = data as {
    listings: Array<{
      id: string;
      slug: string | null;
      name: string;
      tagline: string | null;
      genre: string | null;
      pageCount: number;
      hasPreview: boolean;
      reviewCount: number;
      listedAt: string | null;
      writer: { id: string; fullName: string | null; avatarUrl: string | null };
    }>;
    genres: string[];
    pagination: { page: number; totalPages: number; total: number };
  };

  return (
    <div className="space-y-6">
      {/* Genre filters */}
      <div className="flex flex-wrap gap-2">
        <Link href="/exchange">
          <Badge variant={!genre ? 'default' : 'secondary'} className="cursor-pointer">
            All
          </Badge>
        </Link>
        {genres.map((g) => (
          <Link key={g} href={`/exchange?genre=${g}`}>
            <Badge
              variant={genre === g ? 'default' : 'secondary'}
              className="cursor-pointer capitalize"
            >
              {g}
            </Badge>
          </Link>
        ))}
      </div>

      {/* Results count */}
      <p className="text-sm text-muted-foreground">
        {pagination.total} script{pagination.total !== 1 ? 's' : ''} listed
      </p>

      {listings.length === 0 ? (
        <p className="text-muted-foreground py-12 text-center">
          No scripts listed yet{genre ? ` in ${genre}` : ''}.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {listings.map((script) => (
            <ExchangeScriptCard key={script.id} script={script} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 pt-4">
          {page > 1 ? (
            <Link href={`/exchange?${new URLSearchParams({ ...(genre ? { genre } : {}), page: String(page - 1) })}`}>
              <Button variant="outline" size="sm">
                <ChevronLeft className="w-4 h-4 mr-1" />
                Previous
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              <ChevronLeft className="w-4 h-4 mr-1" />
              Previous
            </Button>
          )}
          <span className="text-sm text-muted-foreground">
            {page} / {pagination.totalPages}
          </span>
          {page < pagination.totalPages ? (
            <Link href={`/exchange?${new URLSearchParams({ ...(genre ? { genre } : {}), page: String(page + 1) })}`}>
              <Button variant="outline" size="sm">
                Next
                <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          ) : (
            <Button variant="outline" size="sm" disabled>
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

export default async function ExchangePage({ searchParams }: PageProps) {
  const sp = await searchParams;
  const genre = sp.genre;
  const page = Math.max(1, parseInt(sp.page ?? '1', 10));

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="bg-background border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-4 h-4 text-primary" />
              </div>
              <div>
                <h1 className="font-bold text-foreground leading-none">Story Exchange</h1>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Discover scripts by talented writers
                </p>
              </div>
            </div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                My Projects
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Suspense
          fallback={
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-44 rounded-lg bg-background animate-pulse" />
              ))}
            </div>
          }
        >
          <ExchangeGrid genre={genre} page={page} />
        </Suspense>
      </main>
    </div>
  );
}
