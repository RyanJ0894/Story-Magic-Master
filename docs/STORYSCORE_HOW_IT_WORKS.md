# StoryScore: How It Works

**Audience:** Product & Business
**Last Updated:** March 2026

---

## What Is StoryScore?

StoryScore is Story Magic's AI-powered screenplay evaluation engine. It reads a full script and produces a structured, multi-dimensional score — the same kind of assessment a professional Hollywood script reader would write, but delivered in seconds rather than days.

Every script a user uploads receives a StoryScore. The score tells the writer not just *how good* their script is, but *where* it's strong, *where* it needs work, and *why* — backed by specific references to scenes, characters, and pages.

The score is not a marketing feature. It is the core intelligence product that differentiates Story Magic from every other audio production tool on the market.

---

## Part 1: The Scoring Framework

### Four Pillars, Twelve Dimensions

Hollywood script coverage has always organized feedback into craft categories. StoryScore formalizes this into four pillars, each worth exactly 25% of the total score. Every pillar contains three dimensions. Every dimension is scored 1–10.

```mermaid
graph TD
    SS["StoryScore<br/>Overall Score (1–10)"]

    SS --> C["Concept<br/>25%"]
    SS --> ST["Structure<br/>25%"]
    SS --> CH["Character<br/>25%"]
    SS --> CR["Craft<br/>25%"]

    C --> C1["Premise Originality<br/>10%"]
    C --> C2["Logline Clarity<br/>8%"]
    C --> C3["Commercial Viability<br/>7%"]

    ST --> ST1["Three-Act Integrity<br/>10%"]
    ST --> ST2["Pacing & Momentum<br/>8%"]
    ST --> ST3["Stakes & Escalation<br/>7%"]

    CH --> CH1["Protagonist Arc<br/>10%"]
    CH --> CH2["Supporting Cast<br/>8%"]
    CH --> CH3["Castability<br/>7%"]

    CR --> CR1["Dialogue Quality<br/>10%"]
    CR --> CR2["Visual Storytelling<br/>8%"]
    CR --> CR3["Technical Execution<br/>7%"]

    style SS fill:#7c3aed,color:#fff
    style C fill:#4f46e5,color:#fff
    style ST fill:#4f46e5,color:#fff
    style CH fill:#4f46e5,color:#fff
    style CR fill:#4f46e5,color:#fff
```

Within each pillar, the three dimensions are weighted slightly differently — the most impactful dimension carries 40% of the pillar weight, the second 32%, and the third 28%. This reflects real industry consensus: originality matters more than logline polish, structure integrity matters more than pacing tightening.

### What Each Dimension Measures

| Pillar | Dimension | What the AI is looking for |
|--------|-----------|---------------------------|
| **Concept** | Premise Originality | Is this story genuinely fresh, or a retread? Would a studio exec say "I've never seen this before"? |
| | Logline Clarity | Can the entire movie be pitched in one sentence? Is the protagonist, goal, and obstacle immediately clear? |
| | Commercial Viability | Who is the audience? How large is it? What comparable films succeeded? Is there franchise potential? |
| **Structure** | Three-Act Integrity | Do the turning points land? Does Act 2 have a strong midpoint? Does the climax feel earned? |
| | Pacing & Momentum | Does every scene earn its place? Does the reader want to turn the page? Are there slow patches? |
| | Stakes & Escalation | Do the consequences grow? Is the clock ticking? Does the protagonist have something real to lose? |
| **Character** | Protagonist Arc | Does the lead have a clear want and need? Do they change? Is there an internal and external journey? |
| | Supporting Cast | Is the antagonist three-dimensional? Do supporting characters have their own agendas? |
| | Castability | Are these roles actors would fight for? Are there scenes that could win awards? |
| **Craft** | Dialogue Quality | Does each character have a distinct voice? Is there subtext? Are there lines the audience will remember? |
| | Visual Storytelling | Does the script show rather than tell? Are there cinematic moments? Is the action writing vivid? |
| | Technical Execution | Is the formatting correct? Are scene headings consistent? Is it easy to read? |

