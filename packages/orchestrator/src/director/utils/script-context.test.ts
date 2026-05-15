import { describe, it, expect } from 'vitest';
import { extractScriptContext, formatScriptContext } from './script-context.js';

const THRILLER_SCRIPT = `INT. DETECTIVE AGENCY - NIGHT

DETECTIVE KANE
The murder happened at midnight. We have a suspect.

INT. CRIME SCENE - DAY

Blood stains. Forensic team works quietly.`;

const SCI_FI_SCRIPT = `EXT. SPACECRAFT - DEEP SPACE

The android activates its laser targeting system. Galaxy-class vessel, year 2350.

CAPTAIN
Alien vessel approaching on sensors.`;

const ROMANCE_SCRIPT = `INT. COFFEE SHOP - DAY

Emma sits across from James, falling in love with every word.

EMMA
I feel like I've known you forever. Romantic, isn't it?`;

const COMEDY_SCRIPT = `INT. LIVING ROOM - DAY

DAVE trips over the dog. Everyone laughs. It's hilarious.

DAVE
This is absolutely ridiculous.`;

const HISTORICAL_SCRIPT = `EXT. BATTLEFIELD - 1863 - DAY

Soldiers charge across the muddy field. The Civil War rages.`;

describe('extractScriptContext', () => {
  it('detects crime/thriller genre', () => {
    const ctx = extractScriptContext(THRILLER_SCRIPT);
    expect(ctx.genre).toBe('crime/thriller');
    expect(ctx.tone).toBe('dark, tense');
  });

  it('detects sci-fi genre', () => {
    const ctx = extractScriptContext(SCI_FI_SCRIPT);
    expect(ctx.genre).toBe('sci-fi');
    expect(ctx.tone).toBe('futuristic, cerebral');
  });

  it('detects romance genre', () => {
    const ctx = extractScriptContext(ROMANCE_SCRIPT);
    expect(ctx.genre).toBe('romance');
    expect(ctx.tone).toBe('warm, emotional');
  });

  it('detects comedy genre', () => {
    const ctx = extractScriptContext(COMEDY_SCRIPT);
    expect(ctx.genre).toBe('comedy');
    expect(ctx.tone).toBe('light, humorous');
  });

  it('detects historical era from year', () => {
    const ctx = extractScriptContext(HISTORICAL_SCRIPT);
    expect(ctx.era).toContain('1800s');
  });

  it('defaults to contemporary era for modern scripts', () => {
    const ctx = extractScriptContext(THRILLER_SCRIPT);
    expect(ctx.era).toBe('contemporary');
  });

  it('defaults to drama for scripts with no genre keywords', () => {
    const ctx = extractScriptContext('INT. ROOM - DAY\n\nPERSON\nHello.');
    expect(ctx.genre).toBe('drama');
  });
});

describe('formatScriptContext', () => {
  it('produces a block starting with the context header', () => {
    const ctx = extractScriptContext(THRILLER_SCRIPT);
    const block = formatScriptContext(ctx);
    expect(block).toContain('[SCRIPT CONTEXT');
    expect(block).toContain('Genre: crime/thriller');
    expect(block).toContain('Tone: dark, tense');
  });
});
