/**
 * JSON Repair Utility - Handles common LLM JSON formatting issues
 *
 * LLMs often produce JSON with minor formatting problems:
 * - Trailing commas
 * - Single quotes instead of double quotes
 * - Unquoted property names
 * - JavaScript style comments
 * - Newlines in strings
 * - Missing quotes around values
 */

/**
 * Attempt to repair common JSON issues from LLM output
 */
export function repairJSON(input: string): string {
  let result = input;

  // Step 1: Remove any markdown code blocks
  result = result.replace(/```json\s*/gi, '');
  result = result.replace(/```\s*/g, '');

  // Step 2: Remove single-line comments (// ...)
  result = result.replace(/\/\/[^\n]*/g, '');

  // Step 3: Remove multi-line comments (/* ... */)
  result = result.replace(/\/\*[\s\S]*?\*\//g, '');

  // Step 4: Fix trailing commas before ] or }
  result = result.replace(/,(\s*[}\]])/g, '$1');

  // Step 5: Fix single quotes to double quotes (careful with nested quotes)
  // Only replace single quotes that are used as string delimiters
  result = fixQuotes(result);

  // Step 6: Quote unquoted property names
  // Match patterns like { key: or , key:
  result = result.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)(\s*:)/g, '$1"$2"$3');

  // Step 7: Fix newlines inside strings (replace with \n)
  result = fixNewlinesInStrings(result);

  return result;
}

/**
 * Fix single quotes to double quotes for JSON strings
 */
function fixQuotes(input: string): string {
  const result: string[] = [];
  let inString = false;
  let stringChar = '';
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = input[i + 1] || '';

    // Check for escape sequences
    if (char === '\\' && inString) {
      result.push(char);
      result.push(nextChar);
      i += 2;
      continue;
    }

    // Handle string boundaries
    if ((char === '"' || char === "'") && !inString) {
      inString = true;
      stringChar = char;
      result.push('"'); // Always use double quotes
      i++;
      continue;
    }

    if (char === stringChar && inString) {
      inString = false;
      stringChar = '';
      result.push('"'); // Always use double quotes
      i++;
      continue;
    }

    // Handle single quotes inside double-quoted strings (need escaping)
    if (char === "'" && inString && stringChar === '"') {
      result.push("'");
      i++;
      continue;
    }

    // Handle double quotes inside single-quoted strings (need escaping)
    if (char === '"' && inString && stringChar === "'") {
      result.push('\\"');
      i++;
      continue;
    }

    result.push(char);
    i++;
  }

  return result.join('');
}

/**
 * Fix newlines inside JSON strings
 */
function fixNewlinesInStrings(input: string): string {
  const result: string[] = [];
  let inString = false;
  let i = 0;

  while (i < input.length) {
    const char = input[i];
    const nextChar = input[i + 1] || '';

    // Check for escape sequences
    if (char === '\\' && inString) {
      result.push(char);
      result.push(nextChar);
      i += 2;
      continue;
    }

    // Handle string boundaries
    if (char === '"' && (i === 0 || input[i - 1] !== '\\')) {
      inString = !inString;
      result.push(char);
      i++;
      continue;
    }

    // Replace newlines inside strings
    if (inString && (char === '\n' || char === '\r')) {
      if (char === '\r' && nextChar === '\n') {
        result.push('\\n');
        i += 2;
      } else {
        result.push('\\n');
        i++;
      }
      continue;
    }

    result.push(char);
    i++;
  }

  return result.join('');
}

/**
 * Extract JSON from a string that may contain other text
 * Handles nested braces correctly
 */
export function extractJSON(input: string): string | null {
  // Find the first { or [
  const startBrace = input.indexOf('{');
  const startBracket = input.indexOf('[');

  let start: number;
  let endChar: string;

  if (startBrace === -1 && startBracket === -1) {
    return null;
  } else if (startBrace === -1) {
    start = startBracket;
    endChar = ']';
  } else if (startBracket === -1) {
    start = startBrace;
    endChar = '}';
  } else {
    // Use whichever comes first
    if (startBrace < startBracket) {
      start = startBrace;
      endChar = '}';
    } else {
      start = startBracket;
      endChar = ']';
    }
  }

  // Find the matching closing brace/bracket
  let depth = 0;
  let inString = false;
  let end = -1;

  for (let i = start; i < input.length; i++) {
    const char = input[i];

    // Handle escape sequences in strings
    if (char === '\\' && inString) {
      i++; // Skip next character
      continue;
    }

    // Track string boundaries
    if (char === '"') {
      inString = !inString;
      continue;
    }

    if (inString) continue;

    // Track depth
    if (char === '{' || char === '[') {
      depth++;
    } else if (char === '}' || char === ']') {
      depth--;
      if (depth === 0) {
        end = i;
        break;
      }
    }
  }

  if (end === -1) {
    return null;
  }

  return input.slice(start, end + 1);
}

/**
 * Parse JSON with automatic repair attempts
 */
export function parseJSONSafely<T = unknown>(input: string): { success: true; data: T } | { success: false; error: string } {
  // First, try to extract JSON from the input
  const extracted = extractJSON(input);
  if (!extracted) {
    return { success: false, error: 'No JSON object found in input' };
  }

  // Try parsing as-is first
  try {
    const data = JSON.parse(extracted) as T;
    return { success: true, data };
  } catch {
    // Continue to repair
  }

  // Try with repairs
  try {
    const repaired = repairJSON(extracted);
    const data = JSON.parse(repaired) as T;
    return { success: true, data };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Unknown parse error';
    return { success: false, error: `JSON repair failed: ${errorMessage}` };
  }
}
