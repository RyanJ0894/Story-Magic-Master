import { auth } from '@clerk/nextjs/server';
import { redirect } from 'next/navigation';
import { StoryBuilderWizard } from '@/components/impact/StoryBuilderWizard';
import Link from 'next/link';

export const metadata = {
  title: 'StoryBuilder — Create Your Audio Story',
};

export default async function BuildPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect('/login?redirect_url=/impact/build');
  }

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Minimal header */}
      <header className="border-b border-zinc-800 px-4 py-3 flex items-center justify-between">
        <Link href="/impact" className="text-zinc-400 hover:text-white text-sm transition-colors">
          ← Impact
        </Link>
        <span className="text-sm text-zinc-500">Story Magic Impact StoryBuilder</span>
        <div className="w-16" />
      </header>

      <StoryBuilderWizard />
    </div>
  );
}
