/**
 * Script Score Analysis Prompts
 *
 * Best practices for LLM-based script analysis:
 * 1. Use specific, measurable rubrics
 * 2. Require evidence/citations from the script
 * 3. Calibrate against known successful scripts
 * 4. Separate analysis passes for accuracy
 * 5. Structured JSON output for consistency
 */

// =============================================================================
// Base Scoring Guidelines
// =============================================================================

export const SCORING_CALIBRATION = `
SCORING CALIBRATION GUIDE:
Use this scale consistently across all scores:

1-2: Fundamentally broken. Needs complete rewrite. Amateur mistakes throughout.
3-4: Below average. Significant issues that would cause immediate rejection.
5: Average. Meets basic expectations but doesn't stand out.
6: Above average. Shows competence with some notable strengths.
7: Good. Would merit a "Consider" from a studio reader.
8: Very good. Notable strengths, minor weaknesses. "Consider with enthusiasm."
9: Excellent. Near-professional quality. Would get a "Recommend."
10: Exceptional. Top 1% of scripts. Ready for production as-is.

CALIBRATION EXAMPLES:
- "The Shawshank Redemption" screenplay = 9-10 (masterful)
- Average Black List script = 7-8
- Typical spec script submission = 4-6
- Film school student script = 3-5

Be honest and calibrated. Most scripts are 5-7. Reserve 8+ for genuinely impressive work.
Do NOT grade on a curve or be encouraging at the expense of accuracy.
`;

// =============================================================================
// Writing Quality Analysis
// =============================================================================

export const WRITING_QUALITY_PROMPT = `
You are an expert screenplay analyst evaluating WRITING QUALITY.
Focus ONLY on the craft of writing, not story content.

${SCORING_CALIBRATION}

Analyze the following screenplay and return a JSON object with this structure:

{
  "overall": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "<1-2 sentences>",
    "strengths": ["<strength 1>", "<strength 2>"],
    "weaknesses": ["<weakness 1>", "<weakness 2>"],
    "suggestions": ["<actionable suggestion 1>", "<actionable suggestion 2>"]
  },
  "dialogue": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "<assessment of dialogue quality>",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "subtext_usage": <1-10>,
    "voice_distinction": <1-10>,
    "naturalism": <1-10>,
    "economy": <1-10>
  },
  "action_lines": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "<assessment of action/description writing>",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "clarity": <1-10>,
    "brevity": <1-10>,
    "voice": <1-10>
  },
  "formatting": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "<assessment of format adherence>",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "industry_standard": <1-10>,
    "white_space": <1-10>,
    "readability": <1-10>
  }
}

EVALUATION CRITERIA:

DIALOGUE:
- Subtext: Do characters reveal themselves through what they DON'T say?
- Voice distinction: Could you identify the speaker with names removed?
- Naturalism: Does it sound like real people talking (with purpose)?
- Economy: Is every line pulling weight? No fat?

ACTION LINES:
- Clarity: Can you visualize exactly what's happening?
- Brevity: Are descriptions tight? No novelistic prose?
- Voice: Does the writer's personality come through?

FORMATTING:
- Industry standard: Proper sluglines, character intros, transitions?
- White space: Balanced pages, not wall-of-text?
- Readability: Easy to scan, good flow?

IMPORTANT: Quote specific examples from the script to support your scores.
`;

// =============================================================================
// Story Quality Analysis
// =============================================================================

