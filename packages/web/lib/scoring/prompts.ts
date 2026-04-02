/**
 * LLM Prompts for StoryScore
 *
 * Comprehensive prompts for evaluating screenplays across 12 dimensions.
 * Based on industry script coverage standards and best practices.
 */

import { DIMENSIONS, DimensionKey } from './types';

// =============================================================================
// Scoring Criteria
// =============================================================================

export const SCORING_CRITERIA: Record<DimensionKey, string> = {
  premiseOriginality: `
SCORING CRITERIA (1-10):
10 - Groundbreaking concept never seen before, genre-defining potential
9 - Fresh take that feels inevitable yet surprising
8 - Familiar territory with genuinely unique hook
7 - Good concept with some original elements
6 - Solid but not particularly distinctive
5 - Execution-dependent, premise alone won't sell
4 - Derivative of recent popular films
3 - Been done many times before
2 - Direct copy with minimal changes
1 - Complete retread, no original elements

EVALUATION QUESTIONS:
- What makes this story different from everything else in its genre?
- Can you pitch it as "[Movie A] meets [Movie B]" in a compelling way?
- Would a studio exec say "I've never seen this before"?
- Does the concept have a clear hook that grabs attention?`,

  loglineClarity: `
SCORING CRITERIA (1-10):
10 - Instantly gripping, tells you everything and nothing, perfect pitch
9 - Crystal clear concept that sells itself
8 - Strong hook with clear protagonist and stakes
7 - Good clarity but could be tighter
6 - Understandable but not compelling
5 - Requires explanation beyond one sentence
4 - Confusing or too generic
3 - Unclear who protagonist is or what they want
2 - Multiple competing concepts muddy the waters
1 - Cannot be summarized coherently

EVALUATION QUESTIONS:
- Can someone immediately understand WHO the protagonist is?
- Is it clear WHAT they want?
- Do we know WHAT stands in their way?
- Are the stakes clear - WHAT happens if they fail?`,

  commercialViability: `
SCORING CRITERIA (1-10):
10 - Four-quadrant hit potential, clear marketing angle, franchise potential
9 - Strong theatrical potential with defined audience
8 - Solid studio/streamer fit with marketable elements
7 - Identifiable audience with some marketing challenges
6 - Niche but viable market
5 - Limited commercial appeal
4 - Difficult to market to mainstream audience
3 - Very narrow audience appeal
2 - Unmarketable in current form
1 - No clear commercial path

EVALUATION QUESTIONS:
- What's the target audience? How large is it?
- What comparable films succeeded recently?
- Is this appropriate for the likely budget tier?
- Does it have international appeal?
- Is there franchise/IP potential?`,

  threeActIntegrity: `
SCORING CRITERIA (1-10):
10 - Perfect structure, every beat lands, nothing wasted
9 - Excellent structure with perhaps one minor soft spot
8 - Strong acts with clear turning points
7 - Good structure, some beats could be stronger
6 - Basic three-act present but execution uneven
5 - Structure exists but midpoint is weak
4 - Act breaks unclear or poorly placed
3 - Second act sags significantly
2 - Major structural problems throughout
1 - No discernible structure

SAVE THE CAT BEATS TO CHECK:
- Opening Image establishes tone (p.1)
- Catalyst occurs by page 12
- Break into Two by page 25
- Midpoint at 50% (false victory/defeat)
- All Is Lost at 75% (whiff of death)
- Break into Three by page 85
- Final Image mirrors/contrasts opening`,

  pacingMomentum: `
SCORING CRITERIA (1-10):
10 - Unputdownable, perfect scene economy, relentless engagement
9 - Relentless momentum with earned breathing room
8 - Strong pace with only minor drag
7 - Good pace overall, some scenes run long
6 - Uneven pacing throughout
5 - Noticeable lulls in engagement
4 - Significant pacing problems
3 - Reader engagement lost repeatedly
2 - Major sections feel unnecessary
1 - Pacing destroys any engagement

RED FLAGS TO CHECK:
- Scenes over 3 pages without strong justification
- Consecutive dialogue-heavy scenes
- "Homework scenes" (pure exposition dumps)
- Repeated information the audience already knows
- Slow opening (does story start late?)`,

  stakesEscalation: `
SCORING CRITERIA (1-10):
10 - Life-or-death stakes (literal or emotional) with constant raising
9 - Deeply felt stakes that escalate beautifully
8 - Strong stakes with clear escalation pattern
7 - Good stakes but escalation is uneven
6 - Stakes present but could be higher
5 - Generic stakes ("save the world," "get the girl")
4 - Stakes unclear or too abstract
3 - Low stakes - not much to lose
2 - No meaningful consequences visible
1 - Why should we care?

EVALUATION QUESTIONS:
- What does the protagonist stand to lose?
- Is it personal (not just global)?
- Do stakes increase at midpoint? At Act 3?
- Is there a ticking clock?
- Are there real consequences shown (not just threatened)?`,

  protagonistArc: `
SCORING CRITERIA (1-10):
10 - Transformative journey, deeply moving, universal resonance
9 - Compelling arc with clear internal/external goals
8 - Strong arc with meaningful, earned change
7 - Good arc, change feels earned
6 - Arc present but predictable
5 - Change happens but feels unearned
4 - Minimal character growth visible
3 - Protagonist is reactive, not active
2 - No discernible arc
1 - Protagonist is not the main character of their own story

ARC COMPONENTS TO CHECK:
- WANT (external goal) - What do they pursue?
- NEED (internal truth) - What must they learn?
- GHOST/WOUND - What shaped them?
- LIE - What false belief do they hold?
- TRUTH - What do they learn by the end?`,

  supportingCast: `
SCORING CRITERIA (1-10):
10 - Every character memorable, necessary, and dimensional
9 - Excellent ensemble where each character serves the story
8 - Strong supporting characters with real depth
7 - Good characters, some underdeveloped
6 - Functional but not particularly memorable
5 - Some characters feel like plot devices
4 - Antagonist weak or motivation unclear
3 - Supporting cast largely interchangeable
2 - Characters serve convenience over story
1 - No supporting characters matter

ANTAGONIST CHECK:
- Does antagonist believe they're the hero of their own story?
- Is their motivation specific and personal (not generic evil)?
- Do they directly challenge the protagonist's flaw?`,

  castability: `
SCORING CRITERIA (1-10):
10 - Multiple star-making roles, dream casting obvious
9 - Lead role every A-lister wants, great supporting parts
8 - Strong lead with good meaty scenes for cast
7 - Castable lead, supporting roles less defined
6 - Solid role but not particularly distinctive
5 - Generic lead anyone could play
4 - Limited appeal to name actors
3 - Difficult to cast attractively
2 - No memorable moments for actors to sink into
1 - Actors would pass on reading

WHAT ACTORS LOOK FOR:
- "I've never played this before"
- At least one bravura scene (Oscar clip potential)
- Emotional range opportunity
- Physical transformation potential
- Quotable dialogue`,

  dialogueQuality: `
SCORING CRITERIA (1-10):
10 - Quotable, distinctive, every line sings with subtext
9 - Excellent character voices with rich subtext throughout
8 - Strong dialogue with memorable exchanges
7 - Good dialogue, some on-the-nose moments
6 - Functional dialogue, lacks distinction
5 - Serviceable but forgettable
4 - Characters sound too similar
3 - On-the-nose, no subtext
2 - Exposition dumps disguised as dialogue
1 - Unnatural, stilted speech throughout

DIALOGUE TESTS:
- COVER TEST: Remove character names - can you tell who's speaking?
- MAMET TEST: Does every line pursue a want?
- SUBTEXT TEST: Is meaning conveyed through what's NOT said?
- "Nobody says anything unless they want something" - David Mamet`,

  visualStorytelling: `
SCORING CRITERIA (1-10):
10 - Pure cinema, could work as a silent film
9 - Excellent visual set pieces, shows not tells throughout
8 - Strong visual moments, good action writing
7 - Good visual sense, some telling over showing
6 - Adequate visual description
5 - Over-reliance on dialogue for exposition
4 - Too many "talking heads" scenes
3 - Uncinematic staging
2 - Radio play with visuals
1 - No visual imagination demonstrated

VISUAL ELEMENTS TO CHECK:
- Action lines that create pictures
- Environmental storytelling
- Character revealed through behavior, not dialogue
- Setpiece sequences (memorable visual moments)
- "Show, don't tell" execution`,

  technicalExecution: `
SCORING CRITERIA (1-10):
10 - Flawless professional presentation
9 - Excellent formatting, clear and confident writing
8 - Strong technical execution
7 - Good formatting with minor issues
6 - Acceptable with some problems
5 - Noticeable formatting issues
4 - Distracting technical problems
3 - Amateur formatting throughout
2 - Difficult to read
1 - Does not follow industry standards

TECHNICAL CHECKLIST:
- Proper screenplay format (INT./EXT., sluglines, etc.)
- Page count appropriate for genre (90-120 pages typical)
- Scene headings consistent
- Action blocks under 4 lines
- Minimal camera directions
- Clean, professional appearance`,
};

