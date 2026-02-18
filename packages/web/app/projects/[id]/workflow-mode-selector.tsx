'use client';

/**
 * WorkflowModeSelector - Choose between Automatic and Fine-Tuned generation
 *
 * Automatic: Quick generation with AI defaults (skip wizard/workflow)
 * Fine-Tuned: Full control with analysis, voice casting, and customization
 */

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Zap,
  Sliders,
  ChevronRight,
  Sparkles,
  Clock,
  CheckCircle,
} from 'lucide-react';
import { apiFetch } from '@/lib/api/fetch';
import { cn } from '@/lib/utils';

type WorkflowMode = 'automatic' | 'fine_tuned';

interface WorkflowModeSelectorProps {
  projectId: string;
  projectName: string;
  currentRunNumber: number;
  preferredMode?: WorkflowMode;
  onModeSelected: (mode: WorkflowMode) => void;
  isStartingRun?: boolean;
}

interface ModeOption {
  id: WorkflowMode;
  title: string;
  subtitle: string;
  description: string;
  icon: typeof Zap;
  iconColor: string;
  features: string[];
  recommended?: boolean;
}

const modeOptions: ModeOption[] = [
  {
    id: 'automatic',
    title: 'Automatic',
    subtitle: 'Quick & Easy',
    description: 'Let AI handle everything. Perfect for a fast first draft.',
    icon: Zap,
    iconColor: 'text-amber-500',
    features: [
      'AI selects optimal voices',
      'Auto-generates music & ambience',
      'Ready in minutes',
      'Great for quick previews',
    ],
  },
  {
    id: 'fine_tuned',
    title: 'Fine-Tuned',
    subtitle: 'Full Control',
    description: 'Customize every detail for a polished final production.',
    icon: Sliders,
    iconColor: 'text-violet-500',
    features: [
      'StoryScore analysis',
      'Hand-pick character voices',
      'AI improvement suggestions',
      'Professional-grade output',
    ],
    recommended: true,
  },
];

export function WorkflowModeSelector({
  projectId,
  projectName,
  currentRunNumber,
  preferredMode,
  onModeSelected,
  isStartingRun = false,
}: WorkflowModeSelectorProps) {
  const [selectedMode, setSelectedMode] = useState<WorkflowMode | null>(preferredMode || null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const nextRunNumber = currentRunNumber + 1;

  const handleContinue = async () => {
    if (!selectedMode) return;

    setIsSubmitting(true);

    // Update preferred mode in database
    try {
      const response = await apiFetch(`/api/projects/${projectId}/workflow-mode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selectedMode }),
      });

      if (!response.ok) {
        throw new Error('Failed to save workflow mode');
      }

      onModeSelected(selectedMode);
    } catch (error) {
      console.error('Error saving workflow mode:', error);
      // Still proceed even if save fails
      onModeSelected(selectedMode);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Run Header */}
      <div className="text-center space-y-2">
        <Badge variant="outline" className="text-sm px-3 py-1">
          <Sparkles className="w-3 h-3 mr-1" />
          Run #{nextRunNumber}
        </Badge>
        <h2 className="text-2xl font-bold text-foreground">
          How would you like to generate?
        </h2>
        <p className="text-muted-foreground max-w-md mx-auto">
          Choose your workflow for this run. You can always start a new run with a different approach.
        </p>
      </div>

      {/* Mode Options */}
      <div className="grid gap-4 md:grid-cols-2 max-w-3xl mx-auto">
        {modeOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedMode === option.id;

          return (
            <Card
              key={option.id}
              className={cn(
                'relative cursor-pointer transition-all hover:shadow-md',
                isSelected
                  ? 'ring-2 ring-violet-500 border-violet-300 dark:border-violet-700'
                  : 'hover:border-border',
              )}
              onClick={() => setSelectedMode(option.id)}
            >
              {option.recommended && (
                <div className="absolute -top-2 left-1/2 -translate-x-1/2">
                  <Badge className="bg-violet-600 text-white text-xs">
                    Recommended
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-start justify-between">
                  <div className={cn(
                    'w-12 h-12 rounded-xl flex items-center justify-center',
                    isSelected
                      ? 'bg-violet-100 dark:bg-violet-900/30'
                      : 'bg-muted',
                  )}>
                    <Icon className={cn('w-6 h-6', option.iconColor)} />
                  </div>
                  <div className={cn(
                    'w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all',
                    isSelected
                      ? 'border-violet-500 bg-violet-500'
                      : 'border-border',
                  )}>
                    {isSelected && <CheckCircle className="w-4 h-4 text-white" />}
                  </div>
                </div>

                <div className="mt-3">
                  <CardTitle className="flex items-center gap-2">
                    {option.title}
                    <span className="text-sm font-normal text-muted-foreground">
                      {option.subtitle}
                    </span>
                  </CardTitle>
                  <CardDescription className="mt-1">
                    {option.description}
                  </CardDescription>
                </div>
              </CardHeader>

              <CardContent>
                <ul className="space-y-2">
                  {option.features.map((feature, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle className={cn(
                        'w-4 h-4 flex-shrink-0',
                        isSelected ? 'text-violet-500' : 'text-muted-foreground',
                      )} />
                      {feature}
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Continue Button */}
      <div className="flex justify-center">
        <Button
          size="lg"
          disabled={!selectedMode || isSubmitting}
          onClick={handleContinue}
          className="brand-gradient brand-gradient-hover min-w-[200px]"
        >
          {isSubmitting ? (
            <>
              <Clock className="w-4 h-4 mr-2 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              Continue
              <ChevronRight className="w-4 h-4 ml-2" />
            </>
          )}
        </Button>
      </div>

      {/* Previous Runs Hint */}
      {currentRunNumber > 0 && (
        <p className="text-center text-sm text-muted-foreground">
          You have {currentRunNumber} previous run{currentRunNumber !== 1 ? 's' : ''} for this project.
          <button className="ml-1 text-violet-600 hover:underline">
            View history
          </button>
        </p>
      )}
    </div>
  );
}

export default WorkflowModeSelector;
