import { auth } from '@clerk/nextjs/server';
import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft } from 'lucide-react';
import { ReaderUploadClient } from '@/components/reader/upload-client';

export default async function ReaderUploadPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login');
  }

  // Get profile
  const profile = await prisma.profile.findUnique({
    where: { id: userId },
  });

  return (
    <div className="min-h-screen bg-muted">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-4">
              <Link href="/reader/dashboard">
                <Button variant="ghost" size="sm">
                  <ChevronLeft className="w-4 h-4 mr-1" />
                  Back
                </Button>
              </Link>
              <div className="h-6 w-px bg-muted" />
              <Link href="/" className="font-bold text-xl">
                Story Magic
              </Link>
              <Badge variant="outline">Reader</Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Upload a Script</h1>
          <p className="text-muted-foreground">
            Upload a PDF screenplay and we&apos;ll convert it to immersive audio
          </p>
        </div>

        <ReaderUploadClient userId={userId} />
      </main>
    </div>
  );
}
