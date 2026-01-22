# Story Magic Implementation Roadmap

**Version:** 1.0
**Date:** 2026-01-21
**Status:** Planning Complete, Ready for Implementation

---

## Document Index

| Document | Purpose | Hours |
|----------|---------|-------|
| [STORYSCORE_DESIGN.md](./STORYSCORE_DESIGN.md) | 12-dimension rubric, UI design, scoring criteria | 40 |
| [STORY_ADVISER_PLAN.md](./STORY_ADVISER_PLAN.md) | Inline suggestions, rewrites, revision tracking | 70 |
| [AUTOSCORE_PLAN.md](./AUTOSCORE_PLAN.md) | Original 8-dimension framework, learning system | 284 |
| [BIBLIOGRAPHY.md](./BIBLIOGRAPHY.md) | 50+ research sources, citations | - |

**Total Planned Hours:** 394 (includes overlap from AUTOSCORE_PLAN.md)

---

## Executive Summary

Transform Story Magic from an audio production tool into a comprehensive screenplay development platform with:

1. **StoryScore** - AI-powered 12-dimension script evaluation
2. **Story-Adviser** - Inline suggestions with smart rewrites
3. **Revision System** - Track improvement across drafts
4. **Learning Loop** - System improves from user feedback

---

## Implementation Phases

### Phase 0: Foundation (From AUTOSCORE_PLAN.md)
**Status:** Future
**Hours:** 56
**Purpose:** Build pgvector corpus for similarity search

| Deliverable | Description |
|-------------|-------------|
| pgvector schema | Script storage with embeddings |
| Ingestion pipeline | Upload → parse → embed → store |
| Similarity search | Find comparable scripts |
| Outcome tracking | Record sale/production status |

**Note:** Phase 0 can be deferred. StoryScore can work without corpus by using general LLM knowledge. Add corpus later for "comparable scripts" feature.

---

### Phase 1: StoryScore MVP
**Status:** Ready to Build
**Hours:** 40
**Depends On:** Nothing (can start immediately)

```
Week 1-2: StoryScore Implementation
├── Database schema (story_scores table)
├── LLM scoring pipeline (12 dimensions)
├── StoryScore React component
│   ├── Radar chart visualization
│   ├── Score cards (collapsed/expanded)
│   └── Strengths/weaknesses summary
├── Integration with project page
└── Score history view
```

#### Deliverables

| # | Deliverable | Hours | Priority |
|---|-------------|-------|----------|
| 1.1 | Database schema for scores | 4 | P0 |
| 1.2 | LLM scoring pipeline | 12 | P0 |
| 1.3 | StoryScore component (radar + cards) | 10 | P0 |
| 1.4 | Project page integration | 6 | P0 |
| 1.5 | Score history view | 4 | P1 |
| 1.6 | Testing & refinement | 4 | P0 |

#### Technical Stack

```typescript
// New files to create:
packages/web/
├── components/
│   └── storyscore/
│       ├── StoryScore.tsx          // Main component
│       ├── ScoreRadarChart.tsx     // Radar visualization
│       ├── ScoreCard.tsx           // Individual dimension card
│       ├── ScoreHistory.tsx        // Historical view
│       └── types.ts                // TypeScript interfaces
├── app/
│   └── api/
│       └── projects/
│           └── [id]/
│               └── score/
│                   └── route.ts    // Score generation endpoint
└── lib/
    └── scoring/
        ├── prompts.ts              // LLM prompt templates
        ├── dimensions.ts           // 12 dimension definitions
        └── calculate.ts            // Score calculation logic

packages/orchestrator/
└── src/
    └── scoring/                    // If scoring runs server-side
        ├── scorer.ts
        └── prompts.ts
```

#### Database Migration

