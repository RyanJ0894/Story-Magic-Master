# Story Magic AutoScore & AutoEdit - Phased Development Plan

**Vision:** Transform Story Magic from an audio production tool into an intelligent script analysis platform that learns from historical success patterns to score, evaluate, and improve screenplays.

---

## Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STORY MAGIC INTELLIGENCE                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PHASE 0                    PHASE 1                    PHASE 2              │
│  ────────                   ────────                   ────────              │
│                                                                              │
│  ┌──────────────┐          ┌──────────────┐          ┌──────────────┐       │
│  │   Vector DB  │          │  AutoScore   │          │  AutoEdit    │       │
│  │   Foundation │────────▶ │   System     │────────▶ │   Engine     │       │
│  └──────────────┘          └──────────────┘          └──────────────┘       │
│                                                                              │
│  • Script corpus            • Rubric framework        • AI rewrites         │
│  • Embeddings               • Human scoring UI        • Section suggestions │
│  • Success metadata         • LLM AutoScore           • Improvement tracking│
│  • Auto-learning            • Score comparison        • Saleability boost   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Phase 0: Vector Database & Learning Foundation

### Objective
Build a pgvector-powered knowledge base that stores scripts with rich metadata, enabling pattern recognition and continuous learning from human feedback.

### Data Model

```sql
-- Core script storage with embeddings
CREATE TABLE scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    author TEXT,
    genre TEXT[],
    logline TEXT,
    full_text TEXT NOT NULL,
    page_count INT,

    -- Outcome tracking
    status TEXT CHECK (status IN ('uploaded', 'sold', 'sold_produced', 'passed')),
    sale_date DATE,
    production_date DATE,
    studio TEXT,
    budget_tier TEXT, -- 'micro', 'indie', 'mid', 'tentpole'

    -- Embeddings (pgvector)
    logline_embedding VECTOR(1536),      -- OpenAI ada-002
    full_text_embedding VECTOR(1536),    -- Chunked and averaged

    -- Metadata
    uploaded_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script sections for granular analysis
CREATE TABLE script_sections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL, -- 'act_1', 'act_2', 'act_3', 'scene', 'sequence'
    section_number INT,
    content TEXT NOT NULL,
    page_start INT,
    page_end INT,

    -- Section-level embeddings
    content_embedding VECTOR(1536),

    -- Section metadata
    characters TEXT[],
    locations TEXT[],
    tone TEXT[], -- 'tense', 'comedic', 'dramatic', etc.

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Human scores (rubric-based)
CREATE TABLE human_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    scorer_id UUID REFERENCES auth.users(id),

    -- Rubric dimensions (1-10 scale)
    premise_originality INT CHECK (premise_originality BETWEEN 1 AND 10),
    plot_structure INT CHECK (plot_structure BETWEEN 1 AND 10),
    character_depth INT CHECK (character_depth BETWEEN 1 AND 10),
    dialogue_quality INT CHECK (dialogue_quality BETWEEN 1 AND 10),
    pacing INT CHECK (pacing BETWEEN 1 AND 10),
    emotional_impact INT CHECK (emotional_impact BETWEEN 1 AND 10),
    market_viability INT CHECK (market_viability BETWEEN 1 AND 10),
    technical_execution INT CHECK (technical_execution BETWEEN 1 AND 10),

    -- Composite
    overall_score DECIMAL(3,1) GENERATED ALWAYS AS (
        (premise_originality + plot_structure + character_depth +
         dialogue_quality + pacing + emotional_impact +
         market_viability + technical_execution) / 8.0
    ) STORED,

    -- Qualitative feedback
    strengths TEXT,
    weaknesses TEXT,
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI-generated scores
CREATE TABLE auto_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    model_version TEXT NOT NULL, -- 'v1.0', 'v1.1', etc.

    -- Same rubric dimensions as human scores
    premise_originality INT,
    plot_structure INT,
    character_depth INT,
    dialogue_quality INT,
    pacing INT,
    emotional_impact INT,
    market_viability INT,
    technical_execution INT,
    overall_score DECIMAL(3,1),

    -- AI reasoning (chain of thought)
    reasoning JSONB, -- {dimension: explanation}
    confidence DECIMAL(3,2), -- 0.00-1.00

    -- Comparable scripts found
    similar_scripts JSONB, -- [{script_id, similarity, outcome}]

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Learning from edits and corrections
CREATE TABLE score_corrections (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    auto_score_id UUID REFERENCES auto_scores(id) ON DELETE CASCADE,
    human_score_id UUID REFERENCES human_scores(id),

    -- What the AI got wrong
    dimension TEXT NOT NULL,
    ai_value INT,
    corrected_value INT,
    correction_reason TEXT,

    -- Used for model fine-tuning
    processed BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Track script outcomes for learning
CREATE TABLE script_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,

    outcome_type TEXT NOT NULL, -- 'submission', 'request', 'pass', 'option', 'sale', 'production'
    outcome_date DATE,
    entity TEXT, -- Studio, producer, contest
    notes TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for vector similarity search
CREATE INDEX ON scripts USING ivfflat (logline_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON scripts USING ivfflat (full_text_embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX ON script_sections USING ivfflat (content_embedding vector_cosine_ops) WITH (lists = 100);
```