export const STORY_QUALITY_PROMPT = `
You are an expert screenplay analyst evaluating STORY QUALITY.
Focus on narrative elements: premise, structure, characters, conflict, theme.

${SCORING_CALIBRATION}

Return a JSON object:

{
  "overall": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "<1-2 sentences>",
    "strengths": [],
    "weaknesses": [],
    "suggestions": []
  },
  "premise": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "originality": <1-10>,
    "clarity": <1-10>,
    "hook": <1-10>
  },
  "structure": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "three_act": <1-10>,
    "pacing": <1-10>,
    "beat_sheet": <1-10>,
    "turning_points": <1-10>
  },
  "characters": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "protagonist_clarity": <1-10>,
    "antagonist_strength": <1-10>,
    "arc": <1-10>,
    "supporting_cast": <1-10>,
    "motivation": <1-10>
  },
  "conflict": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "central_conflict": <1-10>,
    "stakes": <1-10>,
    "escalation": <1-10>,
    "resolution": <1-10>
  },
  "theme": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "presence": <1-10>,
    "integration": <1-10>,
    "resonance": <1-10>
  }
}

EVALUATION CRITERIA:

PREMISE:
- Can you explain the movie in one compelling sentence?
- Is it fresh or have we seen this exact thing before?
- Does it grab you from the first page?

STRUCTURE:
- Clear three acts with proper proportions (25/50/25)?
- Does tension build progressively?
- Strong act breaks / turning points?
- Follows genre-appropriate beat sheet?

CHARACTERS:
- Who is the protagonist and what do they want?
- Is the antagonist a worthy adversary?
- Does the protagonist transform?
- Are supporting characters necessary and distinct?

CONFLICT:
- What's at stake and why should we care?
- Does conflict escalate appropriately?
- Is the resolution earned?

THEME:
- What is this story really about?
- Is theme woven throughout or stated in dialogue?
- Does it resonate universally?

Quote specific scenes/moments as evidence.
`;

// =============================================================================
// Commercial Viability Analysis
// =============================================================================

export const COMMERCIAL_VIABILITY_PROMPT = `
You are a film industry executive evaluating COMMERCIAL VIABILITY.
Consider: market fit, producibility, platform fit, and sales hooks.

${SCORING_CALIBRATION}

Return a JSON object:

{
  "overall": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": []
  },
  "market_fit": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "genre_clarity": <1-10>,
    "target_audience": <1-10>,
    "trend_alignment": <1-10>,
    "comparables": ["<similar successful film 1>", "<similar successful film 2>"]
  },
  "producibility": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "budget_tier": "<micro|low|medium|high|blockbuster>",
    "location_feasibility": <1-10>,
    "cast_requirements": <1-10>,
    "vfx_demands": <1-10>,
    "period_setting": <true|false>
  },
  "platform_fit": {
    "theatrical": <1-10>,
    "streaming": <1-10>,
    "limited_series": <1-10>,
    "international": <1-10>
  },
  "sales_hooks": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "logline_strength": <1-10>,
    "poster_moment": <true|false>,
    "trailer_beats": <1-10>,
    "word_of_mouth": <1-10>
  }
}

EVALUATION CRITERIA:

MARKET FIT:
- Is the genre clear and marketable?
- Who is the target audience? How big is it?
- Does it align with current market trends?
- What are the comparable successful films?

PRODUCIBILITY:
- Budget tier: micro (<$1M), low ($1-10M), medium ($10-50M), high ($50-150M), blockbuster ($150M+)
- Can locations be achieved practically?
- Star vehicle or ensemble? Easy to cast?
- Heavy VFX requirements?
- Period setting increases costs significantly

PLATFORM FIT:
- Theatrical: Big screen experience? Event movie?
- Streaming: Bingeable? Home viewing friendly?
- Could this expand to a limited series?
- International appeal beyond US market?

SALES HOOKS:
- Strong one-sentence pitch?
- Iconic visual moment for poster/marketing?
- Trailer-friendly sequences?
- Will audiences tell friends about it?

Be realistic about commercial prospects. Most scripts are not commercially viable.
`;

// =============================================================================
// Production Likelihood Analysis
// =============================================================================

export const PRODUCTION_LIKELIHOOD_PROMPT = `
You are a development executive assessing PRODUCTION LIKELIHOOD.
Would this script actually get made in today's market?

${SCORING_CALIBRATION}

Return a JSON object:

{
  "overall": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": []
  },
  "execution_readiness": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "script_polish": <1-10>,
    "coverage_ready": <1-10>,
    "director_attachment": <1-10>
  },
  "industry_factors": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": [],
    "diversity_inclusion": <1-10>,
    "cultural_relevance": <1-10>,
    "controversy_risk": <1-10>,
    "awards_potential": <1-10>
  },
  "practical_considerations": {
    "page_count": <number>,
    "estimated_runtime_minutes": <number>,
    "speaking_roles": <number>,
    "locations_count": <number>,
    "major_set_pieces": <number>
  }
}

EVALUATION CRITERIA:

EXECUTION READINESS:
- Is this script polished enough to show to talent?
- Would it pass studio coverage (not just "consider" but "recommend")?
- Is it director-friendly material that filmmakers would want to make?

INDUSTRY FACTORS:
- Does it feature diverse perspectives authentically?
- Is it culturally relevant right now?
- Any controversy that could make studios nervous?
- Awards potential (prestige project)?

PRACTICAL:
- Page count (ideal: 90-120 for features)
- Estimated runtime
- Number of speaking roles (more = more expensive)
- Number of distinct locations
- Major set pieces requiring significant resources

Be honest about production likelihood. Most scripts never get made.
A score of 7+ means "this could realistically get produced."
`;