```sql
-- 001_create_story_scores.sql
CREATE TABLE story_scores (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version INT DEFAULT 1,

    -- 12 dimensions
    premise_originality INT,
    logline_clarity INT,
    commercial_viability INT,
    three_act_integrity INT,
    pacing_momentum INT,
    stakes_escalation INT,
    protagonist_arc INT,
    supporting_cast INT,
    castability INT,
    dialogue_quality INT,
    visual_storytelling INT,
    technical_execution INT,

    -- Computed scores
    concept_score DECIMAL(3,1),
    structure_score DECIMAL(3,1),
    character_score DECIMAL(3,1),
    craft_score DECIMAL(3,1),
    overall_score DECIMAL(3,1),

    -- Rating
    rating TEXT,  -- 'RECOMMEND', 'CONSIDER', 'PASS'

    -- AI output
    reasoning JSONB,
    strengths TEXT[],
    weaknesses TEXT[],
    confidence DECIMAL(3,2),
    model_version TEXT,

    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_story_scores_project ON story_scores(project_id);
```

---

### Phase 2: Story-Adviser Core
**Status:** Ready to Build (after Phase 1)
**Hours:** 70
**Depends On:** Phase 1 (StoryScore)

```
Week 3-5: Story-Adviser Implementation
├── Phase 2A: Core Suggestions (30h)
│   ├── Suggestion data model
│   ├── Generation pipeline
│   ├── Editor integration (highlights)
│   └── Accept/reject workflow
├── Phase 2B: Rewrite Engine (20h)
│   ├── Rewrite generation prompts
│   ├── Multiple option UI
│   └── Before/after comparison
├── Phase 2C: Revision Tracking (10h)
│   ├── Revision data model
│   ├── Auto-save on changes
│   └── History UI
└── Phase 2D: Polish (10h)
    ├── Feedback collection
    ├── Rescore workflow
    └── Export reports
```

#### Deliverables

| # | Deliverable | Hours | Priority |
|---|-------------|-------|----------|
| 2.1 | Suggestion data model & API | 6 | P0 |
| 2.2 | Suggestion generation pipeline | 10 | P0 |
| 2.3 | Script editor with highlights | 8 | P0 |
| 2.4 | Accept/reject/modify workflow | 6 | P0 |
| 2.5 | Rewrite generation prompts | 8 | P0 |
| 2.6 | Multiple rewrite options UI | 4 | P1 |
| 2.7 | Before/after comparison view | 8 | P1 |
| 2.8 | Revision data model | 2 | P1 |
| 2.9 | Auto-save revisions | 3 | P1 |
| 2.10 | Revision history UI | 3 | P1 |
| 2.11 | Score trajectory chart | 2 | P2 |
| 2.12 | Feedback collection | 3 | P2 |
| 2.13 | Rescore workflow | 3 | P1 |
| 2.14 | Export reports | 2 | P2 |
| 2.15 | Testing & refinement | 2 | P0 |

#### New Components

```typescript
// New files for Phase 2:
packages/web/
├── components/
│   └── story-adviser/
│       ├── ScriptEditor.tsx        // Monaco/CodeMirror wrapper
│       ├── SuggestionPanel.tsx     // Inline suggestion UI
│       ├── RewriteOptions.tsx      // Multiple rewrite choices
│       ├── ComparisonView.tsx      // Before/after split
│       ├── RevisionHistory.tsx     // Version timeline
│       └── ScoreTrajectory.tsx     // Chart component
├── app/
│   └── api/
│       ├── projects/
│       │   └── [id]/
│       │       ├── suggestions/
│       │       │   └── route.ts    // Generate suggestions
│       │       ├── rescore/
│       │       │   └── route.ts    // Rescore after changes
│       │       └── revisions/
│       │           └── route.ts    // Revision management
│       └── suggestions/
│           └── [id]/
│               ├── respond/
│               │   └── route.ts    // Accept/reject
│               └── rewrite/
│                   └── route.ts    // Generate rewrites
└── lib/
    └── adviser/
        ├── suggestions.ts          // Suggestion generation
        ├── rewrites.ts             // Rewrite generation
        └── prompts.ts              // LLM prompts
```

---

### Phase 3: Advanced Features
**Status:** Future
**Hours:** 40
**Depends On:** Phase 2

```
Week 6-7: Polish & Advanced
├── Comparable scripts (requires corpus)
├── Diff view between versions
├── PDF report export
├── Genre-specific tuning
└── Performance optimization
```

---

## Technology Decisions

