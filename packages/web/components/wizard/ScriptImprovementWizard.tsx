'use client';

/**
 * ScriptImprovementWizard Component
 *
 * Guides users through the script improvement workflow:
 * 1. Score Analysis - Get StoryScore for current draft
 * 2. Review Suggestions - AI-powered improvement suggestions
 * 3. Make Revisions - Apply changes to the script
 * 4. Compare & Finalize - See score improvement
 */

import { useState, useCallback } from 'react';
import { Wizard, WizardStep, WizardContext } from './Wizard';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  BarChart3,
  Lightbulb,
  Edit3,
  TrendingUp,
  Loader2,
  CheckCircle,
  AlertCircle,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { StoryScore } from '@/lib/scoring/types';
import { Suggestion } from '@/lib/adviser/types';

// =============================================================================
// Props
// =============================================================================

interface ScriptImprovementWizardProps {
  projectId: string;
  scriptText: string;
  existingScore?: StoryScore | null;
  onComplete?: (data: { scoreImprovement: number }) => void;
  onCancel?: () => void;
}

// =============================================================================
// Step Components
// =============================================================================

function ScoreAnalysisStep({ context }: { context: WizardContext }) {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [score, setScore] = useState<StoryScore | null>(
    (context.data.existingScore as StoryScore) || null
  );
  const [error, setError] = useState<string | null>(null);

  const analyzeScript = async () => {
    setIsAnalyzing(true);
    setError(null);

    try {
      const response = await fetch(`/api/projects/${context.data.projectId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error('Failed to analyze script');
      }

      const data = await response.json();
      setScore(data.score);
      context.setData('initialScore', data.score);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Analysis failed');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (score) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center">
          <div className="w-32 h-32 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
            <span className="text-4xl font-bold text-white">{score.overallScore}</span>
          </div>
        </div>

        <div className="text-center">
          <h4 className="font-semibold text-lg">Your StoryScore</h4>
          <p className="text-muted-foreground text-sm">
            {score.overallScore >= 80
              ? 'Excellent! Your script is production-ready.'
              : score.overallScore >= 60
              ? 'Good foundation. Some areas could be improved.'
              : 'Needs work. Let\'s identify the key improvements.'}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {(['premiseOriginality', 'dialogueQuality', 'threeActIntegrity', 'protagonistArc'] as const).map(
            (dim) => {
              const dimScore = score.dimensions[dim]?.score ?? 0;
              return (
                <div
                  key={dim}
                  className="p-3 bg-muted rounded-lg"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium capitalize">
                      {dim.replace(/([A-Z])/g, ' $1').trim()}
                    </span>
                    <span className="text-sm font-bold">
                      {dimScore}
                    </span>
                  </div>
                  <Progress
                    value={dimScore * 10}
                    className="h-1.5"
                  />
                </div>
              );
            }
          )}
        </div>

        <div className="flex justify-center">
          <Button onClick={context.nextStep}>
            Get Improvement Suggestions
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center py-8">
      <div className="w-20 h-20 bg-violet-100 dark:bg-violet-900/30 rounded-full flex items-center justify-center mb-6">
        <BarChart3 className="w-10 h-10 text-violet-600 dark:text-violet-400" />
      </div>

      <h4 className="font-semibold text-lg mb-2">Analyze Your Script</h4>
      <p className="text-muted-foreground text-sm text-center mb-6 max-w-md">
        StoryScore evaluates your screenplay across 12 dimensions used by Hollywood
        readers, providing an objective assessment of your script's strengths and
        areas for improvement.
      </p>

      {error && (
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
          <AlertCircle className="w-4 h-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      <Button onClick={analyzeScript} disabled={isAnalyzing} size="lg">
        {isAnalyzing ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Analyzing (30-60s)...
          </>
        ) : (
          <>
            <Sparkles className="w-4 h-4 mr-2" />
            Analyze Script
          </>
        )}
      </Button>
    </div>
  );
}

function SuggestionsStep({ context }: { context: WizardContext }) {
  const [isLoading, setIsLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [error, setError] = useState<string | null>(null);

  const loadSuggestions = async () => {
    setIsLoading(true);
    setError(null);

    try {
      // First try to fetch existing suggestions
      const getResponse = await fetch(`/api/projects/${context.data.projectId}/suggestions`);

      if (getResponse.ok) {
        const data = await getResponse.json();
        if (data.suggestions && data.suggestions.length > 0) {
          setSuggestions(data.suggestions);
          context.setData('suggestions', data.suggestions);
          setIsLoading(false);
          return;
        }
      }

      // Generate new suggestions
      const postResponse = await fetch(`/api/projects/${context.data.projectId}/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ maxSuggestions: 10 }),
      });

      if (!postResponse.ok) {
        throw new Error('Failed to generate suggestions');
      }

      const data = await postResponse.json();
      setSuggestions(data.suggestions || []);
      context.setData('suggestions', data.suggestions);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load suggestions');
    } finally {
      setIsLoading(false);
    }
  };

  if (suggestions.length === 0 && !isLoading) {
    return (
      <div className="flex flex-col items-center py-8">
        <div className="w-20 h-20 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mb-6">
          <Lightbulb className="w-10 h-10 text-amber-600 dark:text-amber-400" />
        </div>

        <h4 className="font-semibold text-lg mb-2">Get AI Suggestions</h4>
        <p className="text-muted-foreground text-sm text-center mb-6 max-w-md">
          Story-Adviser will analyze your script and provide specific, actionable
          suggestions to improve dialogue, structure, characters, and craft.
        </p>

        {error && (
          <div className="flex items-center gap-2 text-red-600 dark:text-red-400 mb-4 p-3 bg-red-50 dark:bg-red-950/20 rounded-lg">
            <AlertCircle className="w-4 h-4" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        <Button onClick={loadSuggestions} disabled={isLoading} size="lg">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Analyzing...
            </>
          ) : (
            <>
              <Lightbulb className="w-4 h-4 mr-2" />
              Generate Suggestions
            </>
          )}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center py-12">
        <Loader2 className="w-12 h-12 text-violet-500 animate-spin mb-4" />
        <p className="text-muted-foreground">Analyzing your script...</p>
      </div>
    );
  }

  const critical = suggestions.filter((s) => s.severity === 'critical');
  const important = suggestions.filter((s) => s.severity === 'important');
  const minor = suggestions.filter((s) => s.severity === 'minor');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h4 className="font-semibold">
          {suggestions.length} Suggestions Found
        </h4>
        <div className="flex items-center gap-2">
          {critical.length > 0 && (
            <Badge variant="destructive">{critical.length} Critical</Badge>
          )}
          {important.length > 0 && (
            <Badge className="bg-amber-500">{important.length} Important</Badge>
          )}
          {minor.length > 0 && (
            <Badge variant="secondary">{minor.length} Minor</Badge>
          )}
        </div>
      </div>

      <div className="space-y-3 max-h-[300px] overflow-y-auto">
        {suggestions.slice(0, 5).map((suggestion) => (
          <div
            key={suggestion.id}
            className="p-4 border rounded-lg hover:border-violet-300 dark:hover:border-violet-700 transition-colors"
          >
            <div className="flex items-start gap-3">
              <Badge
                variant={
                  suggestion.severity === 'critical'
                    ? 'destructive'
                    : suggestion.severity === 'important'
                    ? 'default'
                    : 'secondary'
                }
                className="flex-shrink-0"
              >
                {suggestion.severity}
              </Badge>
              <div>
                <h5 className="font-medium">{suggestion.title}</h5>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                  {suggestion.explanation}
                </p>
              </div>
            </div>
          </div>
        ))}
        {suggestions.length > 5 && (
          <p className="text-center text-sm text-muted-foreground py-2">
            +{suggestions.length - 5} more suggestions
          </p>
        )}
      </div>

      <div className="flex justify-center">
        <Button onClick={context.nextStep}>
          Continue to Revisions
          <ArrowRight className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function RevisionsStep({ context }: { context: WizardContext }) {
  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-4">
        <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900/30 rounded-full flex items-center justify-center mb-4">
          <Edit3 className="w-8 h-8 text-blue-600 dark:text-blue-400" />
        </div>

        <h4 className="font-semibold text-lg mb-2">Make Your Revisions</h4>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          Based on the suggestions, make edits to your script. Each revision is
          automatically tracked so you can see your progress over time.
        </p>
      </div>

      <div className="bg-muted rounded-lg p-6">
        <h5 className="font-medium mb-4">Recommended Workflow:</h5>
        <ol className="space-y-3">
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-medium flex-shrink-0">
              1
            </span>
            <span className="text-sm">
              Address <strong>Critical</strong> issues first - these have the biggest
              impact on reader perception
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-medium flex-shrink-0">
              2
            </span>
            <span className="text-sm">
              Use the <strong>Rewrite</strong> feature to see AI-generated alternatives
              for difficult passages
            </span>
          </li>
          <li className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400 flex items-center justify-center text-sm font-medium flex-shrink-0">
              3
            </span>
            <span className="text-sm">
              Save your revision to create a new version and track improvements
            </span>
          </li>
        </ol>
      </div>

      <div className="flex justify-center gap-3">
        <Button variant="outline" onClick={context.skipStep}>
          Skip for Now
        </Button>
        <Button onClick={context.nextStep}>
          I've Made Changes
          <CheckCircle className="w-4 h-4 ml-2" />
        </Button>
      </div>
    </div>
  );
}

