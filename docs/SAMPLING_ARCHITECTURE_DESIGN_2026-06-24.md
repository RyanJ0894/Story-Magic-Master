# Sampling-Based Director Architecture — Design Proposal

**Date:** 2026-06-24
**Status:** Proposal — not yet committed to implementation
**Author drafted by:** Claude / Chris
**For review:** Peter, Ryan

---

## TL;DR

The director pipeline today reads the **full script** twice (once for character extraction in Pass 1, once for scene parsing in Pass 3) and makes voice decisions in Pass 2 based on **abstract character descriptions** from Pass 1 — never on actual dialogue. We can cut LLM cost ~40–60 % and director wall-clock ~30–50 % on long scripts by:

1. **Making Pass 1 deterministic** — slug-line + dialogue-attribution detection is regex-solvable with zero LLM cost. Today it's an LLM call that just re-derives what `extractSceneInfo` already gives us cheaper.
2. **Adding a Character Introduction Sampling stage** before Pass 2 — slice the first ~2 pages of each character's dialogue/action context, dedupe pages across characters, stitch into a compact sample (~5–30 K chars even for a 200-page feature).
3. **Voicing from real speech, not descriptions** — Pass 2 reads the stitched sample, picks voices based on actual patterns of speech, not abstract "GRUFF SAILOR, 60s, weather-beaten" prose.
4. **Pass 3 stays chunked + parallel** as it is today — every scene must be parsed; you can't sample your way out of that. But the chunks themselves can be cheaper by giving each a tighter system prompt (since voice + character context is already settled).
5. **Optional Advanced Consistency Check (premium / opt-in)** — after the sample-driven pipeline completes, sample N random scenes from the full script and verify the per-scene decisions are consistent with the sample-derived voice/style. Escalate any discrepancies to a targeted re-pass.

The win is **structural**, not from a faster model: we stop paying for the LLM to re-read context it doesn't need, and we give it the context it actually does need but currently lacks.

---

## Why this is worth doing

### Current pipeline cost (measured on dev)

For Ryan's 77-page script (141 K chars), the director pipeline today does roughly:

| Pass | Cost driver | Approx. tokens (input) | Approx. wall clock |
|---|---|---|---|
| Pass 1 — Character extraction (chunked @ 30 K, parallel) | LLM × ~5 chunks × full chunk text | ~140 K total input | ~60–120 s |
| Pass 2 — Voice assignment | LLM × 1 call on character manifest only (no script) | ~5 K input | ~20–40 s |
| Pass 3 — Scene construction (chunked @ 15 scenes, parallel) | LLM × ~4–6 chunks × full chunk text + voice_map | ~140 K total input | ~180–300 s |

Total: ~280 K input tokens + ~5–20 K output tokens. At Claude Sonnet 4.6 pricing (≈ $3/M in, $15/M out) that's roughly **$0.90–1.20 per director run** for a 77-page script, with ~5–7 min wall clock on the happy path.

Almost all of that input cost is the script text. **The same 141 K characters are read twice — once by Pass 1, once by Pass 3.** Pass 2 gets the cheapest cost because it doesn't read the script at all — but that's also why voice quality is lower than it could be.

### The architectural insight

What does each pass actually *need*?

| Pass | What it needs | What it reads today |
|---|---|---|
| Pass 1 | "Who appears in this script?" | Full script |
| Pass 2 | "What voice fits each character's speech style?" | Only Pass 1's description prose |
| Pass 3 | "Parse each scene's dialogue, action, mood, audio cues." | Full script |

**Pass 1's question is solvable with regex** — every speaker in a screenplay is announced by a `CHARACTER NAME` line directly above their dialogue. We don't need an LLM to find them. Today the LLM does this expensively, then writes abstract descriptions that go to Pass 2.

**Pass 2's question requires reading actual dialogue.** Today it can't, so it relies on the abstract descriptions Pass 1 made up. Voice picks based on "GRUFF SAILOR, 60s, weather-beaten" are worse than voice picks based on the character's actual first three lines of dialogue.

**Pass 3's question genuinely requires the full text of each scene.** This is the only pass we can't reduce — but we can make each parallel call cheaper by stripping the voice-decision context (already settled) and adding a more focused system prompt.

---

## Goals

