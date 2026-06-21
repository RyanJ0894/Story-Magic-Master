/**
 * A-005 edge-case reproducer (Ryan 2026-06-15 + 6/21 dev notes).
 *
 * Ryan: "there are times where character voices are voicing lines or parts
 *        of descriptions rather than just voicing dialogue."
 *
 * The original A-005 classifier (commit a7658a8) catches:
 *   - Leading parenthetical "(whispering)"
 *   - INT./EXT./FADE/CUT TO/DISSOLVE/SMASH CUT/MATCH CUT/CLOSE ON/ANGLE ON
 *     /PAN/POV/SUPER/TITLE/MONTAGE/REVEAL
 *   - >20-char lines that are >50% UPPERCASE
 *
 * It misses several common LLM mis-attributions that Ryan keeps hitting:
 *   1. Action lines starting with He / She / They (third-person pronouns)
 *   2. Period-led descriptions (The wind blows.)
 *   3. Mid-line parentheticals (She walks (slowly) toward him.)
 *   4. Short SFX cues (BANG. CRASH. BOOM.)
 *   5. Off-camera fragments (Off her look. On the radio.)
 *   6. Beat / Pause / single-word direction
 *   7. WE SEE / WE HEAR cinematic narration
 *   8. INTERCUT WITH (missing from current keyword list)
 *   9. Action where text starts with a CHARACTER NAME in caps (SARAH backs
 *      against the wall) — uppercase ratio is below 50% so isMostlyUppercase
 *      misses it
 *  10. Bracket-wrapped wryly [whispering]
 *  11. Asterisk-wrapped action *She looks down.*
 *  12. Curly-brace action {action: glares}
 *
 * This test file demonstrates each gap with a concrete mis-attribution
 * and acts as the regression guard for the patches added alongside it.
 */

import { describe, it, expect, vi } from 'vitest';
import { DirectorJSONValidator } from './director-validator.js';
import type { DirectorJSON } from '../../schemas/director-json.js';

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

const validator = new DirectorJSONValidator();

describe('A-005 — edge-case patterns (Ryan reproducer 2026-06-21)', () => {
  // -----------------------------------------------------------------
  // Gap 1 — third-person pronoun openings
  // -----------------------------------------------------------------
  it.each([
    ['He turns and walks away.'],
    ['She walks slowly to the door.'],
    ['They both stare.'],
    ['It begins to rain.'],
  ])('reassigns third-person action "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 2 — period-led environmental descriptions
  // -----------------------------------------------------------------
  it.each([
    ['The wind blows the dust across the floor.'],
    ['The clock ticks loudly in the silence.'],
    ['Outside, a car passes.'],
    ['Rain begins to fall.'],
    ['A whisper rises.'],
  ])('reassigns environmental description "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 3 — single-word screenplay beats
  // -----------------------------------------------------------------
  it.each([
    ['Beat.'],
    ['Pause.'],
    ['Silence.'],
    ['Off her stare.'],
    ['On the radio.'],
    ['Through the window.'],
  ])('reassigns single-clause beat "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 4 — short SFX cues
  // -----------------------------------------------------------------
  it.each([
    ['BANG.'],
    ['CRASH.'],
    ['BOOM!'],
    ['THUD.'],
  ])('reassigns short SFX cue "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 5 — cinematic narration WE SEE / WE HEAR
  // -----------------------------------------------------------------
  it.each([
    ['WE SEE the truth in his eyes.'],
    ['WE HEAR a distant siren.'],
  ])('reassigns cinematic narration "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 6 — additional transition keywords
  // -----------------------------------------------------------------
  it.each([
    ['INTERCUT WITH the hallway.'],
    ['BACK TO Lucky.'],
    ['END FLASHBACK.'],
  ])('reassigns transition keyword "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 7 — character-name-prefixed action ("JACK turns…")
  //   isMostlyUppercase fails because the lowercase verb pulls the
  //   ratio below 50%. We add an explicit pattern.
  // -----------------------------------------------------------------
  it.each([
    ['JACK turns around and reaches for the lamp.'],
    ['SARAH backs against the wall.'],
    ['LUCKY sets the box down.'],
  ])('reassigns ALLCAPS-NAME-then-lowercase-verb "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Gap 8 — wrapped wryly / action markers
  // -----------------------------------------------------------------
  it.each([
    ['[whispering] Get down.'],
    ['*She looks down.*'],
    ['{action: glares}'],
  ])('reassigns wrapped action marker "%s" to Narrator', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Narrator');
  });

  // -----------------------------------------------------------------
  // Negative cases — DO NOT reassign real dialogue
  // -----------------------------------------------------------------
  it.each([
    ['I told you I would come back.'],
    ['You promised.'],
    ['I waited for you.'],
    ['I am too.'],
    ["I'm sorry."],
    ['Real dialogue here.'],
    ['Yeah, but I didn\'t believe you.'],
    ['STOP IT!'], // Short capitals: legitimate shouted dialogue
    ['NO!'],
  ])('does NOT reassign real dialogue "%s"', (text) => {
    const json = makeJson([{ character: 'Jack', text }]);
    validator.validate(json);
    expect(json.scenes[0].dialogue[0].character).toBe('Jack');
  });

  // -----------------------------------------------------------------
  // Integration — the whole Ryan reproducer screenplay
  // -----------------------------------------------------------------
  it('reduces the full reproducer scene to only true dialogue lines on characters', () => {
    const json = makeJson([
      { character: 'Jack', text: 'I told you I would come back.' },                      // dialogue → keep
      { character: 'Jack', text: 'She walks (slowly) toward the door, eyes fixed.' },   // action
      { character: 'Jack', text: 'He turns and walks away.' },                          // action
      { character: 'Jack', text: 'The wind blows the dust across the floor.' },        // action
      { character: 'Sarah', text: 'You shouldn\'t be here.' },                          // dialogue → keep
      { character: 'Sarah', text: 'She glares at him.' },                              // action
      { character: 'Sarah', text: 'INTERCUT WITH the hallway.' },                      // transition
      { character: 'Jack', text: 'JACK turns around and reaches for the lamp.' },     // action
      { character: 'Jack', text: 'WE SEE the truth in his eyes.' },                   // cinematic
      { character: 'Jack', text: '[whispering] Get down.' },                           // wryly
      { character: 'Jack', text: '*She looks down.*' },                                // asterisk
      { character: 'Jack', text: 'BANG.' },                                            // SFX
      { character: 'Jack', text: 'THE DOOR BURSTS OPEN AND SMOKE FLOODS THE ROOM.' }, // mostly caps
      { character: 'Jack', text: 'Beat.' },                                            // beat
      { character: 'Sarah', text: 'Real dialogue here.' },                            // dialogue → keep
    ]);
    validator.validate(json);

    const charactersOnRealLines = json.scenes[0].dialogue
      .filter((d) => d.character !== 'Narrator')
      .map((d) => d.text);

    // After A-005 runs, only 3 real dialogue lines should remain on characters.
    expect(charactersOnRealLines.sort()).toEqual([
      'I told you I would come back.',
      'Real dialogue here.',
      "You shouldn't be here.",
    ]);
  });
});
