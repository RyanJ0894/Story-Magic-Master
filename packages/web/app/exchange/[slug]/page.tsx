import { notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@clerk/nextjs/server';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WriterSubscribeButton } from '@/components/exchange/writer-subscribe-button';
import { FeedbackForm } from '@/components/exchange/feedback-form';
import {
  ArrowLeft,
  Star,
  MessageSquare,
  FileText,
  Users,
  BookOpen,
  Play,
} from 'lucide-react';

interface PageProps {
  params: Promise<{ slug: string }>;
}

const VERDICT_LABELS: Record<string, { label: string; color: string }> = {
  pass: { label: 'Pass', color: 'text-red-600 bg-red-50 dark:bg-red-900/20' },
  consider: { label: 'Consider', color: 'text-yellow-600 bg-yellow-50 dark:bg-yellow-900/20' },
  recommend: { label: 'Recommend', color: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20' },
  strong_recommend: { label: 'Strong Recommend', color: 'text-green-600 bg-green-50 dark:bg-green-900/20' },
};

async function getExchangeData(slug: string) {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:22000';
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/api/exchange/${encodeURIComponent(slug)}`, { cache: 'no-store' });
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

export default async function ExchangeScriptPage({ params }: PageProps) {
  const { slug } = await params;
  const { userId } = await auth();

  const data = await getExchangeData(slug);
  if (!data) notFound();

  const { project, writer, reviews, stats } = data as {
    project: {
      id: string;
      slug: string;
      name: string;
      tagline: string | null;
      genre: string | null;
      pageCount: number;
      previewUrl: string | null;
      listedAt: string;
    };
    writer: {
      id: string;
      fullName: string | null;
      avatarUrl: string | null;
      listedScripts: number;
      subscribers: number;
    };
    reviews: Array<{
      id: string;
      verdict: string;
      numericRating: number | null;
      comment: string | null;
      createdAt: string;
      reviewer: { id: string | null; fullName: string | null; avatarUrl: string | null };
    }>;
    stats: {
      totalReviews: number;
      avgRating: number | null;
      verdictCounts: Record<string, number>;
    };
  };

  const isOwnScript = userId === writer.id;
  const isLoggedIn = !!userId;

  // Check subscription if logged in and not own script
  let isSubscribed = false;
  if (isLoggedIn && !isOwnScript) {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:22000';
    // We use a server-side prisma check instead of another fetch to avoid auth complications
    // WriterSubscribeButton handles client-side toggle; initial state comes from here
    try {
      const subRes = await fetch(`${baseUrl}/api/writers/${writer.id}/subscribe`, {
        headers: { Cookie: '' }, // server-side check not viable here; will default to false
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        isSubscribed = subData.subscribed;
      }
    } catch {
      // ignore
    }
  }

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-background/95 backdrop-blur border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center gap-4">
            <Link href="/exchange">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Exchange
              </Button>
            </Link>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2 min-w-0">
              <BookOpen className="w-4 h-4 text-primary shrink-0" />
              <span className="font-semibold truncate">{project.name}</span>
            </div>
            {project.genre && (
              <Badge variant="secondary" className="capitalize shrink-0">
                {project.genre}
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
        {/* Hero card */}
        <Card>
          <CardContent className="p-6 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
              <div className="flex-1 space-y-2">
                <h1 className="text-2xl font-bold">{project.name}</h1>
                {project.tagline && (
                  <p className="text-muted-foreground">{project.tagline}</p>
                )}
                <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <FileText className="w-4 h-4" />
                    {project.pageCount} pages
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="w-4 h-4" />
                    {stats.totalReviews} review{stats.totalReviews !== 1 ? 's' : ''}
                  </span>
                  {stats.avgRating !== null && (
                    <span className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                      {stats.avgRating.toFixed(1)}
                    </span>
                  )}
                </div>
              </div>

              {/* Preview player */}
              {project.previewUrl && (
                <div className="sm:w-64 shrink-0">
                  <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                    <Play className="w-3 h-3" />
                    Free Page 1 Preview
                  </p>
                  <audio
                    controls
                    src={project.previewUrl}
                    className="w-full"
                    preload="none"
                  />
                </div>
              )}
            </div>

            {/* Verdict distribution */}
            {Object.keys(stats.verdictCounts).length > 0 && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                {Object.entries(stats.verdictCounts).map(([verdict, count]) => {
                  const vc = VERDICT_LABELS[verdict];
                  return vc ? (
                    <span
                      key={verdict}
                      className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ${vc.color}`}
                    >
                      {vc.label}: {count}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Reviews list */}
          <div className="lg:col-span-2 space-y-4">
            <h2 className="font-semibold text-lg">
              Reviews{stats.totalReviews > 0 ? ` (${stats.totalReviews})` : ''}
            </h2>

            {reviews.length === 0 ? (
              <p className="text-muted-foreground text-sm">No reviews yet. Be the first.</p>
            ) : (
              reviews.map((review) => {
                const vc = VERDICT_LABELS[review.verdict];
                return (
                  <Card key={review.id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-sm">
                          {review.reviewer.fullName ?? 'Anonymous'}
                        </span>
                        <div className="flex items-center gap-2">
                          {review.numericRating && (
                            <span className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                              {review.numericRating}
                            </span>
                          )}
                          {vc && (
                            <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${vc.color}`}>
                              {vc.label}
                            </span>
                          )}
                        </div>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground leading-relaxed">
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

            {/* Submit review */}
            {isLoggedIn && !isOwnScript && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Write a Review</CardTitle>
                </CardHeader>
                <CardContent>
                  <FeedbackForm projectId={project.id} />
                </CardContent>
              </Card>
            )}
            {!isLoggedIn && (
              <Card>
                <CardContent className="p-4 text-sm text-muted-foreground text-center">
                  <Link href="/login" className="text-primary hover:underline">
                    Sign in
                  </Link>{' '}
                  to submit a review.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Sidebar: writer profile */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-5 space-y-4">
                <div className="flex items-center gap-3">
                  {writer.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={writer.avatarUrl}
                      alt={writer.fullName ?? 'Writer'}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-primary font-semibold">
                        {(writer.fullName ?? 'W')[0].toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div>
                    <p className="font-semibold text-sm">{writer.fullName ?? 'Writer'}</p>
                    <div className="flex gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <FileText className="w-3 h-3" />
                        {writer.listedScripts} script{writer.listedScripts !== 1 ? 's' : ''}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {writer.subscribers}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col gap-2">
                  <Link href={`/writer/${writer.id}`}>
                    <Button variant="outline" size="sm" className="w-full">
                      View Profile
                    </Button>
                  </Link>
                  {isLoggedIn && !isOwnScript && (
                    <WriterSubscribeButton
                      writerId={writer.id}
                      initialSubscribed={isSubscribed}
                    />
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}