| # | Goal | Target |
|---|---|---|
| G1 | Cut LLM input tokens per director run | –40 % minimum on long scripts |
| G2 | Cut director wall clock | –30 % minimum on long scripts |
| G3 | Improve voice-pick quality | Voice decisions made on real dialogue, not derived descriptions |
| G4 | Maintain or improve scene-parse fidelity | Zero regression in `DirectorJSONValidator` pass rate |
| G5 | Premium-account differentiator | Optional consistency-check feature behind a flag |
| G6 | Zero quality regression on cache hits | The cross-project cache from PR #405 still operates correctly |

## Non-goals

- **Don't skip any scene's parsing.** Every scene must produce a `Scene` object in the final `DirectorJSON`. Sampling for *decisions* is fine; sampling for *output* is not.
- **Don't reduce voice variety.** If anything we should *increase* it — sample-based voicing should let us pick more distinct voices because we're seeing real differentiation between characters.
- **Don't change the TTS pipeline.** Same ElevenLabs flow downstream of director.
- **Don't break the cross-project cache** (#405). The cache key remains scene-text hash; we just change *how* scenes get parsed before they're cached.

---

## Architecture

### New pipeline structure

```
Script text
  │
  ├──▶ Pass 0  Deterministic Character & Scene Index (NEW, regex-only)
  │      │
  │      └──▶ CharacterIndex + SceneInfo[]
  │
  ├──▶ Pass 1  Character Introduction Sampling (NEW)
  │      │     - For each character, slice first ~2 pages of their lines + context
  │      │     - Dedupe pages across characters
  │      │     - Stitch into compact sample
  │      └──▶ StitchedSample (5–30 K chars max)
  │
  ├──▶ Pass 2  Voice Assignment from Sample (CHANGED)
  │      │     - LLM call with StitchedSample + character list
  │      │     - Pick voice_id per character based on real dialogue
  │      └──▶ VoiceMap
  │
  ├──▶ Pass 3  Scene Construction (UNCHANGED, chunked + parallel)
  │      │     - Same as today, but tighter system prompt because voice context is settled
  │      └──▶ Scene[]
  │
  └──▶ Pass 4  Advanced Consistency Check (NEW, optional)
         │     - Sample N random scenes from full script
         │     - Verify voice + character + style consistency
         │     - Escalate discrepancies to targeted re-pass
         └──▶ DirectorJSON (possibly repaired)
```

### Pass 0 — Deterministic character & scene index

**Today:** Pass 1 LLM call (chunked, parallel) extracts characters.
**Proposed:** regex-based parse. Zero LLM cost.

Screenplays follow strict format conventions for character announcement:

- **Slug line** — `INT.` / `EXT.` / `INT./EXT.` / `I/E.` (already detected by `extractSceneInfo`)
- **Character cue line** — typically 4 spaces of left margin, all caps, no terminal punctuation, optionally followed by `(V.O.)`, `(O.S.)`, `(CONT'D)`, `(filtered)`
- **Dialogue block** — indented less than action, immediately follows a character cue
- **Parenthetical** — `(beat)`, `(softly)` — wrapped in parens between cue and dialogue

A reliable regex + state-machine extracts these with ≥ 95 % accuracy on properly-formatted screenplays. For prose treatments / Fountain / FDX-imported with weird formatting, we fall back to the current LLM Pass 1 — a tiny percentage of uploads. Same fallback we already have when `extractSceneInfo` finds zero scenes.

**Output:**

```ts
interface CharacterIndex {
  characters: Map<string, CharacterAppearance>;
  totalLineCount: number;
  detectionConfidence: 'high' | 'low'; // low → fall back to LLM pass
}

interface CharacterAppearance {
  name: string;
  firstSceneIdx: number;
  firstCueIdx: number;       // absolute char offset of first character cue
  totalSpeakingScenes: number[];
  totalLineCount: number;    // number of dialogue lines this character has
  cueOffsets: number[];      // every character-cue position in the script
}
```

**Cost savings:** Pass 1 today costs ~30 % of the director run on a long script. Drop to ~0 % in the regex path.

**Risk:** non-standard formatting. Mitigated by:
- Confidence score. If `detectionConfidence === 'low'`, fall back to LLM Pass 1 path.
- Heuristic floor: if regex finds < `max(2, pages / 10)` characters, treat as low confidence.
- Telemetry counter `pass0.fallback_to_llm` — if > 10 % of uploads hit fallback, refine the regex.

