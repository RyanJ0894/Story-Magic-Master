/**
 * Voice Catalog DB Loading Tests (#164)
 *
 * Verifies that loadVoiceCatalog() (used by searchVoicesHybrid) queries the DB first,
 * falls back to JSON files on empty result or error, and respects the TTL cache.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchVoicesHybrid, clearVoiceCatalogCache } from './hybrid-voice-search.js';

// Mock prisma module — must be hoisted before the module under test loads
vi.mock('../../lib/prisma.js', () => ({
  prisma: {
    voiceCatalogEntry: {
      findMany: vi.fn(),
    },
  },
}));

// Import AFTER vi.mock to get the mocked version
const { prisma } = await import('../../lib/prisma.js');
const mockFindMany = vi.mocked(prisma.voiceCatalogEntry.findMany);

describe('Voice catalog DB loading (#164)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    clearVoiceCatalogCache();
  });

  it('uses DB rows when voiceCatalogEntry table has entries', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'uuid-1',
        voiceId: 'db-voice-001',
        name: 'DB Voice Alpha',
        label: 'Male 20s to 30s',
        gender: 'Male',
        style: 'American',
        tone: 'warm',
        description: 'A warm male voice',
        isPlaceholder: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: 'uuid-2',
        voiceId: 'db-voice-002',
        name: 'DB Voice Beta',
        label: 'Female - 20s to 30s',
        gender: 'Female',
        style: 'British',
        tone: null,
        description: null,
        isPlaceholder: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // ageRange: 'young_adult' matches 'Male 20s to 30s' label → proximity score > 0 → not filtered out
    const result = await searchVoicesHybrid({
      characterName: 'Character',
      gender: 'Male',
      ageRange: 'young_adult',
    });

    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(mockFindMany).toHaveBeenCalledWith({
      where: { isActive: true },
      orderBy: { label: 'asc' },
    });
    expect(result.success).toBe(true);
    // The DB voice should appear in results (ageRange proximity gives positive score)
    const voiceIds = result.voices.map((v) => v.voice_id);
    expect(voiceIds).toContain('db-voice-001');
  });

  it('falls back to JSON files when DB returns empty array', async () => {
    mockFindMany.mockResolvedValueOnce([]);

    const result = await searchVoicesHybrid({
      characterName: 'TestChar',
      gender: 'Male',
    });

    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    // Should still return voices (from local JSON fallback)
    expect(result.voices.length).toBeGreaterThan(0);
    // Source won't be DB since we fell back
    expect(['local_catalog', 'fallback']).toContain(result.source);
  });

  it('falls back to JSON files when DB throws', async () => {
    mockFindMany.mockRejectedValueOnce(new Error('Connection refused'));

    const result = await searchVoicesHybrid({
      characterName: 'TestChar',
      gender: 'Female',
    });

    expect(mockFindMany).toHaveBeenCalledOnce();
    expect(result.success).toBe(true);
    expect(result.voices.length).toBeGreaterThan(0);
  });

  it('does not re-query DB within the TTL cache window', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'uuid-1',
        voiceId: 'db-voice-001',
        name: 'DB Voice Alpha',
        label: 'Male 20s to 30s',
        gender: 'Male',
        style: 'American',
        tone: null,
        description: null,
        isPlaceholder: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // First call populates cache
    await searchVoicesHybrid({ characterName: 'Char1', gender: 'Male' });
    // Second call should hit cache, not DB
    await searchVoicesHybrid({ characterName: 'Char2', gender: 'Male' });

    // DB should only have been queried once despite two searches
    expect(mockFindMany).toHaveBeenCalledTimes(1);
  });

  it('re-queries DB after clearVoiceCatalogCache()', async () => {
    mockFindMany.mockResolvedValue([
      {
        id: 'uuid-1',
        voiceId: 'db-voice-001',
        name: 'DB Voice Alpha',
        label: 'Male 20s to 30s',
        gender: 'Male',
        style: 'American',
        tone: null,
        description: null,
        isPlaceholder: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await searchVoicesHybrid({ characterName: 'Char1', gender: 'Male' });
    clearVoiceCatalogCache();
    await searchVoicesHybrid({ characterName: 'Char2', gender: 'Male' });

    // After cache clear, DB should be queried again
    expect(mockFindMany).toHaveBeenCalledTimes(2);
  });

  it('maps DB gender field to Male/Female union type correctly', async () => {
    mockFindMany.mockResolvedValueOnce([
      {
        id: 'uuid-f',
        voiceId: 'db-female-001',
        name: 'DB Female Voice',
        label: 'Female - 20s to 30s',
        gender: 'Female',
        style: 'American',
        tone: null,
        description: null,
        isPlaceholder: false,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    // ageRange: 'young_adult' matches 'Female - 20s to 30s' → proximity score > 0
    const result = await searchVoicesHybrid({ characterName: 'Character', gender: 'Female', ageRange: 'young_adult' });

    const dbVoice = result.voices.find((v) => v.voice_id === 'db-female-001');
    expect(dbVoice).toBeDefined();
    expect(dbVoice?.gender).toBe('Female');
  });
});
