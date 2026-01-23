'use client';

/**
 * StoryScore Component
 *
 * AI-powered 12-dimension screenplay evaluation with visual radar chart,
 * category breakdowns, and actionable feedback.
 *
 * Protected by STORY_SCORE feature flag.
 */

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  CheckCircle,
  TrendingUp,
  RefreshCw,
  History,
  FileText,
  Download,
} from 'lucide-react';
import {
  StoryScore as StoryScoreType,
  DIMENSIONS,
  CATEGORIES,
  RATINGS,
  DimensionKey,
  Category,
  Rating,
} from '@/lib/scoring/types';
import { ExportButton } from './ExportButton';

// =============================================================================
// Props
// =============================================================================

interface StoryScoreProps {
  projectId: string;
  scriptText: string;
  onScoreGenerated?: (score: StoryScoreType) => void;
}

// =============================================================================
// Radar Chart Component
// =============================================================================

function RadarChart({ scores }: { scores: StoryScoreType }) {
  const dimensions = Object.keys(DIMENSIONS) as DimensionKey[];
  const centerX = 150;
  const centerY = 150;
  const maxRadius = 120;
  const levels = 5; // Number of concentric circles

  // Calculate points for the polygon
  const points = dimensions.map((key, i) => {
    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
    const value = scores.dimensions[key].score / 10; // Normalize to 0-1
    const radius = maxRadius * value;
    return {
      x: centerX + radius * Math.cos(angle),
      y: centerY + radius * Math.sin(angle),
      label: DIMENSIONS[key].label,
      score: scores.dimensions[key].score,
      category: DIMENSIONS[key].category,
    };
  });

  // Create polygon path
  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z';

  // Create concentric circles
  const circles = Array.from({ length: levels }, (_, i) => {
    const radius = (maxRadius / levels) * (i + 1);
    return (
      <circle
        key={i}
        cx={centerX}
        cy={centerY}
        r={radius}
        fill="none"
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={1}
      />
    );
  });

  // Create axis lines
  const axes = dimensions.map((_, i) => {
    const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
    const x2 = centerX + maxRadius * Math.cos(angle);
    const y2 = centerY + maxRadius * Math.sin(angle);
    return (
      <line
        key={i}
        x1={centerX}
        y1={centerY}
        x2={x2}
        y2={y2}
        stroke="currentColor"
        strokeOpacity={0.1}
        strokeWidth={1}
      />
    );
  });

  // Category colors
  const categoryColors: Record<Category, string> = {
    concept: '#8b5cf6', // violet
    structure: '#3b82f6', // blue
    character: '#f59e0b', // amber
    craft: '#10b981', // emerald
  };

  return (
    <div className="flex justify-center">
      <svg width={300} height={300} className="text-slate-400 dark:text-slate-600">
        {/* Background circles */}
        {circles}
        {/* Axis lines */}
        {axes}
        {/* Score polygon */}
        <path
          d={polygonPath}
          fill="rgba(139, 92, 246, 0.2)"
          stroke="#8b5cf6"
          strokeWidth={2}
        />
        {/* Score dots */}
        {points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={4}
            fill={categoryColors[p.category as Category]}
            stroke="white"
            strokeWidth={2}
          />
        ))}
        {/* Labels */}
        {points.map((p, i) => {
          const angle = (Math.PI * 2 * i) / dimensions.length - Math.PI / 2;
          const labelRadius = maxRadius + 20;
          const labelX = centerX + labelRadius * Math.cos(angle);
          const labelY = centerY + labelRadius * Math.sin(angle);

          // Adjust text anchor based on position
          let textAnchor: 'start' | 'middle' | 'end' = 'middle';
          if (Math.cos(angle) > 0.1) textAnchor = 'start';
          if (Math.cos(angle) < -0.1) textAnchor = 'end';

          return (
            <text
              key={i}
              x={labelX}
              y={labelY}
              textAnchor={textAnchor}
              dominantBaseline="middle"
              className="text-[8px] fill-slate-500 dark:fill-slate-400"
            >
              {p.score.toFixed(0)}
            </text>
          );
        })}
      </svg>
    </div>
  );
}

// =============================================================================
// Category Card Component
// =============================================================================