### Pass 1 — Character Introduction Sampling

**Goal:** assemble a compact text sample that contains every character's first meaningful dialogue, deduplicated when multiple characters appear on the same page.

**Algorithm:**

```
input: scriptText, CharacterIndex
output: StitchedSample

1. PAGE_CHARS = 2_200             // standard 1-page heuristic
2. INTRO_PAGES_PER_CHAR = 2       // configurable
3. INTRO_CONTEXT_CHARS = INTRO_PAGES_PER_CHAR * PAGE_CHARS   // = 4400

4. for each character C in CharacterIndex:
     a. start = C.firstCueIdx
     b. end = min(start + INTRO_CONTEXT_CHARS, scriptText.length)
     c. C.introSpan = [start, end]

5. PageSlice[] = merge overlapping spans into deduplicated ranges
   (interval-merge: if char A's intro is [1000, 5400] and char B's is
    [3000, 7400], merge to one slice [1000, 7400])

6. stitchedText = ""
   for each slice in PageSlice[] (in script order):
     stitchedText += "── PAGES X-Y ─────\n"
     stitchedText += scriptText.slice(slice.start, slice.end)
     stitchedText += "\n\n"

7. characterIntroIndex = Map<character_name, slice_indexes_containing_them>

return { stitchedText, characterIntroIndex, originalChars, sampledChars }
```

**Concrete example.** A 100-page script with 20 characters:

- Naive: 20 characters × 4,400 chars = 88,000 chars
- After dedup (typical clustering of intros): ~25,000–40,000 chars
- vs. original: 220,000 chars
- **Reduction: ~80–85 %** in input tokens for Pass 2

**Edge cases:**

- Character with < 2 pages of speech in entire script → use whatever they have, mark in metadata
- Character first appears in voice-over before on-screen presence → use V.O. lines as the intro
- Two characters with identical names (parent/child both "JOHN") → suffix from CharacterIndex, dedup handles it
- Crowd scene with 8 named characters introduced together → all 8 share the same stitched slice; voice assignment sees them in proximity, which is actually a *better* context for picking distinct voices

### Pass 2 — Voice Assignment from Sample

**Today:** Pass 2 LLM call takes the character manifest (descriptions only) and assigns voices.
**Proposed:** Pass 2 LLM call takes the `StitchedSample` + character list and assigns voices.

The system prompt changes from:

> "Given these character descriptions, pick a voice for each from the catalog."

to:

> "Given these character introductions from the screenplay, pick a voice for each from the catalog that fits their speech patterns, tone, and apparent age/disposition. Same script context for all decisions ensures voice variety across the ensemble."

**Why this is strictly better than today's approach:**

1. The LLM makes voice decisions based on what the character actually *sounds like*, not on a derived description.
2. The LLM sees multiple characters in shared context, which naturally drives voice differentiation. Today's Pass 2 sees characters as a flat list with no relational context.
3. The LLM can spot tonal contrasts — "this character speaks in short clipped phrases, that one is verbose and ornate" — which is impossible from the description prose alone.

**Cost:**

- Today: ~5K input tokens (character manifest), output ~2K tokens
- Proposed: ~25–35K input tokens (stitched sample) + 1K (character list) + output ~2K tokens
- **Net delta: +7×–8× cost on Pass 2**, but Pass 2 was already the cheapest pass (< 5 % of director cost), so the absolute cost increase is small while quality improves significantly.

**Prompt-cache compatible.** The stitched sample is stable across retries — same script + same model = identical sample, so Anthropic's `cache_control: ephemeral` (already enabled in #184) caches it. Retries are nearly free.

### Pass 3 — Scene Construction (unchanged structure, tighter prompts)

Pass 3 still reads the full script (chunked by scene at 15 scenes/chunk, parallel calls). This is the irreducible cost — we have to produce a `Scene` for every scene.

**Two small improvements:**

1. **Tighter system prompt.** Today's Pass 3 system prompt covers voice context, character context, and scene parsing all in one. With voice + character context settled before Pass 3 runs, the system prompt focuses *only* on scene parsing (dialogue extraction, mood, intensity, audio cues). Shorter system prompt → cheaper per-chunk call. Estimated savings: ~10 % per chunk.
2. **Pre-tag character lines.** The `CharacterIndex` from Pass 0 already knows every character-cue offset. We can pre-tag character names in the chunk input so Pass 3 doesn't have to re-detect them — it just maps dialogue → known character.

