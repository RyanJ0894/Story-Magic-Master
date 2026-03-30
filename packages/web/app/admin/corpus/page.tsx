export const dynamic = 'force-dynamic';

import { prisma } from '@/lib/db';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Dataset category → color
const CATEGORY_COLORS: Record<string, string> = {
  'Oscar Winner': 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
  'Black List': 'bg-blue-500/20 text-blue-300 border-blue-500/40',
  'Produced Benchmark': 'bg-green-500/20 text-green-300 border-green-500/40',
  'Weak Film': 'bg-red-500/20 text-red-300 border-red-500/40',
  'TV Benchmark': 'bg-purple-500/20 text-purple-300 border-purple-500/40',
};

function CategoryBadge({ category }: { category: string | null }) {
  const cls = CATEGORY_COLORS[category ?? ''] ?? 'bg-zinc-500/20 text-zinc-300 border-zinc-500/40';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${cls}`}>
      {category ?? 'Unknown'}
    </span>
  );
}

function scoreColor(score: number): string {
  if (score >= 8) return 'text-green-400';
  if (score >= 6) return 'text-yellow-400';
  if (score >= 4) return 'text-orange-400';
  return 'text-red-400';
}

export default async function AdminCorpusPage() {
  // Stats
  const [totalCorpus, scoredCount, categoryStats] = await Promise.all([
    prisma.scriptCorpus.count({ where: { datasetCategory: { not: null } } }),
    prisma.scriptCorpus.count({
      where: {
        datasetCategory: { not: null },
        corpusScores: { some: {} },
      },
    }),
    prisma.scriptCorpus.groupBy({
      by: ['datasetCategory'],
      where: { datasetCategory: { not: null } },
      _count: { id: true },
    }),
  ]);

  // Scored scripts with latest corpus score
  const scripts = await prisma.scriptCorpus.findMany({
    where: { datasetCategory: { not: null } },
    select: {
      id: true,
      title: true,
      datasetCategory: true,
      genre: true,
      pageCount: true,
      sceneCount: true,
      dialoguePct: true,
      corpusScores: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: {
          overallScore: true,
          conceptScore: true,
          structureScore: true,
          characterScore: true,
          craftScore: true,
          modelVersion: true,
        },
      },
    },
    orderBy: [
      { datasetCategory: 'asc' },
      { title: 'asc' },
    ],
  });

  // Calibration stats: avg by category
  const calibrationStats: Record<string, { avg: number; count: number; min: number; max: number }> = {};
  for (const script of scripts) {
    const latestScore = script.corpusScores[0];
    if (!latestScore) continue;
    const cat = script.datasetCategory ?? 'Unknown';
    const s = Number(latestScore.overallScore);
    if (!calibrationStats[cat]) {
      calibrationStats[cat] = { avg: s, count: 1, min: s, max: s };
    } else {
      const prev = calibrationStats[cat];
      prev.count++;
      prev.avg = (prev.avg * (prev.count - 1) + s) / prev.count;
      prev.min = Math.min(prev.min, s);
      prev.max = Math.max(prev.max, s);
    }
  }

  const oscarAvg = calibrationStats['Oscar Winner']?.avg ?? 0;
  const weakAvg = calibrationStats['Weak Film']?.avg ?? 0;
  const spread = oscarAvg - weakAvg;
  const calibrationHealthy = spread >= 2.5;

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-bold text-white">StoryScore Calibration Corpus</h1>
        <p className="text-zinc-400 mt-1">
          Training dataset for few-shot calibration. Run <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded">pnpm ingest:training</code> then <code className="text-xs bg-zinc-800 px-1 py-0.5 rounded">pnpm score:corpus</code> to populate.
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Training Scripts</CardDescription>
            <CardTitle className="text-3xl">{totalCorpus}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Scored</CardDescription>
            <CardTitle className="text-3xl">{scoredCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader className="pb-2">
            <CardDescription>Coverage</CardDescription>
            <CardTitle className="text-3xl">
              {totalCorpus > 0 ? Math.round((scoredCount / totalCorpus) * 100) : 0}%
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className={`border ${calibrationHealthy ? 'bg-green-900/20 border-green-800' : spread > 0 ? 'bg-yellow-900/20 border-yellow-800' : 'bg-zinc-900 border-zinc-800'}`}>
          <CardHeader className="pb-2">
            <CardDescription>Calibration Spread</CardDescription>
            <CardTitle className={`text-3xl ${calibrationHealthy ? 'text-green-400' : 'text-yellow-400'}`}>
              {spread > 0 ? spread.toFixed(2) : '—'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-zinc-500">
              {spread > 0
                ? `Oscar avg ${oscarAvg.toFixed(1)} vs Weak avg ${weakAvg.toFixed(1)}`
                : 'Score corpus to see spread'}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Breakdown */}
      {Object.keys(calibrationStats).length > 0 && (
        <Card className="bg-zinc-900 border-zinc-800">
          <CardHeader>
            <CardTitle className="text-base">Score Distribution by Category</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {['Oscar Winner', 'Black List', 'Produced Benchmark', 'TV Benchmark', 'Weak Film'].map(cat => {
                const stat = calibrationStats[cat];
                if (!stat) return null;
                const barWidth = Math.round((stat.avg / 10) * 100);
                return (
                  <div key={cat} className="flex items-center gap-3">
                    <div className="w-44 flex-shrink-0">
                      <CategoryBadge category={cat} />
                    </div>
                    <div className="flex-1 h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-violet-500 rounded-full"
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <div className="w-36 text-xs text-zinc-400 flex-shrink-0">
                      avg {stat.avg.toFixed(2)} ({stat.min.toFixed(1)}–{stat.max.toFixed(1)}) n={stat.count}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Scripts Table */}
      <Card className="bg-zinc-900 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-base">
            Training Scripts ({scripts.length})
          </CardTitle>
          <CardDescription>
            Scripts without scores need <code className="text-xs bg-zinc-800 px-1 rounded">pnpm score:corpus</code>
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-zinc-800">
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead className="text-right">Overall</TableHead>
                <TableHead className="text-right">Concept</TableHead>
                <TableHead className="text-right">Structure</TableHead>
                <TableHead className="text-right">Character</TableHead>
                <TableHead className="text-right">Craft</TableHead>
                <TableHead className="text-right">Pages</TableHead>
                <TableHead>Model</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {scripts.map(script => {
                const score = script.corpusScores[0];
                return (
                  <TableRow key={script.id} className="border-zinc-800">
                    <TableCell className="font-medium text-white">
                      {script.title}
                    </TableCell>
                    <TableCell>
                      <CategoryBadge category={script.datasetCategory} />
                    </TableCell>
                    <TableCell className="text-right">
                      {score ? (
                        <span className={`font-bold ${scoreColor(Number(score.overallScore))}`}>
                          {Number(score.overallScore).toFixed(2)}
                        </span>
                      ) : (
                        <span className="text-zinc-600">—</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {score ? Number(score.conceptScore).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {score ? Number(score.structureScore).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {score ? Number(score.characterScore).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm">
                      {score ? Number(score.craftScore).toFixed(1) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-sm text-zinc-500">
                      {script.pageCount ?? '—'}
                    </TableCell>
                    <TableCell className="text-xs text-zinc-500">
                      {score?.modelVersion?.replace('claude-', '').replace('gemini-', 'g-') ?? '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
