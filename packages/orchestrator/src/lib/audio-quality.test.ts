import { describe, it, expect } from 'vitest';
import {
  validateAudioQuality,
  parseLoudnormOutput,
  parseLoudnormOutputPass2,
  TARGET_LUFS_I,
  MAX_TRUE_PEAK_DB,
} from './audio-quality.js';

// =============================================================================
// validateAudioQuality
// =============================================================================

describe('validateAudioQuality', () => {
  describe('passing cases', () => {
    it('passes when LUFS-I is exactly at target and true peak is within limit', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0 });
      expect(result.passed).toBe(true);
      expect(result.checks.lufs.passed).toBe(true);
      expect(result.checks.truePeak.passed).toBe(true);
    });

    it('passes when LUFS-I is within ±2 LU tolerance', () => {
      expect(validateAudioQuality({ lufs_i: -14.1, true_peak_db: -2.0 }).passed).toBe(true);
      expect(validateAudioQuality({ lufs_i: -17.9, true_peak_db: -2.0 }).passed).toBe(true);
    });

    it('passes when true peak is exactly at limit (-1.5 dBFS)', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -1.5 });
      expect(result.checks.truePeak.passed).toBe(true);
    });

    it('passes with LRA within 20 LU', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0, lra: 12.0 });
      expect(result.passed).toBe(true);
      expect(result.checks.lra?.passed).toBe(true);
    });

    it('omits LRA check when lra is undefined', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0 });
      expect(result.checks.lra).toBeNull();
    });
  });

  describe('LUFS failures', () => {
    it('fails when LUFS-I is too loud (above target + tolerance)', () => {
      const result = validateAudioQuality({ lufs_i: -12.0, true_peak_db: -2.0 });
      expect(result.passed).toBe(false);
      expect(result.checks.lufs.passed).toBe(false);
      expect(result.checks.lufs.message).toContain('deviates 4.0 LU');
    });

    it('fails when LUFS-I is too quiet (below target - tolerance)', () => {
      const result = validateAudioQuality({ lufs_i: -20.0, true_peak_db: -2.0 });
      expect(result.passed).toBe(false);
      expect(result.checks.lufs.passed).toBe(false);
      expect(result.checks.lufs.message).toContain('deviates 4.0 LU');
    });

    it('fails when LUFS-I measurement is null', () => {
      const result = validateAudioQuality({ lufs_i: null, true_peak_db: -2.0 });
      expect(result.passed).toBe(false);
      expect(result.checks.lufs.message).toContain('unavailable');
    });

    it('respects custom LUFS tolerance', () => {
      // -18 is 2 LU from target; passes with tolerance=2, fails with tolerance=1
      expect(
        validateAudioQuality({ lufs_i: -18.0, true_peak_db: -2.0 }, { lufsTolerance: 2 }).checks.lufs.passed
      ).toBe(true);
      expect(
        validateAudioQuality({ lufs_i: -18.0, true_peak_db: -2.0 }, { lufsTolerance: 1 }).checks.lufs.passed
      ).toBe(false);
    });
  });

  describe('true peak failures', () => {
    it('fails when true peak exceeds -1.5 dBFS', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -1.0 });
      expect(result.passed).toBe(false);
      expect(result.checks.truePeak.passed).toBe(false);
      expect(result.checks.truePeak.message).toContain('exceeds limit');
    });

    it('fails when true peak is 0 dBFS (clipping)', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: 0.0 });
      expect(result.checks.truePeak.passed).toBe(false);
    });

    it('fails when true peak measurement is null', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: null });
      expect(result.passed).toBe(false);
      expect(result.checks.truePeak.message).toContain('unavailable');
    });

    it('respects custom max true peak threshold', () => {
      // -2.0 fails at -1.5 limit but passes at -3.0 limit
      expect(
        validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0 }, { maxTruePeakDb: -1.5 }).checks.truePeak.passed
      ).toBe(true);
      expect(
        validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0 }, { maxTruePeakDb: -3.0 }).checks.truePeak.passed
      ).toBe(false);
    });
  });

  describe('LRA checks', () => {
    it('fails LRA check when LRA exceeds 20 LU', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0, lra: 22.0 });
      expect(result.passed).toBe(false);
      expect(result.checks.lra?.passed).toBe(false);
      expect(result.checks.lra?.message).toContain('exceeds maximum');
    });

    it('passes when lra is null (not measured)', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0, lra: null });
      expect(result.passed).toBe(true);
      expect(result.checks.lra).toBeNull();
    });
  });

  describe('summary messages', () => {
    it('includes measured values in passing summary', () => {
      const result = validateAudioQuality({ lufs_i: -16.0, true_peak_db: -2.0 });
      expect(result.summary).toContain('EBU R128');
      expect(result.summary).toContain('-16.0');
    });

    it('includes failure reasons in failing summary', () => {
      const result = validateAudioQuality({ lufs_i: -10.0, true_peak_db: 0.0 });
      expect(result.summary).toContain('FAILED');
      expect(result.summary).toContain('LUFS-I');
      expect(result.summary).toContain('True peak');
    });
  });

  describe('constants', () => {
    it('uses correct EBU R128 target constants', () => {
      expect(TARGET_LUFS_I).toBe(-16);
      expect(MAX_TRUE_PEAK_DB).toBe(-1.5);
    });
  });
});

