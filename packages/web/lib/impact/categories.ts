/**
 * Impact StoryBuilder — Category definitions
 */

export interface ImpactCategory {
  id: string;
  label: string;
  emoji: string;
  tagline: string;
  description: string;
  /** Opening prompt shown in Step 2 of the wizard */
  writingPrompt: string;
  /** Follow-up questions to deepen the story */
  followUpPrompts: string[];
}

export const IMPACT_CATEGORIES: ImpactCategory[] = [
  {
    id: 'justice',
    label: 'Justice & Advocacy',
    emoji: '⚖️',
    tagline: 'Your fight for fairness changed you.',
    description: 'Stories of navigating the legal system, wrongful experiences, or fighting for rights.',
    writingPrompt:
      'Tell us about a time you had to stand up for yourself or someone else against an unjust system. What happened, how did it change you, and what did you learn?',
    followUpPrompts: [
      'What moment made you realize you had to speak up?',
      'Who stood beside you — and who let you down?',
      'What would you tell someone facing the same battle today?',
    ],
  },
  {
    id: 'system',
    label: 'Navigating the System',
    emoji: '🏛️',
    tagline: 'The maze no one hands you a map for.',
    description: 'Foster care, incarceration, child welfare, bureaucracy — stories of moving through institutions.',
    writingPrompt:
      'Describe your experience with an institution — foster care, corrections, child welfare, or another system. What did survival look like, and what did you carry out the other side?',
    followUpPrompts: [
      'What was the hardest rule to follow — or the one you had to break?',
      'Who inside the system showed you unexpected kindness?',
      'What does "making it through" mean to you now?',
    ],
  },
  {
    id: 'trauma',
    label: 'Surviving Trauma',
    emoji: '🌱',
    tagline: 'You went through something that would have broken most people.',
    description: 'Abuse, violence, loss, PTSD — stories of surviving the unsurvivable.',
    writingPrompt:
      'Share your story of surviving something that once felt impossible to get through. You don\'t need to share every detail — focus on who you are because of it.',
    followUpPrompts: [
      'What was the first sign that you were going to be okay?',
      'What do you know about yourself now that you couldn\'t have known before?',
      'What do you want others who are still in it to hear from you?',
    ],
  },
  {
    id: 'homelessness',
    label: 'Housing & Homelessness',
    emoji: '🏠',
    tagline: 'Home is more than a roof.',
    description: 'Experiences of housing instability, living unhoused, or rebuilding after losing everything.',
    writingPrompt:
      'Tell us what home meant to you when you had it, what its absence felt like, and what home means to you today.',
    followUpPrompts: [
      'What was the moment you realized your situation had changed?',
      'What kept you moving forward when stability felt out of reach?',
      'What does having a safe place mean to you that others might take for granted?',
    ],
  },
  {
    id: 'recovery',
    label: 'Recovery & Resilience',
    emoji: '💪',
    tagline: 'You chose yourself — again and again.',
    description: 'Addiction recovery, mental health journeys, rebuilding after rock bottom.',
    writingPrompt:
      'Tell us about your recovery journey — what you\'re recovering from, what made you choose to fight for yourself, and what recovery looks like in your daily life.',
    followUpPrompts: [
      'What was the moment everything changed?',
      'Who believed in you before you believed in yourself?',
      'What would you say to the version of yourself at your lowest point?',
    ],
  },
  {
    id: 'other',
    label: 'My Story',
    emoji: '✨',
    tagline: 'Every story matters.',
    description: 'Your experience doesn\'t fit a category — and that\'s okay. Tell it your way.',
    writingPrompt:
      'Tell us your story. What shaped you, what you survived, and what you want the world to understand about your journey.',
    followUpPrompts: [
      'What\'s the part of your story that people rarely get to hear?',
      'Who or what kept you going?',
      'What do you want someone reading this to take away?',
    ],
  },
];

export function getCategoryById(id: string): ImpactCategory | undefined {
  return IMPACT_CATEGORIES.find(c => c.id === id);
}