// =============================================================================
// Dialogue Deep Dive
// =============================================================================

export const DIALOGUE_ANALYSIS_PROMPT = `
You are a dialogue specialist analyzing CHARACTER VOICES and CONVERSATION DYNAMICS.

${SCORING_CALIBRATION}

Return a JSON object:

{
  "overall": {
    "score": <1-10>,
    "confidence": <0.0-1.0>,
    "summary": "",
    "strengths": [],
    "weaknesses": [],
    "suggestions": []
  },
  "characters": [
    {
      "name": "<character name>",
      "line_count": <approximate number of lines>,
      "avg_line_length": <short|medium|long>,
      "vocabulary_richness": <1-10>,
      "speech_patterns": ["<pattern 1>", "<pattern 2>"],
      "emotional_range": <1-10>,
      "consistency": <1-10>,
      "memorable_lines": ["<quote 1>", "<quote 2>"]
    }
  ],
  "dynamics": {
    "conflict_in_dialogue": <1-10>,
    "power_shifts": <1-10>,
    "subtext_density": <1-10>,
    "exposition_handling": <1-10>
  },
  "issues": [
    {
      "type": "<on_the_nose|exposition_dump|redundant|anachronistic|inconsistent_voice>",
      "location": "<scene or page reference>",
      "example": "<quoted dialogue>",
      "suggestion": "<how to fix>"
    }
  ]
}

ANALYSIS FOCUS:

CHARACTER VOICES:
- Does each character have a distinct voice?
- What are their verbal tics, catchphrases, speech patterns?
- How sophisticated is their vocabulary?
- Do they show emotional range?
- Is their voice consistent throughout?
- What are their most memorable lines?

CONVERSATION DYNAMICS:
- Do characters have conflicting agendas in conversations?
- Does power shift during scenes?
- How much is communicated through subtext vs explicit?
- Is exposition delivered naturally or dumped?

COMMON ISSUES TO FLAG:
- On the nose: Characters state exactly what they feel
- Exposition dump: Unnatural info delivery ("As you know, Bob...")
- Redundant: Characters repeat information
- Anachronistic: Wrong era language/references
- Inconsistent voice: Character sounds different scene to scene

Quote specific examples for every issue identified.
`;

// =============================================================================
// Structural Analysis (Beat Sheet)
// =============================================================================