function CategoryCard({
  category,
  score,
  dimensions,
}: {
  category: Category;
  score: number;
  dimensions: StoryScoreType['dimensions'];
}) {
  const config = CATEGORIES[category];
  const dimKeys = config.dimensions;

  const colorMap: Record<Category, string> = {
    concept: 'border-violet-500 bg-violet-50 dark:bg-violet-950/20',
    structure: 'border-blue-500 bg-blue-50 dark:bg-blue-950/20',
    character: 'border-amber-500 bg-amber-50 dark:bg-amber-950/20',
    craft: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/20',
  };

  const progressColorMap: Record<Category, string> = {
    concept: '[&>div]:bg-violet-500',
    structure: '[&>div]:bg-blue-500',
    character: '[&>div]:bg-amber-500',
    craft: '[&>div]:bg-emerald-500',
  };

  return (
    <div className={`p-4 rounded-lg border-l-4 ${colorMap[category]}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">{config.icon}</span>
          <span className="font-semibold capitalize">{config.label}</span>
        </div>
        <span className="text-2xl font-bold">{score.toFixed(1)}</span>
      </div>
      <div className="space-y-2">
        {dimKeys.map((key) => {
          const dim = dimensions[key];
          const dimConfig = DIMENSIONS[key];
          return (
            <div key={key}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">{dimConfig.label}</span>
                <span className="font-medium">{dim.score.toFixed(1)}</span>
              </div>
              <Progress
                value={dim.score * 10}
                className={`h-1.5 ${progressColorMap[category]}`}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function StoryScore({
  projectId,
  scriptText,
  onScoreGenerated,
}: StoryScoreProps) {
  const [score, setScore] = useState<StoryScoreType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  // Fetch existing score on mount
  const fetchScore = useCallback(async () => {
    setIsFetching(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/score`);
      if (!response.ok) {
        if (response.status === 404 || response.status === 403) {
          // No score exists or feature disabled
          setScore(null);
          return;
        }
        throw new Error('Failed to fetch score');
      }

      const data = await response.json();
      if (data.score) {
        setScore(data.score);
      }
    } catch (err) {
      console.error('Failed to fetch score:', err);
      // Don't show error for fetch failures - just show generate button
    } finally {
      setIsFetching(false);
    }
  }, [projectId]);

  useEffect(() => {
    fetchScore();
  }, [fetchScore]);

  // Generate new score
  const generateScore = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate score');
      }

      const data = await response.json();
      if (data.success && data.score) {
        setScore(data.score);
        onScoreGenerated?.(data.score);
      } else {
        throw new Error(data.error || 'Failed to generate score');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

  // Loading skeleton
  if (isFetching) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-64 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-32 w-full" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        </CardContent>
      </Card>
    );
  }

  // No score yet - show generate button
  if (!score) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-violet-500" />
            StoryScore
            <Badge variant="secondary" className="ml-2">Beta</Badge>
          </CardTitle>
          <CardDescription>
            AI-powered analysis across 12 dimensions of screenplay craft and commercial viability
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-start gap-2 text-red-600 dark:text-red-400 mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
              <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
              <div>
                <p className="font-medium">Analysis failed</p>
                <p className="text-sm">{error}</p>
              </div>
            </div>
          )}

          <div className="flex flex-col items-center text-center py-6">
            <div className="w-16 h-16 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mb-4">
              <BarChart3 className="w-8 h-8 text-violet-500" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Ready to Analyze</h3>
            <p className="text-muted-foreground text-sm mb-4 max-w-sm">
              Get professional-grade feedback on your screenplay across concept, structure,
              character, and craft dimensions.
            </p>
            <Button onClick={generateScore} disabled={isLoading} size="lg">
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Analyzing Script...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate StoryScore
                </>
              )}
            </Button>
            <p className="text-xs text-muted-foreground mt-3">
              Analysis takes 30-60 seconds depending on script length
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Show score
  const ratingConfig = RATINGS[score.rating as Rating];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-500" />
              StoryScore
              <Badge variant="secondary" className="ml-2">v{score.version}</Badge>
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              <span>Analyzed {new Date(score.createdAt).toLocaleDateString()}</span>
              <span className="text-muted-foreground">•</span>
              <span className="text-muted-foreground">
                {Math.round(score.confidence * 100)}% confidence
              </span>
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-slate-900 dark:text-white">
              {score.overallScore.toFixed(1)}
            </div>
            <Badge className={`${ratingConfig.bgColor} text-white`}>
              {ratingConfig.label}
            </Badge>
            <p className="text-xs text-muted-foreground mt-1">{ratingConfig.description}</p>
          </div>
        </div>
        <div className="flex justify-end mt-3">
          <ExportButton projectId={projectId} />
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Radar Chart */}
        <RadarChart scores={score} />

        {/* Category Cards */}
        <div className="grid md:grid-cols-2 gap-4">
          {(Object.keys(CATEGORIES) as Category[]).map((category) => (
            <CategoryCard
              key={category}
              category={category}
              score={score.categoryScores[category]}
              dimensions={score.dimensions}
            />
          ))}
        </div>

        {/* Expand/Collapse Detailed Reasoning */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Hide Detailed Reasoning
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              View Detailed Reasoning
            </>
          )}
        </Button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
            {(Object.keys(DIMENSIONS) as DimensionKey[]).map((key) => {
              const dim = score.dimensions[key];
              const config = DIMENSIONS[key];
              return (
                <div key={key} className="border-b border-border/50 pb-4 last:border-0 last:pb-0">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <span className="font-medium">{config.label}</span>
                      <span className="text-xs text-muted-foreground ml-2 capitalize">
                        ({config.category})
                      </span>
                    </div>
                    <Badge variant={dim.score >= 7 ? 'default' : dim.score >= 5 ? 'secondary' : 'destructive'}>
                      {dim.score.toFixed(1)}/10
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">{dim.reasoning}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Strengths
            </h4>
            <ul className="space-y-2">
              {score.strengths.map((s, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-green-500 mt-1">•</span>
                  <span>{s}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="space-y-3">
            <h4 className="font-semibold flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-amber-500" />
              Areas for Improvement
            </h4>
            <ul className="space-y-2">
              {score.weaknesses.map((w, i) => (
                <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                  <span className="text-amber-500 mt-1">•</span>
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2 pt-4 border-t">
          <Button
            variant="outline"
            size="sm"
            onClick={generateScore}
            disabled={isLoading}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Rescore
          </Button>
          <Button variant="outline" size="sm" disabled>
            <History className="w-4 h-4 mr-2" />
            View History
          </Button>
          <Button variant="outline" size="sm" disabled>
            <FileText className="w-4 h-4 mr-2" />
            Get Suggestions
          </Button>
          <Button variant="outline" size="sm" disabled>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default StoryScore;
