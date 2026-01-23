/**
 * Story-Adviser LLM Prompts
 *
 * Prompts for generating actionable screenplay suggestions.
 * Designed to work with or without StoryScore context.
 */

import { DimensionKey, DIMENSIONS, StoryScore } from '@/lib/scoring/types';
import { SUGGESTION_CATEGORIES, SuggestionCategory, LLMSuggestionsResponse } from './types';

// =============================================================================
// Category-Specific Guidance
// =============================================================================

const CATEGORY_PROMPTS: Record<SuggestionCategory, string> = {
  premise: `PREMISE ORIGINALITY issues to look for:
- Concepts that feel derivative of recent films
- Missing unique hook or fresh angle
- Premise that doesn't differentiate from similar stories
- Missed opportunities for originality`,

  clarity: `LOGLINE CLARITY issues to look for:
- Unclear protagonist goal in Act 1
- Competing storylines that muddy the focus
- Missing or buried story engine
- Audience confusion about what the movie is about`,

  commercial: `COMMERCIAL VIABILITY issues to look for:
- Unclear target audience
- Unmarketable or niche concepts
- Missing four-quadrant appeal elements
- Budget mismatched to commercial potential`,

  structure: `THREE-ACT INTEGRITY issues to look for:
- Missing or weak catalyst (should be by page 12)
- Unclear Break into Two (should be ~page 25)
- Weak or missing midpoint (false victory/defeat)
- All Is Lost moment not landing (~75%)
- Unsatisfying resolution`,

  pacing: `PACING & MOMENTUM issues to look for:
- Scenes that run too long (>3 pages without strong justification)
- Consecutive dialogue-heavy scenes
- "Homework scenes" (pure exposition dumps)
- Story starting too late
- Sagging second act`,

  stakes: `STAKES & ESCALATION issues to look for:
- Stakes that plateau rather than escalate
- Generic stakes ("save the world" without personal cost)
- Missing ticking clock
- Consequences that are threatened but never shown
- No sense of what protagonist stands to lose`,

  protagonist: `PROTAGONIST ARC issues to look for:
- Reactive rather than active protagonist
- Missing or unclear internal need (vs external want)
- Ghost/wound not established
- Transformation that feels unearned
- Character who doesn't drive the plot`,

  supporting: `SUPPORTING CAST issues to look for:
- Antagonist with unclear or generic motivation
- Supporting characters who are interchangeable
- Characters who exist only as plot devices
- Missing character relationships that challenge protagonist`,

  castability: `CASTABILITY issues to look for:
- Generic lead role (anyone could play it)
- Missing "Oscar clip" moment for actors
- No memorable scenes for supporting cast
- Roles that lack emotional range opportunity`,

  dialogue: `DIALOGUE QUALITY issues to look for:
- On-the-nose dialogue (characters say exactly what they feel)
- Missing subtext
- Characters who all sound the same (fail cover test)
- Exposition dumps disguised as dialogue
- Dialogue that doesn't pursue a want`,

  visual: `VISUAL STORYTELLING issues to look for:
- Over-reliance on dialogue for exposition
- "Talking heads" scenes
- Missing environmental storytelling
- Character revealed through dialogue instead of behavior
- No memorable visual setpieces`,

  technical: `TECHNICAL EXECUTION issues to look for:
- Action blocks over 4 lines
- Excessive camera directions
- Inconsistent scene headings
- Improper formatting
- Unclear slug lines`,
};

// =============================================================================
// Main Suggestion Prompt
// =============================================================================

/**
 * Build the suggestion generation prompt.
 *
 * @param scriptText - The full script text with line numbers
 * @param storyScore - Optional StoryScore to focus on weak areas
 * @param maxSuggestions - Maximum suggestions to generate
 * @param focusCategories - Optional categories to focus on
 */