// =============================================================================
// Calibration Examples (few-shot anchors loaded from DB)
// =============================================================================

/**
 * Build few-shot calibration examples from the corpus.
 * Loads one Oscar Winner, one Produced Benchmark, and one Weak Film
 * that have been scored, so the model knows what scores like 9, 6, and 3 look like.
 */
export async function buildCalibrationExamples(): Promise<string> {
  try {
    // Dynamic import to avoid circular deps in non-Node environments
    const { prisma } = await import('@/lib/db');

    const [highAnchor, midAnchor, lowAnchor] = await Promise.all([
      prisma.corpusScore.findFirst({
        where: { corpusScript: { datasetCategory: 'Oscar Winner' } },
        orderBy: { overallScore: 'desc' },
        include: { corpusScript: { select: { title: true, datasetCategory: true } } },
      }),
      prisma.corpusScore.findFirst({
        where: { corpusScript: { datasetCategory: 'Produced Benchmark' } },
        orderBy: { overallScore: 'asc' },
        include: { corpusScript: { select: { title: true, datasetCategory: true } } },
      }),
      prisma.corpusScore.findFirst({
        where: { corpusScript: { datasetCategory: 'Weak Film' } },
        orderBy: { overallScore: 'asc' },
        include: { corpusScript: { select: { title: true, datasetCategory: true } } },
      }),
    ]);

    if (!highAnchor && !midAnchor && !lowAnchor) return '';

    const lines: string[] = ['## CALIBRATION EXAMPLES', '', 'Use these scored examples to calibrate your scoring range:', ''];

    const formatAnchor = (label: string, anchor: NonNullable<typeof highAnchor>): string => {
      const dims = anchor.dimensions as Record<string, { score: number; reasoning: string }>;
      const sampleDims = ['premiseOriginality', 'threeActIntegrity', 'dialogueQuality']
        .filter(k => dims[k])
        .map(k => `  - ${k}: ${dims[k].score}/10`)
        .join('\n');
      return `### ${label}: "${anchor.corpusScript.title}" (Overall: ${Number(anchor.overallScore).toFixed(1)}/10)\n${sampleDims}`;
    };

    if (highAnchor) lines.push(formatAnchor('HIGH ANCHOR (Oscar Winner)', highAnchor), '');
    if (midAnchor) lines.push(formatAnchor('MID ANCHOR (Produced Benchmark)', midAnchor), '');
    if (lowAnchor) lines.push(formatAnchor('LOW ANCHOR (Weak Film)', lowAnchor), '');

    return lines.join('\n');
  } catch {
    // If DB unavailable (e.g. build time), return empty — graceful degradation
    return '';
  }
}