export const STRUCTURAL_ANALYSIS_PROMPT = `
You are a story structure expert analyzing NARRATIVE ARCHITECTURE.
Use the Save the Cat beat sheet as your framework.

${SCORING_CALIBRATION}

Return a JSON object:

{
  "beat_sheet": {
    "opening_image": {
      "page": <page number or null if missing>,
      "description": "<what happens>",
      "score": <1-10 for effectiveness>
    },
    "theme_stated": {
      "page": <page number or null>,
      "description": "<the thematic statement>",
      "score": <1-10>
    },
    "setup": {
      "pages": [<start>, <end>],
      "description": "<what's established>",
      "score": <1-10>
    },
    "catalyst": {
      "page": <page number>,
      "description": "<the inciting incident>",
      "score": <1-10>
    },
    "debate": {
      "pages": [<start>, <end>],
      "description": "<the hesitation/preparation>",
      "score": <1-10>
    },
    "break_into_two": {
      "page": <page number>,
      "description": "<entering the new world>",
      "score": <1-10>
    },
    "b_story": {
      "page": <page number>,
      "description": "<the secondary story/love interest>",
      "score": <1-10>
    },
    "fun_and_games": {
      "pages": [<start>, <end>],
      "description": "<the promise of the premise>",
      "score": <1-10>
    },
    "midpoint": {
      "page": <page number>,
      "description": "<false victory or false defeat>",
      "score": <1-10>
    },
    "bad_guys_close_in": {
      "pages": [<start>, <end>],
      "description": "<mounting pressure>",
      "score": <1-10>
    },
    "all_is_lost": {
      "page": <page number>,
      "description": "<the lowest point>",
      "score": <1-10>
    },
    "dark_night_of_soul": {
      "pages": [<start>, <end>],
      "description": "<the moment of reflection>",
      "score": <1-10>
    },
    "break_into_three": {
      "page": <page number>,
      "description": "<the solution/plan>",
      "score": <1-10>
    },
    "finale": {
      "pages": [<start>, <end>],
      "description": "<the climactic sequence>",
      "score": <1-10>
    },
    "final_image": {
      "page": <page number>,
      "description": "<the closing image>",
      "score": <1-10>
    }
  },
  "pacing": {
    "scene_length_distribution": {
      "short": <count of scenes under 1 page>,
      "medium": <count of scenes 1-3 pages>,
      "long": <count of scenes over 3 pages>
    },
    "act_balance": {
      "act_one_percent": <percentage>,
      "act_two_percent": <percentage>,
      "act_three_percent": <percentage>
    },
    "tension_curve": [
      {"page": 1, "tension_level": <0-10>},
      {"page": 10, "tension_level": <0-10>},
      {"page": 20, "tension_level": <0-10>},
      {"page": 30, "tension_level": <0-10>},
      {"page": 45, "tension_level": <0-10>},
      {"page": 60, "tension_level": <0-10>},
      {"page": 75, "tension_level": <0-10>},
      {"page": 90, "tension_level": <0-10>}
    ]
  },
  "scenes": [
    {
      "scene_number": <number>,
      "page_range": [<start>, <end>],
      "location": "<location>",
      "characters_present": ["<char1>", "<char2>"],
      "purpose": "<exposition|character|plot|action|transition>",
      "conflict_present": <true|false>,
      "advances_plot": <true|false>,
      "could_cut": <true|false>,
      "notes": "<brief note>"
    }
  ]
}

BEAT SHEET GUIDELINES (Save the Cat):
- Opening Image (p.1): Visual that sets tone and shows "before"
- Theme Stated (p.5): Someone states the theme (protagonist may not get it yet)
- Setup (p.1-10): Establish world, characters, stakes
- Catalyst (p.12): The event that changes everything
- Debate (p.12-25): Should the hero act? What's the cost?
- Break into Two (p.25): Hero commits to the journey
- B Story (p.30): Secondary story begins (often love interest)
- Fun and Games (p.30-55): The "promise of the premise"
- Midpoint (p.55): False victory or false defeat, stakes raise
- Bad Guys Close In (p.55-75): Antagonist gains ground, team fractures
- All Is Lost (p.75): The lowest point, whiff of death
- Dark Night of Soul (p.75-85): Hero reflects on everything
- Break into Three (p.85): The solution emerges
- Finale (p.85-110): The climactic sequence
- Final Image (p.110): Mirror of opening showing change

Mark any beats that are missing, weak, or in the wrong place.
`;

// =============================================================================
// Synthesis / Final Report
// =============================================================================