function CompareStep({ context }: { context: WizardContext }) {
  const initialScore = context.data.initialScore as StoryScore | undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center py-4">
        <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mb-4">
          <TrendingUp className="w-8 h-8 text-green-600 dark:text-green-400" />
        </div>

        <h4 className="font-semibold text-lg mb-2">Track Your Progress</h4>
        <p className="text-muted-foreground text-sm text-center max-w-md">
          After making revisions, re-score your script to see how much you've improved.
          Your revision history tracks every version's score.
        </p>
      </div>

      {initialScore && (
        <div className="bg-muted rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-medium">Starting Score</span>
            <span className="text-2xl font-bold text-violet-600 dark:text-violet-400">
              {initialScore.overallScore}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            Re-score after making changes to see your improvement. Most writers see
            5-15 point improvements after addressing critical suggestions.
          </p>
        </div>
      )}

      <div className="bg-gradient-to-r from-violet-500 to-purple-600 text-white rounded-lg p-6">
        <h5 className="font-semibold mb-2">Ready to improve?</h5>
        <p className="text-sm opacity-90 mb-4">
          You can run this improvement cycle as many times as needed. Each iteration
          brings your script closer to production-ready quality.
        </p>
        <div className="flex gap-2">
          <Button
            variant="secondary"
            className="bg-white/20 hover:bg-white/30 text-white border-0"
            onClick={() => context.goToStep(0)}
          >
            Start New Cycle
          </Button>
          <Button
            variant="secondary"
            className="bg-white hover:bg-white/90 text-violet-600"
            onClick={context.complete}
          >
            Finish Wizard
          </Button>
        </div>
      </div>
    </div>
  );
}

