/**
 * Voices API
 *
 * GET /api/voices - Fetch available ElevenLabs voices
 *
 * Returns the voice catalog with filtering options.
 * Uses in-memory caching to avoid excessive ElevenLabs API calls.
 */

import { withAuth } from '@/lib/api/middleware';
import { NextResponse } from 'next/server';
import { log } from '@/lib/logger';

// Voice type matching the frontend
interface Voice {
  voice_id: string;
  name: string;
  gender: 'male' | 'female' | 'neutral';
  age: 'child' | 'young_adult' | 'adult' | 'senior';
  accent: string;
  style?: string;
  tone?: string;
  description?: string;
  preview_url: string;
  category?: string; // 'custom' | 'cloned' | 'professional' | 'premade'
  is_custom?: boolean; // True for voices native to our API key
}

// Cache for voices (5 minute TTL)
let voiceCache: Voice[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Pre-defined voice catalog (curated for our use case)
// This matches the orchestrator's knowledge base
const CURATED_VOICES: Voice[] = [
  { voice_id: 'CwhRBWXzGAHq8TQ4Fs17', name: 'Roger', gender: 'male', age: 'adult', accent: 'American', style: 'Laid-Back, Casual, Resonant', tone: 'classy', preview_url: '' },
  { voice_id: 'EXAVITQu4vr4xnSDxMaL', name: 'Sarah', gender: 'female', age: 'adult', accent: 'American', style: 'Mature, Reassuring, Confident', tone: 'professional', preview_url: '' },
  { voice_id: 'FGY2WhTYpPnrIDTdsKH5', name: 'Laura', gender: 'female', age: 'young_adult', accent: 'American', style: 'Enthusiast, Quirky Attitude', tone: 'sassy', preview_url: '' },
  { voice_id: 'IKne3meq5aSn9XLyUdCD', name: 'Charlie', gender: 'male', age: 'young_adult', accent: 'Australian', style: 'Deep, Confident, Energetic', tone: 'hyped', preview_url: '' },
  { voice_id: 'JBFqnCBsd6RMkjVDRZzb', name: 'George', gender: 'male', age: 'senior', accent: 'British', style: 'Warm, Captivating Storyteller', tone: 'mature', preview_url: '' },
  { voice_id: 'N2lVS1w4EtoT3dr4eOWO', name: 'Callum', gender: 'male', age: 'adult', accent: 'American', style: 'Husky Trickster', tone: 'characters_animation', preview_url: '' },
  { voice_id: 'SAz9YHcvj6GT2YYXdXww', name: 'River', gender: 'male', age: 'adult', accent: 'American', style: 'Relaxed, Neutral, Informative', tone: 'calm', preview_url: '' },
  { voice_id: 'SOYHLrjzK2X1ezoPC6cr', name: 'Harry', gender: 'male', age: 'young_adult', accent: 'American', style: 'Fierce Warrior', tone: 'rough', preview_url: '' },
  { voice_id: 'TX3LPaxmHKxFdv7VOQHJ', name: 'Liam', gender: 'male', age: 'young_adult', accent: 'American', style: 'Energetic, Social Media Creator', tone: 'confident', preview_url: '' },
  { voice_id: 'Xb7hH8MSUJpSbSDYk0k2', name: 'Alice', gender: 'female', age: 'adult', accent: 'British', style: 'Clear, Engaging Educator', tone: 'professional', preview_url: '' },
  { voice_id: 'XrExE9yKIg1WjnnlVkGX', name: 'Matilda', gender: 'female', age: 'adult', accent: 'American', style: 'Knowledgable, Professional', tone: 'upbeat', preview_url: '' },
  { voice_id: 'bIHbv24MWmeRgasZH58o', name: 'Will', gender: 'male', age: 'young_adult', accent: 'American', style: 'Friendly, Curious', tone: 'neutral', preview_url: '' },
  { voice_id: 'cgSgspJ2msm6clMCkdW9', name: 'Jessica', gender: 'female', age: 'young_adult', accent: 'American', style: 'Natural, Everyday', tone: 'conversational', preview_url: '' },
  { voice_id: 'cjVigY5qzO86Huf0OWal', name: 'Eric', gender: 'male', age: 'adult', accent: 'American', style: 'Friendly, Warm', tone: 'friendly', preview_url: '' },
  { voice_id: 'iP95p4xoKVk53GoZ742B', name: 'Chris', gender: 'male', age: 'adult', accent: 'American', style: 'Casual, Approachable', tone: 'casual', preview_url: '' },
  { voice_id: 'nPczCjzI2devNBz1zQrb', name: 'Brian', gender: 'male', age: 'adult', accent: 'American', style: 'Deep, Narrative', tone: 'narration', preview_url: '' },
  { voice_id: 'onwK4e9ZLuTAKqWW03F9', name: 'Daniel', gender: 'male', age: 'adult', accent: 'British', style: 'Authoritative, Deep', tone: 'authoritative', preview_url: '' },
  { voice_id: 'pFZP5JQG7iQjIQuC4Bku', name: 'Lily', gender: 'female', age: 'young_adult', accent: 'British', style: 'Warm, Gentle', tone: 'soft', preview_url: '' },
  { voice_id: 'pMsXgVXv3BLzUgSXRplE', name: 'Aria', gender: 'female', age: 'adult', accent: 'American', style: 'Professional, Confident', tone: 'professional', preview_url: '' },
  { voice_id: 'pqHfZKP75CvOlQylNhV4', name: 'Bill', gender: 'male', age: 'adult', accent: 'American', style: 'Natural, Trustworthy', tone: 'documentary', preview_url: '' },
];

/**
 * Fetch voices from ElevenLabs API
 *
 * Prioritizes custom/cloned voices (native to our API key) over premade voices.
 * ElevenLabs categories:
 * - "premade" - Standard ElevenLabs voices available to all users
 * - "cloned" - Voices cloned by the API key owner
 * - "professional" - Professional voice clones
 * - "generated" - Instant voice clones
 * - "high_quality" - High quality optimized voices
 */
async function fetchElevenLabsVoices(): Promise<Voice[]> {
  const apiKey = process.env.ELEVENLABS_API_KEY;

  if (!apiKey) {
    log.warn('[Voices API] No ElevenLabs API key, using curated voices');
    return CURATED_VOICES;
  }

  try {
    const response = await fetch('https://api.elevenlabs.io/v1/voices', {
      method: 'GET',
      headers: {
        'xi-api-key': apiKey,
      },
    });

    if (!response.ok) {
      log.error('[Voices API] ElevenLabs API error', undefined, { status: response.status });
      return CURATED_VOICES;
    }

    const data = await response.json();
    const voices: Voice[] = (data.voices || []).map((v: Record<string, unknown>) => {
      const category = v.category as string || 'premade';
      // Custom voices are anything not "premade" - these are native to our API key
      const isCustom = category !== 'premade';

      return {
        voice_id: v.voice_id as string,
        name: v.name as string,
        gender: parseGender((v.labels as Record<string, string>)?.gender),
        age: parseAge((v.labels as Record<string, string>)?.age),
        accent: (v.labels as Record<string, string>)?.accent || 'American',
        style: (v.labels as Record<string, string>)?.description,
        tone: (v.labels as Record<string, string>)?.use_case,
        preview_url: (v.preview_url as string) || '',
        category,
        is_custom: isCustom,
      };
    });

    // Sort voices: custom voices first, then alphabetically by name within each group
    voices.sort((a, b) => {
      // Custom voices come first
      if (a.is_custom && !b.is_custom) return -1;
      if (!a.is_custom && b.is_custom) return 1;
      // Within same group, sort by name
      return a.name.localeCompare(b.name);
    });

    log.info(`[Voices API] Fetched ${voices.length} voices`, { total: voices.length, custom: voices.filter(v => v.is_custom).length });
    return voices;
  } catch (error) {
    log.error('[Voices API] Failed to fetch from ElevenLabs', error);
    return CURATED_VOICES;
  }
}

function parseGender(gender: string | undefined): Voice['gender'] {
  if (!gender) return 'neutral';
  const lower = gender.toLowerCase();
  if (lower.includes('male') && !lower.includes('female')) return 'male';
  if (lower.includes('female')) return 'female';
  return 'neutral';
}

function parseAge(age: string | undefined): Voice['age'] {
  if (!age) return 'adult';
  const lower = age.toLowerCase();
  if (lower.includes('child') || lower.includes('young')) return 'young_adult';
  if (lower.includes('senior') || lower.includes('old') || lower.includes('elder')) return 'senior';
  return 'adult';
}

/**
 * Get voices with caching
 */
async function getVoices(): Promise<Voice[]> {
  const now = Date.now();

  // Check cache
  if (voiceCache && now - cacheTimestamp < CACHE_TTL_MS) {
    return voiceCache;
  }

  // Fetch fresh data
  const voices = await fetchElevenLabsVoices();
  voiceCache = voices;
  cacheTimestamp = now;

  return voices;
}

export const GET = withAuth(async (request) => {
  try {
    // Parse query parameters for filtering
    const url = new URL(request.url);
    const gender = url.searchParams.get('gender');
    const accent = url.searchParams.get('accent');

    let voices = await getVoices();

    // Apply filters
    if (gender) {
      voices = voices.filter(v => v.gender === gender);
    }
    if (accent) {
      voices = voices.filter(v =>
        v.accent.toLowerCase().includes(accent.toLowerCase())
      );
    }

    return NextResponse.json({
      voices,
      count: voices.length,
      cached: Date.now() - cacheTimestamp < 1000 ? false : true,
    });
  } catch (error) {
    log.error('[Voices API] Error', error);
    return NextResponse.json(
      {
        error: 'Failed to fetch voices',
        code: 'FETCH_ERROR',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
});