### Auto-Learning Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           AUTO-LEARNING LOOP                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│   │  Script  │────▶│ Generate │────▶│  Store   │────▶│  Index   │          │
│   │  Upload  │     │ Embedding│     │  + Meta  │     │ pgvector │          │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘          │
│                                                                              │
│                           ▼                                                  │
│                                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐     ┌──────────┐          │
│   │  Model   │◀────│  Train   │◀────│ Correct  │◀────│  Human   │          │
│   │ Improve  │     │ Feedback │     │  Scores  │     │  Review  │          │
│   └──────────┘     └──────────┘     └──────────┘     └──────────┘          │
│                                                                              │
│                           ▼                                                  │
│                                                                              │
│   ┌──────────┐     ┌──────────┐     ┌──────────┐                           │
│   │ Outcome  │────▶│  Update  │────▶│ Refine   │                           │
│   │ Tracking │     │ Weights  │     │ Patterns │                           │
│   └──────────┘     └──────────┘     └──────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Phase 0 Deliverables

| Deliverable | Description |
|-------------|-------------|
| pgvector schema | Full database with embeddings support |
| Ingestion pipeline | Script upload → parse → embed → store |
| Similarity search | Find comparable scripts by logline/content |
| Metadata tagging | Genre, tone, structure auto-detection |
| Outcome tracking | Record sale/production status over time |
| Admin dashboard | View corpus stats, manage scripts |

### Phase 0 Hours Estimate

| Task | Hours |
|------|-------|
| Database schema design | 4 |
| pgvector setup & indexing | 4 |
| Embedding pipeline (OpenAI) | 8 |
| Script parser (sections, metadata) | 12 |
| Similarity search API | 6 |
| Admin UI for corpus management | 10 |
| Outcome tracking system | 4 |
| Testing & refinement | 8 |
| **Total** | **56** |

---

## Phase 1: AutoScore System

### Objective
Build a rubric-based scoring system that enables consistent human evaluation and trains an AI model to replicate and enhance that scoring.

### Scoring Rubric (8 Dimensions)

| Dimension | Description | Weight |
|-----------|-------------|--------|
| **Premise Originality** | Fresh concept? Unique angle on familiar territory? | 15% |
| **Plot Structure** | Three-act integrity, turning points, causality | 15% |
| **Character Depth** | Arc, motivation, dimensionality, relatability | 15% |
| **Dialogue Quality** | Distinctive voices, subtext, natural flow | 12.5% |
| **Pacing** | Scene economy, momentum, reader engagement | 10% |
| **Emotional Impact** | Stakes, catharsis, memorable moments | 12.5% |
| **Market Viability** | Audience, budget tier, current trends | 10% |
| **Technical Execution** | Formatting, clarity, professional presentation | 10% |

