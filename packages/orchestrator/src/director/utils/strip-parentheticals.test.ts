import { describe, it, expect } from 'vitest';
import { stripParentheticals } from './strip-parentheticals.js';

describe('stripParentheticals', () => {
  it('removes a leading stage direction', () => {
    expect(stripParentheticals('(angrily) Don\'t I?')).toBe("Don't I?");
  });

  it('removes embedded direction in the middle', () => {
    expect(stripParentheticals('I said (sharply) that I do.')).toBe('I said that I do.');
  });

  it('removes trailing direction', () => {
    expect(stripParentheticals('Get out. (whispered)')).toBe('Get out.');
  });

  it('removes multiple parentheticals', () => {
    expect(stripParentheticals('(O.S.) Hello (V.O.) world.')).toBe('Hello world.');
  });

  it('handles nested parens by stripping innermost first', () => {
    expect(stripParentheticals('(a (b) c) hello')).toBe('hello');
  });

  it('leaves empty strings alone', () => {
    expect(stripParentheticals('')).toBe('');
  });

  it('collapses whitespace runs after stripping', () => {
    expect(stripParentheticals('one  (note)  two')).toBe('one two');
  });

  it('does not strip square brackets or curly braces', () => {
    expect(stripParentheticals('a [SFX] b')).toBe('a [SFX] b');
    expect(stripParentheticals('a {note} b')).toBe('a {note} b');
  });

  it('returns clean text unchanged', () => {
    expect(stripParentheticals('Just plain dialogue.')).toBe('Just plain dialogue.');
  });

  it('handles the exact pathological case from issue #218', () => {
    // From the issue: HENRY says "(smiles angrily)" then "Don't I?"
    // If the model concatenates the parenthetical into text, we strip it.
    expect(stripParentheticals('(smiles angrily) Don\'t I?')).toBe("Don't I?");
  });
});
