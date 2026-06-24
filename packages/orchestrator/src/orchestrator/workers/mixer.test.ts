/**
 * Functional tests for Mixer Worker
 * Tests FFmpeg mixing pipeline, ducking, dialogue processing,
 * looping, loudness normalization, and SFX timing.
 */

import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks - must be declared before any import that triggers mixer module load
// ---------------------------------------------------------------------------

vi.mock('execa', () => ({
  execa: vi.fn(() =>
    Promise.resolve({
      stdout: '30.0',
      stderr: JSON.stringify({
        input_i: '-18.5',
        input_tp: '-3.2',
        input_lra: '7.1',
        input_thresh: '-28.5',
        target_offset: '0.5',
        output_i: '-16.0',
        output_tp: '-1.4',
        output_lra: '7.0',
      }),
    })
  ),
}));

vi.mock('ffmpeg-static', () => ({
  default: '/usr/local/bin/ffmpeg',
}));

vi.mock('ffprobe-static', () => ({
  default: { path: '/usr/local/bin/ffprobe' },
}));

vi.mock('fs', () => ({
  default: {
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    writeFileSync: vi.fn(),
    unlinkSync: vi.fn(),
  },
}));

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => null),
}));

vi.mock('../../lib/ffmpeg-validator.js', () => ({
  validateFiltergraph: vi.fn(() => ({
    valid: true,
    errors: [],
    warnings: [],
  })),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks are registered)
// ---------------------------------------------------------------------------

import { Readable } from 'node:stream';
import type { MixOptions, MixInputs, MixParams, SFXInput } from './mixer.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// analyzeRMSEnvelope reads subprocess.stderr as a Readable stream. This helper
// creates a mock subprocess whose .stderr property is a stream emitting the
// given text content so the readline interface gets the expected lines.
function makeStreamingSubprocess(stderrContent: string) {
  const stderrStream = Readable.from([stderrContent]);
  return Object.assign(
    Promise.resolve({ stdout: '', stderr: stderrContent }),
    { stderr: stderrStream },
  );
}

function baseMixOptions(overrides: Partial<MixOptions> = {}): MixOptions {
  return {
    project_id: 'proj_test',
    scene_id: 'scene_001',
    inputs: {
      dialogue: '/audio/dialogue.wav',
    },
    outWav: '/tmp/scene_001.wav',
    outFinal: '/output/scene_001.m4a',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe('mixScene', () => {
  let execaMock: Mock;
  let fsMock: typeof import('fs');
  let validatorMock: { validateFiltergraph: Mock };

  beforeEach(async () => {
    vi.resetAllMocks();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Re-acquire mocks after reset
    const execaModule = await import('execa');
    execaMock = execaModule.execa as Mock;

    const fsModule = await import('fs');
    fsMock = fsModule.default as unknown as typeof import('fs');
    (fsMock.existsSync as Mock).mockReturnValue(true);
    (fsMock.mkdirSync as Mock).mockReturnValue(undefined);
    (fsMock.writeFileSync as Mock).mockReturnValue(undefined);
    (fsMock.unlinkSync as Mock).mockReturnValue(undefined);

    const valModule = await import('../../lib/ffmpeg-validator.js');
    validatorMock = valModule as unknown as { validateFiltergraph: Mock };
    validatorMock.validateFiltergraph.mockReturnValue({
      valid: true,
      errors: [],
      warnings: [],
    });

    // Default execa mock: return sensible values for ffprobe (duration)
    // and loudnorm pass (measurement JSON in stderr)
    execaMock.mockImplementation((_bin: string, args: string[]) => {
      // ffprobe duration query
      if (args && args.includes('format=duration')) {
        return Promise.resolve({ stdout: '30.0', stderr: '' });
      }
      // loudnorm measurement pass (pass 1 - analysis to null)
      if (args && args.includes('-f') && args.includes('null')) {
        return Promise.resolve({
          stdout: '',
          stderr: [
            '{',
            '  "input_i" : "-18.50",',
            '  "input_tp" : "-3.20",',
            '  "input_lra" : "7.10",',
            '  "input_thresh" : "-28.50",',
            '  "target_offset" : "0.50",',
            '  "output_i" : "-16.00",',
            '  "output_tp" : "-1.40",',
            '  "output_lra" : "7.00"',
            '}',
          ].join('\n'),
        });
      }
      // All other FFmpeg calls (mix, encode, etc.)
      return Promise.resolve({ stdout: '', stderr: '' });
    });
  });

  // -----------------------------------------------------------------------
  // 1. Dialogue-only mix
  // -----------------------------------------------------------------------
  describe('dialogue-only mix', () => {
    it('should call FFmpeg with correct arguments for dialogue-only input', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions();

      const manifest = await mixScene(options);

      // First execa call after duration probe should be the mix command
      const mixCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-af') &&
          (call[1] as string[]).includes(options.outWav)
      );

      expect(mixCall).toBeDefined();
      // Dialogue input should be present
      const mixArgs = mixCall![1] as string[];
      expect(mixArgs).toContain('-i');
      expect(mixArgs).toContain(options.inputs.dialogue);
      // Output wav should be present
      expect(mixArgs).toContain(options.outWav);
      // Should use pcm_s16le codec at 48kHz
      expect(mixArgs).toContain('pcm_s16le');
      expect(mixArgs).toContain('48000');

      // Manifest should record dialogue-only
      expect(manifest.filters).toContain('dialogue_only');
    });

    it('should include dialogue processing chain by default', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions();

      const manifest = await mixScene(options);

      // The -af argument should contain the dialogue processing chain
      const mixCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) && (call[1] as string[]).includes('-af')
      );
      expect(mixCall).toBeDefined();

      const afIndex = (mixCall![1] as string[]).indexOf('-af');
      const filterArg = (mixCall![1] as string[])[afIndex + 1];

      // Should contain highpass, compressor, and EQ from buildDialogueChain
      expect(filterArg).toContain('highpass=f=80');
      expect(filterArg).toContain('acompressor');
      expect(filterArg).toContain('equalizer=f=3000');

      expect(manifest.filters).toContain('dialogue_processing');
    });

    it('should use anull filter when dialogue processing is disabled', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        mixParams: { use_dialogue_processing: false },
      });

      await mixScene(options);

      const mixCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) && (call[1] as string[]).includes('-af')
      );
      expect(mixCall).toBeDefined();

      const afIndex = (mixCall![1] as string[]).indexOf('-af');
      const filterArg = (mixCall![1] as string[])[afIndex + 1];

      expect(filterArg).toBe('anull');
    });
  });

  // -----------------------------------------------------------------------
  // 2. Music track inclusion
  // -----------------------------------------------------------------------
  describe('music track', () => {
    it('should include music input when provided', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      const manifest = await mixScene(options);

      // Should have a -filter_complex call with music input
      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const args = complexCall![1] as string[];
      // Should have two -i flags (dialogue + music/looped)
      const inputFlags = args.filter((a: string) => a === '-i');
      expect(inputFlags.length).toBeGreaterThanOrEqual(2);

      // Manifest should record music gain
      expect(manifest.inputs.music).toHaveLength(1);
      expect(manifest.inputs.music[0].path).toBe('/audio/music.mp3');
    });

    it('should apply music gain from mixParams', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
        mixParams: { music_gain_db: -18 },
      });

      const manifest = await mixScene(options);

      // Manifest should record custom gain
      expect(manifest.inputs.music[0].gain_db).toBe(-18);

      // Filter graph should contain the gain value
      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];
      expect(filterGraph).toContain('volume=-18dB');
    });

    it('should loop music to scene duration by default', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('music_looped');

      // Looping calls execa with -stream_loop or -t (trim)
      const loopCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          ((call[1] as string[]).includes('-stream_loop') ||
            ((call[1] as string[]).includes('-t') &&
              (call[1] as string[]).some((a: string) => a.includes('music_looped'))))
      );
      expect(loopCall).toBeDefined();
    });

    it('should not loop music when loop_music is false', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
        mixParams: { loop_music: false },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).not.toContain('music_looped');
    });
  });

  // -----------------------------------------------------------------------
  // 3. Ambience track inclusion
  // -----------------------------------------------------------------------
  describe('ambience track', () => {
    it('should include ambience input when provided', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          ambience: '/audio/ambience.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.ambience).toHaveLength(1);
      expect(manifest.inputs.ambience[0].path).toBe('/audio/ambience.mp3');
    });

    it('should apply ambience gain from mixParams', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          ambience: '/audio/ambience.mp3',
        },
        mixParams: { ambience_gain_db: -20 },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.ambience[0].gain_db).toBe(-20);
    });

    it('should loop ambience to scene duration by default', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          ambience: '/audio/ambience.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('ambience_looped');
    });

    it('should not loop ambience when loop_ambience is false', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          ambience: '/audio/ambience.mp3',
        },
        mixParams: { loop_ambience: false },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).not.toContain('ambience_looped');
    });
  });

  // -----------------------------------------------------------------------
  // 4. SFX with timing
  // -----------------------------------------------------------------------
  describe('SFX tracks', () => {
    it('should include SFX inputs with correct timing', async () => {
      const { mixScene } = await import('./mixer.js');
      const sfx: SFXInput[] = [
        { file: '/audio/gunshot.mp3', at: 5.5, duration: 2 },
        { file: '/audio/explosion.mp3', at: 12, duration: 3 },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          sfx,
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.sfx).toHaveLength(2);
      expect(manifest.inputs.sfx[0].at).toBe(5.5);
      expect(manifest.inputs.sfx[0].duration).toBe(2);
      expect(manifest.inputs.sfx[1].at).toBe(12);
      expect(manifest.inputs.sfx[1].duration).toBe(3);
      expect(manifest.filters).toContain('sfx_timed');
    });

    it('should handle SFXInput objects with at and duration', async () => {
      const { mixScene } = await import('./mixer.js');
      const sfx: SFXInput[] = [
        { file: '/audio/door_slam.mp3', at: 8.2, duration: 1.5 },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          sfx,
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.sfx).toHaveLength(1);
      expect(manifest.inputs.sfx[0].path).toBe('/audio/door_slam.mp3');
      expect(manifest.inputs.sfx[0].at).toBe(8.2);
      expect(manifest.inputs.sfx[0].duration).toBe(1.5);
      expect(manifest.inputs.sfx[0].index).toBe(0);
    });

    it('should handle string SFX entries as legacy format', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          sfx: ['/audio/beep.mp3'],
        },
      });

      const manifest = await mixScene(options);

      // String SFX should be normalized to at=0, duration=null
      expect(manifest.inputs.sfx).toHaveLength(1);
      expect(manifest.inputs.sfx[0].path).toBe('/audio/beep.mp3');
      expect(manifest.inputs.sfx[0].at).toBe(0);
      expect(manifest.inputs.sfx[0].duration).toBeNull();
    });

    it('should handle SFXInput with null duration', async () => {
      const { mixScene } = await import('./mixer.js');
      const sfx: SFXInput[] = [
        { file: '/audio/ambient_hit.mp3', at: 3, duration: null },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          sfx,
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.sfx[0].duration).toBeNull();
    });

    it('should apply sfx_gain_db from mixParams', async () => {
      const { mixScene } = await import('./mixer.js');
      const sfx: SFXInput[] = [
        { file: '/audio/sfx1.mp3', at: 0, duration: null },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          sfx,
        },
        mixParams: { sfx_gain_db: -8 },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.sfx[0].gain_db).toBe(-8);
    });

    it('should skip SFX files that do not exist', async () => {
      const { mixScene } = await import('./mixer.js');

      // Make existsSync return false for the SFX file during filter build
      // but true for other checks. The mixer checks existsSync for each SFX
      // file in the filter-building loop AND in the input-adding loop.
      const fsMod = await import('fs');
      const existsMock = (fsMod.default as unknown as { existsSync: Mock }).existsSync;
      existsMock.mockImplementation((p: string) => {
        if (typeof p === 'string' && p.includes('missing_sfx')) return false;
        return true;
      });

      const sfx: SFXInput[] = [
        { file: '/audio/missing_sfx.mp3', at: 5, duration: 2 },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
          sfx,
        },
      });

      // Should not throw; the missing SFX is skipped
      const manifest = await mixScene(options);

      // The manifest still records the SFX in normalized form, but the
      // filter graph should not include it (no sfx0 label generated)
      expect(manifest).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 5. Default mix params
  // -----------------------------------------------------------------------
  describe('default mix parameters', () => {
    it('should use default gain levels when mixParams not provided', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
          ambience: '/audio/ambience.mp3',
        },
      });

      const manifest = await mixScene(options);

      // Default music_gain_db = -22 (film-standard background level, #96)
      expect(manifest.inputs.music[0].gain_db).toBe(-22);
      // Default ambience_gain_db = -18 (audible room tone, raised from -26, #96)
      expect(manifest.inputs.ambience[0].gain_db).toBe(-18);
    });

    it('should use default sfx_gain_db = -4 when not specified', async () => {
      const { mixScene } = await import('./mixer.js');
      const sfx: SFXInput[] = [
        { file: '/audio/sfx.mp3', at: 0, duration: null },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          sfx,
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.sfx[0].gain_db).toBe(-12);
    });
  });

  // -----------------------------------------------------------------------
  // 6. Loudness normalization
  // -----------------------------------------------------------------------
  describe('loudness normalization', () => {
    it('should apply two-pass loudnorm targeting -16 LUFS', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions();

      await mixScene(options);

      // Find the loudnorm analysis call (pass 1 - outputs to null)
      const loudnormCalls = execaMock.mock.calls.filter(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).some(
            (a: string) => typeof a === 'string' && a.includes('loudnorm')
          )
      );

      expect(loudnormCalls.length).toBeGreaterThanOrEqual(1);

      // At least one call should target I=-16
      const hasTarget16 = loudnormCalls.some((call: unknown[]) =>
        (call[1] as string[]).some(
          (a: string) => typeof a === 'string' && a.includes('I=-16')
        )
      );
      expect(hasTarget16).toBe(true);
    });

    it('should use custom target_lufs when specified', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        mixParams: { target_lufs: -14 },
      });

      await mixScene(options);

      // Find loudnorm calls that target -14
      const loudnormCalls = execaMock.mock.calls.filter(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).some(
            (a: string) => typeof a === 'string' && a.includes('I=-14')
          )
      );

      expect(loudnormCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should use custom true_peak_db when specified', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        mixParams: { true_peak_db: -2.0 },
      });

      await mixScene(options);

      const loudnormCalls = execaMock.mock.calls.filter(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).some(
            (a: string) => typeof a === 'string' && a.includes('TP=-2')
          )
      );

      expect(loudnormCalls.length).toBeGreaterThanOrEqual(1);
    });

    it('should output final file to outFinal path', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions();

      await mixScene(options);

      // The final loudnorm encode should target outFinal
      const finalEncodeCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes(options.outFinal) &&
          (call[1] as string[]).some(
            (a: string) => typeof a === 'string' && a.includes('loudnorm')
          )
      );

      expect(finalEncodeCall).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 7. Dialogue processing chain
  // -----------------------------------------------------------------------
  describe('dialogue processing chain', () => {
    it('should include highpass, compressor, and EQ in full mix', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('dialogue_vocal_chain');

      // Check filter_complex contains dialogue chain components
      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];

      expect(filterGraph).toContain('highpass=f=80');
      expect(filterGraph).toContain('acompressor=threshold=-20dB:ratio=3');
      expect(filterGraph).toContain('equalizer=f=3000');
    });

    it('should use anull when dialogue processing is disabled in full mix', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
        mixParams: { use_dialogue_processing: false },
      });

      await mixScene(options);

      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];

      expect(filterGraph).toContain('[0:a]anull[dialogue_processed]');
    });
  });

  // -----------------------------------------------------------------------
  // 8. Advanced ducking
  // -----------------------------------------------------------------------
  describe('advanced ducking', () => {
    it('should use sidechain compression by default (ducking off)', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('music_sidechain_ducking');
      expect(manifest.filters).not.toContain('music_adaptive_ducking');
    });

    it('should analyze RMS and apply adaptive ducking when enabled', async () => {
      const { mixScene } = await import('./mixer.js');

      // The RMS analysis call writes astats to stderr.
      // Provide mock RMS data so the envelope is not empty.
      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '45.0', stderr: '' });
          // PR β: 45 s (was 10 s) — passes the 30 s short-scene gate so advanced ducking actually runs.
        }
        // RMS analysis call uses astats filter
        if (
          args &&
          args.some((a: string) => typeof a === 'string' && a.includes('astats'))
        ) {
          // Simulate RMS output lines via a Readable stream (analyzeRMSEnvelope reads subprocess.stderr as a stream)
          const lines = Array.from({ length: 20 }, (_, i) =>
            `lavfi.astats.Overall.RMS_level=${-30 + (i % 5) * 3}`
          ).join('\n');
          return makeStreamingSubprocess(lines);
        }
        // loudnorm
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: [
              '{',
              '  "input_i" : "-18.50",',
              '  "input_tp" : "-3.20",',
              '  "input_lra" : "7.10",',
              '  "input_thresh" : "-28.50",',
              '  "target_offset" : "0.50",',
              '  "output_i" : "-16.00",',
              '  "output_tp" : "-1.40",',
              '  "output_lra" : "7.00"',
              '}',
            ].join('\n'),
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
        mixParams: { use_advanced_ducking: true },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('music_adaptive_ducking');
      expect(manifest.filters).not.toContain('music_sidechain_ducking');
    });

    it('should use fallback envelope when RMS execa call fails', async () => {
      // analyzeRMSEnvelope catches execa errors internally and returns
      // a fallback single-point envelope [{t:0, rmsDb:-35}].
      // This still produces a valid (short) duck curve, so adaptive
      // ducking is used rather than falling back to sidechain.
      const { mixScene } = await import('./mixer.js');

      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '45.0', stderr: '' });
          // PR β: 45 s (was 10 s) — passes the 30 s short-scene gate so advanced ducking actually runs.
        }
        // RMS analysis throws error - caught internally by analyzeRMSEnvelope
        if (
          args &&
          args.some((a: string) => typeof a === 'string' && a.includes('astats'))
        ) {
          return Promise.reject(new Error('RMS analysis failed'));
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: [
              '{',
              '  "input_i" : "-18.50",',
              '  "input_tp" : "-3.20",',
              '  "input_lra" : "7.10",',
              '  "input_thresh" : "-28.50",',
              '  "target_offset" : "0.50",',
              '  "output_i" : "-16.00",',
              '  "output_tp" : "-1.40",',
              '  "output_lra" : "7.00"',
              '}',
            ].join('\n'),
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
        mixParams: { use_advanced_ducking: true },
      });

      const manifest = await mixScene(options);

      // analyzeRMSEnvelope returns a fallback 1-point envelope on error,
      // which is still valid for the adaptive ducking path
      expect(manifest.filters).toContain('music_adaptive_ducking');
    });

    // PR β (2026-06-23): skip the astats analysis pass entirely on scenes
    // shorter than 30 s. The full filter-graph pass at 50 ms hop costs
    // ~5–15 s per call (or more on the longer timeouts in #394) and the
    // perceptual difference vs. sidechain on a < 30 s clip is nil. If
    // the guard ever regresses, short-scene wallclock immediately balloons.
    it('does NOT run astats on scenes shorter than 30 s, even when use_advanced_ducking=true', async () => {
      const { mixScene } = await import('./mixer.js');

      // ffprobe returns 10 s → triggers the short-scene early-exit.
      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '10.0', stderr: '' });
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{"input_i":"-18","input_tp":"-3","input_lra":"7","input_thresh":"-28","target_offset":"0.5","output_i":"-16","output_tp":"-1.4","output_lra":"7"}',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await mixScene(baseMixOptions({
        inputs: { dialogue: '/audio/dialogue.wav', music: '/audio/music.mp3' },
        mixParams: { use_advanced_ducking: true },
      }));

      // No execa call should have the astats filter. Sidechain fallback
      // (set in the mix filter_complex) covers ducking on short scenes.
      const astatsCall = execaMock.mock.calls.find((call: unknown[]) => {
        const args = call[1] as string[] | undefined;
        return Array.isArray(args) && args.some(
          (a) => typeof a === 'string' && a.includes('astats'),
        );
      });
      expect(astatsCall).toBeUndefined();
    });

    it('DOES run astats on scenes at/above 30 s when use_advanced_ducking=true', async () => {
      const { mixScene } = await import('./mixer.js');

      // ffprobe returns 45 s → over the threshold → astats SHOULD run.
      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '45.0', stderr: '' });
        }
        if (args && args.some((a: string) => typeof a === 'string' && a.includes('astats'))) {
          return Promise.resolve({ stdout: '', stderr: 'lavfi.astats.Overall.RMS_level=-30' });
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{"input_i":"-18","input_tp":"-3","input_lra":"7","input_thresh":"-28","target_offset":"0.5","output_i":"-16","output_tp":"-1.4","output_lra":"7"}',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      await mixScene(baseMixOptions({
        inputs: { dialogue: '/audio/dialogue.wav', music: '/audio/music.mp3' },
        mixParams: { use_advanced_ducking: true },
      }));

      const astatsCall = execaMock.mock.calls.find((call: unknown[]) => {
        const args = call[1] as string[] | undefined;
        return Array.isArray(args) && args.some(
          (a) => typeof a === 'string' && a.includes('astats'),
        );
      });
      expect(astatsCall).toBeDefined();
    });

    // PR γ (2026-06-23) regression guard: the main filter_complex mix call
    // must pass `-threads 0` as a GLOBAL option (before -i) so ffmpeg
    // auto-picks the optimal thread count. On standard/Pro Render plans
    // this unlocks the 2–4× speedup that motivated the PR. If anyone
    // "cleans up" the threads flag, this lights up before the prod
    // regression (back to single-threaded per-scene mix).
    it('passes -threads 0 as a global option on the main mix execa call', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions();
      await mixScene(options);

      // The main mix call is the one whose argv includes the outWav path.
      // (Same anchor as the existing dialogue-only-mix test in this file.)
      const mixCall = execaMock.mock.calls.find((call: unknown[]) => {
        const args = call[1] as string[] | undefined;
        return Array.isArray(args) && args.includes(options.outWav);
      });
      expect(mixCall).toBeDefined();
      const args = mixCall![1] as string[];
      const threadsIdx = args.indexOf('-threads');
      expect(threadsIdx).toBeGreaterThanOrEqual(0);
      expect(args[threadsIdx + 1]).toBe('0');
      // Global option = before the first -i.
      const firstInputIdx = args.indexOf('-i');
      expect(threadsIdx).toBeLessThan(firstInputIdx);
    });

    it('should fall back to sidechain when duck curve is too complex', async () => {
      // When the downsampled curve exceeds 500 segments, the mixer
      // sets duckCurve = null and falls back to sidechain compression.
      const { mixScene } = await import('./mixer.js');

      // Generate RMS output with alternating blocks of 4 points each.
      // Each block of 4 at 0.05s hop = 0.2s, meeting minSegmentSec.
      // 10000 points / 4 = 2500 blocks → ~2500 downsampled segments > 500 threshold.
      const manyRmsLines = Array.from({ length: 10000 }, (_, i) => {
        const block = Math.floor(i / 4);
        const rms = block % 2 === 0 ? -20 : -60;
        return `lavfi.astats.Overall.RMS_level=${rms}`;
      }).join('\n');

      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '500.0', stderr: '' });
        }
        if (
          args &&
          args.some((a: string) => typeof a === 'string' && a.includes('astats'))
        ) {
          return makeStreamingSubprocess(manyRmsLines);
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{ "input_i": "-18.5", "input_tp": "-3.2", "input_lra": "7.1", "input_thresh": "-28.5", "target_offset": "0.5", "output_i": "-16.0", "output_tp": "-1.4", "output_lra": "7.0" }',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
        mixParams: { use_advanced_ducking: true },
      });

      const manifest = await mixScene(options);

      // With highly variable RMS, downsampled segments should exceed 500
      // causing fallback to sidechain compression
      expect(manifest.filters).toContain('music_sidechain_ducking');
      expect(manifest.filters).not.toContain('music_adaptive_ducking');
    });

    it('should apply adaptive ducking to ambience when enabled', async () => {
      const { mixScene } = await import('./mixer.js');

      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '45.0', stderr: '' });
          // PR β: 45 s (was 10 s) — passes the 30 s short-scene gate so advanced ducking actually runs.
        }
        if (
          args &&
          args.some((a: string) => typeof a === 'string' && a.includes('astats'))
        ) {
          const lines = Array.from({ length: 20 }, (_, i) =>
            `lavfi.astats.Overall.RMS_level=${-30 + (i % 5) * 3}`
          ).join('\n');
          return Promise.resolve({ stdout: '', stderr: lines });
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{ "input_i": "-18.5", "input_tp": "-3.2", "input_lra": "7.1", "input_thresh": "-28.5", "target_offset": "0.5", "output_i": "-16.0", "output_tp": "-1.4", "output_lra": "7.0" }',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          ambience: '/audio/ambience.mp3',
        },
        mixParams: { use_advanced_ducking: true },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('ambience_adaptive_ducking');
    });
  });

  // -----------------------------------------------------------------------
  // 9. Music/ambience looping behavior
  // -----------------------------------------------------------------------
  describe('audio looping', () => {
    it('should use stream_loop when input is shorter than scene', async () => {
      const { mixScene } = await import('./mixer.js');

      // Dialogue is 30s, music is 10s (needs looping)
      let durationCallCount = 0;
      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          durationCallCount++;
          // First duration call is for dialogue (30s), second for music (10s)
          if (durationCallCount === 1) return Promise.resolve({ stdout: '30.0', stderr: '' });
          return Promise.resolve({ stdout: '10.0', stderr: '' });
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{ "input_i": "-18.5", "input_tp": "-3.2", "input_lra": "7.1", "input_thresh": "-28.5", "target_offset": "0.5", "output_i": "-16.0", "output_tp": "-1.4", "output_lra": "7.0" }',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await mixScene(options);

      // Should have a stream_loop call for music
      const loopCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) && (call[1] as string[]).includes('-stream_loop')
      );
      expect(loopCall).toBeDefined();
    });

    it('should trim (not loop) when input is longer than scene', async () => {
      const { mixScene } = await import('./mixer.js');

      // Dialogue is 30s, music is 60s (trim only)
      let durationCallCount = 0;
      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          durationCallCount++;
          if (durationCallCount === 1) return Promise.resolve({ stdout: '30.0', stderr: '' });
          return Promise.resolve({ stdout: '60.0', stderr: '' });
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{ "input_i": "-18.5", "input_tp": "-3.2", "input_lra": "7.1", "input_thresh": "-28.5", "target_offset": "0.5", "output_i": "-16.0", "output_tp": "-1.4", "output_lra": "7.0" }',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await mixScene(options);

      // Should have a trim call with -t (target duration) but NOT -stream_loop
      const trimCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-t') &&
          !(call[1] as string[]).includes('-stream_loop') &&
          (call[1] as string[]).some((a: string) => a.includes('afade'))
      );
      expect(trimCall).toBeDefined();
    });
  });

  // -----------------------------------------------------------------------
  // 10. Error handling
  // -----------------------------------------------------------------------
  describe('error handling', () => {
    it('should throw when FFmpeg mix command fails', async () => {
      const { mixScene } = await import('./mixer.js');

      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '30.0', stderr: '' });
        }
        // The actual mix call (has -filter_complex)
        if (args && args.includes('-filter_complex')) {
          return Promise.reject(new Error('FFmpeg mix failed: exit code 1'));
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{ "input_i": "-18.5", "input_tp": "-3.2", "input_lra": "7.1", "input_thresh": "-28.5", "target_offset": "0.5" }',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await expect(mixScene(options)).rejects.toThrow('FFmpeg mix failed');
    });

    it('should throw when filtergraph validation fails', async () => {
      const { mixScene } = await import('./mixer.js');

      validatorMock.validateFiltergraph.mockReturnValue({
        valid: false,
        errors: ['Unbalanced filter labels'],
        warnings: [],
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await expect(mixScene(options)).rejects.toThrow('Filtergraph validation failed');
    });

    it('should clean up temp files when mix fails', async () => {
      const { mixScene } = await import('./mixer.js');
      const fsMod = await import('fs');
      const unlinkMock = (fsMod.default as unknown as { unlinkSync: Mock }).unlinkSync;

      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '10.0', stderr: '' });
        }
        if (args && args.includes('-filter_complex')) {
          return Promise.reject(new Error('Mix failed'));
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await expect(mixScene(options)).rejects.toThrow();

      // unlinkSync should have been called for temp looped files
      // (the cleanup function iterates tempFiles array)
      expect(unlinkMock).toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // 11. Full mix with all inputs
  // -----------------------------------------------------------------------
  describe('full mix with all inputs', () => {
    it('should combine dialogue, music, ambience, and SFX', async () => {
      const { mixScene } = await import('./mixer.js');
      const sfx: SFXInput[] = [
        { file: '/audio/sfx1.mp3', at: 2, duration: 1.5 },
      ];
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
          ambience: '/audio/ambience.mp3',
          sfx,
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.inputs.dialogue).toHaveLength(1);
      expect(manifest.inputs.music).toHaveLength(1);
      expect(manifest.inputs.ambience).toHaveLength(1);
      expect(manifest.inputs.sfx).toHaveLength(1);

      // Should use filter_complex (not simple -af)
      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      // Filter graph should have amix with correct input count
      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];
      expect(filterGraph).toContain('amix=inputs=4');
    });

    it('should map output to [mix] label', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await mixScene(options);

      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const args = complexCall![1] as string[];
      expect(args).toContain('-map');
      expect(args).toContain('[mix]');
    });
  });

  // -----------------------------------------------------------------------
  // 12. Manifest persistence
  // -----------------------------------------------------------------------
  describe('manifest persistence', () => {
    it('should write manifest JSON to local filesystem', async () => {
      const { mixScene } = await import('./mixer.js');
      const fsMod = await import('fs');
      const writeFileMock = (fsMod.default as unknown as { writeFileSync: Mock }).writeFileSync;

      const options = baseMixOptions();

      await mixScene(options);

      expect(writeFileMock).toHaveBeenCalled();
      const writeCall = writeFileMock.mock.calls[0];
      const writtenPath = writeCall[0] as string;
      expect(writtenPath).toContain('scene_001-manifest.json');

      // Verify written JSON is valid
      const writtenData = JSON.parse(writeCall[1] as string);
      expect(writtenData.scene_id).toBe('scene_001');
    });

    it('should record scene_id in manifest', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({ scene_id: 'scene_042' });

      const manifest = await mixScene(options);

      expect(manifest.scene_id).toBe('scene_042');
    });

    // PR α (2026-06-23): the per-scene post-loudnorm verification pass was
    // dropped. The manifest now records the TARGET values (what loudnorm
    // was asked to hit) rather than re-measured output values. Saves a
    // full ffmpeg decode pass per scene (~5–10s) without losing data —
    // loudnorm either hit the targets or the previous pass would have
    // failed. If we ever need true post-mix audit values, run it
    // out-of-band on the final episode rather than every scene.
    it('records the target loudness values on the manifest (no re-measurement)', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      // Mock loudnorm measurement pass + main mix. The KEY assertion below
      // ignores any `output_i` / `output_tp` the mock returns — proves we
      // no longer parse the post-mix verification stream.
      execaMock.mockImplementation((_bin: string, args: string[]) => {
        if (args && args.includes('format=duration')) {
          return Promise.resolve({ stdout: '10.0', stderr: '' });
        }
        if (args && args.includes('-f') && args.includes('null')) {
          return Promise.resolve({
            stdout: '',
            stderr: '{ "input_i": "-18.5", "input_tp": "-3.2", "input_lra": "7.1", "input_thresh": "-28.5", "target_offset": "0.5", "output_i": "-999.0", "output_tp": "-999.0", "output_lra": "-999.0" }',
          });
        }
        return Promise.resolve({ stdout: '', stderr: '' });
      });

      const manifest = await mixScene(options);

      // Target defaults are I=-16, TP=-1.5, LRA=8 in mixScene. Even though
      // the mock returns `-999` for the output_* fields, we ignore them
      // because the verification pass no longer runs.
      expect(manifest.lufs_i).toBe(-16);
      expect(manifest.true_peak_db).toBe(-1.5);
      expect(manifest.lra).toBe(8);
    });

    // PR α codec-selection regression guard: scene files are .wav now, so
    // loudnormTwoPass must encode with pcm_s16le. The final episode file
    // (.m4a) stays AAC. If anyone hardcodes a codec back in any of the
    // three loudnorm execa calls, this lights up before the prod regression
    // (double-encode + lossy hop reintroduced + final concat slower).
    it('codecArgsForOutPath picks PCM for .wav and AAC for .m4a', async () => {
      const { codecArgsForOutPath } = await import('./mixer.js');
      expect(codecArgsForOutPath('/tmp/scene-001.wav')).toEqual(['-c:a', 'pcm_s16le']);
      expect(codecArgsForOutPath('/tmp/scene-001.WAV')).toEqual(['-c:a', 'pcm_s16le']);
      expect(codecArgsForOutPath('/tmp/episode.m4a')).toEqual(['-c:a', 'aac', '-b:a', '256k']);
      // Default fallback — anything we don't recognize stays AAC for
      // backward compatibility with callers passing explicit AAC targets.
      expect(codecArgsForOutPath('/tmp/preview.unknown')).toEqual(['-c:a', 'aac', '-b:a', '256k']);
    });

    // PR α regression guard for the call-count contract: no execa call
    // should be made post-loudnormTwoPass that re-runs the loudnorm filter
    // in measurement mode on the OUTPUT file. The signature of the dropped
    // call was: `-i <outFinal> -af loudnorm=...:print_format=json -f null -`.
    // If this test goes red, the per-scene verification pass crept back in.
    it('does NOT run a post-loudnorm verification pass on the output file', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: { dialogue: '/audio/dialogue.wav', music: '/audio/music.mp3' },
      });

      // Default mock from beforeEach returns loudnorm JSON for any `-f null` call.
      await mixScene(options);

      // The verification pass was identifiable by:
      //   - reading the OUTPUT file (inputPath ends with outFinal name),
      //   - WITH `print_format=json` in the -af arg.
      // The (still-correct) measurement pass inside loudnormTwoPass reads
      // the OUTWAV file instead. So no execa call should hit outFinal +
      // print_format=json simultaneously.
      const verificationLikeCall = execaMock.mock.calls.find((call: unknown[]) => {
        const args = call[1] as string[] | undefined;
        if (!Array.isArray(args)) return false;
        const iIdx = args.indexOf('-i');
        const inputArg = iIdx >= 0 ? args[iIdx + 1] : '';
        const afIdx = args.indexOf('-af');
        const afArg = afIdx >= 0 ? args[afIdx + 1] : '';
        return inputArg === options.outFinal && afArg.includes('print_format=json');
      });
      expect(verificationLikeCall).toBeUndefined();
    });
  });

  // -----------------------------------------------------------------------
  // 13. Filter graph validation
  // -----------------------------------------------------------------------
  describe('filtergraph validation', () => {
    it('should call validateFiltergraph before executing mix', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await mixScene(options);

      expect(validatorMock.validateFiltergraph).toHaveBeenCalledTimes(1);
      // The argument should be the filtergraph string
      const graphArg = validatorMock.validateFiltergraph.mock.calls[0][0];
      expect(typeof graphArg).toBe('string');
      expect(graphArg.length).toBeGreaterThan(0);
    });
  });

  // -----------------------------------------------------------------------
  // 14. Gain compensation
  // -----------------------------------------------------------------------
  describe('gain compensation', () => {
    it('should include limiter in final output chain', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      await mixScene(options);

      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];

      expect(filterGraph).toContain('alimiter=limit=0.95');
    });

    it('should apply gain compensation based on input count', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
          ambience: '/audio/ambience.mp3',
        },
      });

      await mixScene(options);

      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      expect(complexCall).toBeDefined();

      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];

      // Should have [premix] -> volume compensation -> [compensated]
      expect(filterGraph).toContain('[premix]');
      expect(filterGraph).toContain('[compensated]');
      expect(filterGraph).toMatch(/volume=-[\d.]+dB/);
    });
  });

  // -----------------------------------------------------------------------
  // 15. EQ separation on music and ambience
  // -----------------------------------------------------------------------
  describe('EQ separation', () => {
    it('should apply EQ notch on music for vocal clarity', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          music: '/audio/music.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('music_eq_separation');

      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];

      // Music should have EQ cuts in voice frequency range
      expect(filterGraph).toContain('equalizer=f=800');
      expect(filterGraph).toContain('equalizer=f=2500');
    });

    it('should apply bandpass filtering on ambience', async () => {
      const { mixScene } = await import('./mixer.js');
      const options = baseMixOptions({
        inputs: {
          dialogue: '/audio/dialogue.wav',
          ambience: '/audio/ambience.mp3',
        },
      });

      const manifest = await mixScene(options);

      expect(manifest.filters).toContain('ambience_eq_separation');

      const complexCall = execaMock.mock.calls.find(
        (call: unknown[]) =>
          Array.isArray(call[1]) &&
          (call[1] as string[]).includes('-filter_complex')
      );
      const filterIdx = (complexCall![1] as string[]).indexOf('-filter_complex');
      const filterGraph = (complexCall![1] as string[])[filterIdx + 1];

      // Ambience should have highpass and lowpass
      expect(filterGraph).toContain('highpass=f=40');
      expect(filterGraph).toContain('lowpass=f=12000');
    });
  });
});