### The Rating Scale

The overall score maps to a professional coverage rating — the same language a studio reader would use in a coverage report:

| Score | Rating | What it means |
|-------|--------|---------------|
| 9.0–10.0 | **Strong Recommend** | Exceptional script, pursue immediately |
| 8.0–8.9 | **Recommend** | Above market standard, production-ready |
| 7.0–7.9 | **Consider** | Strong elements, needs focused development |
| 6.0–6.9 | **Consider with Reservations** | Promising but significant work needed |
| 4.0–5.9 | **Pass** | Fundamental issues in one or more pillars |
| 1.0–3.9 | **Strong Pass** | Does not meet production standards |

---

## Part 2: How a Score Is Generated

### The Journey from Upload to Score

When a user submits a script for scoring, the following process runs in sequence:

```mermaid
sequenceDiagram
    participant U as User
    participant W as Web App
    participant DB as Database
    participant AI as Claude Sonnet 4.6

    U->>W: Upload script (PDF/DOCX)
    W->>W: Extract plain text
    W->>DB: Query calibration anchors
    DB-->>W: High / Mid / Low example scores
    W->>AI: Script text + rubric + calibration examples
    Note over AI: Reads full script (up to 120 pages)<br/>200,000 token context window
    AI-->>W: JSON: 12 dimension scores + reasoning
    W->>W: Calculate category scores & overall score
    W->>DB: Save StoryScore record
    W-->>U: Display score + detailed feedback
```

### Step 1: Text Extraction

The script arrives as a PDF or Word document. The system strips all formatting and extracts clean plain text — scene headings, action lines, character names, and dialogue. This is the raw material the AI will read.

### Step 2: The Evaluation Prompt

The AI is given a carefully engineered instruction set that includes:

1. **Role framing** — The AI is positioned as a senior development executive with 20+ years of reading scripts for major studios.

2. **The scoring rubric** — Detailed 1–10 criteria for every dimension, with evaluation questions. For example, for Premise Originality, the rubric distinguishes between a 7 ("good concept with some original elements") and a 10 ("groundbreaking concept, genre-defining potential").

3. **Calibration anchors** — Three concrete examples pulled from Story Magic's training corpus showing what a 9/10, a 7/10, and a 3/10 actually look like (more on this in Part 3).

4. **The script** — The full text of the screenplay.

### Step 3: AI Evaluation

The AI reads the entire script — up to 120 pages — in a single pass. No chunking, no summarization. The AI's response is a structured JSON document containing a score and a specific 2–3 sentence reasoning for each of the 12 dimensions, plus a list of three concrete strengths and three specific, actionable weaknesses.

The AI is explicitly instructed to use the **full scoring range** — not to cluster everything around 6–7. This instruction is reinforced by the calibration examples.

### Step 4: Score Calculation

The 12 dimension scores are combined mathematically to produce four pillar scores (concept, structure, character, craft), which are then averaged equally to produce the overall score. The calculation is deterministic — the same dimension scores always produce the same overall score.

### Step 5: Storage and Display

The full score is saved to the database — every dimension, every reasoning text, the overall score, the rating, and which AI model version produced it. This creates a permanent version history. If the writer revises their script and scores again, they can see exactly which dimensions improved and by how much.

---

## Part 3: How StoryScore Is Trained

### The Calibration Problem

Left to its own devices, a large language model will score most scripts in the 5–8 range. It is conservative, avoids extremes, and clusters around "acceptable." This is useless. A system where Parasite and Battlefield Earth both score 6.5 provides no signal.

The solution is **calibration** — showing the AI what a 9, a 6, and a 3 actually look like, using real scripts the entire industry agrees on.

### The Training Corpus

Story Magic maintains a curated corpus of 43 professional screenplays spanning the full quality spectrum. These scripts are organized into five categories:

```mermaid
graph LR
    CORPUS["Training Corpus<br/>43 Scripts"]

    CORPUS --> OW["🏆 Oscar Winners<br/>16 scripts<br/><i>Parasite, Moonlight,<br/>The Social Network...</i>"]
    CORPUS --> BL["📋 Black List<br/>6 scripts<br/><i>Hell or High Water,<br/>Nightcrawler...</i>"]
    CORPUS --> PB["🎬 Produced Benchmark<br/>15 scripts<br/><i>The Matrix, Die Hard,<br/>Pulp Fiction...</i>"]
    CORPUS --> WF["💀 Weak Films<br/>5 scripts<br/><i>Battlefield Earth,<br/>Batman & Robin...</i>"]
    CORPUS --> TV["📺 TV Benchmark<br/>8 pilots<br/><i>Breaking Bad, Sopranos,<br/>Lost, Game of Thrones...</i>"]

    style OW fill:#ca8a04,color:#fff
    style BL fill:#2563eb,color:#fff
    style PB fill:#16a34a,color:#fff
    style WF fill:#dc2626,color:#fff
    style TV fill:#7c3aed,color:#fff
```

These categories were chosen deliberately. Oscar Winners define the ceiling. Weak Films define the floor. Produced Benchmarks establish what "market standard" looks like across a range of budgets and genres. The Black List covers acclaimed scripts that prove logline and voice can carry a low score elsewhere. TV Benchmarks establish that pilots are scored differently from features — a 50-page pilot is not an unfinished feature film.

### The Full Corpus Library

The 43 scripts in the current training corpus:

| # | Title | Category |
|---|-------|----------|
| 1 | Parasite | Oscar Winner |
| 2 | Moonlight | Oscar Winner |
| 3 | The Social Network | Oscar Winner |
| 4 | Spotlight | Oscar Winner |
| 5 | Whiplash | Oscar Winner |
| 6 | Get Out | Oscar Winner |
| 7 | American Beauty | Oscar Winner |
| 8 | Birdman | Oscar Winner |
| 9 | The Departed | Oscar Winner |
| 10 | Juno | Oscar Winner |
| 11 | Little Miss Sunshine | Oscar Winner |
| 12 | Argo | Oscar Winner |
| 13 | CODA | Oscar Winner |
| 14 | Manchester by the Sea | Oscar Winner |
| 15 | Marriage Story | Oscar Winner |
| 16 | The Big Short | Oscar Winner |
| 17 | Hell or High Water | Black List |
| 18 | Nightcrawler | Black List |
| 19 | Prisoners | Black List |
| 20 | The Founder | Black List |
| 21 | The Martian | Black List |
| 22 | Passengers | Black List |
| 23 | The Matrix | Produced Benchmark |
| 24 | Die Hard | Produced Benchmark |
| 25 | Jurassic Park | Produced Benchmark |
| 26 | Alien | Produced Benchmark |
| 27 | Terminator 2 | Produced Benchmark |
| 28 | Pulp Fiction | Produced Benchmark |
| 29 | Good Will Hunting | Produced Benchmark |
| 30 | Inception | Produced Benchmark |
| 31 | Raiders of the Lost Ark | Produced Benchmark |
| 32 | Memento | Produced Benchmark |
| 33 | John Wick | Produced Benchmark |
| 34 | Mad Max: Fury Road | Produced Benchmark |
| 35 | The Big Lebowski | Produced Benchmark |
| 36 | The Martian | Produced Benchmark |
| 37 | Argo | Produced Benchmark |
| 38 | Battlefield Earth | Weak Film |
| 39 | Batman and Robin | Weak Film |
| 40 | Breaking Bad (Pilot) | TV Benchmark |
| 41 | The Sopranos (Pilot) | TV Benchmark |
| 42 | Lost (Pilot) | TV Benchmark |
| 43 | Game of Thrones (Pilot) | TV Benchmark |
| — | + Stranger Things, The Office, others | TV Benchmark |

### Structural Metrics Extraction

