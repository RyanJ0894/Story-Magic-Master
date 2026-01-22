# Story-Adviser Implementation Plan

**Version:** 1.0
**Date:** 2026-01-21
**Depends On:** StoryScore (must be implemented first)

---

## Vision

Story-Adviser is an AI-powered writing assistant that helps screenwriters improve their scripts through:
1. **Inline Suggestions** - Contextual feedback directly in the editor
2. **Smart Rewrites** - Multiple AI-generated alternatives for weak passages
3. **Revision Tracking** - Score trajectory across drafts
4. **Learning Loop** - System improves from accepted/rejected suggestions

---

## User Journey

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         STORY-ADVISER USER FLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. UPLOAD SCRIPT                                                           │
│     ↓                                                                        │
│  2. GENERATE STORYSCORE (12 dimensions)                                     │
│     ↓                                                                        │
│  3. REVIEW OVERALL ASSESSMENT                                               │
│     ↓                                                                        │
│  4. CLICK "GET SUGGESTIONS" ON LOW-SCORING DIMENSIONS                       │
│     ↓                                                                        │
│  5. VIEW INLINE HIGHLIGHTS IN EDITOR                                        │
│     ↓                                                                        │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     FOR EACH SUGGESTION:                            │   │
│  │                                                                      │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐            │   │
│  │  │ OPTION A     │   │ OPTION B     │   │ OPTION C     │            │   │
│  │  │ AI REWRITE   │   │ PARTIAL FIX  │   │ SELF-EDIT    │            │   │
│  │  │ (Full)       │   │ (Targeted)   │   │ + Rescore    │            │   │
│  │  └──────────────┘   └──────────────┘   └──────────────┘            │   │
│  │         ↓                  ↓                  ↓                     │   │
│  │      [APPLY]           [APPLY]          [EDIT] → [RESCORE]         │   │
│  │         ↓                  ↓                  ↓                     │   │
│  │  ┌─────────────────────────────────────────────────────────────┐   │   │
│  │  │              COMPARE BEFORE/AFTER SCORES                    │   │   │
│  │  └─────────────────────────────────────────────────────────────┘   │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│     ↓                                                                        │
│  6. SAVE REVISION (Auto-tracked)                                            │
│     ↓                                                                        │
│  7. VIEW REVISION HISTORY & SCORE TRAJECTORY                                │
│     ↓                                                                        │
│  8. EXPORT REPORT OR CONTINUE EDITING                                       │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Suggestion Types

### 1. Highlight (Passive)

Visual marker showing potential issue without requiring action.

```typescript
interface Highlight {
  type: 'highlight';
  severity: 'info' | 'warning' | 'error';
  location: {
    pageStart: number;
    pageEnd: number;
    lineStart: number;
    lineEnd: number;
    text: string;
  };
  dimension: string;
  message: string;  // Hover tooltip
}
```

**Example:**
- Yellow highlight on dialogue
- Hover shows: "This line could benefit from more subtext"

### 2. Note (Informational)

Detailed feedback panel without automatic rewrite.

```typescript
interface Note {
  type: 'note';
  severity: 'low' | 'medium' | 'high';
  location: Location;
  dimension: string;
  title: string;
  explanation: string;
  examples?: string[];  // From comparable scripts
  resources?: string[];  // Links to learning materials
  actions: ['dismiss', 'request_rewrite', 'mark_resolved'];
}
```

**Example:**
- "The antagonist's motivation is revealed too late (page 78). Consider foreshadowing earlier."
- Includes examples from successful thrillers

### 3. Suggestion (Actionable)

Specific change with projected impact.

```typescript
interface Suggestion {
  type: 'suggestion';
  severity: 'low' | 'medium' | 'high';
  location: Location;
  dimension: string;
  issue: string;
  recommendation: string;
  projectedImpact: number;  // e.g., +0.5 points
  actions: ['accept', 'modify', 'dismiss'];
}
```

**Example:**
- "Cut lines 45-52 (exposition dump) and show through action instead"
- Projected impact: +0.3 to Dialogue Quality