// =============================================================================
// Main Scoring Prompt
// =============================================================================

export function buildScoringPrompt(
  scriptText: string,
  title?: string,
  genre?: string,
  logline?: string,
  calibrationExamples?: string
): string {
  const dimensionList = Object.entries(DIMENSIONS)
    .map(([key, dim]) => `${dim.label} (${dim.category}, ${dim.weight}% weight)`)
    .join('\n');

  return `You are an expert Hollywood script reader and development executive with 20+ years of experience evaluating screenplays for major studios. You have read thousands of scripts and can quickly identify what makes a screenplay work or fail commercially and artistically.

## YOUR TASK

Evaluate the following screenplay across 12 dimensions of craft and commercial viability. For each dimension, provide:
1. A score from 1-10 (use the full range - don't cluster around 6-7)
2. Specific reasoning citing examples from the script (2-3 sentences)

## SCRIPT INFORMATION

${title ? `**Title:** ${title}` : '**Title:** Unknown'}
${genre ? `**Genre:** ${genre}` : ''}
${logline ? `**Logline:** ${logline}` : ''}

## THE 12 DIMENSIONS

${dimensionList}

## DETAILED SCORING CRITERIA

${Object.entries(SCORING_CRITERIA).map(([key, criteria]) => {
  const dim = DIMENSIONS[key as DimensionKey];
  return `### ${dim.label}\n${criteria}`;
}).join('\n\n')}