// =============================================================================
// Main Component
// =============================================================================

export function ScriptImprovementWizard({
  projectId,
  scriptText,
  existingScore,
  onComplete,
  onCancel,
}: ScriptImprovementWizardProps) {
  const steps: WizardStep[] = [
    {
      id: 'score',
      title: 'Score Analysis',
      description: 'Get your StoryScore to understand your script\'s strengths',
      icon: <BarChart3 className="w-5 h-5 text-violet-500" />,
      content: (context) => <ScoreAnalysisStep context={context} />,
    },
    {
      id: 'suggestions',
      title: 'Review Suggestions',
      description: 'AI-powered recommendations for improvement',
      icon: <Lightbulb className="w-5 h-5 text-amber-500" />,
      content: (context) => <SuggestionsStep context={context} />,
    },
    {
      id: 'revisions',
      title: 'Make Revisions',
      description: 'Apply changes based on suggestions',
      icon: <Edit3 className="w-5 h-5 text-blue-500" />,
      isSkippable: true,
      content: (context) => <RevisionsStep context={context} />,
    },
    {
      id: 'compare',
      title: 'Compare & Finalize',
      description: 'See your improvement and plan next steps',
      icon: <TrendingUp className="w-5 h-5 text-green-500" />,
      content: (context) => <CompareStep context={context} />,
    },
  ];

  const handleComplete = (data: Record<string, unknown>) => {
    const initialScore = data.initialScore as StoryScore | undefined;
    onComplete?.({
      scoreImprovement: 0, // Would calculate if we had final score
    });
  };

  return (
    <Wizard
      steps={steps}
      title="Script Improvement Wizard"
      description="Follow this guided workflow to systematically improve your screenplay"
      initialData={{
        projectId,
        scriptText,
        existingScore,
      }}
      onComplete={handleComplete}
      onCancel={onCancel}
      showProgress={true}
      showStepIndicators={true}
      allowSkipAhead={false}
    />
  );
}

export default ScriptImprovementWizard;