### 4. Rewrite (AI-Generated)

Full alternative text with multiple options.

```typescript
interface Rewrite {
  type: 'rewrite';
  severity: 'medium' | 'high';
  location: Location;
  dimension: string;
  issue: string;
  originalText: string;
  options: RewriteOption[];
  actions: ['apply', 'edit', 'compare', 'dismiss'];
}

interface RewriteOption {
  id: string;
  label: string;  // "Visual Storytelling", "Dialogue Compression", etc.
  text: string;
  rationale: string;
  projectedImpact: number;
  isRecommended: boolean;
}
```

---

## Editor Integration

### Script Editor Component

```typescript
// components/script-editor/ScriptEditor.tsx

interface ScriptEditorProps {
  projectId: string;
  initialText: string;
  suggestions: Suggestion[];
  onTextChange: (text: string) => void;
  onSuggestionRespond: (id: string, action: string, data?: any) => void;
}

// Features:
// 1. Monaco Editor or CodeMirror base
// 2. Custom decorations for highlights
// 3. Inline suggestion panels
// 4. Split view for comparisons
// 5. Revision history sidebar
```

### Highlight Rendering

```typescript
// Decoration types by severity
const decorationStyles = {
  info: 'bg-blue-100 dark:bg-blue-900/30 border-b-2 border-blue-400',
  warning: 'bg-yellow-100 dark:bg-yellow-900/30 border-b-2 border-yellow-400',
  error: 'bg-red-100 dark:bg-red-900/30 border-b-2 border-red-400',
};

// Gutter icons
const gutterIcons = {
  dialogue: '💬',
  structure: '📐',
  character: '👤',
  visual: '🎬',
  pacing: '⏱️',
};
```

### Suggestion Panel Component

```tsx
// components/script-editor/SuggestionPanel.tsx

export function SuggestionPanel({ suggestion, onRespond }: Props) {
  return (
    <div className="suggestion-panel">
      <header>
        <Badge variant={severityVariant[suggestion.severity]}>
          {suggestion.dimension}
        </Badge>
        <span className="impact">+{suggestion.projectedImpact} pts</span>
      </header>

      <div className="issue">{suggestion.issue}</div>

      {suggestion.type === 'rewrite' && (
        <div className="rewrite-options">
          {suggestion.options.map(option => (
            <RewriteOption
              key={option.id}
              option={option}
              onSelect={() => onRespond(suggestion.id, 'apply', option.id)}
            />
          ))}
        </div>
      )}

      <div className="actions">
        <Button variant="ghost" onClick={() => onRespond(suggestion.id, 'dismiss')}>
          Dismiss
        </Button>
        <Button variant="outline" onClick={() => onRespond(suggestion.id, 'edit')}>
          Edit Myself
        </Button>
        {suggestion.options?.[0] && (
          <Button onClick={() => onRespond(suggestion.id, 'apply', suggestion.options[0].id)}>
            Apply Recommended
          </Button>
        )}
      </div>
    </div>
  );
}
```

---

## Rewrite Generation

### LLM Prompt for Rewrites

```python
REWRITE_PROMPT = """
You are an expert script doctor helping improve a screenplay passage.

CONTEXT:
- Script Title: {title}
- Genre: {genre}
- Current StoryScore: {overall_score}/10
- Dimension Being Improved: {dimension}
- Current Score for Dimension: {dimension_score}/10

ORIGINAL PASSAGE (pages {page_start}-{page_end}):
```
{original_text}
```

ISSUE IDENTIFIED:
{issue_description}

SURROUNDING CONTEXT:
- Before: {context_before}
- After: {context_after}

Generate 3 rewrite options, each taking a different approach:

OPTION A - {approach_a_name}:
- Approach: {approach_a_description}
- Target improvement: Show don't tell / Add subtext / Compress / etc.

OPTION B - {approach_b_name}:
- Approach: {approach_b_description}
- Keep more of the original structure

OPTION C - {approach_c_name}:
- Approach: {approach_c_description}
- Most conservative change

For each option provide:
1. The rewritten text (properly formatted as screenplay)
2. Brief rationale (1-2 sentences)
3. Estimated page count change
4. Which specific issues this addresses

Respond in JSON format:
{
  "options": [
    {
      "id": "a",
      "label": "Visual Storytelling",
      "text": "...",
      "rationale": "...",
      "pageCountChange": -1.5,
      "issuesAddressed": ["exposition_dump", "dialogue_heavy"]
    },
    ...
  ]
}
"""
```

