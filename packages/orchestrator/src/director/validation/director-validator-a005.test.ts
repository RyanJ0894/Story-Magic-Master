/**
 * Tests for the A-005 stage-direction auto-reassignment in
 * DirectorJSONValidator. Closes A-005 from the 2026-06-15 build plan.
 *
 * The bug Ryan reported: character voices occasionally read parentheticals,
 * scene headers, transitions, or action lines instead of just dialogue.
 * The director-agent prompt has had RULE 2 saying "action → Narrator" since
 * v1, but the model sometimes ignores it. The auto-reassigner is a safety
 * net so a single misclassified line doesn't survive into the rendered mix.
 */

import { describe, it, expect, vi } from 'vitest';
import { DirectorJSONValidator } from './director-validator.js';
import type { DirectorJSON } from '../../schemas/director-json.js';

// Silence the validator's log output during tests.
vi.mock('../../lib/logger.js', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeJson(lines: Array<{ character: string; text: string }>): DirectorJSON {
  return {
    scenes: [
      {
        scene_id: 'scene_001',
        scene_header: 'Test scene',
        location: 'INT. ROOM - DAY',
        intensity: 0.5,
        dialogue: lines.map((l, i) => ({
          line_id: `line_${String(i + 1).padStart(3, '0')}`,
          character: l.character,
          voice_key: l.character === 'Narrator' ? 'narrator_voice' : 'char_voice',
          text: l.text,
        })),
      },
    ],
  } as unknown as DirectorJSON;
}

describe('DirectorJSONValidator — A-005 stage-direction auto-reassignment', () => {
  const validator = new DirectorJSONValidator();

  it('keeps real dialogue assigned to its character', () => {
    const json = makeJson([
      { character: 'Lucky', text: 'I told you I would come back.' },
      { character: 'Sarah', text: "Yeah, but I didn't believe you." },
    ]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Lucky');
    expect(json.scenes[0].dialogue[1].character).toBe('Sarah');
  });

  it.each([
    ['parenthetical', '(whispering to himself)'],
    ['scene header INT.', 'INT. KEVIN\'S HOUSE - DAY'],
    ['scene header EXT.', 'EXT. BEACH - NIGHT'],
    ['transition FADE IN', 'FADE IN:'],
    ['transition CUT TO', 'CUT TO:'],
    ['transition DISSOLVE TO', 'DISSOLVE TO:'],
    ['camera direction CLOSE ON', 'CLOSE ON Lucky as he turns.'],
    ['camera direction ANGLE ON', 'ANGLE ON the window.'],
    ['POV direction', 'POV: Lucky looking down.'],
    ['SUPER title', 'SUPER: "Four Years Earlier"'],
    ['BEGIN MONTAGE', 'BEGIN MONTAGE'],
    ['REVEAL', 'REVEAL: The room is empty.'],
  ])('reassigns a %s misclassified as character speech to Narrator', (_label, badText) => {
    const json = makeJson([
      { character: 'Lucky', text: badText },
      { character: 'Lucky', text: 'Real dialogue here.' },
    ]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
    expect(json.scenes[0].dialogue[1].character).toBe('Lucky'); // untouched
  });

  it('reassigns mostly-uppercase action lines (>20 chars, >50% caps)', () => {
    const json = makeJson([
      { character: 'Lucky', text: 'THE DOOR BURSTS OPEN AND SMOKE FLOODS THE ROOM.' },
    ]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  it('does NOT reassign short capital words (legitimate dialogue can shout)', () => {
    const json = makeJson([
      { character: 'Lucky', text: 'NO!' },
      { character: 'Sarah', text: 'STOP IT!' },
    ]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Lucky');
    expect(json.scenes[0].dialogue[1].character).toBe('Sarah');
  });

  it('sets voice_key to a real narrator voice (not undefined) so DirectorJSONSchema accepts the JSON', () => {
    // 2026-06-21: previously this expected `voice_key` to be falsy on the
    // assumption that downstream voice-assignment would fill it in. But
    // the orchestrator runs DirectorJSONSchema validation BEFORE voice
    // assignment, so undefined voice_key produced HTTP 400 in dev (Ryan
    // job 2413af4f-… on 2026-06-21). A-005 now substitutes either the
    // script's existing narrator voice_key OR DEFAULT_NARRATOR_VOICE.
    const json = makeJson([
      { character: 'Narrator', text: 'Some real narrator line.' },
      { character: 'Lucky', text: '(beat)' },
    ]);
    validator.validate(json);
    const reassigned = json.scenes[0].dialogue[1];
    expect(reassigned.character).toBe('Narrator');
    expect(typeof reassigned.voice_key).toBe('string');
    expect(reassigned.voice_key.length).toBeGreaterThan(0);
  });

  it('falls back to DEFAULT_NARRATOR_VOICE when the script has no narrator at all', () => {
    const json = makeJson([{ character: 'Lucky', text: '(beat)' }]);
    validator.validate(json);
    const line = json.scenes[0].dialogue[0];
    expect(line.character).toBe('Narrator');
    expect(typeof line.voice_key).toBe('string');
    expect(line.voice_key.length).toBeGreaterThan(0);
  });

  it("preserves the LLM's narrator casing (e.g. uppercase NARRATOR) when reassigning", () => {
    const json = makeJson([
      { character: 'NARRATOR', text: 'Establishing line.' },
      { character: 'Lucky', text: 'CUT TO:' },
    ]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[1].character).toBe('NARRATOR');
    // voice_key matches the existing NARRATOR's voice_key, not a default
    expect(json.scenes[0].dialogue[1].voice_key).toBe(json.scenes[0].dialogue[0].voice_key);
  });

  it('handles a mixed scene without touching narrator lines', () => {
    const json = makeJson([
      { character: 'Narrator', text: 'Interior. Kevin\'s house. Day.' },
      { character: 'Lucky', text: 'I made it back.' },
      { character: 'Lucky', text: '(softly, almost to himself)' },
      { character: 'Sarah', text: 'Welcome home.' },
    ]);
    validator.validate(json);
    expect(json.scenes[0].dialogue.map((l) => l.character)).toEqual([
      'Narrator',
      'Lucky',
      'Narrator', // was Lucky with parenthetical — auto-reassigned
      'Sarah',
    ]);
  });

  it('is idempotent — running validate() twice produces the same result', () => {
    const json = makeJson([
      { character: 'Lucky', text: 'CUT TO:' },
      { character: 'Sarah', text: 'Real dialogue.' },
    ]);
    validator.validate(json);
    const snapshot = JSON.stringify(json);
    validator.validate(json);
    expect(JSON.stringify(json)).toBe(snapshot);
  });
});
