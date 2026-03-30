export const dynamic = 'force-dynamic';

import Link from 'next/link';
import { prisma } from '@/lib/db';
import { IMPACT_CATEGORIES } from '@/lib/impact/categories';

export const metadata = {
  title: 'Impact Story Gallery — Story Magic',
  description: 'Listen to personal stories of resilience, recovery, and triumph from the Story Magic Impact community.',
};

interface PageProps {
  searchParams: Promise<{ category?: string; page?: string }>;
}

function CategoryBadge({ category }: { category: string }) {
  const cat = IMPACT_CATEGORIES.find(c => c.id === category);
  return (
    <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-violet-900/30 text-violet-300 border border-violet-700/30">
      {cat?.emoji} {cat?.label ?? category}
    </span>
  );
}

export default async function GalleryPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const category = params.category;
  const page = Math.max(1, Number(params.page ?? '1'));
  const limit = 12;

  const where = {
    isPublic: true,
    isApproved: true,
    status: 'complete',
    ...(category ? { category } : {}),
  };

  const [stories, total] = await Promise.all([
    prisma.impactStory.findMany({
      where,
      select: {
        id: true,
        title: true,
        category: true,
        authorName: true,
        authorCity: true,
        audioUrl: true,
        playCount: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.impactStory.count({ where }),
  ]);

  const pages = Math.ceil(total / limit);

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <div className="border-b border-zinc-800 px-4 py-3 flex items-center gap-3">
        <Link href="/impact" className="text-zinc-400 hover:text-white text-sm">← Impact</Link>
        <span className="text-zinc-700">|</span>
        <h1 className="text-sm font-semibold text-white">Community Story Gallery</h1>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-10">
        {/* Category filter */}
        <div className="flex gap-2 flex-wrap mb-8">
          <Link
            href="/impact/stories"
            className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
              !category ? 'bg-violet-600 text-white border-violet-500' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-violet-600'
            }`}
          >
            All Stories
          </Link>
          {IMPACT_CATEGORIES.map(cat => (
            <Link
              key={cat.id}
              href={`/impact/stories?category=${cat.id}`}
              className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                category === cat.id ? 'bg-violet-600 text-white border-violet-500' : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:border-violet-600'
              }`}
            >
              {cat.emoji} {cat.label}
            </Link>
          ))}
        </div>

        {stories.length === 0 ? (
          <div className="text-center py-20">
            <div className="text-4xl mb-4">🌱</div>
            <p className="text-zinc-400">No stories here yet. Be the first to share yours.</p>
            <Link href="/impact/build" className="mt-4 inline-block px-6 py-2 text-sm font-medium rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors">
              Share my story
            </Link>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {stories.map(story => (
                <div key={story.id} className="bg-zinc-900 border border-zinc-800 rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold text-white text-sm leading-snug">{story.title}</h3>
                    <CategoryBadge category={story.category} />
                  </div>
                  <div className="text-xs text-zinc-500">
                    {story.authorName ?? 'Anonymous'}
                    {story.authorCity ? ` · ${story.authorCity}` : ''}
                  </div>
                  {story.audioUrl && (
                    <audio controls src={story.audioUrl} className="w-full h-8" preload="none" />
                  )}
                  <div className="flex items-center gap-3 text-xs text-zinc-600">
                    <span>🎧 {story.playCount} listens</span>
                    <span>{new Date(story.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="flex justify-center gap-2 mt-8">
                {page > 1 && (
                  <Link
                    href={`/impact/stories?${category ? `category=${category}&` : ''}page=${page - 1}`}
                    className="px-3 py-1 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  >
                    ← Prev
                  </Link>
                )}
                <span className="px-3 py-1 text-sm text-zinc-500">
                  {page} / {pages}
                </span>
                {page < pages && (
                  <Link
                    href={`/impact/stories?${category ? `category=${category}&` : ''}page=${page + 1}`}
                    className="px-3 py-1 text-sm rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700"
                  >
                    Next →
                  </Link>
                )}
              </div>
            )}
          </>
        )}

        <div className="mt-12 text-center">
          <Link
            href="/impact/build"
            className="px-8 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-semibold text-sm transition-colors"
          >
            Share your story — it&apos;s free
          </Link>
        </div>
      </div>
    </div>
  );
}
