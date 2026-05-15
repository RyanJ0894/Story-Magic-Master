/**
 * Script Context Extraction — heuristic genre/tone/era detection.
 *
 * Samples the script text for keyword signals. No LLM call — deterministic
 * and fast (~1ms). Used to bias AudioDirectorAgent music/SFX selections.
 */

export interface ScriptContext {
  genre: string;
  tone: string;
  era: string;
}

/**
 * Derive genre, tone, and era from a screenplay using keyword heuristics.
 * Samples the first 3000 chars + a mid-script window for coverage.
 */
export function extractScriptContext(scriptText: string): ScriptContext {
  const midStart = Math.floor(scriptText.length / 2);
  const sample = scriptText.slice(0, 3000) + scriptText.slice(midStart, midStart + 1500);
  const lower = sample.toLowerCase();

  // Genre — first match wins (ordered most-specific to most-general)
  let genre = 'drama';
  if (/murder|detective|crime\b|heist|suspect|forensic|noir|criminal|homicide/.test(lower)) {
    genre = 'crime/thriller';
  } else if (/horror|haunted|ghost|demon|monster|terrif|nightmare|supernatural/.test(lower)) {
    genre = 'horror';
  } else if (/spacecraft|alien\b|android|cyborg|galaxy|laser|robot|mars\b|futuristic|dystopia/.test(lower)) {
    genre = 'sci-fi';
  } else if (/cowboy|saloon|sheriff|outlaw|frontier|gold rush|wild west/.test(lower)) {
    genre = 'western';
  } else if (/knight|castle|dragon|wizard|magic\b|kingdom|medieval|sword/.test(lower)) {
    genre = 'fantasy';
  } else if (/falling in love|first date|i love you|romantic|heartbreak|soulmate/.test(lower)) {
    genre = 'romance';
  } else if (/hilarious|comedy|joke\b|funny|laughing|ridiculous|absurd/.test(lower)) {
    genre = 'comedy';
  } else if (/\bbattle\b|soldier|army|military|combat|war\b|bomb|explosion/.test(lower)) {
    genre = 'action/war';
  }

  // Tone — derived from genre + override signals
  const toneMap: Record<string, string> = {
    'crime/thriller': 'dark, tense',
    'horror': 'atmospheric, frightening',
    'sci-fi': 'futuristic, cerebral',
    'western': 'rugged, expansive',
    'fantasy': 'epic, mystical',
    'romance': 'warm, emotional',
    'comedy': 'light, humorous',
    'action/war': 'intense, visceral',
    'drama': 'dramatic',
  };
  const tone = toneMap[genre] ?? 'dramatic';

  // Era — year ranges and era-specific keywords
  let era = 'contemporary';
  if (/\b(18\d{2}|190\d|191\d)\b/.test(sample)) {
    era = 'historical (1800s–1910s)';
  } else if (/\b(192\d|193\d|194\d)\b/.test(sample)) {
    era = 'early 20th century (1920s–40s)';
  } else if (/\b(195\d|196\d|197\d)\b/.test(sample)) {
    era = 'mid-20th century (1950s–70s)';
  } else if (/\b(198\d|199\d)\b/.test(sample)) {
    era = '1980s–1990s';
  } else if (/medieval|castle|knight|sword\b|horse-drawn|peasant|tavern/.test(lower)) {
    era = 'medieval';
  } else if (/year 20[3-9]\d|post-apocalyptic|after the war|century from now/.test(lower)) {
    era = 'near future';
  }

  return { genre, tone, era };
}

/**
 * Format ScriptContext as a brief block to prepend to the AudioDirectorAgent user message.
 */
export function formatScriptContext(context: ScriptContext): string {
  return (
    `[SCRIPT CONTEXT — use this to guide audio selection]\n` +
    `Genre: ${context.genre}\n` +
    `Tone: ${context.tone}\n` +
    `Era: ${context.era}\n\n`
  );
}