### Rewrite Approaches by Dimension

| Dimension | Common Issues | Rewrite Approaches |
|-----------|---------------|-------------------|
| **Dialogue** | On-the-nose, all same voice | Subtext version, Character-specific, Compressed |
| **Visual** | Telling not showing | Action sequence, Montage, Environmental |
| **Structure** | Pacing lag, weak beat | Scene trim, Beat enhancement, Relocation |
| **Character** | Thin motivation, flat arc | Backstory integration, Want/need clarity, Conflict addition |
| **Stakes** | Low tension | Ticking clock, Personal cost, Escalation |

---

## Before/After Comparison

### Score Comparison UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  COMPARE: Scene 12 (Pages 23-25)                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────────────────────┐  ┌─────────────────────────────┐          │
│  │ ORIGINAL                    │  │ REWRITTEN                   │          │
│  ├─────────────────────────────┤  ├─────────────────────────────┤          │
│  │                             │  │                             │          │
│  │ DETECTIVE HARRIS            │  │ INT. DETECTIVE'S OFFICE     │          │
│  │ I need to tell you about    │  │                             │          │
│  │ what happened twenty years  │  │ Harris opens a drawer.      │          │
│  │ ago. My father was a cop    │  │ Yellowed newspaper clippings.│         │
│  │ in this precinct. He was    │  │ A badge. A faded photo.     │          │
│  │ investigating a case that   │  │                             │          │
│  │ got him killed. That case   │  │ His hand trembles.          │          │
│  │ is connected to what's      │  │                             │          │
│  │ happening now...            │  │        HARRIS               │          │
│  │                             │  │   (barely audible)          │          │
│  │ [continues for 2 more       │  │ Some cases don't close.     │          │
│  │  pages of exposition]       │  │                             │          │
│  │                             │  │                             │          │
│  └─────────────────────────────┘  └─────────────────────────────┘          │
│                                                                              │
│  SCORE IMPACT                                                               │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  Dialogue Quality:      6 → 8  (+2.0)  ████████████████░░░░                 │
│  Visual Storytelling:   5 → 8  (+3.0)  ████████████████░░░░                 │
│  Pacing:                6 → 8  (+2.0)  ████████████████░░░░                 │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Page Count:            3 → 1.5 (-1.5 pages saved)                          │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Projected Overall:     6.8 → 7.4  (+0.6)                                   │
│                                                                              │
│  [Keep Original]  [Apply Rewrite]  [Edit Rewrite]                           │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Diff View

```typescript
// Use diff-match-patch or similar for word-level diff
import { diffWords } from 'diff';

function renderDiff(original: string, rewritten: string) {
  const changes = diffWords(original, rewritten);
  return changes.map((part, i) => (
    <span
      key={i}
      className={
        part.added ? 'bg-green-200 dark:bg-green-900' :
        part.removed ? 'bg-red-200 dark:bg-red-900 line-through' :
        ''
      }
    >
      {part.value}
    </span>
  ));
}
```

---

## Revision Tracking

### Data Model