Before a script can serve as a calibration example, the system extracts measurable structural data from its text. This is the difference between vague impressions and quantified evidence.

```mermaid
flowchart LR
    PDF["PDF Script"] --> EX["Text Extractor"]
    XLS["Excel Dataset<br/>(manual labels)"] --> MERGE["Merge Layer"]
    EX --> METRICS["Metric Calculator"]

    METRICS --> SC["Scene Count<br/><i>INT./EXT. headings counted</i>"]
    METRICS --> DP["Dialogue %<br/><i>% of lines in dialogue blocks</i>"]
    METRICS --> PC["Page Count<br/><i>total lines ÷ 55</i>"]
    METRICS --> AB["Act Break Pages<br/><i>25% and 75% heuristic</i>"]
    METRICS --> CD["Conflict Density<br/><i>fight/chase keywords per 10 pages</i>"]

    SC --> MERGE
    DP --> MERGE
    PC --> MERGE
    AB --> MERGE
    CD --> MERGE

    MERGE --> DB[("script_corpus<br/>table")]

    style DB fill:#1e1b4b,color:#fff
```

Five metrics are computed automatically from the screenplay text:

- **Scene Count** — the number of INT./EXT. scene headings. High-count scripts tend toward fast-cutting action; low-count scripts suggest longer, dialogue-driven scenes.
- **Dialogue Percentage** — the proportion of lines that are spoken dialogue versus action description. Oscar-caliber dramas often run 55–70%; lean thrillers can drop to 35%.
- **Page Count** — estimated from line count. A standard screenplay runs 90–120 pages; a TV pilot runs 45–65.
- **Act Break Pages** — where the act transitions fall relative to total pages. Strong three-act scripts break at roughly page 25 and page 75 (out of 100).
- **Conflict Density** — how many conflict-indicating words (fights, chases, threats, explosions) appear per 10 pages. Action films score higher; quiet character dramas lower. Neither is better — but the metric reveals whether the script's genre promise is fulfilled.

If manual values exist in the training spreadsheet (e.g., a script analyst already identified the exact Act 2 break), those override the computed values.

### Scoring the Corpus

Once all 43 scripts are ingested with their structural metrics, each one is run through the full StoryScore evaluation using a cost-efficient AI model (Gemini 2.0 Flash). This produces 43 complete scores — all 12 dimensions, all reasoning, all category breakdowns.

The result is a calibration table: Story Magic knows definitively that Parasite scores a 9.2, that Battlefield Earth scores a 2.8, and that Die Hard scores a 7.6. These are not guesses. They are calculated scores from a model reading the actual screenplay text.

### Validating Calibration Health

After corpus scoring runs, the system generates a calibration health report. The key metric is **spread** — the difference between the average Oscar Winner score and the average Weak Film score.

```mermaid
xychart-beta
    title "Target Score Distribution by Category"
    x-axis ["Weak Film", "Produced Benchmark", "Black List", "TV Benchmark", "Oscar Winner"]
    y-axis "Average Score (1-10)" 0 --> 10
    bar [3.2, 6.8, 7.6, 7.2, 8.9]
```

A spread of 2.5 or more is considered healthy. This means the model is genuinely discriminating between quality levels. A spread below 1.5 is a warning sign — the model is clustering and the corpus should be re-scored with a stronger model or reviewed for data quality issues.

---

## Part 4: How StoryScore Keeps Learning

### The Few-Shot Feedback Loop

StoryScore does not require retraining the AI model to improve. Instead, it uses a technique called **few-shot prompting** — providing the model with concrete examples at inference time that anchor its scoring behavior.

The calibration corpus is those examples. Every time a user's script is scored, the system pulls the three most useful anchors from the corpus and injects them directly into the AI's instructions:

```mermaid
flowchart TD
    A["User submits script for scoring"] --> B["System queries calibration corpus"]

    B --> H["HIGH ANCHOR<br/>Best Oscar Winner in corpus<br/><i>e.g., Parasite — 9.2/10</i>"]
    B --> M["MID ANCHOR<br/>Lowest Produced Benchmark<br/><i>e.g., John Wick — 6.9/10</i>"]
    B --> L["LOW ANCHOR<br/>Lowest Weak Film<br/><i>e.g., Battlefield Earth — 2.8/10</i>"]

    H --> P["Scoring Prompt Assembly"]
    M --> P
    L --> P

    P --> AI["Claude Sonnet 4.6<br/>reads script with calibration context"]
    AI --> S["Score output:<br/>all 12 dimensions, reasoning,<br/>strengths, weaknesses"]

    style H fill:#ca8a04,color:#fff
    style M fill:#16a34a,color:#fff
    style L fill:#dc2626,color:#fff
    style AI fill:#7c3aed,color:#fff
```

The anchors tell the AI: *"Here is what a 9 looks like. Here is what a 7 looks like. Here is what a 3 looks like. Now score this script."* This is the same way a human reader calibrates — they have a mental library of reference scripts. Story Magic simply makes that library explicit and consistent.

### Why This Architecture Beats Retraining

Traditional ML systems improve by retraining on new labeled data. This is expensive, slow (weeks of compute time), and requires annotated examples. StoryScore improves differently:

| | Traditional ML Retraining | StoryScore Few-Shot Calibration |
|--|--------------------------|----------------------------------|
| **Improvement cycle** | Weeks | Immediate |
| **Cost per improvement** | High (GPU compute) | Near-zero |
| **Transparency** | Black box | Every anchor is a readable script |
| **Rollback** | Complex | Remove one row from corpus |
| **Domain expertise required** | ML engineer | Script analyst |

Improvements to StoryScore follow this cycle:

```mermaid
flowchart LR
    OB["Observation<br/><i>Score feels wrong<br/>for a genre or style</i>"] --> AN["Analysis<br/><i>Review calibration<br/>report in admin panel</i>"]
    AN --> FIX["Fix<br/><i>Add representative<br/>script to corpus OR<br/>adjust rubric text</i>"]
    FIX --> RS["Re-score corpus<br/><i>pnpm score:corpus</i>"]
    RS --> VER["Verify<br/><i>Check spread and<br/>category averages</i>"]
    VER --> LIVE["Live<br/><i>Next user scoring call<br/>uses updated anchors</i>"]
    LIVE --> OB

    style FIX fill:#7c3aed,color:#fff
    style LIVE fill:#16a34a,color:#fff
```

### Three Ways StoryScore Gets Smarter

**1. Expanding the Corpus**

The current corpus of 43 scripts covers Hollywood's middle tier well but has thin coverage at the extremes. Adding more Weak Films (horror sequels, critically-panned studio films) and more international Oscar nominees will give the anchors finer granularity — the difference between a 2 and a 4, or between an 8 and a 9, will become clearer.

```mermaid
flowchart TD
    NOW["Current State<br/>43 scripts, 5 categories"]
    NEXT["Phase 2<br/>100+ scripts, add subgenres<br/><i>Sci-fi corpus, Horror corpus,<br/>Indie Drama corpus</i>"]
    FUTURE["Phase 3<br/>500+ scripts, genre-specific<br/>calibration anchors<br/><i>Different anchors for Action<br/>vs. Drama vs. Thriller</i>"]

    NOW --> NEXT --> FUTURE
```

**2. Genre-Specific Anchoring**

A slow-burn drama and a summer blockbuster should not be scored against the same anchors. Moonlight's pacing is intentionally unhurried — scoring it against Die Hard's momentum norms is unfair.

The roadmap includes genre-specific calibration: when the AI identifies a script as "indie drama," it selects anchors from the drama subset of the corpus. When it identifies "action thriller," it selects from the action subset. This will dramatically improve scoring accuracy for genre-specific conventions.

**3. Rubric Refinement**

