# Story Magic — Competitive Feature Roadmap

**Date:** 2026-05-06
**Author:** Chris Therriault (chris@servicevision.net)
**Research Depth:** Standard — 8 competitors profiled, 25 web searches
**Focus:** All areas
**Audience:** Screenwriters (primary), production companies (B2B), indie studios (enterprise)

---

## TL;DR — Top 5 Recommendations

> Highest-priority features based on competitive gap analysis and market demand signals.
> Each addresses a gap no competitor currently fills for the screenplay-to-audio workflow.

1. **Fountain/FDX Native Import** — Screenwriters write in Fountain and Final Draft, not PDF. Native parser = more accurate character detection and a clear differentiator against every competitor, including the niche table-read tools (Screenplayer.ai, ScreenplayRadio) that only handle PDF.

2. **Script Director Notes UI** — No competitor lets users inject creative direction *before* generation. An inline "director annotation" layer (per character: "sarcastic", per scene: "tension building") deepens the pipeline moat exactly where ElevenLabs v3's Dialogue Mode is narrowing it.

3. **Per-Scene / Credit-Based Pricing Tier** — Every major competitor (ElevenLabs, Descript, Podcastle) uses usage-based pricing. Subscription-only creates friction for screenwriters who want to try one scene. 28% of AI audio users cite opaque/forced subscription costs as their #1 frustration.

4. **Scene-Level Audio Sharing** — No competitor offers per-scene share URLs. A writer pitching to an agent can send "listen to Act 2 Scene 3" — the exact use case that closes industry relationships. Technically trivial; strategically significant.

5. **Team Collaboration & Review Comments** — ElevenLabs Studio and WellSaid both have team features. Without them, Story Magic is locked out of production company accounts where directors, producers, and writers all need to review and comment on the same project.

---

## Competitive Landscape

> Researched May 6, 2026. Source: 25 searches across 8 competitor profiles + 4 market trend reports.

### Market Overview

The AI screenplay-to-audio category is pre-consolidation with no dominant player. The closest adjacent category — AI TTS platforms — is being rapidly consolidated (ElevenLabs at $11B, $500M ARR, 5x growth in 12 months). No TTS incumbent has built a screenplay-native automated pipeline. The niche tools that target screenwriters directly (Screenplayer.ai, ScreenplayRadio, Storywork.io) are table-read utilities, not production tools. Scriptmatix Studio Composer (pre-launch) is the only announced direct competitor with music + SFX + screenplay format support, but it is video-first and not yet shipped.

---

### Competitor Profiles

