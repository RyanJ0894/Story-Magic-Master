'use client';

/**
 * Wizard Component
 *
 * A reusable multi-step wizard with progress tracking,
 * navigation controls, and customizable steps.
 */

import { useState, useCallback, ReactNode, createContext, useContext } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  ChevronLeft,
  ChevronRight,
  Check,
  Circle,
  Loader2,
  X,
} from 'lucide-react';

// =============================================================================
// Types
// =============================================================================

export interface WizardStep {
  id: string;
  title: string;
  description?: string;
  icon?: ReactNode;
  isOptional?: boolean;
  isSkippable?: boolean;
  content: ReactNode | ((context: WizardContext) => ReactNode);
  validate?: () => boolean | Promise<boolean>;
  onEnter?: () => void | Promise<void>;
  onLeave?: () => void | Promise<void>;
}

export interface WizardContext {
  currentStep: number;
  totalSteps: number;
  stepId: string;
  isFirstStep: boolean;
  isLastStep: boolean;
  goToStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  skipStep: () => void;
  complete: () => void;
  data: Record<string, unknown>;
  setData: (key: string, value: unknown) => void;
}

export interface WizardProps {
  steps: WizardStep[];
  onComplete?: (data: Record<string, unknown>) => void;
  onCancel?: () => void;
  initialStep?: number;
  initialData?: Record<string, unknown>;
  showProgress?: boolean;
  showStepIndicators?: boolean;
  allowSkipAhead?: boolean;
  title?: string;
  description?: string;
  className?: string;
}

// =============================================================================
// Context
// =============================================================================

const WizardCtx = createContext<WizardContext | null>(null);

export function useWizard() {
  const context = useContext(WizardCtx);
  if (!context) {
    throw new Error('useWizard must be used within a Wizard component');
  }
  return context;
}

// =============================================================================
// Component
// =============================================================================

