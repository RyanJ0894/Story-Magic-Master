'use client';

/**
 * StoryScore Component
 *
 * AI-powered 12-dimension screenplay evaluation.
 * Protected by STORY_SCORE feature flag.
 *
 * Usage:
 *   <FeatureGate feature="STORY_SCORE">
 *     <StoryScore projectId={project.id} scriptText={project.script_text} />
 *   </FeatureGate>
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Loader2,
  BarChart3,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertCircle,
  CheckCircle,
  TrendingUp,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface StoryScoreData {
  id: string;
  version: number;
  overallScore: number;
  rating: 'RECOMMEND' | 'CONSIDER' | 'PASS';
  dimensions: {
    premiseOriginality: DimensionScore;
    loglineClarity: DimensionScore;
    commercialViability: DimensionScore;
    threeActIntegrity: DimensionScore;
    pacingMomentum: DimensionScore;
    stakesEscalation: DimensionScore;
    protagonistArc: DimensionScore;
    supportingCast: DimensionScore;
    castability: DimensionScore;
    dialogueQuality: DimensionScore;
    visualStorytelling: DimensionScore;
    technicalExecution: DimensionScore;
  };
  categoryScores: {
    concept: number;
    structure: number;
    character: number;
    craft: number;
  };
  strengths: string[];
  weaknesses: string[];
  confidence: number;
  createdAt: string;
}

interface DimensionScore {
  score: number;
  reasoning: string;
}

interface StoryScoreProps {
  projectId: string;
  scriptText: string;
  existingScore?: StoryScoreData | null;
  onScoreGenerated?: (score: StoryScoreData) => void;
}

// =============================================================================
// Constants
// =============================================================================

const DIMENSION_CONFIG = {
  premiseOriginality: { label: 'Premise Originality', category: 'concept', weight: 10 },
  loglineClarity: { label: 'Logline Clarity', category: 'concept', weight: 8 },
  commercialViability: { label: 'Commercial Viability', category: 'concept', weight: 7 },
  threeActIntegrity: { label: 'Three-Act Integrity', category: 'structure', weight: 10 },
  pacingMomentum: { label: 'Pacing & Momentum', category: 'structure', weight: 8 },
  stakesEscalation: { label: 'Stakes & Escalation', category: 'structure', weight: 7 },
  protagonistArc: { label: 'Protagonist Arc', category: 'character', weight: 10 },
  supportingCast: { label: 'Supporting Cast', category: 'character', weight: 8 },
  castability: { label: 'Castability', category: 'character', weight: 7 },
  dialogueQuality: { label: 'Dialogue Quality', category: 'craft', weight: 10 },
  visualStorytelling: { label: 'Visual Storytelling', category: 'craft', weight: 8 },
  technicalExecution: { label: 'Technical Execution', category: 'craft', weight: 7 },
} as const;

const RATING_CONFIG = {
  RECOMMEND: { color: 'bg-green-500', label: 'Recommend', description: 'Ready for market' },
  CONSIDER: { color: 'bg-yellow-500', label: 'Consider', description: 'Strong potential with revisions' },
  PASS: { color: 'bg-red-500', label: 'Pass', description: 'Needs significant work' },
} as const;

const CATEGORY_ICONS = {
  concept: '💡',
  structure: '📐',
  character: '👤',
  craft: '✍️',
} as const;

// =============================================================================
// Component
// =============================================================================

export function StoryScore({
  projectId,
  scriptText,
  existingScore,
  onScoreGenerated,
}: StoryScoreProps) {
  const [score, setScore] = useState<StoryScoreData | null>(existingScore || null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const generateScore = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${projectId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scriptText }),
      });

      if (!response.ok) {
        throw new Error('Failed to generate score');
      }

      const data = await response.json();
      setScore(data);
      onScoreGenerated?.(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };

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
            AI-powered analysis across 12 dimensions of screenplay craft
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="flex items-center gap-2 text-red-600 mb-4">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </div>
          )}
          <Button onClick={generateScore} disabled={isLoading}>
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
          <p className="text-sm text-muted-foreground mt-2">
            Takes about 30-60 seconds to analyze your script
          </p>
        </CardContent>
      </Card>
    );
  }

  // Show score
  const ratingConfig = RATING_CONFIG[score.rating];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-violet-500" />
              StoryScore
              <Badge variant="secondary" className="ml-2">v{score.version}</Badge>
            </CardTitle>
            <CardDescription>
              Last analyzed: {new Date(score.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold">{score.overallScore.toFixed(1)}</div>
            <Badge className={ratingConfig.color}>{ratingConfig.label}</Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Category Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {(Object.entries(score.categoryScores) as [keyof typeof CATEGORY_ICONS, number][]).map(
            ([category, categoryScore]) => (
              <div key={category} className="text-center p-3 bg-muted rounded-lg">
                <div className="text-2xl mb-1">{CATEGORY_ICONS[category]}</div>
                <div className="text-sm font-medium capitalize">{category}</div>
                <div className="text-lg font-bold">{categoryScore.toFixed(1)}</div>
              </div>
            )
          )}
        </div>

        {/* Expand/Collapse */}
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          {isExpanded ? (
            <>
              <ChevronUp className="w-4 h-4 mr-2" />
              Hide Details
            </>
          ) : (
            <>
              <ChevronDown className="w-4 h-4 mr-2" />
              View All 12 Dimensions
            </>
          )}
        </Button>

        {/* Expanded Details */}
        {isExpanded && (
          <div className="space-y-4">
            {(Object.entries(score.dimensions) as [keyof typeof DIMENSION_CONFIG, DimensionScore][]).map(
              ([key, dim]) => {
                const config = DIMENSION_CONFIG[key];
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{config.label}</span>
                      <span className="font-bold">{dim.score}/10</span>
                    </div>
                    <Progress value={dim.score * 10} className="h-2" />
                    <p className="text-xs text-muted-foreground">{dim.reasoning}</p>
                  </div>
                );
              }
            )}
          </div>
        )}

        {/* Strengths & Weaknesses */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              Strengths
            </h4>
            <ul className="text-sm space-y-1">
              {score.strengths.map((s, i) => (
                <li key={i} className="text-muted-foreground">• {s}</li>
              ))}
            </ul>
          </div>
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-yellow-500" />
              Areas for Improvement
            </h4>
            <ul className="text-sm space-y-1">
              {score.weaknesses.map((w, i) => (
                <li key={i} className="text-muted-foreground">• {w}</li>
              ))}
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={generateScore} disabled={isLoading}>
            {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Rescore'}
          </Button>
          <Button variant="outline" disabled>
            Get Suggestions
          </Button>
          <Button variant="outline" disabled>
            Export Report
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

export default StoryScore;