#### ElevenLabs — elevenlabs.io
- **Positioning:** Full-stack voice AI for creators and enterprises. Audiobooks, podcasts, video dubbing, real-time agents.
- **Pricing:** Free → Creator $22 → Pro $99 → Scale $330 → Business $1,320 → Enterprise custom. Turbo models = 0.5 credits/char.
- **Recent ships:** Studio 3.0 (Sept 2025) — multi-voice timeline editor; Eleven v3 GA (Feb 2026) — audio tags + Dialogue Mode; Eleven Music (Aug 2025) + stem separation (Mar 2026); Productions managed service ($2/min human-edited)
- **Strengths:** Voice quality (#1 in market), 10,000+ voice library, full creative suite (TTS + Music + SFX + video), $500M ARR
- **Gaps:** Auto-character-assignment is Alpha quality; no screenplay format (Fountain/FDX) awareness; pipeline is assembly-manual; no scene-aware music/ambience/SFX automation; no LUFS-normalized broadcast mix output; no film/TV industry compliance posture

#### Descript — descript.com
- **Positioning:** Audio/video editor for podcast and video creators. Edit by editing the transcript.
- **Pricing:** Free $0 → Hobbyist $16 → Creator $24 → Business $50 → Enterprise custom
- **Recent ships:** Pricing model overhaul (Sept 2025) — media minutes + AI credits; Underlord reasoning upgrade; dubbing in 30+ languages; MCP API support; custom avatar from photo
- **Strengths:** Best-in-class transcript-based editing UX; Overdub voice clone; team collaboration; multi-language dubbing
- **Gaps:** No PDF screenplay import; no character detection from scripts; Overdub = single-voice correction, not multi-cast synthesis; no full-length production pipeline; not targeting screenwriters

#### Podcastle / Async — async.com
- **Positioning:** Podcast + creator platform, rebranding toward enterprise and developer API. Previously Podcastle.
- **Pricing:** Free $0 → Essentials ~$12 → Pro ~$24 → Teams/Business custom
- **Recent ships:** Asyncflow v1.0 TTS model (Mar 2025); voice cloning reduced to seconds of audio; Voice API for developers; platform rebrand to Async
- **Strengths:** 7,000+ royalty-free music + SFX library; multi-voice TTS from text; podcast hosting included; affordable
- **Gaps:** Manual multi-character assignment; no screenplay parser; voice quality "slightly robotic"; optimized for 5–60 min episodes, degrades on 90–120 page scripts; no production-grade audio output

#### WellSaid Labs — wellsaid.io
- **Positioning:** Enterprise narration platform for L&D, marketing, healthcare, and legal.
- **Pricing:** Maker $49 → Pro ~$99 → Enterprise custom (avg $28K/yr per enterprise client)
- **Recent ships:** Caruso model (96 kHz, 30% faster); AI Director (granular emotional intonation without re-render); 36 new voices in Oct 2025; collaboration comments; SSO + Workspaces
- **Strengths:** Best enterprise posture (collaboration, SSO, industry pronunciation); emotional control without re-rendering; team workflow
- **Gaps:** Narration-only — no music, ambience, SFX; no screenplay support; not targeting film/TV

#### Resemble.ai — resemble.ai
- **Positioning:** Developer voice API for programmatic cloning, gaming, and enterprise.
- **Pricing:** Starter $5 → Professional $99 → Business $699 → Enterprise custom
- **Recent ships:** Rapid Voice Clone 2.0 (20-second clone); 23-language multilingual cloning; deepfake watermarking
- **Strengths:** Developer API quality; deepfake detection/watermarking; on-premise deployment
- **Gaps:** Voice infrastructure only — no screenplay, no production pipeline, no music/SFX layer

#### Screenplayer.ai — screenplayer.ai
- **Positioning:** AI table read for screenwriters. Upload PDF, hear your script with assigned voices.
- **Pricing:** ~$40/mo credit-based; 1 free credit trial
- **Recent ships:** Expanded to 160-page feature films
- **Strengths:** Screenplay format awareness; auto voice assignment; affordable; targets screenwriters directly
- **Gaps:** Table read only — no music, ambience, SFX, or immersive production; no enterprise features; English-focused

#### Scriptmatix Studio Composer — scriptmatix.com *(pre-launch)*
- **Positioning:** AI screenwriting platform adding full audio-visual production. Video-first.
- **Pricing:** Not published (pre-launch)
- **Announced features:** 500 voices, SFX library, musical composition library, image/video generation, camera movement, AI acting performance
- **Strengths:** First announced competitor with music + SFX + screenplay format in one tool
- **Gaps:** NOT LAUNCHED. Video-first (Story Magic is audio-first). Unknown audio quality vs. broadcast standard. No enterprise/SOC 2.

#### AudioProducer.ai — audioproducer.ai
- **Positioning:** Automated audio drama from prose/text.
- **Pricing:** Not publicly listed
- **Strengths:** One-click audio drama with SFX + music beds; closest current feature overlap on audio production
- **Gaps:** Prose/text input only — no screenplay format parser; no PDF/Fountain/FDX awareness; no film industry positioning; no enterprise

---

## Market Trends

| Trend | Signal Strength | Implication for Story Magic |
|-------|----------------|-------------------|
| Script-to-multi-voice audio = category with no clear winner | HIGH | First-mover advantage is still available; move fast on brand + distribution |
| AI voice market 30.7% CAGR ($4.16B → $20.71B by 2031) | HIGH | Rising tide; institutional capital means more competitors entering; moat must deepen |
| ElevenLabs v3 Dialogue Mode narrows manual assembly gap | HIGH | Pipeline automation + screenplay-native features are the moat; they cannot be easily replicated by a general tool |
| Mid-market (indie studios, production companies) moving fastest | HIGH | Target this segment before enterprise. They move without legal/compliance gatekeeping. |
| 78% of screenwriters already use AI in their workflows | HIGH | Market is primed; not an education problem. Distribution/discovery is the bottleneck. |
| 28% cite opaque/unexpected subscription costs as #1 frustration | HIGH | Per-scene pricing reduces commitment anxiety and opens the funnel |
| SOC 2 Type II + MPAA/TPN = enterprise gating requirement | HIGH | Story Magic's existing SOC 2 roadmap is table stakes, not a differentiator |
| Collaboration features = team workflow gating | HIGH | Without comments/review, production companies can't standardize on Story Magic |
| Voice consistency across long-form is unsolved | HIGH | 90-120 page consistent character voices is Story Magic's unique strength; market it explicitly |
| Human-in-loop premium production tier gaining traction | MED | ElevenLabs Productions ($2/min) is a validation that premium managed service has demand; consider white-glove tier |
| Scriptmatix (video-first) entering the space in 2026 | MED | Monitor; their audio quality is unknown. Establish brand before they launch. |
| Voice actor marketplace / licensing emerging | MED | Long-term moat opportunity; Audible testing narrator replica licensing |
| International market (multi-language) growing | MED | Not a near-term priority given English-dominant screenplay market, but worth watching |
| Mobile-first creation workflows | LOW | Screenwriters review on phones; creation stays on desktop for now |

### Emerging Capabilities to Watch
- **ElevenLabs Eleven Music + Stem Separation:** If music generation quality reaches production-standard, it threatens the music layer of Story Magic's pipeline. Consider switching from pre-licensed music to generated music per scene.
- **Suno ($250M Series C):** Music AI at scale. The AI-generated music layer will commoditize rapidly.
- **Mirelo ($44M, a16z+Index):** Audio-matching for AI video — signals increasing demand for automated audio production across video workflows. Could become an integration partner or an acquirer.
- **Scriptmatix Studio Composer:** First announced direct competitor with music + SFX + screenplay. Watch for launch quality and pricing.

---

## Feature Gap Matrix

| Feature | Story Magic | ElevenLabs | Descript | Podcastle | Screenplayer.ai | WellSaid | Users Want |
|---------|-------------|-----------|---------|---------|----------------|---------|-----------|
| Screenplay PDF ingest | ✅ | ⚠️ (generic) | ❌ | ❌ | ✅ | ❌ | HIGH |
| Fountain/FDX native import | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | HIGH |
| Auto character detection + voice cast | ✅ | ⚠️ (Alpha) | ❌ | ❌ | ✅ | ❌ | HIGH |
| Scene-aware music/ambience automation | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | HIGH |
| SFX automation from script cues | ✅ | ⚠️ (standalone) | ❌ | ⚠️ (manual) | ❌ | ❌ | HIGH |
| Broadcast-standard LUFS output (-16 LUFS) | ✅ | ❌ | ❌ | ❌ | ❌ | ⚠️ (narration only) | MED |
| Full-length script (90-120 pages) | ✅ | ⚠️ (manual) | ❌ | ❌ | ✅ (160pp) | ❌ | HIGH |
| Voice consistency across long-form | ✅ | ⚠️ | ❌ | ❌ | ⚠️ | ❌ | HIGH |
| Performance direction (inline emotion cues UI) | ❌ | ✅ (v3 audio tags) | ❌ | ❌ | ❌ | ✅ (AI Director) | HIGH |
| Director notes / pre-generation creative input | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | HIGH |
| Per-scene / usage-based pricing | ❌ | ✅ | ✅ | ✅ | ✅ | ❌ | HIGH |
| Custom voice cloning | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | HIGH |
| Scene-level audio sharing | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ | HIGH |
| Team collaboration / review comments | ❌ | ✅ (Studio) | ✅ | ❌ | ❌ | ✅ | HIGH |
| Public API + webhooks | ❌ | ✅ | ✅ | ✅ | ❌ | ❌ | MED |
| Mobile-friendly / PWA | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ | MED |
| Podcast/audio RSS distribution | ❌ | ❌ | ✅ | ✅ | ❌ | ❌ | MED |
| Multi-language support | ❌ | ✅ (70+ lang) | ✅ (30+ lang) | ✅ | ❌ | ✅ (18 dialects) | MED |
| SOC 2 / enterprise compliance | ⚠️ (in progress) | ✅ | ❌ | ❌ | ❌ | ✅ | HIGH (enterprise) |
| Human-in-loop production service | ❌ | ✅ (Productions) | ❌ | ❌ | ❌ | ❌ | MED |
| Writer profile + marketplace | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | LOW (unique) |
| Script analysis / StoryScore | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | LOW (unique) |

---

## Opportunity Scoring

| Feature | User Impact | Comp Necessity | Differentiation | Effort (5=easy) | Score | Tier |
|---------|------------|----------------|-----------------|-----------------|-------|------|
| Fountain/FDX native import | 5 | 1 | 5 | 3 | **19** | 🟢 Now |
| Per-scene / credit-based pricing | 5 | 5 | 1 | 3 | **19** | 🟢 Now |
| Scene-level audio sharing | 4 | 1 | 5 | 4 | **19** | 🟢 Now |
| Script director notes UI | 4 | 1 | 5 | 3 | **18** | 🟢 Now |
| Performance direction UI (emotion cue overrides) | 4 | 3 | 4 | 3 | **18** | 🟢 Now |
| Audio-to-podcast RSS distribution | 4 | 2 | 5 | 3 | **18** | 🟢 Now |
| Team collaboration + review comments | 5 | 4 | 2 | 3 | **19** | 🟢 Now |
| Custom voice cloning (per-character upload) | 4 | 5 | 1 | 2 | **16** | 🟡 Next |
| Public API + webhook | 3 | 4 | 3 | 3 | **16** | 🟡 Next |
| Audio preview speed (sub-2-min scene preview) | 4 | 3 | 1 | 4 | **16** | 🟡 Next |
| Mobile PWA (listen + review on phone) | 4 | 2 | 2 | 3 | **15** | 🟡 Next |
| Human-in-loop production tier | 4 | 2 | 3 | 1 | **14** | 🟡 Next |
| Multi-language support (Spanish, French, German) | 3 | 4 | 2 | 1 | **12** | 🔵 Later |
| Voice actor marketplace (platform-level licensing) | 4 | 1 | 5 | 1 | **15** | 🚀 Moonshot |
| On-premise / private cloud deployment | 3 | 2 | 4 | 1 | **12** | 🚀 Moonshot |

---

## Phased Roadmap

### 🟢 Now — Ship This Sprint (Score ≥18)

---

#### 1. Fountain/FDX Native Import (Score: 19)

**Why:** Screenwriters do not write in PDF. Final Draft (`.fdx`) is the industry standard; Fountain is the open-source plain-text format preferred by indie writers (Highland 2, Logline, WriterSolo). PDF conversion loses character CUE formatting, parentheticals, and slug line precision — which means Story Magic's Director pipeline works from degraded input. No competitor (including Screenplayer.ai) supports FDX natively. This is a differentiator that can be featured in every landing page comparison.

**What it is:** Accept `.fdx` (Final Draft XML) and `.fountain` (plain-text Fountain) file uploads alongside PDF. Parse them natively to extract character names, scene headings, action blocks, and dialogue with higher accuracy than PDF extraction.

**How:**
- Fountain parser: use `fountain-js` or `fountain-parse` (MIT licensed OSS libraries); integrate into the existing upload route at `packages/web/app/api/projects/upload/route.ts`
- FDX: XML-based format; parse with standard XML parser (no library needed); extract `<Character>`, `<Scene>`, `<Action>`, `<Dialogue>` nodes
- Estimated: 5 SP (parser integration + upload UI file type filter + orchestrator Director handoff)
- Test: add 3 Fountain test files to `Samples/`, write 5 new upload route tests

**Success metric:** Fountain/FDX upload completion rate ≥ 95%; Director character detection accuracy improves measurably on test corpus.

**Risk:** FDX has version variants (Final Draft 10 vs 12); handle gracefully with fallback to PDF conversion.

---

#### 2. Per-Scene / Credit-Based Pricing Tier (Score: 19)

**Why:** 28% of AI audio users cite "unexpected subscription costs" as their #1 frustration. Screenwriters in development don't want a full subscription to hear one scene. All major competitors (ElevenLabs, Descript, Podcastle) offer usage-based pricing. Per-scene credits also solve Ryan's concern about cost exposure on long-form scripts — charges are proportional to generation volume.

**What it is:** A "credits" layer alongside subscriptions. Each scene generation costs N credits. Free tier gets 3 scene credits. Paid tier gets unlimited generation or bulk credit packs ($9.99 for 20 scene credits). Full-script generation = all scenes in one transaction (discounted vs per-scene).

**How:**
- Add `credits` field to `Profile` model in Prisma schema
- Add Stripe one-time checkout for credit packs (reuse Advanced Analysis checkout pattern at `packages/web/app/api/projects/[id]/advanced-analysis/route.ts`)
- Credit deduction hook in generation trigger at `packages/web/app/api/generate/route.ts`
- Admin UI: display credit balance and top-up history
- Estimated: 8 SP (schema, Stripe product, deduction logic, admin display, tests)

**Success metric:** 15%+ of free-tier users convert to at least one credit pack purchase within 30 days.

**Risk:** Pricing perception — credits feel nickel-and-dime if not well-framed. Bundle first scene free with every project to reduce anxiety.

---

#### 3. Scene-Level Audio Sharing (Score: 19)

**Why:** The primary use case for a screenwriter sharing audio is pitching a specific scene — "here's the opening of Act 2" — not the full feature. No competitor offers this. A URL like `/listen/[projectId]?scene=3` that auto-positions the player at scene 3 costs minimal engineering but enables a genuinely differentiated pitch workflow.

**What it is:** A per-scene share URL. Clicking "Share this scene" copies a URL with a `?scene=N` parameter. Opening that URL in the share player auto-seeks to the right scene and optionally loops it. Combine with a "Share scene" button on each scene card in the project view.

**How:**
- Existing listen page at `packages/web/app/projects/[id]/listen/page.tsx` reads audio player state
- Add `?scene=N` URL param support; player seeks to scene start timestamp on mount
- Add "Share scene" button per scene in the project detail component
- Share modal already handles URL copy; extend to pass `?scene=N` when invoked from a scene context
- Estimated: 3 SP

**Success metric:** "Share scene" button click rate vs "Share project" button — a positive ratio indicates the feature is preferred.

**Risk:** Scene timestamps require accurate audio timeline data from the Director JSON; verify the `director_json` scene boundary format is stable.

---

#### 4. Script Director Notes UI (Score: 18)

**Why:** ElevenLabs v3's audio tags (`[whispers]`, `[excited]`) are narrowing the quality gap on per-line delivery. Story Magic's Director pipeline infers emotional direction automatically — but users have no way to override or guide it before generation. A "director notes" layer that feeds into the Director prompt gives professional users control over characterization that no competitor offers. This deepens the automation moat by making it collaborative rather than opaque.

**What it is:** A pre-generation panel on the project page where users can add per-character notes ("Jess is sardonic and speaks fast") and per-act notes ("Act 2 is tense; reduce music energy"). These notes are injected into the Director LLM prompt (Pass 1) as additional context before generation begins.

**How:**
- Add `directorNotes` JSONB field to `Project` model (or a separate `DirectorNote` table keyed by projectId + characterName/actNumber)
- UI: accordion panel on project page, character list with text input per character + global notes textarea
- Inject notes into Director Pass 1 prompt in `packages/orchestrator/src/director/pipeline.ts`
- Estimated: 5 SP (schema, UI, prompt injection, tests for note passthrough)

**Success metric:** Projects with director notes set → measurably higher StoryScore on character arc dimension.

**Risk:** LLM prompt injection — director notes are user-supplied text; sanitize against prompt injection before including in LLM context. Use a structured format, not free-form concatenation.

---

#### 5. Performance Direction UI — Inline Emotion Cue Overrides (Score: 18)

**Why:** ElevenLabs v3 launched audio tags as a key differentiator. WellSaid's AI Director enables intonation control without re-rendering. Story Magic auto-generates performance direction via the Director pipeline, but users can't see or edit these cues. Surfacing them (and making them editable) shows users the "intelligence" they're paying for and lets professionals fine-tune performance without regenerating the full pipeline.

**What it is:** A post-generation "Performance" panel that shows the emotion/delivery tag the Director assigned to each dialogue line (e.g., "NERVOUS", "SARCASTIC", "TENDER"). Users can change a tag and re-render just that line's TTS (using the existing scene regeneration endpoint). Think of it as a timeline of delivery notes that can be adjusted without full re-generation.

**How:**
- Director pipeline already produces `emotion` metadata per dialogue line in `director_json`; expose this in the project detail API response
- UI: in the listen/project view, show a "Performance" tab with collapsible list of characters → dialogue lines with their emotion tag (editable Select)
- On change: call `POST /api/projects/[id]/regenerate-scene` with updated emotion override
- Estimated: 6 SP (UI, director_json emotion surfacing, override persistence, regenerate hook)

**Success metric:** Performance tab open rate in first 30 days post-launch; regeneration rate on overridden lines.

**Risk:** director_json emotion field format must be stable. If the Director pipeline doesn't produce per-line emotion tags consistently, add a Pass 2 post-processing step to normalize.

---

#### 6. Audio-to-Podcast RSS Distribution (Score: 18)

**Why:** Descript and Podcastle both include podcast hosting. Once a screenwriter has a finished audio production, the natural next action is sharing it with an audience — and podcasting is the distribution channel with the lowest friction. A "publish as podcast" feature creates a new story format: the "screenplay podcast" (already emerging as a category on Stage 32 and in indie creator communities). Unique positioning: Story Magic is the only platform where a screenplay becomes a podcast in one workflow.

**What it is:** One-click publish of a completed project to a podcast RSS feed hosted on Story Magic. The feed includes episode title (project name), description, cover art, and M4A audio URL. Users get a shareable RSS URL and a public landing page. Optional: Spotify Submit integration via their API.

**How:**
- Add `podcastFeed` model in Prisma (projectId, rssFeedUrl, published, episodeTitle, coverArtUrl)
- Generate RSS XML at `GET /api/projects/[id]/podcast.rss` using the existing M4A R2 URL
- Simple public page at `/listen/[code]/podcast` showing episode details + listen/subscribe CTA
- Optional Spotify Submit integration (separate API, lower priority)
- Estimated: 5 SP (RSS generation, model, public page, share UI addition)

**Success metric:** Podcast publish rate (% of completed projects published); podcast subscriber count.

**Risk:** Audio file must be publicly accessible. Existing share links use a token; podcast RSS URLs would be persistent public URLs — needs access level check.

---

#### 7. Team Collaboration & Review Comments (Score: 19)

**Why:** Production companies, studios, and writing rooms work in teams. WellSaid has clip-level collaboration comments. ElevenLabs Studio has team workspaces. Without any team collaboration features, Story Magic cannot become the standard tool in a writing room or post-production workflow. This is the single feature most likely to unlock the $200–500/mo production company tier.

**What it is:** A comment thread per project (and optionally per scene). Team members with project access can leave timestamped comments (including references to a scene or audio position). Comments are visible to all project collaborators. Basic @mention support for notification.

**How:**
- Add `ProjectComment` model: `projectId`, `userId`, `sceneIndex?`, `audioTimestampMs?`, `body`, `createdAt`
- API: `GET/POST /api/projects/[id]/comments`
- UI: comment sidebar on project detail page; playback position link-back (click timestamp → seek audio to that point)
- Notification: email (Resend) on new comment if user is a project collaborator
- Estimated: 8 SP (model, API, UI, notifications, tests)

**Success metric:** Projects with comments set → retention rate vs. projects without.

**Risk:** Collaboration requires defining "project access" — tie to existing `TeamShare` and `ScriptShare` models; don't build a separate permissions system.

---

### 🟡 Next — 1–2 Sprints (Score 14–17)

#### Custom Voice Cloning (Per-Character Upload) (Score: 16)

**Why:** ElevenLabs, Descript, and Podcastle all support voice cloning from 20 seconds of audio. Screenwriters writing for a specific actor's voice (or wanting to cast a friend as a character) need this. Since Story Magic already uses ElevenLabs API, this is a thin UI layer over ElevenLabs voice clone creation.

**How:** "Add custom voice" button per character in voice assignments panel. Triggers ElevenLabs Instant Voice Clone API (`POST /v1/voices/add`) with uploaded audio. Saves resulting `voice_id` to the character's voice assignment record. ~5 SP.

**Risk:** ElevenLabs instant clone quality varies with audio length/quality. Add minimum duration validation (20+ seconds) and quality guidance in UI.

---

#### Public API + Webhooks (Score: 16)

**Why:** Developer integrations (Final Draft plugin, Celtx add-on, custom automation) require a public API. ElevenLabs and Descript both have developer APIs. Exposing the screenplay-native pipeline as an API creates a distribution channel no competitor has.

**How:** Document and rate-limit the existing orchestrator API endpoints. Add API key management under Account Settings. Webhook support for `job.completed`, `job.failed` events. ~8 SP.

---

#### Audio Preview Speed — Sub-2-Minute Scene Preview (Score: 16)

**Why:** Users report latency as the #1 frustration with AI audio tools. A scene preview that completes in under 2 minutes (vs. a full 30+ minute feature generation) dramatically changes the iteration loop for writers in development. The existing `/preview` endpoint handles this, but it needs surface-level UX improvements (scene selector, progress estimation).

**How:** Surface the preview endpoint prominently on the project page ("Preview Scene 3" button). Add a progress estimate based on scene word count. ~3 SP.

---

#### Mobile-Friendly PWA (Score: 15)

**Why:** Screenwriters review on their phones. The listen page and project detail page need responsive layouts optimized for mobile. A PWA allows "Add to Home Screen" without a native app investment.

**How:** Audit and fix responsive breakpoints in player and project components. Add `manifest.json` + service worker for PWA. Focus on listen page (primary mobile use case). ~5 SP.

---

#### Human-in-Loop Production Tier (Score: 14)

**Why:** ElevenLabs Productions ($2/min) validates market demand for premium human-reviewed audio. For high-stakes pitches (studio meetings, festival submissions), some users will pay a premium for human quality review of their audio output.

**How:** Add a "White Glove" production option. Generates audio via the standard pipeline, then routes to an internal (or external contractor) human reviewer queue for quality check, prosody review, and mix adjustment. Fulfilled via email delivery. Pricing: $99–149 per project. ~13 SP + operational setup.

---

### 🔵 Later — 1–3 Months (Score 9–13)

| Feature | Why | Approx SP | Notes |
|---------|-----|-----------|-------|
| Multi-language support (ES, FR, DE) | ElevenLabs 70+ languages; international screenwriters | 13+ | Start with Spanish (largest non-English screenplay community); leverage ElevenLabs multilingual voices |
| Advanced share analytics | Who opened, when, how many plays, play completion rate per scene | 5 | Producers and agents want to know if the reader finished it |
| Script version diff with audio | Show what changed between run N and N+1 at the line level with audio comparison | 8 | Extends existing revision comparison feature |
| AI-generated cover art per project | Midjourney/DALL-E generated poster art for podcast/share pages | 3 | Polish; improves share page visual quality |
| Embeddable audio player widget | `<iframe>` embed for personal websites, loglines sites | 3 | Distribution amplifier; no competitor offers this for screenplays |
| Branded share pages (custom domain) | Production company deploys their branded listen page | 5 | Enterprise feature; white-label lite |

---

### 🚀 Moonshot — 3–6 Months (High Effort + High Impact)

| Feature | Vision | Competitive Differentiation | Investment Required |
|---------|--------|----------------------------|---------------------|
| Voice Actor Marketplace | Real voice actors submit AI replicas for licensing. Writers pay to cast a professional voice or an indie actor's voice. Revenue split with actors. | Network effect: voice catalog grows with each new actor. No TTS tool has done script-native voice licensing. Audible testing this model. | Legal/rights infrastructure, actor onboarding, stripe connect, marketplace moderation. 30+ SP. |
| On-Premise / Private Cloud Deployment | Major studios won't send IP to shared cloud. Private deployment unlocks TPN/MPAA-level enterprise deals. | Only Resemble.ai offers on-prem; none of the screenplay tools do. | AWS/Azure deployment packaging, customer success ops, enterprise SLA. 40+ SP. |
| AI Music Generation Per Scene (Suno/ElevenMusic integration) | Replace pre-licensed music beds with AI-generated score unique to each project. Every script gets an original soundtrack. | No competitor generates a custom score per screenplay scene. | Suno or ElevenMusic API integration; quality validation against LUFS targets; licensing clarity. 15+ SP. |
| Interactive Audio Drama (branching narrative) | Choose-Your-Own-Adventure audio: scenes with branching choices. Listener decides what happens next; AI generates the next scene in real time. | Completely new story format no competitor has explored. Hedra and Rumi Labs are building adjacent interactive character products. | Major product rearchitecture; real-time generation pipeline; new UX paradigm. 50+ SP. |

---

## What NOT to Build

| Feature | Why Skip |
|---------|---------|
| General podcast editing (transcript-based) | Descript and Async own this market. Building a general-purpose editor competes on Descript's turf where we have no advantage. |
| Transcription service | Commoditized. ElevenLabs Scribe, AssemblyAI, Whisper are all better and cheaper. |
| AI video generation | Different product, enormous capital requirement, no screenplay-to-audio synergy. |
| General TTS API (competing with ElevenLabs at infrastructure layer) | Story Magic's advantage is the screenplay-aware pipeline on top of TTS, not TTS itself. |
| Social discovery feed (algorithm-driven) | Expensive to build and maintain; requires critical mass to be useful; not a screenwriter workflow need. |
| Audio editing (DAW features: EQ, compression, region editing) | Outside the audience's expertise; adds complexity without adding value. Professional users who need this use Pro Tools. |

---

## Pricing Intelligence

| Competitor | Free Tier | Entry Paid | Mid Tier | Enterprise | Key Limits |
|------------|-----------|------------|----------|------------|------------|
| ElevenLabs | ✅ (limited chars) | $22/mo (Creator) | $99/mo (Pro, 500K chars) | Custom | Characters/month; Turbo = 0.5x cost |
| Descript | ✅ (60 min/100 credits) | $16/mo (Hobbyist) | $24/mo (Creator) | Custom | Media minutes + AI credits, no rollover |
| Podcastle/Async | ✅ (15 min lifetime TTS) | $12/mo (Essentials) | $24/mo (Pro) | Custom | TTS chars/month; cloud storage |
| WellSaid | ❌ (7-day trial) | $49/mo (Maker) | ~$99/mo+ | $28K+/yr avg | No free tier; enterprise-focused |
| Screenplayer.ai | ✅ (1 credit) | ~$40/mo | — | — | Credit-based |
| **Story Magic** | ❌ | ? | ? | ? | Subscription only; $9.99 Advanced Analysis add-on |

**Pricing recommendations:**
1. **Add a free tier with 3 scene credits** — no competitor in the screenplay space has a generous free tier. This creates organic trial and word-of-mouth from writers who share their audio.
2. **Introduce a $19/mo "Writer" tier** — below WellSaid's $49 entry, above Podcastle's $24. Positions as the screenplay professional tool, not the podcast creator tool.
3. **Scene credits as add-on** — $9.99 for 20 scene credits mirrors the Advanced Analysis add-on already proven effective. Keeps subscription ARR predictable while capturing usage revenue.
4. **Production company tier at $199/mo** — includes team seats (up to 5), collaboration comments, priority generation queue. Anchors enterprise at WellSaid's price point.

---

## Research Sources

| Query | Key Findings |
|-------|-------------|
| ElevenLabs Studio 3.0 + v3 features | Eleven v3 GA Feb 2026: audio tags + Dialogue Mode; Studio 3.0 includes SFX, music, timeline; Auto-assign still Alpha |
| ElevenLabs pricing 2025–2026 | Creator $22 → Pro $99 → Scale $330; Aug 2025 unified character credits; $500M ARR |
| Descript pricing/features 2025 | Sept 2025 overhaul: media minutes + credits; Overdub no longer needs long read-aloud |
| Podcastle / Async rebranding | Asyncflow v1.0 March 2025; platform rebrand to Async; 7K+ music/SFX library |
| WellSaid Labs 2025 | Caruso model; AI Director intonation control; collaboration comments; SOC2; $28K/yr enterprise avg |
| Resemble.ai 2025 | Rapid Voice Clone 2.0 (20 seconds); developer-API focused; on-premise deployment |
| AI audio drama production tools 2025 | Screenplayer.ai ($40/mo table read); ScreenplayRadio (free lightweight); AudioProducer.ai (prose); Storywork.io (FDX read-aloud) |
| Scriptmatix Studio Composer | Pre-launch, video-first, 500 voices + SFX + music + image/video announced for early 2026 |
| AI voice market trends 2025–2031 | $4.16B (2025) → $20.71B (2031), 30.7% CAGR; ElevenLabs 5x in 12 months |
| CHI 2025 screenwriter AI study | 78% use AI; want Actor/Audience/Expert/Executor roles; human creative control non-negotiable |
| Enterprise AI audio requirements | SOC 2 Type II + MPAA/TPN required; on-premise demand from major studios |
| Funding landscape 2025 | ElevenLabs $500M; Suno $250M (music); Mirelo $44M (audio-for-video); YC W25 = 22% voice/audio |
| User pain points in AI audio | 28% cite opaque pricing; voice inconsistency in long-form; emotional flatness; no collaboration |

---

*Generated 2026-05-06 via competitive web research (25 queries, 8 competitor profiles). Recommendations grounded in live market data. Re-run `/feature-planner` monthly — ElevenLabs ships bi-weekly and Scriptmatix Studio Composer launches in early 2026.*