export function Wizard({
  steps,
  onComplete,
  onCancel,
  initialStep = 0,
  initialData = {},
  showProgress = true,
  showStepIndicators = true,
  allowSkipAhead = false,
  title,
  description,
  className = '',
}: WizardProps) {
  const [currentStep, setCurrentStep] = useState(initialStep);
  const [data, setDataState] = useState<Record<string, unknown>>(initialData);
  const [isNavigating, setIsNavigating] = useState(false);
  const [completedSteps, setCompletedSteps] = useState<Set<number>>(new Set());

  const step = steps[currentStep];
  const progress = ((currentStep + 1) / steps.length) * 100;

  const setData = useCallback((key: string, value: unknown) => {
    setDataState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const goToStep = useCallback(
    async (targetStep: number) => {
      if (targetStep < 0 || targetStep >= steps.length) return;
      if (!allowSkipAhead && targetStep > currentStep + 1) return;
      if (targetStep > currentStep && !completedSteps.has(currentStep) && !allowSkipAhead) return;

      setIsNavigating(true);
      try {
        // Run leave callback for current step
        if (step.onLeave) {
          await step.onLeave();
        }

        // Run enter callback for target step
        const targetStepObj = steps[targetStep];
        if (targetStepObj.onEnter) {
          await targetStepObj.onEnter();
        }

        setCurrentStep(targetStep);
      } finally {
        setIsNavigating(false);
      }
    },
    [currentStep, steps, step, allowSkipAhead, completedSteps]
  );

  const nextStep = useCallback(async () => {
    setIsNavigating(true);
    try {
      // Validate current step
      if (step.validate) {
        const isValid = await step.validate();
        if (!isValid) {
          setIsNavigating(false);
          return;
        }
      }

      // Mark step as completed
      setCompletedSteps((prev) => new Set(Array.from(prev).concat(currentStep)));

      // Run leave callback
      if (step.onLeave) {
        await step.onLeave();
      }

      if (currentStep < steps.length - 1) {
        const nextStepObj = steps[currentStep + 1];
        if (nextStepObj.onEnter) {
          await nextStepObj.onEnter();
        }
        setCurrentStep(currentStep + 1);
      }
    } finally {
      setIsNavigating(false);
    }
  }, [currentStep, steps, step]);

  const prevStep = useCallback(async () => {
    if (currentStep > 0) {
      await goToStep(currentStep - 1);
    }
  }, [currentStep, goToStep]);

  const skipStep = useCallback(async () => {
    if (step.isSkippable && currentStep < steps.length - 1) {
      await goToStep(currentStep + 1);
    }
  }, [currentStep, steps, step, goToStep]);

  const complete = useCallback(async () => {
    setIsNavigating(true);
    try {
      // Validate final step
      if (step.validate) {
        const isValid = await step.validate();
        if (!isValid) {
          setIsNavigating(false);
          return;
        }
      }

      // Run leave callback
      if (step.onLeave) {
        await step.onLeave();
      }

      // Call completion handler
      onComplete?.(data);
    } finally {
      setIsNavigating(false);
    }
  }, [step, data, onComplete]);

  const context: WizardContext = {
    currentStep,
    totalSteps: steps.length,
    stepId: step.id,
    isFirstStep: currentStep === 0,
    isLastStep: currentStep === steps.length - 1,
    goToStep,
    nextStep,
    prevStep,
    skipStep,
    complete,
    data,
    setData,
  };

  const renderContent = () => {
    if (typeof step.content === 'function') {
      return step.content(context);
    }
    return step.content;
  };

  return (
    <WizardCtx.Provider value={context}>
      <Card className={className}>
        <CardHeader>
          {/* Header with title and cancel button */}
          <div className="flex items-start justify-between">
            <div>
              {title && (
                <CardTitle className="flex items-center gap-2">
                  {step.icon}
                  {title}
                </CardTitle>
              )}
              {description && <CardDescription className="mt-1">{description}</CardDescription>}
            </div>
            {onCancel && (
              <Button variant="ghost" size="sm" onClick={onCancel}>
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>

          {/* Progress bar */}
          {showProgress && (
            <div className="mt-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Step {currentStep + 1} of {steps.length}
                </span>
                <span className="text-sm text-muted-foreground">{Math.round(progress)}%</span>
              </div>
              <Progress value={progress} className="h-2" />
            </div>
          )}

          {/* Step indicators */}
          {showStepIndicators && (
            <div className="flex items-center justify-center gap-2 mt-4">
              {steps.map((s, index) => {
                const isCompleted = completedSteps.has(index);
                const isCurrent = index === currentStep;
                const canNavigate = allowSkipAhead || index <= currentStep || isCompleted;

                return (
                  <button
                    key={s.id}
                    onClick={() => canNavigate && goToStep(index)}
                    disabled={!canNavigate || isNavigating}
                    className={`
                      flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium transition-all
                      ${
                        isCurrent
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300'
                          : isCompleted
                          ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300'
                          : 'bg-muted text-muted-foreground'
                      }
                      ${canNavigate ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed'}
                    `}
                  >
                    {isCompleted ? (
                      <Check className="w-3 h-3" />
                    ) : isCurrent ? (
                      <Circle className="w-3 h-3 fill-current" />
                    ) : (
                      <Circle className="w-3 h-3" />
                    )}
                    <span className="hidden sm:inline">{s.title}</span>
                  </button>
                );
              })}
            </div>
          )}
        </CardHeader>

        <CardContent>
          {/* Current step header */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              {step.icon}
              {step.title}
              {step.isOptional && (
                <Badge variant="secondary" className="text-xs">
                  Optional
                </Badge>
              )}
            </h3>
            {step.description && (
              <p className="text-sm text-muted-foreground mt-1">{step.description}</p>
            )}
          </div>

          {/* Step content */}
          <div className="min-h-[200px]">{renderContent()}</div>

          {/* Navigation buttons */}
          <div className="flex items-center justify-between mt-8 pt-4 border-t">
            <Button
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 0 || isNavigating}
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>

            <div className="flex items-center gap-2">
              {step.isSkippable && (
                <Button
                  variant="ghost"
                  onClick={skipStep}
                  disabled={isNavigating}
                >
                  Skip
                </Button>
              )}

              {currentStep < steps.length - 1 ? (
                <Button onClick={nextStep} disabled={isNavigating}>
                  {isNavigating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      Next
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              ) : (
                <Button onClick={complete} disabled={isNavigating}>
                  {isNavigating ? (
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-4 h-4 mr-2" />
                      Complete
                    </>
                  )}
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </WizardCtx.Provider>
  );
}

export default Wizard;
