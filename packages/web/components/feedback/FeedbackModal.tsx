'use client';

/**
 * FeedbackModal Component
 *
 * Collects detailed feedback when users respond to suggestions.
 * Supports quick ratings, rejection reasons, and free-form comments.
 */

import { useState } from 'react';
import { log } from '@/lib/logger';
import { useToast } from '@/hooks/use-toast';
import { apiFetch } from '@/lib/api/fetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
  ThumbsUp,
  ThumbsDown,
  HelpCircle,
  AlertTriangle,
  MessageSquare,
  Send,
  Loader2,
} from 'lucide-react';
import {
  FeedbackRating,
  FeedbackTarget,
  RejectionReason,
  REJECTION_REASONS,
  SubmitFeedbackRequest,
} from '@/lib/feedback/types';

// =============================================================================
// Props
// =============================================================================

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  target: FeedbackTarget;
  targetId: string;
  projectId: string;
  mode: 'quick' | 'rejection' | 'detailed';
  title?: string;
  description?: string;
  onSubmit?: (feedback: SubmitFeedbackRequest) => Promise<void>;
}

// =============================================================================
// Rating Options Config
// =============================================================================

const RATING_OPTIONS: Array<{
  value: FeedbackRating;
  label: string;
  icon: typeof ThumbsUp;
  color: string;
}> = [
  {
    value: 'helpful',
    label: 'Helpful',
    icon: ThumbsUp,
    color: 'text-green-600 dark:text-green-400',
  },
  {
    value: 'somewhat_helpful',
    label: 'Somewhat',
    icon: HelpCircle,
    color: 'text-amber-600 dark:text-amber-400',
  },
  {
    value: 'not_helpful',
    label: 'Not Helpful',
    icon: ThumbsDown,
    color: 'text-muted-foreground',
  },
  {
    value: 'harmful',
    label: 'Harmful',
    icon: AlertTriangle,
    color: 'text-red-600 dark:text-red-400',
  },
];

// =============================================================================
// Component
// =============================================================================

export function FeedbackModal({
  isOpen,
  onClose,
  target,
  targetId,
  projectId,
  mode,
  title = 'Share Your Feedback',
  description = 'Help us improve by sharing your thoughts on this suggestion.',
  onSubmit,
}: FeedbackModalProps) {
  const [rating, setRating] = useState<FeedbackRating | null>(null);
  const [rejectionReason, setRejectionReason] = useState<RejectionReason | null>(null);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async () => {
    setIsSubmitting(true);

    const feedback: SubmitFeedbackRequest = {
      target,
      targetId,
      rating: rating || undefined,
      rejectionReason: rejectionReason || undefined,
      comment: comment.trim() || undefined,
    };

    try {
      if (onSubmit) {
        await onSubmit(feedback);
      } else {
        // Default API submission
        const response = await apiFetch(`/api/projects/${projectId}/feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(feedback),
        });

        if (!response.ok) {
          throw new Error('Failed to submit feedback');
        }
      }

      setSubmitted(true);
      setTimeout(() => {
        handleClose();
      }, 1500);
    } catch (error) {
      log.error('Failed to submit feedback', error);
      toast({
        variant: 'destructive',
        title: 'Submission failed',
        description: 'Could not submit your feedback. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setRating(null);
    setRejectionReason(null);
    setComment('');
    setSubmitted(false);
    onClose();
  };

  const canSubmit =
    (mode === 'quick' && rating) ||
    (mode === 'rejection' && rejectionReason) ||
    (mode === 'detailed' && (rating || comment.trim()));

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-500" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {submitted ? (
          <div className="py-8 text-center">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
              <ThumbsUp className="w-8 h-8 text-green-600 dark:text-green-400" />
            </div>
            <h3 className="font-semibold text-lg mb-1">Thanks for your feedback!</h3>
            <p className="text-muted-foreground text-sm">
              Your input helps us improve the AI for everyone.
            </p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Quick Rating Section */}
            {(mode === 'quick' || mode === 'detailed') && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  How would you rate this suggestion?
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {RATING_OPTIONS.map((option) => {
                    const Icon = option.icon;
                    const isSelected = rating === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setRating(option.value)}
                        className={`
                          flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all
                          ${
                            isSelected
                              ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                              : 'border-border hover:border-border'
                          }
                        `}
                      >
                        <Icon
                          className={`w-5 h-5 ${isSelected ? 'text-blue-600' : option.color}`}
                        />
                        <span className="text-xs font-medium">{option.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Rejection Reason Section */}
            {mode === 'rejection' && (
              <div className="space-y-3">
                <Label className="text-sm font-medium">
                  Why are you rejecting this suggestion?
                </Label>
                <RadioGroup
                  value={rejectionReason || ''}
                  onValueChange={(value) => setRejectionReason(value as RejectionReason)}
                  className="space-y-2"
                >
                  {Object.entries(REJECTION_REASONS).map(([key, config]) => (
                    <div
                      key={key}
                      className={`
                        flex items-start space-x-3 p-3 rounded-lg border transition-colors cursor-pointer
                        ${
                          rejectionReason === key
                            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                            : 'border-border hover:border-border'
                        }
                      `}
                      onClick={() => setRejectionReason(key as RejectionReason)}
                    >
                      <RadioGroupItem value={key} id={key} className="mt-0.5" />
                      <div className="flex-1">
                        <Label
                          htmlFor={key}
                          className="font-medium cursor-pointer"
                        >
                          {config.label}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {config.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              </div>
            )}

            {/* Comment Section */}
            {(mode === 'detailed' || mode === 'rejection') && (
              <div className="space-y-2">
                <Label htmlFor="comment" className="text-sm font-medium">
                  Additional comments{' '}
                  <span className="text-muted-foreground">(optional)</span>
                </Label>
                <Textarea
                  id="comment"
                  placeholder="Share any additional thoughts or suggestions..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>
            )}
          </div>
        )}

        {!submitted && (
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={handleClose}>
              Skip
            </Button>
            <Button onClick={handleSubmit} disabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Submitting...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Submit Feedback
                </>
              )}
            </Button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default FeedbackModal;