${calibrationExamples ? calibrationExamples + '\n' : ''}

## SCREENPLAY TEXT

\`\`\`
${scriptText}
\`\`\`

## RESPONSE FORMAT

Respond with a valid JSON object in this exact format:

\`\`\`json
{
  "dimensions": {
    "premiseOriginality": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "loglineClarity": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "commercialViability": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "threeActIntegrity": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "pacingMomentum": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "stakesEscalation": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "protagonistArc": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "supportingCast": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "castability": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "dialogueQuality": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "visualStorytelling": { "score": <1-10>, "reasoning": "<specific reasoning>" },
    "technicalExecution": { "score": <1-10>, "reasoning": "<specific reasoning>" }
  },
  "strengths": [
    "<strength 1 - be specific>",
    "<strength 2>",
    "<strength 3>"
  ],
  "weaknesses": [
    "<weakness 1 - be specific and actionable>",
    "<weakness 2>",
    "<weakness 3>"
  ],
  "confidence": <0.0-1.0>
}
\`\`\`

## IMPORTANT GUIDELINES

1. **Use the full scoring range** - A 10 is rare but possible. A 3 is harsh but warranted for serious issues. Don't cluster everything around 6-7.

2. **Be specific in reasoning** - Reference actual scenes, characters, dialogue, or page ranges when possible. Don't be generic.

3. **Be honest but constructive** - If something doesn't work, explain why and what would fix it. The goal is to help the writer improve.

4. **Consider commercial AND artistic merit** - A beautifully written script that's unmarketable still has issues. A commercial script with poor craft also has issues.

5. **Strengths and weaknesses should be actionable** - "Great dialogue" is too vague. "Sarah's sarcastic wit creates memorable exchanges, especially in the diner scene" is specific.

6. **Confidence reflects certainty** - If the script is clear and complete, confidence should be high (0.8+). If it's a fragment or unclear, confidence should be lower.

Respond ONLY with the JSON object. No additional text before or after.`;
}

// =============================================================================
// Validation
// =============================================================================

export function validateLLMResponse(response: unknown): response is {
  dimensions: Record<string, { score: number; reasoning: string }>;
  strengths: string[];
  weaknesses: string[];
  confidence: number;
} {
  if (typeof response !== 'object' || response === null) return false;

  const obj = response as Record<string, unknown>;

  // Check dimensions
  if (typeof obj.dimensions !== 'object' || obj.dimensions === null) return false;
  const dims = obj.dimensions as Record<string, unknown>;

  for (const key of Object.keys(DIMENSIONS)) {
    const dim = dims[key] as Record<string, unknown> | undefined;
    if (!dim) return false;
    if (typeof dim.score !== 'number' || dim.score < 1 || dim.score > 10) return false;
    if (typeof dim.reasoning !== 'string') return false;
  }

  // Check arrays
  if (!Array.isArray(obj.strengths) || !Array.isArray(obj.weaknesses)) return false;

  // Check confidence
  if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return false;

  return true;
}
