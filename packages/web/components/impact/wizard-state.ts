/**
 * StoryBuilder Wizard — shared state types
 */

/**
 * 'attest' is a pre-gate before the numbered steps.
 * It is NOT included in WIZARD_STEPS so the progress bar ignores it.
 * Once the user agrees, the wizard advances to 'category' (step 1).
 */
export type WizardStep =
  | 'attest'    // Pre-gate: attestation + eligibility agreement
  | 'category'  // Step 1: Choose your story category
  | 'write'     // Step 2: Write (and optionally expand) your story
  | 'voice'     // Step 3: Choose your narrator voice
  | 'preview'   // Step 4: Preview audio
  | 'share'     // Step 5: Choose sharing + prize settings
  | 'produce'   // Step 6: Produce and celebrate

/** Numbered steps shown in the progress bar — does NOT include 'attest' */
export const WIZARD_STEPS: Exclude<WizardStep, 'attest'>[] = [
  'category',
  'write',
  'voice',
  'preview',
  'share',
  'produce',
];

export const STEP_LABELS: Record<WizardStep, string> = {
  attest: 'Agree',
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
  step: 'attest',
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

/** Returns -1 for 'attest' (pre-gate), 0-based index for numbered steps */
export function stepIndex(step: WizardStep): number {
  return WIZARD_STEPS.indexOf(step as Exclude<WizardStep, 'attest'>);
}

export function nextStep(step: WizardStep): WizardStep | null {
  if (step === 'attest') return 'category';
  const idx = stepIndex(step);
  if (idx < 0) return null;
  return idx < WIZARD_STEPS.length - 1 ? WIZARD_STEPS[idx + 1] : null;
}

export function prevStep(step: WizardStep): WizardStep | null {
  const idx = stepIndex(step);
  if (idx <= 0) return null;
  return WIZARD_STEPS[idx - 1];
}