// =============================================================================
// parseLoudnormOutput (pass 1 — input_* fields)
// =============================================================================

describe('parseLoudnormOutput', () => {
  const LOUDNORM_STDERR = `
[Parsed_loudnorm_0 @ 0x7f8b4c012a00] {
  "input_i" : "-23.5",
  "input_tp" : "-3.2",
  "input_lra" : "9.1",
  "input_thresh" : "-34.0",
  "target_offset" : "7.5"
}`;

  it('parses LUFS-I, true peak, and LRA from loudnorm stderr', () => {
    const result = parseLoudnormOutput(LOUDNORM_STDERR);
    expect(result).not.toBeNull();
    expect(result!.lufs_i).toBeCloseTo(-23.5);
    expect(result!.true_peak_db).toBeCloseTo(-3.2);
    expect(result!.lra).toBeCloseTo(9.1);
  });

  it('returns null when no JSON block found in stderr', () => {
    expect(parseLoudnormOutput('no json here')).toBeNull();
    expect(parseLoudnormOutput('')).toBeNull();
  });

  it('returns null for malformed JSON', () => {
    expect(parseLoudnormOutput('{ "input_i": broken json }')).toBeNull();
  });

  it('handles numeric values (not just string values)', () => {
    const stderr = '{ "input_i": -20.0, "input_tp": -2.5, "input_lra": 8.0 }';
    const result = parseLoudnormOutput(stderr);
    expect(result?.lufs_i).toBeCloseTo(-20.0);
    expect(result?.true_peak_db).toBeCloseTo(-2.5);
  });
});

// =============================================================================
// parseLoudnormOutputPass2 (pass 2 — output_* fields)
// =============================================================================

describe('parseLoudnormOutputPass2', () => {
  const PASS2_STDERR = `
Some ffmpeg output...
"output_i" : "-16.1",
"output_tp" : "-1.8",
"output_lra" : "8.3",
More output...`;

  it('parses LUFS-I, true peak, and LRA from pass-2 stderr', () => {
    const result = parseLoudnormOutputPass2(PASS2_STDERR);
    expect(result).not.toBeNull();
    expect(result!.lufs_i).toBeCloseTo(-16.1);
    expect(result!.true_peak_db).toBeCloseTo(-1.8);
    expect(result!.lra).toBeCloseTo(8.3);
  });

  it('returns null when no output_* fields present', () => {
    expect(parseLoudnormOutputPass2('no loudnorm output here')).toBeNull();
    expect(parseLoudnormOutputPass2('')).toBeNull();
  });

  it('handles missing LRA gracefully', () => {
    const stderr = '"output_i" : "-16.0", "output_tp" : "-2.0"';
    const result = parseLoudnormOutputPass2(stderr);
    expect(result?.lufs_i).toBeCloseTo(-16.0);
    expect(result?.lra).toBeNull();
  });

  it('validates a passing EBU R128 mix result end-to-end', () => {
    const stderr = '"output_i" : "-16.0", "output_tp" : "-2.1", "output_lra" : "7.5"';
    const measurement = parseLoudnormOutputPass2(stderr);
    expect(measurement).not.toBeNull();
    const quality = validateAudioQuality(measurement!);
    expect(quality.passed).toBe(true);
  });

  it('detects a failing mix result end-to-end', () => {
    const stderr = '"output_i" : "-10.5", "output_tp" : "-0.5", "output_lra" : "12.0"';
    const measurement = parseLoudnormOutputPass2(stderr);
    const quality = validateAudioQuality(measurement!);
    expect(quality.passed).toBe(false);
    expect(quality.checks.lufs.passed).toBe(false);
    expect(quality.checks.truePeak.passed).toBe(false);
  });
});
