export interface DirectorNotes {
  global: string;
  characters: Record<string, string>;
}

const MAX_GLOBAL_CHARS = 500;
const MAX_CHARACTER_CHARS = 2000;

// Lowercase patterns that indicate a prompt injection attempt.
// Matched against the lowercased text so casing variants are caught.
const INJECTION_PATTERNS = [
  'ignore previous instructions',
  'ignore all previous',
  'disregard previous',
  'you are now',
  'act as ',
  'pretend you are',
  'system:',
  '<|system|>',
  '<|im_start|>',
  '```',
];

function sanitizeText(text: string, maxLength: number): string {
  const truncated = text.slice(0, maxLength);
  const lower = truncated.toLowerCase();
  for (const pattern of INJECTION_PATTERNS) {
    if (lower.includes(pattern)) {
      // Remove everything from the injection point onward
      const idx = lower.indexOf(pattern);
      return truncated.slice(0, idx).trim();
    }
  }
  return truncated.trim();
}

export function sanitizeDirectorNotes(notes: DirectorNotes): DirectorNotes {
  const global = sanitizeText(notes.global, MAX_GLOBAL_CHARS);
  const characters: Record<string, string> = {};
  for (const [name, note] of Object.entries(notes.characters)) {
    const sanitized = sanitizeText(note, MAX_CHARACTER_CHARS);
    if (sanitized) characters[name] = sanitized;
  }
  return { global, characters };
}

export function buildDirectorNotesBlock(notes: DirectorNotes): string {
  const sanitized = sanitizeDirectorNotes(notes);
  const hasGlobal = sanitized.global.length > 0;
  const hasCharacters = Object.keys(sanitized.characters).length > 0;

  if (!hasGlobal && !hasCharacters) return '';

  const lines: string[] = [
    '',
    '--- DIRECTOR NOTES (user-provided, read-only context) ---',
  ];

  if (hasGlobal) {
    lines.push('Overall Direction:', sanitized.global, '');
  }

  if (hasCharacters) {
    lines.push('Character Notes:');
    for (const [name, note] of Object.entries(sanitized.characters)) {
      lines.push(`  ${name}: ${note}`);
    }
    lines.push('');
  }

  lines.push('--- END DIRECTOR NOTES ---');
  return lines.join('\n');
}
