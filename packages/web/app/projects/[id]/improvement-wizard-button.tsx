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
import type { StoryScore } from '@/lib/scoring/types';

interface ImprovementWizardButtonProps {
  projectId: string;
  scriptText: string;
  existingScore?: Partial<StoryScore> | null;
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