```sql
-- Revision snapshots
CREATE TABLE story_revisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    version INT NOT NULL,

    -- Full script at this point
    script_text TEXT NOT NULL,
    script_hash TEXT NOT NULL,  -- For deduplication

    -- Associated score
    story_score_id UUID REFERENCES story_scores(id),

    -- Change summary
    changes_summary TEXT,
    suggestions_applied INT DEFAULT 0,
    suggestions_rejected INT DEFAULT 0,
    manual_edits INT DEFAULT 0,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    created_by UUID REFERENCES auth.users(id)
);

-- Individual changes within a revision
CREATE TABLE revision_changes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    revision_id UUID REFERENCES story_revisions(id) ON DELETE CASCADE,

    -- What changed
    change_type TEXT NOT NULL,  -- 'suggestion_applied', 'suggestion_rejected', 'manual_edit'
    suggestion_id UUID REFERENCES story_suggestions(id),

    -- Location
    page_start INT,
    page_end INT,

    -- Content
    original_text TEXT,
    new_text TEXT,

    -- Impact
    dimension_affected TEXT,
    score_before DECIMAL(3,1),
    score_after DECIMAL(3,1),

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Revision Timeline UI

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  REVISION HISTORY: "Untitled Thriller"                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  SCORE TRAJECTORY                                                           │
│  10 ┤                                                                       │
│   9 ┤                                          ┌─────── Target: 8.5         │
│   8 ┤                               ●──────────┤                            │
│   7 ┤                    ●─────────●           │  ● v4 (7.4)               │
│   6 ┤         ●─────────●                      │                            │
│   5 ┤────────●                                 │                            │
│   4 ┤                                          │                            │
│     └─────────────────────────────────────────────────────────────────────  │
│       v1      v2        v3         v4         v5 (goal)                     │
│                                                                              │
│  VERSION DETAILS                                                            │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                              │
│  ▼ v4 - Current (Jan 21, 2026)                           Score: 7.4        │
│    └─ Applied 3 suggestions (+0.2)                                          │
│       • Dialogue: Scene 12 rewrite (Visual Storytelling)                    │
│       • Character: Antagonist motivation (page 48)                          │
│       • Pacing: Cut scenes 8-9 transition                                   │
│                                                                              │
│  ► v3 (Jan 20, 2026)                                     Score: 7.2        │
│  ► v2 (Jan 18, 2026)                                     Score: 6.8        │
│  ► v1 (Jan 15, 2026)                                     Score: 6.2        │
│                                                                              │
│  [Compare Versions]  [Restore Version]  [Export History]                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## API Endpoints

### Suggestion Generation

```typescript
// POST /api/projects/{id}/suggestions
// Generate suggestions for a project based on its StoryScore

interface GenerateSuggestionsRequest {
  focusDimensions?: string[];  // Optional: focus on specific weak areas
  maxSuggestions?: number;     // Default: 10
  severityThreshold?: 'low' | 'medium' | 'high';  // Default: 'low'
}

interface GenerateSuggestionsResponse {
  suggestions: Suggestion[];
  summary: {
    totalIssues: number;
    byDimension: Record<string, number>;
    projectedImpact: number;  // If all applied
  };
}
```

### Suggestion Response

```typescript
// POST /api/suggestions/{id}/respond

interface SuggestionResponseRequest {
  action: 'accept' | 'reject' | 'modify' | 'dismiss';
  selectedOptionId?: string;  // For rewrites
  modifiedText?: string;      // If user edited
  feedback?: string;          // Optional feedback for learning
}

interface SuggestionResponseResponse {
  success: boolean;
  newScore?: StoryScore;  // If script was modified
  nextSuggestion?: Suggestion;  // Auto-advance to next
}
```

### Rewrite Generation

```typescript
// POST /api/suggestions/{id}/rewrite
// Generate additional rewrite options for a suggestion

interface GenerateRewriteRequest {
  approach?: string;  // Specific approach to try
  constraints?: {
    maxPageChange?: number;
    preserveDialogue?: boolean;
    preserveCharacters?: boolean;
  };
}

interface GenerateRewriteResponse {
  options: RewriteOption[];
}
```

### Rescore

```typescript
// POST /api/projects/{id}/rescore
// Rescore after user makes manual edits

interface RescoreRequest {
  newScriptText: string;
  changeDescription?: string;
}

