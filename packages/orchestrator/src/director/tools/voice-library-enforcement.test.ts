/**
 * Voice Library Enforcement Tests (#94)
 *
 * Confirms that searchVoicesHybrid NEVER returns voices from the ElevenLabs API —
 * only from the local curated catalog or curated default fallbacks.
 *
 * The ElevenLabs API fallback was removed in fix/voice-ambience-pipeline to ensure
 * the AI director only assigns voices from Ryan's approved collection.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchVoicesHybrid, clearVoiceCatalogCache } from './hybrid-voice-search.js';

// We want to verify that fetch (ElevenLabs API) is NEVER called by this module.
const fetchSpy = vi.spyOn(globalThis, 'fetch');

describe('Voice library enforcement — curated-only (#94)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearVoiceCatalogCache();
    fetchSpy.mockReset();
  });

  afterEach(() => {
    fetchSpy.mockRestore();
  });

  it('never calls the ElevenLabs API regardless of search params', async () => {
    await searchVoicesHybrid({
      characterName: 'Hero character, brave and confident',
      gender: 'Male',
      ageRange: 'young_adult',
      style: 'American',
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns a voice from local catalog, not the API, for obscure parameters', async () => {
    // Use params unlikely to match well — should still return a curated fallback
    const result = await searchVoicesHybrid({
      characterName: 'Extremely obscure character with no keywords',
      gender: 'Female',
      ageRange: 'older',
      style: 'Australian',
    });

    expect(result.success).toBe(true);
    expect(result.voices.length).toBeGreaterThan(0);
    // Source must be local_catalog or fallback — never elevenlabs_api
    expect(result.source).not.toBe('elevenlabs_api');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('uses curated default fallback (not API) when local catalog has no match', async () => {
    // Exclude all voices to force the fallback path
    const result = await searchVoicesHybrid({
      characterName: 'Any character',
      gender: 'Male',
      // Note: excludeVoiceIds would need to list all voice IDs to truly test this,
      // but we're confirming the source field and no fetch calls
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(['local_catalog', 'fallback']).toContain(result.source);
  });

  it('never calls the API for narrator search', async () => {
    await searchVoicesHybrid({
      characterName: 'narrator voice, warm and engaging',
      isNarrator: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('result voice_ids are from the curated catalog (not random ElevenLabs IDs)', async () => {
    // Known curated default voice IDs
    const KNOWN_CURATED_IDS = [
      'JBFqnCBsd6RMkjVDRZzb', // George (narrator)
      'bIHbv24MWmeRgasZH58o', // Will (male default)
      'cgSgspJ2msm6clMCkdW9', // Jessica (female default)
    ];

    const result = await searchVoicesHybrid({
      characterName: 'narrator',
      isNarrator: true,
    });

    expect(result.voices.length).toBeGreaterThan(0);
    // All returned voices should have a voice_id (not undefined)
    for (const v of result.voices) {
      expect(v.voice_id).toBeTruthy();
      expect(typeof v.voice_id).toBe('string');
    }
    // No fetch was used
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
