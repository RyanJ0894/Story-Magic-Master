// @vitest-environment node
import { describe, it, expect } from 'vitest';
import { repairJSON, extractJSON, parseJSONSafely } from './json-repair.js';

describe('repairJSON', () => {
  it('passes valid JSON through unchanged', () => {
    const input = '{"key": "value", "num": 42}';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value', num: 42 });
  });

  it('strips markdown code fences', () => {
    const input = '```json\n{"key": "value"}\n```';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value' });
  });

  it('removes single-line // comments', () => {
    const input = '{"key": "value" // this is a comment\n}';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value' });
  });

  it('removes multi-line /* */ comments', () => {
    const input = '{"key": /* comment */ "value"}';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value' });
  });

  it('fixes trailing comma before }', () => {
    const input = '{"key": "value",}';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value' });
  });

  it('fixes trailing comma before ]', () => {
    const input = '[1, 2, 3,]';
    expect(JSON.parse(repairJSON(input))).toEqual([1, 2, 3]);
  });

  it('converts single-quoted strings to double-quoted', () => {
    const input = "{'key': 'value'}";
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value' });
  });

  it('quotes unquoted property names', () => {
    const input = '{key: "value", other: 42}';
    expect(JSON.parse(repairJSON(input))).toEqual({ key: 'value', other: 42 });
  });

  it('handles nested objects with trailing commas', () => {
    const input = '{"outer": {"inner": "val",},}';
    expect(JSON.parse(repairJSON(input))).toEqual({ outer: { inner: 'val' } });
  });
});

describe('extractJSON', () => {
  it('extracts a JSON object from surrounding text', () => {
    const input = 'Here is the result: {"key": "value"} and more text';
    expect(extractJSON(input)).toBe('{"key": "value"}');
  });

  it('extracts a JSON array from surrounding text', () => {
    const input = 'Result: [1, 2, 3] done';
    expect(extractJSON(input)).toBe('[1, 2, 3]');
  });

  it('returns null when no JSON object is present', () => {
    expect(extractJSON('no json here')).toBeNull();
  });

  it('handles nested braces correctly', () => {
    const input = 'prefix {"a": {"b": "c"}} suffix';
    expect(extractJSON(input)).toBe('{"a": {"b": "c"}}');
  });

  it('prefers object over array when object starts first', () => {
    const input = '{"obj": true} [1,2]';
    expect(extractJSON(input)).toBe('{"obj": true}');
  });

  it('returns null for unclosed braces', () => {
    expect(extractJSON('{"key": "value"')).toBeNull();
  });
});

describe('parseJSONSafely', () => {
  it('parses valid JSON successfully', () => {
    const result = parseJSONSafely<{ key: string }>('{"key": "value"}');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ key: 'value' });
  });

  it('repairs and parses LLM output with trailing commas', () => {
    const result = parseJSONSafely<{ key: string }>('{"key": "value",}');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ key: 'value' });
  });

  it('extracts and parses JSON embedded in prose', () => {
    const result = parseJSONSafely<{ name: string }>('The output is: {"name": "Alice"} as requested.');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toEqual({ name: 'Alice' });
  });

  it('handles markdown-wrapped LLM response', () => {
    const result = parseJSONSafely<{ score: number }>('```json\n{"score": 9}\n```');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.score).toBe(9);
  });

  it('returns success:false when no JSON is present', () => {
    const result = parseJSONSafely('just some text with no JSON');
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('No JSON object found');
  });

  it('returns success:false for unrepairable JSON', () => {
    const result = parseJSONSafely('{totally: broken: json: {{{{');
    expect(result.success).toBe(false);
  });
});
