/**
 * Impact StoryBuilder — Curated voice list
 *
 * A warm, human-feeling subset of ElevenLabs voices selected for personal storytelling.
 * Emphasizes natural, empathetic tones rather than polished broadcast voices.
 */

export interface ImpactVoice {
  id: string;       // ElevenLabs voice ID
  name: string;
  description: string;
  gender: 'male' | 'female' | 'neutral';
  tone: string;
  previewText: string;
}

export const IMPACT_VOICES: ImpactVoice[] = [
  {
    id: 'EXAVITQu4vr4xnSDxMaL',
    name: 'Sarah',
    description: 'Warm and conversational',
    gender: 'female',
    tone: 'Gentle, empathetic, like a trusted friend',
    previewText: 'This is my story. It is not easy to tell, but I believe it matters.',
  },
  {
    id: 'TX3LPaxmHKxFdv7VOQHJ',
    name: 'Liam',
    description: 'Calm and thoughtful',
    gender: 'male',
    tone: 'Steady, sincere, quietly powerful',
    previewText: 'I have carried this story for a long time. Today I am ready to share it.',
  },
  {
    id: 'pFZP5JQG7iQjIQuC4Bku',
    name: 'Lily',
    description: 'Soft and reflective',
    gender: 'female',
    tone: 'Introspective, measured, deeply human',
    previewText: 'Some chapters of life are hard to read aloud. This is mine.',
  },
  {
    id: 'nPczCjzI2devNBz1zQrb',
    name: 'Brian',
    description: 'Grounded and resilient',
    gender: 'male',
    tone: 'Honest, direct, carries quiet strength',
    previewText: 'What I went through made me who I am. I wouldn\'t trade the lessons.',
  },
  {
    id: 'cgSgspJ2msm6clMCkdW9',
    name: 'Jessica',
    description: 'Expressive and heartfelt',
    gender: 'female',
    tone: 'Passionate, open, unafraid of emotion',
    previewText: 'I used to think no one would want to hear my story. I was wrong.',
  },
  {
    id: 'onwK4e9ZLuTAKqWW03F9',
    name: 'Daniel',
    description: 'Deep and reassuring',
    gender: 'male',
    tone: 'Rich, warm, like a mentor who has lived',
    previewText: 'Every scar has a story. I am done hiding mine.',
  },
];

export function getImpactVoiceById(id: string): ImpactVoice | undefined {
  return IMPACT_VOICES.find(v => v.id === id);
}