The 12 scoring rubrics are written text. They can be updated by a script analyst without touching any code. If user feedback consistently shows that the Castability dimension is being interpreted too narrowly, the rubric text is updated and the corpus is re-scored. The improvement is live immediately.

---

## Part 5: The Admin Dashboard

Product and operations teams can monitor the health of StoryScore's calibration at any time through the admin corpus panel at `/admin/corpus`.

```mermaid
graph TD
    DASH["Admin Corpus Dashboard"]

    DASH --> STATS["Coverage Stats<br/><i>43 scripts / 43 scored = 100%<br/>Calibration spread: 6.1</i>"]
    DASH --> DIST["Score Distribution Chart<br/><i>Bar chart: avg score by category</i>"]
    DASH --> TABLE["Full Corpus Table<br/><i>Every script: title, category,<br/>all 5 scores, page count, model</i>"]

    STATS --> HEALTH{"Spread ≥ 2.5?"}
    HEALTH -- Yes --> GREEN["✓ Healthy"]
    HEALTH -- No --> WARN["⚠ Re-score needed"]
```

The dashboard surfaces three signals:

- **Coverage** — how many corpus scripts have been scored. 100% is required for reliable calibration.
- **Spread** — the Oscar-to-Weak-Film gap. Drops in spread are an early warning that a model update has caused regression.
- **Per-script scores** — individual scores let the team spot anomalies. If *Parasite* suddenly scores 5.4, something is wrong upstream.

---

## Part 6: Model Selection

StoryScore uses two different AI models depending on the task. This is a deliberate cost/quality trade-off.

```mermaid
flowchart LR
    subgraph PRODUCTION["🎬 Production Scoring"]
        direction TB
        PS["User submits script"] --> C4["Claude Sonnet 4.6"]
        C4 --> NOTE1["200,000 token context<br/>Reads full 120-page script<br/>Best-in-class literary analysis<br/>~$0.005 per script"]
    end

    subgraph BATCH["🔬 Corpus Batch Scoring"]
        direction TB
        BS["Admin runs score:corpus"] --> GF["Gemini 2.0 Flash"]
        GF --> NOTE2["1,000,000 token context<br/>3 parallel jobs<br/>~70% cost reduction<br/>~$7 for all 43 scripts"]
    end

    style PRODUCTION fill:#1e1b4b,color:#fff
    style BATCH fill:#14532d,color:#fff
```

**Claude Sonnet 4.6** is used when a user's script is being scored. It has the best understanding of narrative structure, subtext, and character psychology of any available model. Its 200,000-token context window means even a 120-page script (roughly 100,000 tokens) fits comfortably in a single call with room for the rubric and calibration examples.

**Gemini 2.0 Flash** is used for bulk corpus scoring — running all 43 training scripts through evaluation to build or refresh calibration data. It is faster, cheaper, and its scores are sufficiently reliable for establishing reference anchors. The quality trade-off is acceptable because these scores are reviewed by the admin team before going live.

---

## Summary

StoryScore is not a rubric lookup table or a static algorithm. It is a live system that:

1. **Reads the full script** — not a summary, not chunks, the entire text in one pass
2. **Applies a professional 12-dimension framework** — rooted in how Hollywood development executives actually evaluate scripts
3. **Anchors its scores to known-quality benchmarks** — real scripts, real consensus, explicitly injected at evaluation time
4. **Gets smarter as the corpus grows** — no model retraining required, improvements deploy immediately
5. **Is transparent and auditable** — every dimension score has a written reasoning, every calibration example is a readable script, every change is visible in the admin dashboard

The system is designed so that a script analyst, not a machine learning engineer, can improve it. Adding a new corpus script, adjusting a rubric description, or flagging a category as under-represented are all actions a domain expert can take directly. The AI does what AI is good at — reading and synthesizing — while the human team does what humans are good at — deciding what quality means.

---

*This document covers the production implementation as of March 2026. The corpus currently holds 43 scripts. Target for Phase 2 is 100+ scripts with genre sub-categories.*
