# StoryScore & Story-Adviser Design Document

**Version:** 1.0
**Date:** 2026-01-21
**Status:** Implementation Ready

---

## Executive Summary

StoryScore is an AI-powered screenplay evaluation system that helps budding screenwriters improve their scripts by providing objective, rubric-based feedback across 12 dimensions derived from industry best practices. Story-Adviser extends this with inline suggestions and AI-assisted rewrites.

---

## Research Foundation

### Industry Sources Consulted

- **AUTOSCORE_PLAN.md** - Internal 8-dimension framework (284 hours planned)
- **Professional Script Coverage** - [StudioBinder](https://www.studiobinder.com/blog/script-coverage-complete-guide/), [WeScreenplay](https://www.wescreenplay.com/blog/script-coverage-guide/)
- **Slated Script Analysis** - [10 numerical attributes](https://get.slated.com/script-analysis/)
- **Save the Cat Beat Sheet** - [Blake Snyder's 15 beats](https://www.studiobinder.com/blog/save-the-cat-beat-sheet/)
- **Greenlight Criteria** - [Industrial Scripts](https://industrialscripts.com/greenlit/), [No Film School](https://nofilmschool.com/2013/09/script-meet-criteria-greenlight)
- **Dialogue/Character Voice** - [Greenlight Coverage](https://glcoverage.com/2024/06/14/how-to-give-characters-unique-voices-in-screenplay/)

### Key Industry Insights

1. **Pass/Consider/Recommend** is the universal industry rating system
2. **Four Quadrants** (age/gender) drive marketing decisions
3. **High-concept** scripts dominate 2025 sales (23 specs sold Summer 2025)
4. **Castability** = compelling characters + great scenes + emotional intensity
5. **Subtext** distinguishes amateur from professional dialogue

---

## Enhanced 12-Dimension Rubric

Building on the original 8-dimension framework, we expand to 12 dimensions to capture all critical evaluation vertices:

### Category 1: CONCEPT (25% total weight)

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 1 | **Premise Originality** | 10% | Fresh concept, unique hook, differentiation from existing films |
| 2 | **Logline Clarity** | 8% | Can the core concept be expressed in one compelling sentence? |
| 3 | **Commercial Viability** | 7% | Market fit, four-quadrant appeal, comparable success stories |

### Category 2: STRUCTURE (25% total weight)

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 4 | **Three-Act Integrity** | 10% | Save the Cat beats present, turning points land, causality |
| 5 | **Pacing & Momentum** | 8% | Scene economy, no fat, reader engagement maintained |
| 6 | **Stakes & Escalation** | 7% | Rising tension, consequences that matter, ticking clocks |

### Category 3: CHARACTER (25% total weight)

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 7 | **Protagonist Arc** | 10% | Clear want/need, transformation, internal + external journey |
| 8 | **Supporting Cast** | 8% | Dimensional antagonist, distinct supporting characters, relationships |
| 9 | **Castability** | 7% | Roles actors want to play, star vehicle potential, memorable scenes |

### Category 4: CRAFT (25% total weight)

| # | Dimension | Weight | What It Measures |
|---|-----------|--------|------------------|
| 10 | **Dialogue Quality** | 10% | Subtext, distinctive voices, economy, memorable lines |
| 11 | **Visual Storytelling** | 8% | Show don't tell, cinematic moments, action writing |
| 12 | **Technical Execution** | 7% | Formatting, clarity, professional presentation |

---

## Scoring Scale & Output

### 1-10 Scale Definition

```
10 - EXCEPTIONAL: Award-worthy, industry benchmark
 9 - EXCELLENT: Ready for market, minor polish only
 8 - VERY GOOD: Strong execution, targeted improvements needed
 7 - GOOD: Solid foundation, specific areas need work
 6 - ABOVE AVERAGE: Shows promise, multiple areas need development
 5 - AVERAGE: Competent but unremarkable
 4 - BELOW AVERAGE: Fundamental issues present
 3 - WEAK: Significant problems in this dimension
 2 - POOR: Major overhaul needed
 1 - FAILING: Does not meet minimum standards
```

### Overall Rating Translation

| Score Range | Rating | Industry Equivalent |
|-------------|--------|---------------------|
| 8.5 - 10.0 | **RECOMMEND** | Ready for market |
| 7.0 - 8.4 | **CONSIDER** | Strong potential with revisions |
| 5.0 - 6.9 | **CONSIDER WITH RESERVATIONS** | Needs significant work |
| 3.0 - 4.9 | **PASS** | Not ready |
| 1.0 - 2.9 | **STRONG PASS** | Fundamental issues |

---

## Detailed Scoring Criteria

### 1. Premise Originality (10%)

```
10 - Never seen before, genre-defining potential
 9 - Fresh take that feels inevitable yet surprising
 8 - Familiar territory with genuinely unique hook
 7 - Good concept with some original elements
 6 - Solid but not distinctive
 5 - Execution-dependent, premise alone won't sell
 4 - Derivative of recent films
 3 - Been done many times
 2 - Direct copy with minimal changes
 1 - Complete retread, no original elements
```

**Evaluation Questions:**
- What makes this story different from everything else in its genre?
- Can you pitch it as "[Movie A] meets [Movie B]" in a compelling way?
- Would a studio exec say "I've never seen this before"?

### 2. Logline Clarity (8%)

```
10 - Instantly gripping, tells you everything and nothing
 9 - Crystal clear concept that sells itself
 8 - Strong hook, clear protagonist and stakes
 7 - Good clarity, could be tighter
 6 - Understandable but not compelling
 5 - Requires explanation beyond one sentence
 4 - Confusing or generic
 3 - Unclear who protagonist is or what they want
 2 - Multiple concepts competing
 1 - Cannot be summarized coherently
```

**Test:** Can someone unfamiliar with the script immediately understand:
- WHO is the protagonist?
- WHAT do they want?
- WHAT stands in their way?
- WHAT happens if they fail?

### 3. Commercial Viability (7%)

```
10 - Four-quadrant hit potential, clear marketing angle
 9 - Strong theatrical potential, defined audience
 8 - Solid streamer/studio fit, marketable elements
 7 - Identifiable audience, some marketing challenges
 6 - Niche but viable market
 5 - Limited commercial appeal
 4 - Difficult to market
 3 - Very narrow audience
 2 - Unmarketable in current form
 1 - No commercial path visible
```

**Considerations:**
- Budget tier alignment (micro/indie/mid/tentpole)
- Current market trends (2025: high-concept thrillers dominate)
- Comparable films and their performance
- IP potential (franchise, adaptation)

### 4. Three-Act Integrity (10%)

```
10 - Perfect structure, every beat lands, nothing wasted
 9 - Excellent structure with one minor soft spot
 8 - Strong acts with clear turning points
 7 - Good structure, some beats could be stronger
 6 - Basic three-act present but uneven
 5 - Structure exists but midpoint weak
 4 - Act breaks unclear or poorly placed
 3 - Second act sags significantly
 2 - Major structural problems
 1 - No discernible structure
```

**Save the Cat Beat Check:**
- [ ] Opening Image establishes tone
- [ ] Catalyst by page 12
- [ ] Break into Two by page 25
- [ ] Midpoint at 50% (false victory/defeat)
- [ ] All Is Lost at 75%
- [ ] Break into Three by page 85
- [ ] Final Image mirrors/contrasts opening

### 5. Pacing & Momentum (8%)

```
10 - Unputdownable, perfect scene economy
 9 - Relentless momentum with earned breathing room
 8 - Strong pace with minor drag
 7 - Good pace overall, some scenes run long
 6 - Uneven pacing
 5 - Noticeable lulls
 4 - Significant pacing problems
 3 - Reader engagement lost repeatedly
 2 - Major sections feel unnecessary
 1 - Pacing destroys engagement
```

**Red Flags:**
- Scenes over 3 pages without justification
- Consecutive dialogue-heavy scenes
- "Homework scenes" (pure exposition)
- Repeated information

### 6. Stakes & Escalation (7%)

```
10 - Life-or-death (literal or emotional) with constant raising
 9 - Deeply felt stakes that escalate beautifully
 8 - Strong stakes, clear escalation pattern
 7 - Good stakes but escalation uneven
 6 - Stakes present but could be higher
 5 - Generic stakes (save the world, get the girl)
 4 - Stakes unclear or abstract
 3 - Low stakes, nothing to lose
 2 - No meaningful consequences
 1 - Why should we care?
```

### 7. Protagonist Arc (10%)

```
10 - Transformative journey, deeply moving
 9 - Compelling arc with clear internal/external goals
 8 - Strong arc with meaningful change
 7 - Good arc, change earned
 6 - Arc present but predictable
 5 - Change happens but feels unearned
 4 - Minimal character growth
 3 - Protagonist is reactive, not active
 2 - No discernible arc
 1 - Protagonist is not the main character of their own story
```

**Arc Components:**
- **Want** (external goal) vs **Need** (internal truth)
- **Ghost/Wound** (what shaped them)
- **Lie** (false belief they hold)
- **Truth** (what they learn)

### 8. Supporting Cast (8%)

```
10 - Every character memorable and necessary
 9 - Excellent ensemble, each serves story
 8 - Strong supporting characters with depth
 7 - Good characters, some underdeveloped
 6 - Functional but not memorable
 5 - Some characters feel like plot devices
 4 - Antagonist weak or unclear motivation
 3 - Supporting cast interchangeable
 2 - Characters serve convenience over story
 1 - No supporting characters matter
```

**Antagonist Check:**
- Does the antagonist believe they're the hero of their own story?
- Is their motivation specific and personal (not generic evil)?
- Do they directly challenge the protagonist's flaw?

### 9. Castability (7%)

```
10 - Multiple star-making roles, dream casting easy
 9 - Lead role every A-lister wants, great supporting
 8 - Strong lead with good scenes for cast
 7 - Castable lead, supporting roles less defined
 6 - Solid role but not distinctive
 5 - Generic lead anyone could play
 4 - Limited appeal to name actors
 3 - Difficult to cast
 2 - No memorable moments for actors
 1 - Actors would pass
```

**What Actors Look For:**
- "I've never played this before"
- At least one bravura scene (Oscar clip)
- Emotional range opportunity
- Physical transformation potential

### 10. Dialogue Quality (10%)

```
10 - Quotable, distinctive, every line sings
 9 - Excellent voices, rich subtext
 8 - Strong dialogue with memorable exchanges
 7 - Good dialogue, some on-the-nose moments
 6 - Functional dialogue, lacks distinction
 5 - Serviceable but forgettable
 4 - Characters sound similar
 3 - On-the-nose, no subtext
 2 - Exposition dumps in dialogue
 1 - Unnatural, stilted speech
```

**Dialogue Tests:**
1. **Cover Test:** Remove character names - can you tell who's speaking?
2. **Mamet Test:** Does every line pursue a want?
3. **Subtext Test:** Is meaning conveyed through what's NOT said?

### 11. Visual Storytelling (8%)

```
10 - Pure cinema, could work as silent film
 9 - Excellent visual set pieces, shows not tells
 8 - Strong visual moments, good action writing
 7 - Good visual sense, some telling over showing
 6 - Adequate visual description
 5 - Over-reliance on dialogue for exposition
 4 - Talking heads scenes
 3 - Uncinematic staging
 2 - Radio play with visuals
 1 - No visual imagination
```

**Visual Storytelling Elements:**
- Action lines that create pictures
- Environmental storytelling
- Character revealed through behavior, not dialogue
- Setpiece sequences

### 12. Technical Execution (7%)

```
10 - Flawless professional presentation
 9 - Excellent formatting, clear writing
 8 - Strong technical execution
 7 - Good formatting with minor issues
 6 - Acceptable with some problems
 5 - Noticeable formatting issues
 4 - Distracting technical problems
 3 - Amateur formatting
 2 - Difficult to read
 1 - Does not follow industry standards
```

**Technical Checklist:**
- [ ] Proper screenplay format (Final Draft/Highland standard)
- [ ] Page count appropriate for genre (90-120 pages)
- [ ] Scene headings consistent (INT./EXT., LOCATION - TIME)
- [ ] Action blocks under 4 lines
- [ ] No camera directions (unless absolutely necessary)
- [ ] No actor directions in parentheticals (unless crucial)

---

## StoryScore UI Component Design

### Score Card View (Collapsed)

```
┌──────────────────────────────────────────────────────────────────┐
│  STORYSCORE                                    CONSIDER (7.4/10) │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐  CONCEPT      ████████░░  7.8                   │
│  │            │  STRUCTURE    ███████░░░  7.2                   │
│  │   RADAR    │  CHARACTER    ████████░░  7.6                   │
│  │   CHART    │  CRAFT        ███████░░░  7.0                   │
│  │            │                                                  │
│  └────────────┘  [View Details] [Get Suggestions]               │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

### Score Card View (Expanded)

```
┌──────────────────────────────────────────────────────────────────┐
│  STORYSCORE                                    CONSIDER (7.4/10) │
├──────────────────────────────────────────────────────────────────┤
│                                                                  │
│  CONCEPT (7.8)                                                   │
│  ├─ Premise Originality     ████████░░  8  Fresh supernatural   │
│  │                                         horror angle         │
│  ├─ Logline Clarity         ████████░░  8  Strong hook, clear   │
│  │                                         protagonist          │
│  └─ Commercial Viability    ███████░░░  7  Solid streamer fit   │
│                                                                  │
│  STRUCTURE (7.2)                                                 │
│  ├─ Three-Act Integrity     ████████░░  8  Strong beats, Act 3  │
│  │                                         slightly rushed      │
│  ├─ Pacing & Momentum       ███████░░░  7  Pages 35-45 drag     │
│  └─ Stakes & Escalation     ██████░░░░  6  Stakes could be      │
│                                            higher personally    │
│                                                                  │
│  CHARACTER (7.6)                                                 │
│  ├─ Protagonist Arc         ████████░░  8  Clear transformation │
│  ├─ Supporting Cast         ███████░░░  7  Antagonist needs     │
│  │                                         more specificity     │
│  └─ Castability             ████████░░  8  Great lead role      │
│                                                                  │
│  CRAFT (7.0)                                                     │
│  ├─ Dialogue Quality        ███████░░░  7  Some on-the-nose     │
│  │                                         moments              │
│  ├─ Visual Storytelling     ██████░░░░  6  More show, less tell │
│  └─ Technical Execution     ████████░░  8  Clean formatting     │
│                                                                  │
│  ─────────────────────────────────────────────────────────────── │
│                                                                  │
│  STRENGTHS                        AREAS FOR IMPROVEMENT          │
│  ✓ Fresh premise with hook        ✗ Visual storytelling needs   │
│  ✓ Strong protagonist arc            more cinema                │
│  ✓ Castable lead role             ✗ Stakes could be more        │
│  ✓ Clean execution                   personal                   │
│                                   ✗ Antagonist motivation        │
│                                      unclear                     │
│                                                                  │
│  [Generate Full Report]  [Compare to Similar Scripts]           │
│  [Story-Adviser Suggestions]                                     │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## Story-Adviser Architecture

### Overview

Story-Adviser extends StoryScore by providing:
1. **Inline Suggestions** - Highlighted areas with improvement notes
2. **Section Analysis** - Deep dive into weak areas
3. **Rewrite Options** - AI-generated alternatives
4. **Before/After Scoring** - Track improvement

### Suggestion Types

| Type | Description | User Actions |
|------|-------------|--------------|
| **Highlight** | Visual marker on weak passage | Hover for explanation |
| **Note** | Detailed feedback without rewrite | Read, dismiss, or request rewrite |
| **Suggestion** | Specific change recommendation | Accept, modify, or dismiss |
| **Rewrite** | AI-generated alternative text | Accept, edit, compare, or dismiss |

### Editor Integration Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                        SCRIPT EDITOR                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  INT. SARAH'S APARTMENT - NIGHT                                 │
│                                                                  │
│  Sarah sits alone, staring at old photographs.                  │
│                                                                  │
│                    SARAH                                         │
│         [HIGHLIGHTED - DIALOGUE ISSUE]                          │
│         I'm so sad about everything that                        │
│         happened to me when I was young. My                     │
│         childhood was very difficult and that's                 │
│         why I have trust issues now.                            │
│                                                                  │
│  ┌────────────────────────────────────────────────────────┐    │
│  │  STORY-ADVISER SUGGESTION                              │    │
│  │                                                         │    │
│  │  Issue: On-the-nose dialogue (-2 points)               │    │
│  │                                                         │    │
│  │  This dialogue tells us Sarah's backstory directly.    │    │
│  │  Consider showing her pain through behavior and        │    │
│  │  subtext instead.                                       │    │
│  │                                                         │    │
│  │  OPTIONS:                                               │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │ A. AI REWRITE (Recommended)                     │   │    │
│  │  │    Sarah traces a photo's edge. She opens her   │   │    │
│  │  │    mouth to speak, then doesn't. She sets the   │   │    │
│  │  │    photo face-down.                             │   │    │
│  │  │    [APPLY] [EDIT] [COMPARE]                     │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │ B. PARTIAL REWRITE                              │   │    │
│  │  │    Keep the dialogue structure, add subtext:    │   │    │
│  │  │    "Some things stay broken."                   │   │    │
│  │  │    [APPLY] [EDIT]                               │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  │  ┌─────────────────────────────────────────────────┐   │    │
│  │  │ C. I'LL REWRITE IT                              │   │    │
│  │  │    Edit the section yourself, then click        │   │    │
│  │  │    "Rescore" to compare to original.            │   │    │
│  │  │    [EDIT MYSELF]                                │   │    │
│  │  └─────────────────────────────────────────────────┘   │    │
│  │                                                         │    │
│  │  [DISMISS]  [EXPLAIN MORE]  [SIMILAR EXAMPLES]         │    │
│  └────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Revision Tracking

```
┌─────────────────────────────────────────────────────────────────┐
│  REVISION HISTORY                                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  VERSION         DATE        SCORE    CHANGE                    │
│  ─────────────────────────────────────────────                  │
│  Draft 1         Jan 15      6.2      Initial upload            │
│  Draft 2         Jan 18      6.8      +0.6 (Dialogue fixes)     │
│  Draft 3         Jan 20      7.2      +0.4 (Structure work)     │
│  Draft 4         Jan 21      7.4      +0.2 (Character depth)    │
│  ► Current       Jan 21      7.4      Working...                │
│                                                                  │
│  TRAJECTORY: ████████████░░░░░░░░  7.4 → Target: 8.5           │
│                                                                  │
│  [Compare Versions]  [Export Change Log]                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema Additions

```sql
-- StoryScore results
CREATE TABLE story_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version INT DEFAULT 1,

    -- 12 dimensions (1-10 scale)
    premise_originality INT CHECK (premise_originality BETWEEN 1 AND 10),
    logline_clarity INT CHECK (logline_clarity BETWEEN 1 AND 10),
    commercial_viability INT CHECK (commercial_viability BETWEEN 1 AND 10),
    three_act_integrity INT CHECK (three_act_integrity BETWEEN 1 AND 10),
    pacing_momentum INT CHECK (pacing_momentum BETWEEN 1 AND 10),
    stakes_escalation INT CHECK (stakes_escalation BETWEEN 1 AND 10),
    protagonist_arc INT CHECK (protagonist_arc BETWEEN 1 AND 10),
    supporting_cast INT CHECK (supporting_cast BETWEEN 1 AND 10),
    castability INT CHECK (castability BETWEEN 1 AND 10),
    dialogue_quality INT CHECK (dialogue_quality BETWEEN 1 AND 10),
    visual_storytelling INT CHECK (visual_storytelling BETWEEN 1 AND 10),
    technical_execution INT CHECK (technical_execution BETWEEN 1 AND 10),

    -- Category scores (computed)
    concept_score DECIMAL(3,1) GENERATED ALWAYS AS (
        (premise_originality * 0.4 + logline_clarity * 0.32 + commercial_viability * 0.28)
    ) STORED,
    structure_score DECIMAL(3,1) GENERATED ALWAYS AS (
        (three_act_integrity * 0.4 + pacing_momentum * 0.32 + stakes_escalation * 0.28)
    ) STORED,
    character_score DECIMAL(3,1) GENERATED ALWAYS AS (
        (protagonist_arc * 0.4 + supporting_cast * 0.32 + castability * 0.28)
    ) STORED,
    craft_score DECIMAL(3,1) GENERATED ALWAYS AS (
        (dialogue_quality * 0.4 + visual_storytelling * 0.32 + technical_execution * 0.28)
    ) STORED,

    -- Overall (weighted average)
    overall_score DECIMAL(3,1),
    rating TEXT, -- 'RECOMMEND', 'CONSIDER', 'PASS', etc.

    -- AI reasoning
    reasoning JSONB, -- {dimension: explanation}
    strengths TEXT[],
    weaknesses TEXT[],

    -- Confidence
    confidence DECIMAL(3,2),
    model_version TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Story-Adviser suggestions
CREATE TABLE story_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    story_score_id UUID REFERENCES story_scores(id),

    -- Location in script
    page_start INT,
    page_end INT,
    line_start INT,
    line_end INT,
    original_text TEXT,

    -- Suggestion details
    dimension TEXT NOT NULL,
    issue_type TEXT, -- 'dialogue', 'structure', 'character', 'visual', 'pacing'
    severity TEXT, -- 'high', 'medium', 'low'
    issue_description TEXT NOT NULL,

    -- Rewrite options
    rewrite_options JSONB, -- [{id, label, text, projected_impact}]
    projected_impact DECIMAL(2,1),

    -- User response
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'modified'
    selected_option TEXT,
    user_rewrite TEXT,
    user_feedback TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- Track revision history
CREATE TABLE story_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,

    version INT NOT NULL,
    script_text TEXT NOT NULL,
    story_score_id UUID REFERENCES story_scores(id),

    -- Changes from previous version
    changes_summary TEXT,
    suggestions_applied INT DEFAULT 0,
    suggestions_rejected INT DEFAULT 0,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_story_scores_project ON story_scores(project_id);
CREATE INDEX idx_story_suggestions_project ON story_suggestions(project_id);
CREATE INDEX idx_story_revisions_project ON story_revisions(project_id);
```

---

## API Endpoints

```typescript
// StoryScore endpoints
POST   /api/projects/{id}/score          // Generate StoryScore
GET    /api/projects/{id}/score          // Get latest score
GET    /api/projects/{id}/score/history  // Get score history
POST   /api/projects/{id}/score/compare  // Compare to similar scripts

// Story-Adviser endpoints
POST   /api/projects/{id}/suggestions    // Generate suggestions
GET    /api/projects/{id}/suggestions    // Get pending suggestions
POST   /api/suggestions/{id}/respond     // Accept/reject suggestion
POST   /api/suggestions/{id}/rewrite     // Generate rewrite options
POST   /api/projects/{id}/rescore        // Rescore after changes

// Revision tracking
GET    /api/projects/{id}/revisions      // Get revision history
POST   /api/projects/{id}/revisions      // Save new revision
GET    /api/revisions/{id}/diff          // Get diff between versions
```

---

## Implementation Phases

### Phase 1: StoryScore MVP (40 hours)
- [ ] Database schema for scores
- [ ] StoryScore React component (radar chart, score cards)
- [ ] LLM scoring pipeline (12 dimensions)
- [ ] Integration with project page
- [ ] Score history view

### Phase 2: Story-Adviser Core (60 hours)
- [ ] Suggestion generation pipeline
- [ ] Inline editor highlighting
- [ ] Rewrite option generation
- [ ] Accept/reject workflow
- [ ] Rescore after changes

### Phase 3: Advanced Features (40 hours)
- [ ] Revision tracking & diff view
- [ ] Score trajectory visualization
- [ ] Similar script comparison (requires corpus)
- [ ] Export reports (PDF)

**Total: 140 hours**

---

## LLM Prompt Architecture

### Master Scoring Prompt

```
You are an expert Hollywood script reader evaluating a screenplay.

SCRIPT INFORMATION:
Title: {title}
Genre: {genre}
Logline: {logline}
Page Count: {page_count}

FULL SCRIPT TEXT:
{script_text}

Evaluate this script across 12 dimensions. For each dimension, provide:
1. Score (1-10)
2. Reasoning (2-3 sentences)
3. Specific examples from the script

DIMENSIONS:
1. Premise Originality (10%) - Fresh concept, unique hook
2. Logline Clarity (8%) - Can concept be expressed in one sentence?
3. Commercial Viability (7%) - Market fit, audience appeal
4. Three-Act Integrity (10%) - Beat structure, turning points
5. Pacing & Momentum (8%) - Scene economy, engagement
6. Stakes & Escalation (7%) - Rising tension, consequences
7. Protagonist Arc (10%) - Transformation, want vs need
8. Supporting Cast (8%) - Dimensional characters, antagonist
9. Castability (7%) - Roles actors want to play
10. Dialogue Quality (10%) - Subtext, distinctive voices
11. Visual Storytelling (8%) - Show don't tell, cinema
12. Technical Execution (7%) - Formatting, clarity

After scoring all dimensions:
- List 3-5 key STRENGTHS
- List 3-5 key AREAS FOR IMPROVEMENT
- Provide overall RATING: RECOMMEND / CONSIDER / PASS
- Calculate weighted OVERALL SCORE (1-10)

Respond in JSON format.
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Score generation time | < 60 seconds |
| User satisfaction with scores | > 4/5 |
| Suggestion acceptance rate | > 40% |
| Score improvement after suggestions | > 0.5 points average |
| Revision tracking usage | > 60% of active users |

---

## References

- [StudioBinder Script Coverage Guide](https://www.studiobinder.com/blog/script-coverage-complete-guide/)
- [Save the Cat Beat Sheet](https://www.studiobinder.com/blog/save-the-cat-beat-sheet/)
- [WeScreenplay Script Coverage](https://www.wescreenplay.com/blog/script-coverage-guide/)
- [Greenlight Coverage - Character Voices](https://glcoverage.com/2024/06/14/how-to-give-characters-unique-voices-in-screenplay/)
- [Industrial Scripts - Greenlight Criteria](https://industrialscripts.com/greenlit/)
- [Slated Script Analysis](https://get.slated.com/script-analysis/)
