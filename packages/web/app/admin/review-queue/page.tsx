export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ReviewDecisionButton } from '@/components/admin/ReviewDecisionButton';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    approved: 'bg-green-500/20 text-green-300 border-green-500/30',
    rejected: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? map.pending}`}>
      {status}
    </span>
  );
}

export default async function ReviewQueuePage() {
  const reviews = await prisma.humanReview.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'asc' },
    select: {
      id: true,
      status: true,
      createdAt: true,
      notifiedReviewerAt: true,
      amountCents: true,
      projectId: true,
      jobId: true,
      userId: true,
      project: { select: { name: true } },
    },
  });

  // Enrich with audio URL and customer info
  const enriched = await Promise.all(
    reviews.map(async (review) => {
      const [audioOutput, profile] = await Promise.all([
        prisma.audioOutput.findFirst({
          where: { jobId: review.jobId },
          orderBy: { createdAt: 'desc' },
          select: { filePath: true },
        }),
        prisma.profile.findUnique({
          where: { id: review.userId },
          select: { fullName: true, email: true },
        }),
      ]);

      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const audioUrl = audioOutput?.filePath && supabaseUrl
        ? `${supabaseUrl}/storage/v1/object/public/${audioOutput.filePath}`
        : null;

      return { ...review, audioUrl, customerName: profile?.fullName, customerEmail: profile?.email };
    }),
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-foreground mb-2">Review Queue</h1>
      <p className="text-muted-foreground mb-6 text-sm">
        White-glove audio reviews awaiting approval ({enriched.length} pending)
      </p>

      {enriched.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            No pending reviews.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {enriched.map((review) => (
            <Card key={review.id} className="bg-card border-border">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <CardTitle className="text-base font-semibold text-foreground">
                      {review.project.name ?? 'Untitled project'}
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      {review.customerName ?? review.customerEmail ?? review.userId} ·{' '}
                      {new Date(review.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <StatusBadge status={review.status} />
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {review.audioUrl && (
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Generated audio</p>
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <audio controls className="w-full" src={review.audioUrl} />
                  </div>
                )}
                <ReviewDecisionButton reviewId={review.id} />
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