### Editor Choice

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Monaco Editor** | VS Code engine, excellent TypeScript | Heavy (5MB), overkill for scripts | Not recommended |
| **CodeMirror 6** | Modern, extensible, lighter | Learning curve | **Recommended** |
| **Textarea + Custom** | Simple, full control | Must build highlighting | For MVP only |
| **Slate.js** | Rich text, React-native | Complex for our needs | Not recommended |

**Decision:** Start with CodeMirror 6 for extensibility and performance.

### Chart Library

| Option | Pros | Cons | Recommendation |
|--------|------|------|----------------|
| **Recharts** | React-native, declarative | Limited radar chart | Good for trajectory |
| **Victory** | Flexible, good radar | Larger bundle | **Recommended** |
| **Chart.js** | Lightweight, full-featured | Imperative API | Fallback option |
| **D3** | Most flexible | Steep learning curve | Overkill |

**Decision:** Victory for radar charts, Recharts for line charts.

### LLM Provider

| Provider | Model | Use Case | Cost |
|----------|-------|----------|------|
| **OpenAI** | GPT-4 | Scoring (high accuracy needed) | $0.03/1K tokens |
| **OpenAI** | GPT-4o | Rewrites (faster, cheaper) | $0.005/1K tokens |
| **Anthropic** | Claude 3 | Alternative for rewrites | $0.015/1K tokens |

**Decision:** GPT-4 for scoring (accuracy critical), GPT-4o for rewrites (speed/cost).

---

## Risk Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| LLM scoring inconsistency | High | Medium | Multi-prompt ensemble, confidence scores |
| Editor performance with long scripts | Medium | Medium | Virtualization, lazy loading |
| User rejects all suggestions | Medium | Low | Learn from patterns, adjust prompts |
| Cost overruns (LLM API) | Medium | Medium | Caching, rate limiting, cheaper models for drafts |
| Scope creep | High | High | Strict phase boundaries, MVP first |

---

## Success Criteria

### Phase 1 (StoryScore)
- [ ] Score generated in < 60 seconds for 120-page script
- [ ] 12 dimensions scored with reasoning
- [ ] Radar chart renders correctly
- [ ] Score history shows progression
- [ ] User can understand why they got each score

### Phase 2 (Story-Adviser)
- [ ] 10+ suggestions generated per script
- [ ] Inline highlights visible in editor
- [ ] Accept/reject workflow functional
- [ ] 3 rewrite options per suggestion
- [ ] Revisions auto-saved
- [ ] Score improves after applying suggestions (validated)

### Overall
- [ ] User satisfaction > 4/5
- [ ] Suggestion acceptance rate > 40%
- [ ] Average score improvement > 0.5 points per session
- [ ] < 3% error rate in scoring pipeline

---

## Timeline Summary

| Phase | Duration | Start | End |
|-------|----------|-------|-----|
| Phase 1: StoryScore | 2 weeks | Week 1 | Week 2 |
| Phase 2A: Suggestions | 1.5 weeks | Week 3 | Week 4 |
| Phase 2B: Rewrites | 1 week | Week 4 | Week 5 |
| Phase 2C: Revisions | 0.5 weeks | Week 5 | Week 5 |
| Phase 2D: Polish | 0.5 weeks | Week 5 | Week 6 |
| Phase 3: Advanced | 1 week | Week 6 | Week 7 |

**Total:** 7 weeks (110 hours at ~16h/week)

---

## Next Actions

1. **Immediate:** Create database migration for story_scores table
2. **This Week:** Implement LLM scoring pipeline with 12 dimensions
3. **This Week:** Build StoryScore React component
4. **Next Week:** Integrate with project page, begin Phase 2

---

## Related Documents

- [STORYSCORE_DESIGN.md](./STORYSCORE_DESIGN.md) - Detailed rubric and UI specs
- [STORY_ADVISER_PLAN.md](./STORY_ADVISER_PLAN.md) - Suggestion system architecture
- [AUTOSCORE_PLAN.md](./AUTOSCORE_PLAN.md) - Original research and corpus plans
- [BIBLIOGRAPHY.md](./BIBLIOGRAPHY.md) - Research sources and citations
- [MVP_SAAS_PLAN.md](./MVP_SAAS_PLAN.md) - Overall product roadmap