### Human Scoring Interface

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  SCRIPT EVALUATION: "Untitled Thriller" by J. Smith                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  PREMISE ORIGINALITY                                          [7] ████████░░│
│  "A unique twist on the home invasion genre with the house itself          │
│   as an antagonist. Loses points for familiar setup."                      │
│                                                                              │
│  PLOT STRUCTURE                                               [8] █████████░│
│  "Strong three-act structure. Midpoint is particularly effective.          │
│   Third act slightly rushed."                                              │
│                                                                              │
│  CHARACTER DEPTH                                              [6] ███████░░░│
│  "Protagonist is well-drawn. Supporting characters feel thin.              │
│   Antagonist motivation unclear."                                          │
│                                                                              │
│  ... (remaining dimensions)                                                 │
│                                                                              │
│  ───────────────────────────────────────────────────────────────────────── │
│                                                                              │
│  OVERALL SCORE: 7.2 / 10                                                    │
│                                                                              │
│  STRENGTHS:                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Unique premise with commercial hook                               │   │
│  │ • Tight pacing keeps reader engaged                                 │   │
│  │ • Strong visual storytelling                                        │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  WEAKNESSES:                                                                │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ • Secondary characters need development                             │   │
│  │ • Third act resolution feels convenient                             │   │
│  │ • Some dialogue too on-the-nose                                     │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [Save Score]  [Save Draft]  [Skip]                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AutoScore Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         AUTOSCORE PIPELINE                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  INPUT                     ANALYSIS                    OUTPUT               │
│  ─────                     ────────                    ──────               │
│                                                                              │
│  ┌──────────┐     ┌─────────────────────────────┐     ┌──────────┐         │
│  │  Script  │────▶│  1. Section Extraction      │────▶│ AutoScore│         │
│  │   Text   │     │     - Acts, scenes          │     │  Report  │         │
│  └──────────┘     │     - Dialogue vs action    │     └──────────┘         │
│                   │                             │                           │
│  ┌──────────┐     │  2. Pattern Matching        │     ┌──────────┐         │
│  │ Similar  │────▶│     - Similar sold scripts  │────▶│ Comps    │         │
│  │ Scripts  │     │     - Genre conventions     │     │ Analysis │         │
│  └──────────┘     │                             │     └──────────┘         │
│                   │  3. Rubric Evaluation       │                           │
│  ┌──────────┐     │     - Per-dimension LLM     │     ┌──────────┐         │
│  │ Training │────▶│     - Chain-of-thought      │────▶│ Confidence│        │
│  │   Data   │     │     - Calibrated scoring    │     │  Score   │         │
│  └──────────┘     │                             │     └──────────┘         │
│                   │  4. Market Analysis         │                           │
│                   │     - Current trends        │                           │
│                   │     - Budget estimation     │                           │
│                   └─────────────────────────────┘                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### AutoScore Prompt Strategy (Per Dimension)

```python
PREMISE_ORIGINALITY_PROMPT = """
You are evaluating the PREMISE ORIGINALITY of a screenplay.

REFERENCE COMPARISONS:
{similar_scripts_with_outcomes}

SCORING CRITERIA:
10 - Groundbreaking concept never seen before
8-9 - Fresh take on familiar territory with unique hook
6-7 - Solid concept with some original elements
4-5 - Familiar premise, execution-dependent
2-3 - Derivative, seen many times
1 - Complete retread with nothing new

SCRIPT LOGLINE:
{logline}

SCRIPT OPENING (first 10 pages):
{opening_pages}

Evaluate this script's premise originality. Consider:
1. Has this core concept been done before?
2. What's the unique angle or hook?
3. How does it compare to similar sold scripts?

Respond with:
- Score (1-10)
- Reasoning (2-3 sentences)
- Comparable scripts and how this differs
"""
```

### Calibration System

To ensure AI scores align with human judgment:

1. **Bootstrap Phase**: 100+ human-scored scripts as training set
2. **Calibration Tests**: Regular blind comparisons
3. **Correction Loop**: Human overrides feed back to model
4. **Confidence Scoring**: AI reports certainty level
5. **Ensemble Approach**: Multiple prompts averaged

### Phase 1 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Scoring rubric | 8-dimension framework with clear criteria |
| Human scoring UI | Web interface for structured evaluation |
| Scorer management | Multiple scorers, inter-rater reliability |
| AutoScore engine | LLM-based scoring with reasoning |
| Score comparison | Side-by-side human vs AI scores |
| Calibration dashboard | Track AI accuracy over time |
| API endpoints | Score submission, retrieval, comparison |

### Phase 1 Hours Estimate

