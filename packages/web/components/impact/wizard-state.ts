/**
 * StoryBuilder Wizard — shared state types
 */

export type WizardStep =
  | 'category'      // Step 1: Choose your story category
  | 'write'         // Step 2: Write (and optionally expand) your story
  | 'voice'         // Step 3: Choose your narrator voice
  | 'preview'       // Step 4: Preview audio
  | 'share'         // Step 5: Choose sharing + prize settings
  | 'produce'       // Step 6: Produce and celebrate

export const WIZARD_STEPS: WizardStep[] = [
  'category',
  'write',
  'voice',
  'preview',
  'share',
  'produce',
];

export const STEP_LABELS: Record<WizardStep, string> = {
  category: 'Your Story',
  write: 'Tell It',
  voice: 'Your Voice',
  preview: 'Preview',
  share: 'Share',
  produce: 'Create',
};

export interface WizardState {
  storyId: string | null;
  step: WizardStep;
  category: string | null;
  title: string;
  storyText: string;
  expandedText: string | null;
  useExpanded: boolean;
  voiceId: string | null;
  voiceName: string | null;
  audioUrl: string | null;
  isPublic: boolean;
  prizeEligible: boolean;
  authorName: string;
  authorCity: string;
}

export const INITIAL_WIZARD_STATE: WizardState = {
  storyId: null,
  step: 'category',
  category: null,
  title: '',
  storyText: '',
  expandedText: null,
  useExpanded: true,
  voiceId: null,
  voiceName: null,
  audioUrl: null,
  isPublic: false,
  prizeEligible: true,
  authorName: '',
  authorCity: '',
};

export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step);
}

export function nextStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  return idx < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[idx + 1] : null;
}

export function prevStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  return idx > 0 ? WIZARD_STEPS[idx - 1] : null;
}
