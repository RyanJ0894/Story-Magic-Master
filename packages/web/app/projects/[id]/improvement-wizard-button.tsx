'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Wand2 } from 'lucide-react';
import { ScriptImprovementWizard } from '@/components/wizard/ScriptImprovementWizard';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';
interface ImprovementWizardButtonProps {
  projectId: string;
  scriptText: string;
  // T-05 from code-review/2026-06-16 — deferred to Sprint C.1. Tried
  // narrowing to `Pick<StoryScore, 'id' | 'overallScore'>` in Sprint C
  // but exposed a real type-debt onion: the wizard's prop is typed
  // `StoryScore | null` (full shape, 11 fields) while project-workflow
  // passes a narrow `{ id, overallScore }` shape, and the wizard's
  // internal `as StoryScore` cast masks the mismatch. Real fix is one
  // of (a) widen the wizard to `Partial<StoryScore>` after auditing
  // its field accesses, or (b) load full StoryScore at page boundary.
  // Both are larger than the 2-SP T-05 estimate.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existingScore?: any;
}

export function ImprovementWizardButton({
  projectId,
  scriptText,
  existingScore,
}: ImprovementWizardButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleComplete = (data: { scoreImprovement: number }) => {
    setIsOpen(false);
    toast({
      title: 'Wizard Complete',
      description: 'Your script improvement workflow is complete.',
    });
    router.refresh();
  };

  return (
    <>
      <Button
        onClick={() => setIsOpen(true)}
        className="brand-gradient brand-gradient-hover"
      >
        <Wand2 className="w-4 h-4 mr-2" />
        Start Improvement Wizard
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="sr-only">Script Improvement Wizard</DialogTitle>
          </DialogHeader>
          <ScriptImprovementWizard
            projectId={projectId}
            scriptText={scriptText}
            existingScore={existingScore}
            onComplete={handleComplete}
            onCancel={() => setIsOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