| Task | Hours |
|------|-------|
| Rubric design & documentation | 6 |
| Human scoring UI | 16 |
| Scorer management system | 8 |
| AutoScore LLM pipeline | 20 |
| Prompt engineering (8 dimensions) | 12 |
| Calibration system | 10 |
| Score comparison UI | 8 |
| API development | 8 |
| Testing & refinement | 12 |
| **Total** | **100** |

---

## Phase 2: AutoEdit Engine

### Objective
Leverage AutoScore insights and corpus patterns to generate actionable editorial suggestions that improve both script quality and market viability.

### AutoEdit Capabilities

| Capability | Description |
|------------|-------------|
| **Section Rewrites** | AI-suggested alternatives for weak sections |
| **Dialogue Polish** | Character voice consistency, subtext enhancement |
| **Structure Notes** | Act break adjustments, pacing recommendations |
| **Character Arcs** | Deepening motivation, improving relatability |
| **Market Alignment** | Suggestions based on successful comparable scripts |
| **Format Cleanup** | Technical formatting corrections |

### Edit Suggestion Framework

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AUTOEDIT SUGGESTIONS: "Untitled Thriller"                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  OVERALL ASSESSMENT                                                         │
│  ─────────────────                                                          │
│  Current Score: 7.2 → Projected Score: 8.4 (if edits applied)              │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ HIGH IMPACT EDITS (3)                                               │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │                                                                      │   │
│  │ 1. CHARACTER DEPTH: Antagonist Motivation (pages 45-52)             │   │
│  │    Impact: +0.8 points                                              │   │
│  │    ┌───────────────────────────────────────────────────────────┐   │   │
│  │    │ CURRENT:                                                   │   │   │
│  │    │ "The killer's motivation is revealed as generic revenge    │   │   │
│  │    │  without specific personal stakes."                        │   │   │
│  │    ├───────────────────────────────────────────────────────────┤   │   │
│  │    │ SUGGESTED:                                                 │   │   │
│  │    │ "Connect the antagonist's actions to a specific trauma     │   │   │
│  │    │  that mirrors the protagonist's backstory, creating        │   │   │
│  │    │  thematic resonance. Consider: they were both failed by    │   │   │
│  │    │  the same institution."                                    │   │   │
│  │    ├───────────────────────────────────────────────────────────┤   │   │
│  │    │ COMPARABLE: In "Gone Girl" (sold, produced), the          │   │   │
│  │    │ antagonist's motivation is deeply personal and revealed   │   │   │
│  │    │ gradually, maintaining mystery while building empathy.    │   │   │
│  │    └───────────────────────────────────────────────────────────┘   │   │
│  │    [Apply Suggestion] [View Rewrite Options] [Dismiss]             │   │
│  │                                                                      │   │
│  │ 2. PLOT STRUCTURE: Third Act Pacing (pages 85-95)                   │   │
│  │    Impact: +0.5 points                                              │   │
│  │    ...                                                              │   │
│  │                                                                      │   │
│  │ 3. DIALOGUE: Protagonist Voice Consistency (throughout)             │   │
│  │    Impact: +0.3 points                                              │   │
│  │    ...                                                              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ MEDIUM IMPACT EDITS (5)                                             │   │
│  ├─────────────────────────────────────────────────────────────────────┤   │
│  │ • Scene 12: Trim exposition (pages 23-25)                           │   │
│  │ • Scene 18: Strengthen midpoint reversal                            │   │
│  │ • Scene 24: Add visual storytelling beat                            │   │
│  │ • Act 3: Foreshadow climax element earlier                          │   │
│  │ • Ending: Clarify thematic resolution                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  [Generate Full Edit Report]  [Export to PDF]  [Track Changes Mode]        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Rewrite Generation