export function buildSuggestionPrompt(
  scriptText: string,
  storyScore?: StoryScore | null,
  maxSuggestions: number = 15,
  focusCategories?: SuggestionCategory[]
): string {
  // Determine which categories to focus on
  let prioritizedCategories: SuggestionCategory[] = [];

  if (storyScore) {
    // Sort dimensions by score (lowest first) to focus on weak areas
    const sortedDimensions = (Object.keys(DIMENSIONS) as DimensionKey[])
      .map((key) => ({
        key,
        score: storyScore.dimensions[key].score,
        category: Object.entries(SUGGESTION_CATEGORIES).find(
          ([, config]) => config.dimension === key
        )?.[0] as SuggestionCategory,
      }))
      .sort((a, b) => a.score - b.score);

    // Take the 6 weakest dimensions
    prioritizedCategories = sortedDimensions
      .slice(0, 6)
      .map((d) => d.category)
      .filter((c): c is SuggestionCategory => c !== undefined);
  }

  // Override with explicit focus categories if provided
  if (focusCategories && focusCategories.length > 0) {
    prioritizedCategories = focusCategories;
  }

  // Build category guidance
  let categoryGuidance = '';
  if (prioritizedCategories.length > 0) {
    categoryGuidance = `
## PRIORITY AREAS (Focus most suggestions here)

${prioritizedCategories
  .map((cat) => CATEGORY_PROMPTS[cat])
  .join('\n\n')}

## OTHER AREAS (Include if significant issues found)

${Object.entries(CATEGORY_PROMPTS)
  .filter(([key]) => !prioritizedCategories.includes(key as SuggestionCategory))
  .map(([, prompt]) => prompt)
  .join('\n\n')}`;
  } else {
    categoryGuidance = `
## AREAS TO ANALYZE

${Object.values(CATEGORY_PROMPTS).join('\n\n')}`;
  }

  // Build StoryScore context if available
  let scoreContext = '';
  if (storyScore) {
    scoreContext = `
## STORYSCORE CONTEXT

This script was recently evaluated. Focus suggestions on the weakest areas:

| Dimension | Score | Key Issue |
|-----------|-------|-----------|
${(Object.keys(DIMENSIONS) as DimensionKey[])
  .map((key) => {
    const dim = DIMENSIONS[key];
    const score = storyScore.dimensions[key];
    return `| ${dim.label} | ${score.score}/10 | ${score.reasoning.slice(0, 60)}... |`;
  })
  .join('\n')}

**Overall Score:** ${storyScore.overallScore}/10 (${storyScore.rating})

**Identified Weaknesses:**
${storyScore.weaknesses.map((w) => `- ${w}`).join('\n')}
`;
  }

  return `You are an expert script consultant providing specific, actionable suggestions to improve a screenplay. Your feedback should be precise, referencing exact locations in the script.

${scoreContext}

${categoryGuidance}

## SCRIPT TEXT (with line numbers)

\`\`\`
${addLineNumbers(scriptText)}
\`\`\`

## YOUR TASK

Generate up to ${maxSuggestions} specific, actionable suggestions to improve this screenplay.

For each suggestion:
1. **Be specific** - Reference exact lines and quote the problematic text
2. **Be actionable** - Tell the writer exactly what to do
3. **Explain why** - Connect to craft principles and reader experience
4. **Prioritize impact** - Focus on issues that most affect story success

## SEVERITY GUIDELINES

- **critical**: Fundamental issues that may cause a reader to stop or pass (e.g., confusing protagonist goal, broken story logic, major pacing problems)
- **important**: Significant issues that affect story quality (e.g., flat dialogue, weak midpoint, unclear stakes)
- **minor**: Polish opportunities (e.g., long action blocks, word choice, formatting)

## RESPONSE FORMAT

Respond with valid JSON in this exact format:

\`\`\`json
{
  "suggestions": [
    {
      "category": "dialogue",
      "severity": "important",
      "title": "Add subtext to confrontation scene",
      "explanation": "The dialogue between SARAH and MIKE on lines 45-52 is on-the-nose. Sarah says 'I'm angry at you for leaving' - this tells us her emotion directly instead of showing it through behavior and subtext. Readers and audiences engage more when they must interpret meaning.",
      "suggestion": "Have Sarah discuss something mundane (like returning borrowed items) while her anger manifests through actions - slamming drawers, avoiding eye contact, cutting Mike off mid-sentence. Let the subtext carry the emotion.",
      "excerpt": "SARAH\\nI'm angry at you for leaving. You abandoned me when I needed you most.",
      "startLine": 45,
      "endLine": 52,
      "confidence": 0.9
    }
  ]
}
\`\`\`

## IMPORTANT RULES

1. **Line numbers must be accurate** - Double-check that startLine and endLine match the actual script
2. **Excerpt must be exact** - Copy the problematic text exactly as it appears
3. **No generic advice** - Every suggestion must reference specific script content
4. **Balance categories** - Don't only focus on one type of issue
5. **Be constructive** - Frame suggestions positively as improvements, not attacks

Generate exactly the JSON response with no additional text.`;
}

// =============================================================================
// Rewrite Prompt
// =============================================================================

/**
 * Build prompt for generating rewrite options
 */
