/**
 * Audio Quality Validation
 *
 * Validates measured loudness and peak values against EBU R128 broadcast standards:
 *   - Integrated loudness (LUFS-I): -16 LUFS target
 *   - True peak:                    -1.5 dBFS maximum
 *   - Loudness range (LRA):         ≤ 20 LU (informational)
 */

// =============================================================================
// Constants
// =============================================================================

/** EBU R128 broadcast loudness target (LUFS-I) */
export const TARGET_LUFS_I = -16;

/** Maximum allowed true peak (dBFS) */
export const MAX_TRUE_PEAK_DB = -1.5;

/** Default tolerance for LUFS-I pass/fail check (±2 LU) */
export const DEFAULT_LUFS_TOLERANCE = 2;

/** Maximum loudness range before flagging (LU) */
export const MAX_LRA = 20;

// =============================================================================
// Types
// =============================================================================

export interface AudioMeasurement {
  /** Integrated loudness (LUFS) — from FFmpeg loudnorm output_i */
  lufs_i: number | null;
  /** True peak (dBFS) — from FFmpeg loudnorm output_tp */
  true_peak_db: number | null;
  /** Loudness range (LU) — from FFmpeg loudnorm output_lra */
  lra?: number | null;
}

export interface AudioQualityCheck {
  /** Overall pass/fail */
  passed: boolean;
  /** Per-dimension results */
  checks: {
    lufs: CheckResult;
    truePeak: CheckResult;
    lra: CheckResult | null;
  };
  /** Human-readable summary */
  summary: string;
}

export interface CheckResult {
  passed: boolean;
  measured: number | null;
  target: number | string;
  message: string;
}

export interface AudioQualityOptions {
  /** Acceptable deviation from target LUFS (default: ±2 LU) */
  lufsTolerance?: number;
  /** Override max true peak threshold */
  maxTruePeakDb?: number;
}

// =============================================================================
// Core validation
// =============================================================================

/**
 * Validate measured audio levels against EBU R128 broadcast standards.
 *
 * @param measurement - Measured values from FFmpeg loudnorm
 * @param options     - Optional overrides for thresholds
 * @returns Structured pass/fail result with per-dimension details
 */
export function validateAudioQuality(
  measurement: AudioMeasurement,
  options: AudioQualityOptions = {}
): AudioQualityCheck {
  const { lufsTolerance = DEFAULT_LUFS_TOLERANCE, maxTruePeakDb = MAX_TRUE_PEAK_DB } = options;

  // --- LUFS-I check ---
  const lufsCheck: CheckResult = (() => {
    if (measurement.lufs_i === null) {
      return {
        passed: false,
        measured: null,
        target: `${TARGET_LUFS_I} ± ${lufsTolerance} LUFS`,
        message: 'LUFS measurement unavailable',
      };
    }
    const delta = Math.abs(measurement.lufs_i - TARGET_LUFS_I);
    const passed = delta <= lufsTolerance;
    return {
      passed,
      measured: measurement.lufs_i,
      target: `${TARGET_LUFS_I} ± ${lufsTolerance} LUFS`,
      message: passed
        ? `LUFS-I ${measurement.lufs_i.toFixed(1)} within tolerance`
        : `LUFS-I ${measurement.lufs_i.toFixed(1)} deviates ${delta.toFixed(1)} LU from target ${TARGET_LUFS_I}`,
    };
  })();

  // --- True peak check ---
  const truePeakCheck: CheckResult = (() => {
    if (measurement.true_peak_db === null) {
      return {
        passed: false,
        measured: null,
        target: `≤ ${maxTruePeakDb} dBFS`,
        message: 'True peak measurement unavailable',
      };
    }
    const passed = measurement.true_peak_db <= maxTruePeakDb;
    return {
      passed,
      measured: measurement.true_peak_db,
      target: `≤ ${maxTruePeakDb} dBFS`,
      message: passed
        ? `True peak ${measurement.true_peak_db.toFixed(1)} dBFS within limit`
        : `True peak ${measurement.true_peak_db.toFixed(1)} dBFS exceeds limit ${maxTruePeakDb}`,
    };
  })();

  // --- LRA check (informational — only fails if grossly out of range) ---
  const lraCheck: CheckResult | null = (() => {
    if (measurement.lra === undefined || measurement.lra === null) return null;
    const passed = measurement.lra <= MAX_LRA;
    return {
      passed,
      measured: measurement.lra,
      target: `≤ ${MAX_LRA} LU`,
      message: passed
        ? `LRA ${measurement.lra.toFixed(1)} LU within range`
        : `LRA ${measurement.lra.toFixed(1)} LU exceeds maximum ${MAX_LRA} LU`,
    };
  })();

  const passed = lufsCheck.passed && truePeakCheck.passed && (lraCheck === null || lraCheck.passed);

  const failures: string[] = [];
  if (!lufsCheck.passed) failures.push(lufsCheck.message);
  if (!truePeakCheck.passed) failures.push(truePeakCheck.message);
  if (lraCheck && !lraCheck.passed) failures.push(lraCheck.message);

  const summary = passed
    ? `Audio meets EBU R128 standard (LUFS-I: ${measurement.lufs_i?.toFixed(1)}, TP: ${measurement.true_peak_db?.toFixed(1)} dBFS)`
    : `Audio quality check FAILED: ${failures.join('; ')}`;

  return { passed, checks: { lufs: lufsCheck, truePeak: truePeakCheck, lra: lraCheck }, summary };
}

/**
 * Parse loudnorm JSON output from FFmpeg stderr.
 *
 * FFmpeg loudnorm prints a JSON block to stderr during analysis (pass 1):
 *   [Parsed_loudnorm_0 @ 0x...] {
 *     "input_i" : "-23.0",
 *     "output_i" : "-16.0",
 *     ...
 *   }
 *
 * @param stderr - Raw FFmpeg stderr output
 * @returns Parsed measurement or null if parsing fails
 */
export function parseLoudnormOutput(stderr: string): AudioMeasurement | null {
  // Extract the JSON block from loudnorm stderr output
  const match = stderr.match(/\{[\s\S]*?"input_i"[\s\S]*?\}/);
  if (!match) return null;

  try {
    const json = JSON.parse(match[0]);

    const parseNum = (val: unknown): number | null => {
      if (val === null || val === undefined) return null;
      const n = typeof val === 'string' ? parseFloat(val) : Number(val);
      return isFinite(n) ? n : null;
    };

    return {
      lufs_i: parseNum(json.input_i),
      true_peak_db: parseNum(json.input_tp),
      lra: parseNum(json.input_lra),
    };
  } catch {
    return null;
  }
}

/**
 * Parse post-normalization loudnorm output (output_* fields instead of input_*).
 */
export function parseLoudnormOutputPass2(stderr: string): AudioMeasurement | null {
  const outputI = (stderr.match(/"output_i"\s*:\s*"?([-\d.]+)"?/) || [])[1];
  const outputTP = (stderr.match(/"output_tp"\s*:\s*"?([-\d.]+)"?/) || [])[1];
  const outputLRA = (stderr.match(/"output_lra"\s*:\s*"?([-\d.]+)"?/) || [])[1];

  if (!outputI && !outputTP) return null;

  return {
    lufs_i: outputI ? parseFloat(outputI) : null,
    true_peak_db: outputTP ? parseFloat(outputTP) : null,
    lra: outputLRA ? parseFloat(outputLRA) : null,
  };
}
