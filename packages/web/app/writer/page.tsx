/**
 * Writer Hub — /writer
 * Dashboard for the logged-in writer: their listed scripts, feedback inbox,
 * subscriber count, and quick links to manage each listing.
 */

export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { prisma } from '@/lib/db';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ArrowLeft,
  BookOpen,
  Globe,
  EyeOff,
  MessageSquare,
  Users,
  Star,
  ChevronRight,
  FileText,
} from 'lucide-react';

const VERDICT_LABELS: Record<string, string> = {
  pass: 'Dislike',
  consider: 'Consider',
  recommend: 'Recommend',
  strong_recommend: 'Strong Rec.',
};

export default async function WriterHubPage() {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  // Fetch writer's profile + listed scripts with reviews
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
    select: {
      fullName: true,
      _count: { select: { writerSubscriptions: true } },
    },
  });

  // All projects (listed or not) for the writer hub
  const projects = await prisma.project.findMany({
    where: { userId },
    orderBy: { exchangeListedAt: { sort: 'desc', nulls: 'last' } },
    select: {
      id: true,
      name: true,
      pageCount: true,
      exchangeSlug: true,
      exchangeIsPublic: true,
      exchangeTagline: true,
      exchangeGenre: true,
      exchangeListedAt: true,
      _count: { select: { scriptReviews: true } },
      scriptReviews: {
        where: { isPublic: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: {
          id: true,
          verdict: true,
          numericRating: true,
          comment: true,
          isAnonymous: true,
          createdAt: true,
          reviewer: { select: { fullName: true } },
          reviewerName: true,
        },
      },
    },
  });

  const listedProjects = projects.filter((p) => p.exchangeIsPublic);
  const unlistedProjects = projects.filter((p) => !p.exchangeIsPublic);

  // Aggregate inbox: recent reviews across all listed scripts
  const inbox = listedProjects
    .flatMap((p) =>
      p.scriptReviews.map((r) => ({
        ...r,
        projectId: p.id,
        projectName: p.name,
        projectSlug: p.exchangeSlug,
      }))
    )
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 20);

  // Stats
  const totalReviews = listedProjects.reduce((s, p) => s + p._count.scriptReviews, 0);
  const subscriberCount = profile?._count.writerSubscriptions ?? 0;

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Dashboard
                </Button>
              </Link>
              <div className="h-6 w-px bg-border" />
              <div className="flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="font-semibold">Writer Hub</span>
              </div>
            </div>
            <Link href="/exchange">
              <Button variant="outline" size="sm">
                Browse Exchange
              </Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Globe className="w-8 h-8 text-primary/60" />
              <div>
                <p className="text-2xl font-bold">{listedProjects.length}</p>
                <p className="text-xs text-muted-foreground">Listed scripts</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <MessageSquare className="w-8 h-8 text-primary/60" />
              <div>
                <p className="text-2xl font-bold">{totalReviews}</p>
                <p className="text-xs text-muted-foreground">Total reviews</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-3">
              <Users className="w-8 h-8 text-primary/60" />
              <div>
                <p className="text-2xl font-bold">{subscriberCount}</p>
                <p className="text-xs text-muted-foreground">Subscribers</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Scripts column */}
          <div className="lg:col-span-3 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="w-5 h-5 text-muted-foreground" />
              My Scripts
            </h2>

            {/* Listed */}
            {listedProjects.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant="outline" className="border-green-500 text-green-600 text-xs gap-1">
                          <Globe className="w-2.5 h-2.5" />
                          Listed
                        </Badge>
                        {p.exchangeGenre && (
                          <Badge variant="secondary" className="text-xs capitalize">
                            {p.exchangeGenre}
                          </Badge>
                        )}
                      </div>
                      <p className="font-medium truncate">{p.name}</p>
                      {p.exchangeTagline && (
                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {p.exchangeTagline}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0 text-xs text-muted-foreground">
                      <span>{p.pageCount}p</span>
                      <span className="flex items-center gap-1">
                        <MessageSquare className="w-3 h-3" />
                        {p._count.scriptReviews}
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    {p.exchangeSlug && (
                      <Link href={`/exchange/${p.exchangeSlug}`}>
                        <Button variant="outline" size="sm" className="text-xs">
                          View listing
                          <ChevronRight className="w-3 h-3 ml-1" />
                        </Button>
                      </Link>
                    )}
                    <Link href={`/projects/${p.id}`}>
                      <Button variant="ghost" size="sm" className="text-xs">
                        Edit project
                      </Button>
                    </Link>
                  </div>
                </CardContent>
              </Card>
            ))}

            {/* Unlisted */}
            {unlistedProjects.length > 0 && (
              <>
                <h3 className="font-medium text-sm text-muted-foreground flex items-center gap-2 pt-2">
                  <EyeOff className="w-4 h-4" />
                  Not listed ({unlistedProjects.length})
                </h3>
                {unlistedProjects.map((p) => (
                  <Card key={p.id} className="opacity-70">
                    <CardContent className="p-4 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-medium truncate text-sm">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.pageCount} pages</p>
                      </div>
                      <Link href={`/projects/${p.id}`}>
                        <Button variant="outline" size="sm" className="text-xs shrink-0">
                          List on Exchange
                        </Button>
                      </Link>
                    </CardContent>
                  </Card>
                ))}
              </>
            )}

            {projects.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center space-y-3">
                  <BookOpen className="w-10 h-10 mx-auto text-muted-foreground/50" />
                  <p className="text-muted-foreground">No projects yet.</p>
                  <Link href="/dashboard">
                    <Button size="sm">Create your first project</Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Feedback inbox */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-lg flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-muted-foreground" />
              Feedback Inbox
            </h2>

            {inbox.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-muted-foreground text-sm">
                  No reviews yet. List a script to start receiving feedback.
                </CardContent>
              </Card>
            ) : (
              inbox.map((review) => {
                const verdictLabel = VERDICT_LABELS[review.verdict] ?? review.verdict;
                return (
                  <Card key={review.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="text-xs text-muted-foreground truncate">
                            {review.projectName}
                          </p>
                          <p className="text-sm font-medium">
                            {review.isAnonymous
                              ? 'Anonymous'
                              : review.reviewer.fullName ?? review.reviewerName ?? 'Reviewer'}
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          {review.numericRating && (
                            <span className="flex items-center text-xs text-muted-foreground">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 mr-0.5" />
                              {review.numericRating}
                            </span>
                          )}
                          <Badge variant="secondary" className="text-xs">
                            {verdictLabel}
                          </Badge>
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground line-clamp-3">
                          {review.comment}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {new Date(review.createdAt).toLocaleDateString()}
                      </p>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