Pass 3 wall-clock dominates because of model throughput on long inputs, not because of count of calls. So the wall-clock win here is modest — maybe 5–10 %. The big wall-clock wins come from Pass 0 (removing the LLM call entirely) and Pass 1 (eliminating Pass 1 LLM altogether).

### Pass 4 — Advanced Consistency Check (optional, gated)

**Use case:** premium accounts opt in to a consistency-validation step that catches edge cases where the sample-based voice/character decisions don't hold up on the full script.

**Gating:**

- Account flag `advanced_consistency_check: true` on the user's profile, OR
- Per-project `$X premium add-on` purchase, OR
- Automatic for scripts > 90 pages on enterprise tier

**Algorithm:**

```
input: DirectorJSON, scriptText
output: DirectorJSON (possibly repaired)

1. SAMPLE_SCENE_COUNT = 5     // configurable per tier
2. randomScenes = pickRandom(scenes, SAMPLE_SCENE_COUNT)

3. for each scene S in randomScenes:
     a. originalSceneText = scriptText.slice(S.bounds)
     b. parsedScene = directorJson.scenes[S.index]
     c. verifierPrompt = "Here is the original scene text and our parsed
        output. Check:
        - Does every dialogue line attribute to the correct speaker?
        - Does the assigned voice match the character's apparent
          speech pattern based on this scene?
        - Are there obvious omissions (missing lines, missing characters)?
        - Are mood/intensity values consistent with the scene?
        Respond: { passed: bool, issues: [{ field, severity, suggested_fix }] }"
     d. verdict[S.index] = await verify(verifierPrompt)

4. failures = verdict.filter(v => !v.passed)

5. if failures.length === 0:
     return directorJson  // happy path, ~$0.10 cost added

6. for each failed verdict:
     a. if it's a localized issue (e.g. one wrong voice): apply suggested fix
     b. if it's a structural issue (e.g. systematic mis-attribution): re-run
        Pass 3 for the affected chunk with the verifier's feedback in the
        system prompt
     c. log to telemetry for monitoring sample-pass quality
```

**Cost:**

- Spot-check phase: ~5 verifier calls × ~$0.02 each = **~$0.10**
- Repair phase (rare, < 5 % of jobs by projection): ~$0.30–0.50 added in worst case
- Average cost: ~$0.10–0.15 for the feature

**Quality signal we gain:** rolling failure rate per character / per script-length-bucket / per detection-confidence. If we see Pass 0's regex causing systematic Pass 4 failures on a particular formatting style, we know to refine the regex or fall back to LLM Pass 1 for that style.

### Why "sample, then verify" beats "always-full-context"

The traditional approach to LLM quality is "give the model all the context." That works at small scales but breaks at long-script scales because:

- Context is expensive (linear-to-quadratic cost per pass)
- Context window has a ceiling (Sonnet's 200 K tokens hits real walls)
- More context ≠ better decisions on tasks that have *local* dependencies (voice picks are local; scene parsing is local)

The sample-and-verify pattern is the standard for any large-scale data extraction problem: sample to make decisions, verify on a separate sample to catch errors, escalate when needed. It mirrors what an actual human reader does — they read the first 10–20 pages to get a feel for the voices, then they read the rest scene-by-scene without re-evaluating voice choices on every scene.

---

## Decision matrix: what can be sampled?

| Decision | Locality | Sampleable? | Sample size | Quality risk if sampled |
|---|---|---|---|---|
| Scene boundaries | Local (per-scene) | Already deterministic (regex) | N/A | None |
| Character detection | Local (per-cue) | Yes — regex on cue lines | All cues | Low (95%+ accuracy on standard format) |
| Voice assignment | Per-character | **Yes — character's intro pages** | First 2 pages of each | **Low** — picks from real speech beat descriptions |
| Dialogue line parsing | Per-line | No — must process every line | Full script | N/A |
| Mood / intensity | Per-scene | No — every scene needs one | Full scene text | N/A |
| Audio cue selection | Per-scene | Partially — could batch similar scenes | Per-scene + similar-scene clustering | Medium (covered as a Phase 3 follow-up) |
| Cross-scene voice continuity | Global | No — but spot-checkable | Random N scenes | Low (Pass 4) |

---

## Cost model

For a 100-page script (~220 K chars):

| Phase | Today | Proposed (no Pass 4) | Proposed (with Pass 4) |
|---|---|---|---|
| Pass 0 / Character extraction | $0.30 LLM (chunked × 5) | **$0.00 regex** | $0.00 regex |
| Pass 1 / Sample stitching | (does not exist) | $0.00 (deterministic) | $0.00 (deterministic) |
| Pass 2 / Voice assignment | $0.03 LLM | $0.08 LLM (richer input) | $0.08 LLM |
| Pass 3 / Scene construction | $0.70 LLM (chunked × 6) | $0.65 LLM (tighter prompt) | $0.65 LLM |
| Pass 4 / Consistency check | n/a | n/a | $0.10–0.15 LLM |
| **Total per run** | **~$1.03** | **~$0.73** (–29 %) | **~$0.83** (–19 %) |

Wall clock improvement is harder to project precisely because Pass 3 dominates and depends on Sonnet throughput, but eliminating Pass 1's full-script-chunked LLM walk and replacing it with regex (instant) reliably saves **60–120 s** off the front of the pipeline.

For a 30-page script: smaller absolute savings (~$0.10), but proportionally the same. For a 200-page script (above current `MAX_SCRIPT_PAGES` cap): savings scale linearly with input size; this architecture is what makes 200+ page scripts viable.

---

## Quality safeguards

1. **`DirectorJSONValidator` runs unchanged** against the output. Any malformed result auto-corrects via the existing flow.
2. **Sample fallback path.** If `CharacterIndex.detectionConfidence === 'low'`, fall back to today's full LLM Pass 1. We never get worse than the current pipeline; we sometimes get better.
3. **Cache key untouched** — PR #405's `director_scene_cache` keys on per-scene hash + model. The scene parsing step (Pass 3) is unchanged, so cache hits behave identically.
4. **Voice map persisted as today.** Same-project re-runs still load the cached `VoiceMap` and skip Pass 2 entirely. This proposal only changes the *first* parse path for a project; cached paths are untouched.
5. **Pass 4 catches drift.** If a sampled voice decision turns out wrong on a later scene, the consistency check surfaces it. Premium tier only — free tier ships the sample-driven pipeline without the verifier.

---

## Failure modes & mitigations

| Failure mode | Likelihood | Detection | Mitigation |
|---|---|---|---|
| Pass 0 regex misses unconventional formatting | Medium | Confidence < threshold | Fall back to LLM Pass 1 (current behavior) |
| Pass 1 sample omits a character with very late intro | Low | CharacterIndex sees all cues; sample always covers first 2 pages of each | Always include every character, even ones with < 2 pages of dialogue |
| Pass 2 picks wrong voice for a character whose speech evolves across the script | Low–Med | Pass 4 spot check, post-hoc telemetry | Pass 4 catches; future iteration could weight late-script appearances |
| Pass 3 tighter prompt regresses scene parse quality | Low | Existing `DirectorJSONValidator` auto-correct | Rollback flag per chunk to revert to old prompt |
| Pass 4 false positives flood the repair path | Med (initially) | Telemetry: repair_rate per script | Tune verifier prompt; raise discrepancy threshold |
| Cost regression on small scripts (overhead exceeds savings) | Med | A/B by page count | Gate sampling pipeline to scripts > 20 pages; below that, run today's pipeline (it's already cheap) |

---

## Rollout phases

Each phase is independently shippable — they don't depend on later phases.

### Phase A — Foundation (regex + sampler, no LLM changes yet)

- New module `packages/orchestrator/src/director/sampling/character-index.ts`
  - Deterministic character detection
  - `CharacterIndex` data structure
  - Confidence scoring
- New module `packages/orchestrator/src/director/sampling/intro-stitcher.ts`
  - Interval-merge dedup
  - `StitchedSample` output
- Unit tests: characterization tests against known scripts (we have plenty in `Samples/`)
- Telemetry: log `pass0.confidence`, `sample.original_chars`, `sample.stitched_chars`
- **No behavior change yet** — outputs go to logs only, not pipeline

**SP estimate:** 5

### Phase B — Voice assignment from sample

- New `VoiceAssignmentAgent` mode: `assignFromSample(stitchedSample, characterIndex)`
- Feature flag `DIRECTOR_VOICE_FROM_SAMPLE=true` (default off → safe rollout)
- Side-by-side comparison logging when both flags are on (compare voice picks between old and new methods)
- Tests: snapshot tests on representative scripts
- A/B canary on dev: 10 % of dev jobs use the new path, compare quality