For sections flagged as weak, AutoEdit can generate alternative versions:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REWRITE OPTIONS: Scene 12 - Exposition Trim                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ORIGINAL (pages 23-25):                                                    │
│  ───────────────────────                                                    │
│  [Scene shows detective explaining entire backstory through dialogue]       │
│                                                                              │
│  OPTION A: Visual Storytelling (Recommended)                                │
│  ───────────────────────────────────────────                                │
│  Replace dialogue exposition with:                                          │
│  - Detective discovers old newspaper clippings                              │
│  - Quick flashback montage (30 seconds screen time)                         │
│  - Single line of dialogue to anchor emotion                                │
│  Estimated page count: 1.5 pages (down from 3)                              │
│  [Preview Full Rewrite]                                                     │
│                                                                              │
│  OPTION B: Dialogue Compression                                             │
│  ─────────────────────────────                                              │
│  Keep dialogue format but:                                                  │
│  - Reduce to essential information only                                     │
│  - Add interruptions for natural rhythm                                     │
│  - Use subtext instead of direct statements                                 │
│  Estimated page count: 2 pages (down from 3)                                │
│  [Preview Full Rewrite]                                                     │
│                                                                              │
│  OPTION C: Scene Relocation                                                 │
│  ─────────────────────────                                                  │
│  Move exposition to:                                                        │
│  - Drip throughout Act 2 in smaller pieces                                  │
│  - Reveal during action sequences                                           │
│  - Let audience discover with protagonist                                   │
│  Estimated page count: 0 here, +1.5 distributed                             │
│  [Preview Scene Map]                                                        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Learning from Edit Acceptance

```sql
-- Track which suggestions are accepted/rejected
CREATE TABLE edit_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,
    auto_score_id UUID REFERENCES auto_scores(id),

    -- Suggestion details
    dimension TEXT NOT NULL,
    section_type TEXT, -- 'scene', 'dialogue', 'character', 'structure'
    page_start INT,
    page_end INT,

    -- The suggestion
    issue_description TEXT NOT NULL,
    suggestion_text TEXT NOT NULL,
    rewrite_options JSONB, -- [{option_id, text, rationale}]
    projected_impact DECIMAL(2,1), -- Expected score improvement

    -- User response
    status TEXT DEFAULT 'pending', -- 'pending', 'accepted', 'rejected', 'modified'
    user_feedback TEXT,
    accepted_option TEXT,

    -- Learning
    processed_for_training BOOLEAN DEFAULT FALSE,

    created_at TIMESTAMPTZ DEFAULT NOW(),
    responded_at TIMESTAMPTZ
);

-- Track score changes after edits
CREATE TABLE edit_outcomes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    script_id UUID REFERENCES scripts(id) ON DELETE CASCADE,

    -- Before/after comparison
    score_before DECIMAL(3,1),
    score_after DECIMAL(3,1),
    edits_applied INT,
    edits_rejected INT,

    -- Outcome tracking
    submission_result TEXT, -- 'request', 'pass', 'option', 'sale'

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Phase 2 Deliverables

| Deliverable | Description |
|-------------|-------------|
| Edit suggestion engine | AI-generated improvements per dimension |
| Rewrite generator | Multiple options for flagged sections |
| Impact projection | Predicted score improvement per edit |
| Track changes mode | View original vs suggested side-by-side |
| Edit acceptance tracking | Learn which suggestions work |
| Progress dashboard | Score trajectory over revisions |
| Export tools | PDF reports, track changes docs |

### Phase 2 Hours Estimate

| Task | Hours |
|------|-------|
| Edit suggestion framework | 16 |
| Rewrite generation prompts | 20 |
| Comparable script matching | 12 |
| Impact projection model | 10 |
| Track changes UI | 16 |
| Edit acceptance tracking | 8 |
| Progress dashboard | 10 |
| Export/reporting tools | 8 |
| Learning pipeline integration | 12 |
| Testing & refinement | 16 |
| **Total** | **128** |

---

## Technical Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STORY MAGIC INTELLIGENCE                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         FRONTEND (Next.js)                          │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │  Upload  │  │  Score   │  │  Edit    │  │  Admin   │            │   │
│  │  │   UI    │  │   UI     │  │   UI     │  │   UI     │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      API LAYER (FastAPI)                            │   │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐            │   │
│  │  │ Ingest   │  │ AutoScore│  │ AutoEdit │  │ Learning │            │   │
│  │  │ Service  │  │ Service  │  │ Service  │  │ Service  │            │   │
│  │  └──────────┘  └──────────┘  └──────────┘  └──────────┘            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                      │                                      │
│                    ┌─────────────────┼─────────────────┐                   │
│                    ▼                 ▼                 ▼                   │
│  ┌──────────────────────┐  ┌──────────────┐  ┌──────────────────────┐     │
│  │   PostgreSQL +       │  │    Redis     │  │    S3 / Supabase    │     │
│  │   pgvector           │  │    Cache     │  │    Storage          │     │
│  │                      │  │              │  │                      │     │
│  │  • Scripts           │  │  • Sessions  │  │  • PDFs             │     │
│  │  • Scores            │  │  • Rate limit│  │  • Reports          │     │
│  │  • Embeddings        │  │  • Job queue │  │  • Exports          │     │
│  │  • Outcomes          │  │              │  │                      │     │
│  └──────────────────────┘  └──────────────┘  └──────────────────────┘     │
│                                      │                                      │
│                                      ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                      LLM LAYER                                      │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │   │
│  │  │ OpenAI GPT-4 │  │ Claude 3     │  │ Embeddings   │              │   │
│  │  │ (Scoring)    │  │ (Rewrites)   │  │ (ada-002)    │              │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘              │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### API Endpoints

```
# Phase 0 - Corpus Management
POST   /api/scripts/upload          # Upload new script
GET    /api/scripts/{id}            # Get script details
GET    /api/scripts/search          # Vector similarity search
POST   /api/scripts/{id}/outcome    # Record outcome
GET    /api/corpus/stats            # Corpus statistics