interface RescoreResponse {
  previousScore: StoryScore;
  newScore: StoryScore;
  delta: Record<string, number>;  // Change per dimension
  revision: StoryRevision;  // Auto-saved revision
}
```

---

## Learning System

### Feedback Collection

```sql
-- Track what works and what doesn't
CREATE TABLE suggestion_feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    suggestion_id UUID REFERENCES story_suggestions(id),

    -- User action
    action TEXT NOT NULL,  -- 'accepted', 'rejected', 'modified'
    selected_option_id TEXT,

    -- If modified, what did user change?
    user_modifications TEXT,

    -- Explicit feedback
    rating INT CHECK (rating BETWEEN 1 AND 5),
    feedback_text TEXT,

    -- Outcome tracking
    score_before DECIMAL(3,1),
    score_after DECIMAL(3,1),
    actual_impact DECIMAL(2,1),  -- Actual vs projected

    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Model Improvement Loop

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         LEARNING LOOP                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  1. COLLECT                                                                 │
│     • Track accept/reject rates by suggestion type                          │
│     • Record user modifications to AI rewrites                              │
│     • Measure actual vs projected score impact                              │
│                                                                              │
│  2. ANALYZE                                                                 │
│     • Which suggestion types have highest acceptance?                       │
│     • Which rewrite approaches work best per dimension?                     │
│     • What patterns in user modifications?                                  │
│                                                                              │
│  3. IMPROVE                                                                 │
│     • Adjust prompt templates based on acceptance rates                     │
│     • Weight rewrite approaches by success                                  │
│     • Fine-tune issue detection thresholds                                  │
│                                                                              │
│  4. VALIDATE                                                                │
│     • A/B test new prompts vs baseline                                      │
│     • Track score improvement trajectories                                  │
│     • Monitor user satisfaction metrics                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Phases

### Phase 2A: Core Suggestions (30 hours)

| Task | Hours |
|------|-------|
| Suggestion data model & API | 6 |
| Suggestion generation pipeline | 10 |
| Basic editor integration | 8 |
| Accept/reject workflow | 6 |

### Phase 2B: Rewrite Engine (20 hours)

| Task | Hours |
|------|-------|
| Rewrite generation prompts | 8 |
| Multiple option generation | 4 |
| Before/after comparison UI | 8 |

### Phase 2C: Revision Tracking (10 hours)

| Task | Hours |
|------|-------|
| Revision data model | 2 |
| Auto-save on changes | 3 |
| Revision history UI | 3 |
| Score trajectory chart | 2 |

### Phase 2D: Polish & Learning (10 hours)

| Task | Hours |
|------|-------|
| Feedback collection | 3 |
| Rescore workflow | 3 |
| Export reports | 2 |
| Testing & refinement | 2 |

**Total Phase 2: 70 hours**

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Suggestion acceptance rate | > 40% | Accepted / (Accepted + Rejected) |
| Rewrite preference | Option A > 50% | When recommended is chosen |
| Score improvement | > 0.5 pts / session | Average delta after suggestions |
| User satisfaction | > 4.0 / 5 | Post-session survey |
| Time to 8.0 score | < 5 revisions | From initial upload |
| Return usage | > 60% | Users who return after first session |

---

## Future Enhancements

### v2 Features
- Real-time collaboration (multiple editors)
- Genre-specific suggestion tuning
- Comparable scripts panel ("scripts like yours that sold")
- Voice consistency checker across full script
- Beat sheet overlay visualization

### v3 Features
- Integration with Final Draft / Highland export
- Pitch deck generation from high-scoring scripts
- Agent/manager submission tracking
- Contest submission recommendations
- Writing coach chat interface

---

## Dependencies

| Dependency | Purpose | Phase |
|------------|---------|-------|
| StoryScore | Must have scores before suggestions | Required |
| Monaco Editor or CodeMirror | Script editor base | Phase 2A |
| diff-match-patch | Text comparison | Phase 2B |
| Recharts or Victory | Score trajectory charts | Phase 2C |
| OpenAI GPT-4 | Rewrite generation | Phase 2B |
