/**
 * Audio Scoring Tests
 *
 * Tests the client-side audio scoring that powers
 * the Audio Chooser track sorting.
 */

import { describe, it, expect } from 'vitest';
import { scoreAudioTrack, getScoredTracks } from '@/lib/audio-scoring';
import type { AudioTrackMetadata, SceneContext } from '@/lib/types/audio';

// Test track fixtures
const musicTracks: AudioTrackMetadata[] = [
  {
    id: 'm_orchestra_epic_01',
    file: 'music/m_orchestra_epic_01.mp3',
    title: 'Orchestra Epic 01',
    group: 'EPIC',
    style: 'orchestra',
    mood: ['epic', 'heroic', 'majestic', 'powerful'],
    intensity: 85,
    loopable: true,
    tags: ['anthemic', 'climax', 'orchestra'],
  },
  {
    id: 'm_string_orchestra_uplifting_01',
    file: 'music/m_string_orchestra_uplifting_01.mp3',
    title: 'String Orchestra Uplifting 01',
    group: 'UPLIFTING',
    style: 'orchestral strings',
    mood: ['uplifting', 'hopeful', 'bright', 'soaring'],
    intensity: 70,
    loopable: true,
    tags: ['cinematic', 'orchestra', 'strings'],
  },
  {
    id: 'm_piano_sad_01',
    file: 'music/m_piano_sad_01.mp3',
    title: 'Piano Sad 01',
    group: 'SAD',
    style: 'solo piano',
    mood: ['sad', 'melancholy', 'reflective', 'somber'],
    intensity: 30,
    loopable: true,
    tags: ['emotional', 'piano', 'intimate'],
  },
  {
    id: 'm_synth_tense_01',
    file: 'music/m_synth_tense_01.mp3',
    title: 'Synth Tense 01',
    group: 'TENSE',
    style: 'electronic synth',
    mood: ['tense', 'suspenseful', 'dark', 'ominous'],
    intensity: 75,
    loopable: true,
    tags: ['thriller', 'suspense', 'electronic'],
  },
];

const sfxTracks: AudioTrackMetadata[] = [
  {
    id: 's_bar_fight_brawl_01',
    file: 'sfx/s_bar_fight_brawl_01.mp3',
    title: 'Bar Fight Brawl 01',
    group: 'Fighting',
    style: 'general effect',
    mood: ['neutral', 'ambient', 'cinematic'],
    intensity: 40,
    loopable: true,
    tags: ['fighting', 'general', 'cinematic'],
  },
  {
    id: 's_explosion_heavy_01',
    file: 'sfx/s_explosion_heavy_01.mp3',
    title: 'Explosion Heavy 01',
    group: 'Explosions',
    style: 'explosion',
    mood: ['neutral', 'ambient', 'cinematic'],
    intensity: 80,
    loopable: false,
    tags: ['explosions', 'cinematic'],
  },
  {
    id: 's_gunshot_single_01',
    file: 'sfx/s_gunshot_single_01.mp3',
    title: 'Gunshot Single 01',
    group: 'Gunshot(s)',
    style: 'general effect',
    mood: ['neutral', 'ambient', 'cinematic'],
    intensity: 70,
    loopable: false,
    tags: ['gunshot', 'cinematic'],
  },
];

describe('Audio Scoring', () => {
  describe('scoreAudioTrack', () => {
    it('should score tense music higher than uplifting for a tense scene', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        mood: 'tense',
        summary: 'A dark suspenseful chase through the warehouse',
        intensity: 80,
      };

      const tenseScore = scoreAudioTrack(musicTracks[3], context, 'music'); // Synth Tense
      const upliftingScore = scoreAudioTrack(musicTracks[1], context, 'music'); // Uplifting
      expect(tenseScore).toBeGreaterThan(upliftingScore);
    });

    it('should rank high-intensity tracks higher for high-intensity scenes', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        mood: 'epic',
        summary: 'The climactic battle scene',
        intensity: 90,
      };

      const epicScore = scoreAudioTrack(musicTracks[0], context, 'music'); // Epic, intensity 85
      const sadScore = scoreAudioTrack(musicTracks[2], context, 'music'); // Sad, intensity 30
      expect(epicScore).toBeGreaterThan(sadScore);
    });

    it('should weight SFX group matching heavily', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        summary: 'Characters fighting in a bar',
        action_keywords: ['fighting', 'brawl', 'punch'],
        intensity: 60,
      };

      const fightScore = scoreAudioTrack(sfxTracks[0], context, 'sfx'); // Fighting group
      const explosionScore = scoreAudioTrack(sfxTracks[1], context, 'sfx'); // Explosions group
      expect(fightScore).toBeGreaterThan(explosionScore);
    });

    it('should return valid score with empty/missing context', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
      };

      const score = scoreAudioTrack(musicTracks[0], context, 'music');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    });

    it('should handle scenes with no mood but with summary', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        summary: 'A quiet moment of reflection by the lake',
      };

      const sadScore = scoreAudioTrack(musicTracks[2], context, 'music'); // reflective mood
      expect(sadScore).toBeGreaterThan(0);
    });
  });

  describe('getScoredTracks', () => {
    it('should return all tracks sorted by score descending', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        mood: 'tense',
        summary: 'Suspenseful standoff',
        intensity: 75,
      };

      const scored = getScoredTracks(musicTracks, context, 'music');

      expect(scored).toHaveLength(musicTracks.length);

      // Verify sorted descending
      for (let i = 1; i < scored.length; i++) {
        expect(scored[i - 1].score).toBeGreaterThanOrEqual(scored[i].score - 0.01);
      }
    });

    it('should assign correct match labels at thresholds', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        mood: 'tense suspenseful dark ominous thriller',
        summary: 'tense suspenseful scene',
        intensity: 75,
      };

      const scored = getScoredTracks(musicTracks, context, 'music');

      scored.forEach(sv => {
        expect(['Excellent', 'Good', 'Fair', 'Low']).toContain(sv.matchLabel);
        if (sv.score >= 0.7) expect(sv.matchLabel).toBe('Excellent');
        else if (sv.score >= 0.5) expect(sv.matchLabel).toBe('Good');
        else if (sv.score >= 0.3) expect(sv.matchLabel).toBe('Fair');
        else expect(sv.matchLabel).toBe('Low');
      });
    });

    it('should rank fighting SFX first for a combat scene', () => {
      const context: SceneContext = {
        scene_id: 'scene-1',
        summary: 'An intense fighting sequence in the alley',
        action_keywords: ['fighting', 'punching'],
        intensity: 70,
      };

      const scored = getScoredTracks(sfxTracks, context, 'sfx');

      // Fighting track should be #1
      expect(scored[0].track.id).toBe('s_bar_fight_brawl_01');
    });

    it('should return valid results for empty context', () => {
      const context: SceneContext = { scene_id: 'scene-1' };

      const scored = getScoredTracks(musicTracks, context, 'music');

      expect(scored).toHaveLength(musicTracks.length);
      scored.forEach(sv => {
        expect(sv.score).toBeGreaterThanOrEqual(0);
        expect(sv.score).toBeLessThanOrEqual(1);
      });
    });
  });
});