# Phase 1 - Scoring
POST   /api/scores/human            # Submit human score
GET    /api/scores/human/{script}   # Get human scores
POST   /api/scores/auto             # Generate AutoScore
GET    /api/scores/auto/{script}    # Get AutoScore
GET    /api/scores/compare/{script} # Compare human vs AI
POST   /api/scores/correct          # Submit correction

# Phase 2 - Editing
POST   /api/edits/generate          # Generate edit suggestions
GET    /api/edits/{script}          # Get suggestions for script
POST   /api/edits/{id}/respond      # Accept/reject suggestion
POST   /api/edits/rewrite           # Generate rewrite options
GET    /api/edits/progress/{script} # Score trajectory
POST   /api/edits/export            # Export edit report
```

---

## Hours Summary

| Phase | Scope | Hours |
|-------|-------|-------|
| **Phase 0** | Vector DB & Learning Foundation | 56 |
| **Phase 1** | AutoScore System | 100 |
| **Phase 2** | AutoEdit Engine | 128 |
| **Total** | | **284** |

---

## Dependencies & Prerequisites

### Phase 0 Prerequisites
- Supabase project with pgvector extension enabled
- OpenAI API access (embeddings + GPT-4)
- Initial script corpus (minimum 50-100 scripts with known outcomes)

### Phase 1 Prerequisites
- Phase 0 complete
- 100+ human-scored scripts for calibration
- Defined rubric criteria (finalized with stakeholders)

### Phase 2 Prerequisites
- Phase 1 complete with calibrated AutoScore
- Sufficient correction data for pattern learning
- User feedback on edit suggestion quality

---

## Success Metrics

### Phase 0
- [ ] 100+ scripts ingested with embeddings
- [ ] Similarity search returns relevant comparables
- [ ] Outcome tracking captures sale/production data

### Phase 1
- [ ] Human scoring UI used by 3+ scorers
- [ ] AutoScore within ±1 point of human average (80% of time)
- [ ] Calibration improves over time with corrections

### Phase 2
- [ ] Edit suggestions accepted >50% of time
- [ ] Scripts with applied edits show score improvement
- [ ] User satisfaction with edit quality >4/5

---

## Risk Considerations

| Risk | Mitigation |
|------|------------|
| Insufficient training data | Partner with script coverage services for initial corpus |
| AI scoring bias | Multiple prompt approaches, human calibration loop |
| Over-reliance on AI | Position as tool to assist, not replace human judgment |
| IP concerns | Clear terms on script storage, optional deletion |
| Model drift | Regular calibration checks, version tracking |

---

## Next Steps

1. **Confirm scope and priorities** - Which phase to start with?
2. **Acquire initial corpus** - Source scripts with known outcomes
3. **Define rubric criteria** - Stakeholder alignment on scoring dimensions
4. **Technical setup** - Provision pgvector, API keys, infrastructure
5. **Begin Phase 0** - Database and ingestion pipeline