**SP estimate:** 5

### Phase C — Pass 0 regex replacement

- Feature flag `DIRECTOR_CHARACTER_EXTRACTION_MODE=regex|llm|hybrid`
- `hybrid` mode: run both, log discrepancies, prefer regex when confidence is high
- After 2 weeks of `hybrid` data, switch default to `regex` if discrepancy rate < 2 %
- Removes Pass 1's full LLM walk on the regex path

**SP estimate:** 5

### Phase D — Pass 3 prompt refinement

- Strip voice/character preamble from Pass 3 system prompt
- Pre-tag character cues in chunk input
- A/B test prompt variants
- Measure: chunks-per-second, output schema validation rate

**SP estimate:** 3

### Phase E — Advanced Consistency Check

- New `ConsistencyVerifierAgent` (uses Haiku — cheap)
- Account flag in DB schema
- Project-level premium toggle (`is_advanced_check_enabled` on Project)
- UI surface: badge on the project page indicating "Advanced consistency on"
- Stripe SKU if we're billing per-project

**SP estimate:** 8

### Total

**26 SP** across 5 phases, shippable individually over 2–3 sprints. Phase A unlocks all later phases; B/C/D are independent; E is the premium layer that requires A.

---

## Open questions

1. **Should Pass 4 run automatically for free-tier users on long scripts?** Adds ~$0.10 cost per long run; might be a quality differentiator we want to keep.
2. **How does this interact with `voice_overrides` from the user?** Today user overrides apply post-Pass-2. Same flow — sampling is invisible to the override path.
3. **Should we cache the `StitchedSample` itself?** Probably not — it's cheap to recompute, and PR #405's per-scene cache already handles the bigger fish (skipping Pass 3 entirely on cache hits).
4. **Do we need a separate model for the verifier in Pass 4?** Haiku is probably right (cheap, fast, good enough for binary "passed/failed" judgments). Could revisit if false-positive rate is high.
5. **How do we measure "quality" objectively?** Proposed proxy metrics:
   - Voice variety entropy across cast (higher = better differentiation)
   - DirectorJSONValidator pass rate (must not regress)
   - Pass 4 failure rate (when enabled, should trend to < 5 %)
   - User-facing: completion rate, retry-rate, listen-through-rate on first generation

---

## What this proposal does *not* do

- It does not replace Sonnet with a cheaper model for Pass 3. Pass 3 quality matters; Sonnet's the right tier.
- It does not change the chunk size for Pass 3. The 15-scene chunk size is well-tuned for parallelism without sacrificing coherence.
- It does not touch the cross-project scene cache (PR #405). That's complementary and orthogonal — the sample-based pipeline still produces cacheable scene parses, and same-script re-uploads still skip the whole director run.
- It does not address audio cue selection waste — Pass 3 today does audio cue selection per scene, and there's a real opportunity to batch similar scenes (e.g. all "night exterior tense" scenes share music decisions). That's a separate Phase F not covered here.

---

## What follows naturally from this

Once we have `CharacterIndex` and `StitchedSample` as first-class concepts, several downstream improvements unlock:

- **Adaptive intro length per script length.** 1 page for shorts; 2 for features; 3 for epics.
- **Multi-genre sample stitching.** If a script is genre-mixed (action + romance), Pass 2 can be asked to pick voices that work across both genres.
- **Voice consistency check across projects.** If the same character appears in multiple projects (a series), CharacterIndex makes cross-project voice continuity tractable.
- **Predictive voice catalog warmup.** Pre-warm ElevenLabs voices that the stitched sample is likely to pick, reducing first-TTS latency.
- **Director Notes integration.** Notes from the user could be injected into the StitchedSample as additional context, giving Pass 2 user-driven hints.

---

## Recommended next step

**Start with Phase A** — build the deterministic CharacterIndex and IntroStitcher modules with no pipeline changes. Run them in shadow mode for 1–2 weeks to validate detection accuracy against real screenplays from `Samples/` and from user uploads. The telemetry from shadow mode is what enables confident decisions on Phase B/C/D rollout thresholds.

Phase A is independently valuable for debugging today's pipeline (we'd have a clean character index for diagnostics) and creates zero risk because nothing is wired into the live director path yet.