export function buildRewritePrompt(
  originalText: string,
  suggestionContext: {
    category: SuggestionCategory;
    title: string;
    explanation: string;
    suggestion: string;
  },
  count: number = 3,
  style: 'conservative' | 'moderate' | 'bold' = 'moderate'
): string {
  const styleGuidance = {
    conservative: 'Make minimal changes while addressing the issue. Preserve the original voice and structure as much as possible.',
    moderate: 'Make changes necessary to address the issue effectively. Balance preservation with improvement.',
    bold: 'Reimagine this section to best serve the story. Don\'t be constrained by the original approach.',
  };

  return `You are an expert screenwriter tasked with rewriting a section of a screenplay.

## ORIGINAL TEXT

\`\`\`
${originalText}
\`\`\`

## ISSUE IDENTIFIED

**Category:** ${SUGGESTION_CATEGORIES[suggestionContext.category].label}
**Problem:** ${suggestionContext.title}
**Explanation:** ${suggestionContext.explanation}
**Guidance:** ${suggestionContext.suggestion}

## YOUR TASK

Generate ${count} different rewrite options. ${styleGuidance[style]}

Each rewrite should:
1. Address the identified issue
2. Maintain proper screenplay format
3. Preserve character voice (unless that's the problem)
4. Be approximately the same length (unless pacing is the issue)

## RESPONSE FORMAT

\`\`\`json
{
  "rewrites": [
    {
      "rewrittenText": "[The rewritten screenplay text]",
      "explanation": "[Brief explanation of what changed and why it improves the script]"
    }
  ]
}
\`\`\`

Generate exactly ${count} rewrite options as JSON with no additional text.`;
}

// =============================================================================
// Validation
// =============================================================================

/**
 * Validate LLM suggestion response
 */
export function validateSuggestionsResponse(
  response: unknown
): response is LLMSuggestionsResponse {
  if (typeof response !== 'object' || response === null) return false;

  const obj = response as Record<string, unknown>;
  if (!Array.isArray(obj.suggestions)) return false;

  for (const suggestion of obj.suggestions) {
    if (typeof suggestion !== 'object' || suggestion === null) return false;

    const s = suggestion as Record<string, unknown>;

    // Required string fields
    if (typeof s.category !== 'string') return false;
    if (typeof s.severity !== 'string') return false;
    if (typeof s.title !== 'string') return false;
    if (typeof s.explanation !== 'string') return false;
    if (typeof s.suggestion !== 'string') return false;
    if (typeof s.excerpt !== 'string') return false;

    // Required number fields
    if (typeof s.startLine !== 'number') return false;
    if (typeof s.endLine !== 'number') return false;
    if (typeof s.confidence !== 'number') return false;

    // Validate category
    if (!Object.keys(SUGGESTION_CATEGORIES).includes(s.category)) return false;

    // Validate severity
    if (!['critical', 'important', 'minor'].includes(s.severity)) return false;

    // Validate confidence range
    if (s.confidence < 0 || s.confidence > 1) return false;
  }

  return true;
}

/**
 * Validate rewrite response
 */
export function validateRewriteResponse(
  response: unknown
): response is { rewrites: Array<{ rewrittenText: string; explanation: string }> } {
  if (typeof response !== 'object' || response === null) return false;

  const obj = response as Record<string, unknown>;
  if (!Array.isArray(obj.rewrites)) return false;

  for (const rewrite of obj.rewrites) {
    if (typeof rewrite !== 'object' || rewrite === null) return false;

    const r = rewrite as Record<string, unknown>;
    if (typeof r.rewrittenText !== 'string') return false;
    if (typeof r.explanation !== 'string') return false;
  }

  return true;
}

// =============================================================================
// Utilities
// =============================================================================

/**
 * Add line numbers to script text for precise referencing
 */
function addLineNumbers(text: string): string {
  const lines = text.split('\n');
  const padLength = String(lines.length).length;

  return lines
    .map((line, i) => {
      const lineNum = String(i + 1).padStart(padLength, ' ');
      return `${lineNum} | ${line}`;
    })
    .join('\n');
}

/**
 * Extract line numbers from script text excerpt
 * (Used to verify LLM-provided line numbers)
 */
export function findExcerptInScript(
  scriptText: string,
  excerpt: string
): { startLine: number; endLine: number } | null {
  const lines = scriptText.split('\n');
  const excerptLines = excerpt.split('\n').map((l) => l.trim());

  // Find the first line of the excerpt
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().includes(excerptLines[0].trim())) {
      // Check if subsequent lines match
      let match = true;
      for (let j = 1; j < excerptLines.length && i + j < lines.length; j++) {
        if (!lines[i + j].trim().includes(excerptLines[j].trim())) {
          match = false;
          break;
        }
      }

      if (match) {
        return {
          startLine: i + 1, // 1-indexed
          endLine: i + excerptLines.length,
        };
      }
    }
  }

  return null;
}
