export const dynamic = 'force-dynamic';

import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/db';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';
import Stripe from 'stripe';

function getStripe(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('STRIPE_SECRET_KEY is not configured');
  return new Stripe(key);
}

export default async function ReaderUploadSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string }>;
}) {
  const { userId } = await auth();
  if (!userId) redirect('/login');

  const { session_id: sessionId } = await searchParams;
  if (!sessionId) redirect('/reader/upload');

  // Retrieve the Stripe session to get the purchase ID from metadata.
  // Defense-in-depth: verify session belongs to the caller before resolving projectId.
  let projectId: string | null = null;
  try {
    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status === 'paid' && session.metadata?.purchaseId) {
      // Reject if the session was created for a different user
      if (session.metadata.userId && session.metadata.userId !== userId) {
        redirect('/reader/dashboard');
      }
      // Scope the purchase lookup to the authenticated user — prevents IDOR
      const purchase = await prisma.purchase.findFirst({
        where: { id: session.metadata.purchaseId, userId },
        select: { projectId: true },
      });
      projectId = purchase?.projectId ?? null;
    }
  } catch {
    // If Stripe lookup fails, still show success — webhook will have handled the purchase
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          <CheckCircle className="w-14 h-14 text-green-500 mx-auto" />
          <h1 className="text-xl font-semibold">Payment successful!</h1>
          <p className="text-sm text-muted-foreground">
            Your script is being processed. You'll receive an email when your audio is ready.
          </p>
          <div className="flex flex-col gap-2 pt-2">
            {projectId ? (
              <Link href={`/projects/${projectId}`}>
                <Button className="w-full brand-gradient brand-gradient-hover">View Project</Button>
              </Link>
            ) : null}
            <Link href="/reader/dashboard">
              <Button variant={projectId ? 'outline' : 'default'} className="w-full">
                Go to Reader Dashboard
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