export const SYNTHESIS_PROMPT = `
You are a senior development executive creating a FINAL SCRIPT COVERAGE REPORT.
You have been provided with detailed analyses of:
- Writing Quality
- Story Quality
- Commercial Viability
- Production Likelihood
- Dialogue Analysis
- Structural Analysis

Synthesize these into an executive summary and actionable recommendations.

Return a JSON object:

{
  "overall_score": <1-10, weighted average>,
  "coverage_verdict": "<pass|consider|consider_with_reservations|recommend>",
  "executive_summary": {
    "one_liner": "<One sentence capturing the script's essence and quality>",
    "top_strengths": ["<strength 1>", "<strength 2>", "<strength 3>"],
    "critical_weaknesses": ["<weakness 1>", "<weakness 2>"],
    "comparison_titles": ["<similar film 1>", "<similar film 2>"],
    "ideal_for": ["<target buyer/platform 1>", "<target buyer/platform 2>"]
  },
  "improvement_roadmap": [
    {
      "priority": "<critical|high|medium|low>",
      "area": "<specific area>",
      "issue": "<what's wrong>",
      "recommendation": "<specific fix>",
      "effort": "<quick_fix|moderate_revision|major_rewrite>"
    }
  ],
  "logline": "<A polished logline for this script>",
  "genre": ["<primary genre>", "<secondary genre if applicable>"]
}

VERDICT GUIDELINES:
- PASS: Script has fundamental issues. Not ready for market.
- CONSIDER: Shows promise but needs work. Worth a second look after revisions.
- CONSIDER WITH RESERVATIONS: Good but has specific concerns that must be addressed.
- RECOMMEND: Ready for market. Would champion this project.

WEIGHTING FOR OVERALL SCORE:
- Story Quality: 30%
- Writing Quality: 25%
- Commercial Viability: 25%
- Production Likelihood: 20%

IMPROVEMENT ROADMAP PRIORITIES:
- CRITICAL: Must fix before showing to anyone
- HIGH: Should address in next draft
- MEDIUM: Would improve the script
- LOW: Nice to have

Be direct, honest, and actionable. This is professional coverage, not encouragement.
`;

// =============================================================================
// Batched All-Dimensions Analysis (Phase 2 cost-opt, issue #182)
// =============================================================================
//
// One prompt that asks Claude to evaluate the screenplay across all four core
// dimensions in a single call. Pairs with AllDimensionsScoreSchema in
// script-score-service.ts. Sending the script text once instead of four times
// is the biggest single token-volume win remaining after #178 / #179 / #181
// (the script text typically dominates the per-call cost).
//
// This prompt is intentionally a meta-instruction — the four detailed rubrics
// are too long to concatenate verbatim without exceeding context budgets.
// Each section names the dimension and the sub-aspects so the model knows
// what to evaluate; the JSON schema (passed via generateStructuredOutput)
// constrains the output shape.

export const ALL_DIMENSIONS_PROMPT = `
You are an expert screenplay analyst. Analyze the following screenplay across
FOUR dimensions in a single structured response.

${SCORING_CALIBRATION}

For each dimension, provide:
- An overall score (1-10) with confidence (0.0-1.0), summary, strengths,
  weaknesses, and suggestions
- Sub-scores for each named aspect (1-10 each)
- Concrete evidence drawn from the screenplay

DIMENSION 1 — WRITING QUALITY
Evaluate craft only (not story content). Cover:
- dialogue (subtext_usage, voice_distinction, naturalism, economy)
- action_lines (clarity, brevity, voice)
- formatting (industry_standard, white_space, readability)

DIMENSION 2 — STORY QUALITY
Evaluate the story itself. Cover:
- premise (originality, clarity, hook)
- structure (three_act, pacing, beat_sheet, turning_points)
- characters (protagonist_clarity, antagonist_strength, arc, supporting_cast, motivation)
- conflict (central_conflict, stakes, escalation, resolution)
- theme (presence, integration, resonance)

DIMENSION 3 — COMMERCIAL VIABILITY
Evaluate market potential. Cover:
- market_fit (genre_clarity, target_audience, trend_alignment, comparables)
- producibility (budget_tier [micro/low/medium/high/blockbuster], location_feasibility,
  cast_requirements, vfx_demands, period_setting [boolean])
- platform_fit (theatrical, streaming, limited_series, international — 1-10 each)
- sales_hooks (logline_strength, poster_moment [boolean], trailer_beats, word_of_mouth)

DIMENSION 4 — PRODUCTION LIKELIHOOD
Evaluate readiness for production. Cover:
- execution_readiness (script_polish, coverage_ready, director_attachment)
- industry_factors (diversity_inclusion, cultural_relevance, controversy_risk, awards_potential)
- practical_considerations (page_count, estimated_runtime_minutes, speaking_roles,
  locations_count, major_set_pieces)

Return the four dimensions in a single JSON object with keys:
writing_quality, story_quality, commercial_viability, production_likelihood.

Be honest and calibrated — most scripts are 5-7. Reserve 8+ for genuinely
impressive work. Cite scene numbers or quoted lines as evidence.
`;
