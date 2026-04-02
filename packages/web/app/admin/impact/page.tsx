export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { IMPACT_CATEGORIES } from '@/lib/impact/categories';
import { ApproveStoryButton } from '@/components/admin/ApproveStoryButton';

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    complete: 'bg-green-500/20 text-green-300 border-green-500/30',
    processing: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
    draft: 'bg-zinc-700/40 text-zinc-400 border-zinc-600/30',
    failed: 'bg-red-500/20 text-red-300 border-red-500/30',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${map[status] ?? map.draft}`}>
      {status}
    </span>
  );
}

export default async function AdminImpactPage() {
  const [
    totalStories,
    pendingApproval,
    completedStories,
    prizeEligible,
    partnerCount,
    recentStories,
    pendingPartners,
    catCountRows,
  ] = await Promise.all([
    prisma.impactStory.count(),
    prisma.impactStory.count({ where: { isPublic: true, isApproved: false } }),
    prisma.impactStory.count({ where: { status: 'complete' } }),
    prisma.impactStory.count({ where: { prizeEligible: true, status: 'complete' } }),
    prisma.impactPartner.count({ where: { isActive: true } }),
    prisma.impactStory.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: {
        id: true,
        title: true,
        category: true,
        authorName: true,
        status: true,
        isPublic: true,
        isApproved: true,
        prizeEligible: true,
        createdAt: true,
        audioUrl: true,
      },
    }),
    prisma.impactPartner.findMany({
      where: { isActive: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    prisma.impactStory.groupBy({
      by: ['category'],
      _count: { id: true },
    }),
  ]);

  const catCountMap = Object.fromEntries(catCountRows.map(r => [r.category, r._count.id]));

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Impact StoryBuilder</h1>
        <p className="text-zinc-400 mt-1">Manage community stories, approvals, and partner inquiries.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total Stories', value: totalStories },
          { label: 'Completed', value: completedStories },
          { label: 'Pending Approval', value: pendingApproval, alert: pendingApproval > 0 },
          { label: 'Prize Eligible', value: prizeEligible },
          { label: 'Active Partners', value: partnerCount },
        ].map(stat => (
          <Card key={stat.label} className={`${stat.alert ? 'bg-yellow-900/20 border-yellow-700' : 'bg-zinc-900 border-zinc-800'}`}>
            <CardHeader className="pb-2">
              <CardDescription>{stat.label}</CardDescription>
              <CardTitle className={`text-3xl ${stat.alert ? 'text-yellow-300' : ''}`}>{stat.value}</CardTitle>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Category breakdown */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Stories by Category</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {IMPACT_CATEGORIES.map(cat => (
              <div key={cat.id} className="text-center">
                <div className="text-xl mb-1">{cat.emoji}</div>
                <div className="text-lg font-bold text-white">{catCountMap[cat.id] ?? 0}</div>
                <div className="text-xs text-zinc-500">{cat.label.split(' ')[0]}</div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pending approval */}
      {pendingApproval > 0 && (
        <Card className="bg-yellow-900/20 border-yellow-700">
          <CardHeader>
            <CardTitle className="text-base text-yellow-300">Pending Gallery Approval ({pendingApproval})</CardTitle>
            <CardDescription>These stories are marked public but await admin approval before appearing in the gallery.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {recentStories
              .filter(s => s.isPublic && !s.isApproved)
              .map(story => (
                <div key={story.id} className="flex items-center justify-between gap-4 p-3 bg-zinc-900 rounded-lg">
                  <div>
                    <p className="text-sm font-medium text-white">{story.title}</p>
                    <p className="text-xs text-zinc-400">
                      {IMPACT_CATEGORIES.find(c => c.id === story.category)?.label} ·{' '}
                      {story.authorName ?? 'Anonymous'} ·{' '}
                      {new Date(story.createdAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    {story.audioUrl && (
                      <audio controls src={story.audioUrl} className="h-8 w-32" preload="none" />
                    )}
                    <ApproveStoryButton storyId={story.id} />
                  </div>
                </div>
              ))}
          </CardContent>
        </Card>
      )}

      {/* Partner inquiries */}
      {pendingPartners.length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">New Partner Inquiries ({pendingPartners.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {pendingPartners.map(partner => (
              <div key={partner.id} className="p-3 bg-zinc-800 rounded-lg space-y-1">
                <p className="text-sm font-medium text-white">{partner.companyName}</p>
                <p className="text-xs text-zinc-400">
                  Tier: {partner.tier} · {partner.contactEmail}
                  {partner.contactName ? ` · ${partner.contactName}` : ''}
                </p>
                {partner.notes && <p className="text-xs text-zinc-500 italic">{partner.notes}</p>}
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Recent stories table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">Recent Stories ({recentStories.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800">
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Title</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Category</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Author</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Status</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Public</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Prize</th>
                  <th className="text-left px-4 py-2 text-xs text-zinc-400 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recentStories.map(story => (
                  <tr key={story.id} className="border-b border-zinc-800/50">
                    <td className="px-4 py-2 text-white font-medium text-xs max-w-[180px] truncate">{story.title}</td>
                    <td className="px-4 py-2 text-xs text-zinc-400">
                      {IMPACT_CATEGORIES.find(c => c.id === story.category)?.emoji}{' '}
                      {story.category}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400">{story.authorName ?? 'Anonymous'}</td>
                    <td className="px-4 py-2"><StatusBadge status={story.status} /></td>
                    <td className="px-4 py-2 text-xs">
                      {story.isPublic ? (story.isApproved ? '✓ Approved' : '⏳ Pending') : '—'}
                    </td>
                    <td className="px-4 py-2 text-xs text-zinc-400">{story.prizeEligible ? '✓' : '—'}</td>
                    <td className="px-4 py-2 text-xs text-zinc-500">{new Date(story.createdAt).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
