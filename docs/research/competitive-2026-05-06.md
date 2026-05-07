# Competitive Research Dump — 2026-05-06

## Search Queries Run (via background agents)

1. "ElevenLabs Projects feature 2025"
2. "ElevenLabs pricing 2025"
3. "ElevenLabs new features 2025 2026"
4. "ElevenLabs audiobook script multi voice 2025"
5. "Descript features 2025"
6. "Descript pricing 2025"
7. "Podcastle features 2025"
8. "Podcastle pricing 2025"
9. "Resemble.ai features 2025"
10. "Resemble.ai pricing 2025"
11. "WellSaid Labs features 2025"
12. "WellSaid Labs pricing 2025"
13. "AI audio drama production 2025"
14. "screenplay to podcast AI 2025"
15. "script to audio AI tool 2025"
16. "AI audio production trends 2025 2026"
17. "AI screenwriting tools market 2025"
18. "AI voice audio drama podcast 2025 new features"
19. "audiobook AI production market 2025"
20. "entertainment AI tools film industry 2025"
21. "AI content creation monetization features 2025"
22. "what screenwriters want from AI tools reddit OR forum 2025"
23. "AI audio sharing social features 2025"
24. "YC startups audio voice 2025"
25. "enterprise AI audio SOC 2 2025"

---

## Raw Findings by Competitor

### ElevenLabs

- Studio 3.0 (Sept 2025): browser-based production environment. Upload EPUB/PDF/TXT/HTML/MP4/MOV/MP3/WAV. Auto-detect chapters, auto-assign voices (Alpha). Timeline editor: TTS + Eleven Music + SFX on separate tracks. Export with auto-captions in 29 languages.
- Eleven v3 (alpha late 2025, GA Feb 2026): audio tags `[whispers]`, `[excited]`, etc. Dialogue Mode: multi-speaker single API call, auto transitions, overlapping speech, pauses, emotional variation. Text-to-Dialogue endpoint specifically for character dialogue.
- Eleven Music (Aug 2025): music from text prompts. March 2026: stem separation, Inpainting API, Music Finetunes. ElevenMusic iOS app (April 2026).
- SFX v2: upgraded sound effects generation
- Scribe v2 (Nov 2025): most accurate transcription model
- Productions (Sept 2025): managed service, human expert linguists, audiobooks/dubs/captions, per-minute pricing (~$2/min)
- Conversational AI 2.0 (Jan 2026): real-time voice agents, cached history
- $500M ARR (April 2026), $11B valuation (Series D, Feb 2026), Sequoia-led, Nvidia-backed
- No native screenplay format parsing (Fountain/FDX). Auto-assign is Alpha quality. Workflow = assembly-manual.
- Pricing: Free → Creator $22 → Pro $99 → Scale $330 → Business $1,320 → Enterprise custom
- Aug 2025: unified character credits (Multilingual vs Flash no longer separate pools); Turbo/Flash = 0.5 credits/char

### Descript

- Text-based editing: edit audio by editing transcript. Multitrack recording via Descript Rooms.
- Studio Sound: single-toggle ML voice isolation + noise removal
- Underlord AI co-editor: show notes, chapter markers, titles, social clips, natural-language multi-step edits
- Overdub: custom AI voice clone from short Voice ID + uploaded audio (no longer needs long read-aloud)
- Free/Hobbyist: Overdub 1000-word vocabulary. Creator: 25+ stock AI voices. Business: 60+ + custom avatar from photo
- Pricing (post-Sept 2025 overhaul): Free $0 (60 min/100 credits), Hobbyist $16 (600 min/400 credits), Creator $24 (1800 min/800 credits), Business $50 (2400 min/1500 credits), Enterprise custom
- Stock media library (Creator+): videos, images, GIFs, music tracks, SFX
- MCP API support (controllable via Claude/GPT)
- Sept 2025: full pricing model overhaul — media minutes + AI credits replace transcription hours
- Translation/dubbing in 30+ languages (Business+)
- No screenplay parser, no multi-character casting from script, no scene-aware production

### Podcastle / Async

- Rebranded to Async (late 2025) — unified creator platform + enterprise + Voice API
- Asyncflow v1.0 (March 2025): proprietary TTS model, 450-500+ voices, Voice API launch
- Voice cloning: now seconds of audio (down from 70 sentences); 24hr processing
- Soundboard: 7,000+ royalty-free music tracks + SFX library (drag-and-drop)
- Animated voice generator: assign different voice skins to different characters manually
- Pricing: Free $0, Essentials ~$12 (120K chars/mo), Pro ~$24 (500K chars/mo), Teams custom, Business custom
- 40% savings annual
- Verticals: podcast, marketing, advertising, education, corporate training
- No screenplay parser, no auto casting, no LUFS-normalized broadcast output
- Optimized for 5-60 minute episodes, not 90-120 page feature scripts
- Quality concern: voice clones "slightly robotic" per reviewer feedback

### Resemble.ai

- Developer API. Not a screenplay tool.
- Rapid Voice Clone 2.0 (Feb 2025): 20 seconds of audio
- Multi-voice variants per clone (conversational, commercial, phone agent)
- 23-language multilingual cloning
- Resemble Fill: neural audio editing
- Real-time voice cloning + speech-to-speech
- Built-in deepfake watermarking + detection
- On-premise deployment
- Pricing: Starter $5 → Creator $19 → Professional $99 → Scale $299 → Business $699 → Enterprise custom
- Target: developers, game studios, healthcare, finance — NOT screenwriters

### WellSaid Labs

- Enterprise TTS. Not a screenplay tool.
- Caruso model: 30% faster, 96 kHz output, broadcast quality
- AI Director: emotional intonation control without re-rendering
- Word-level controls: pitch, pacing, pauses, loudness via Smart Suggestions
- Multi-speaker scripting (dialogue in training content)
- Clip-level collaboration comments, SSO, Workspaces, Billing Admin roles
- Industry pronunciation: 9,000+ medical terms, 500+ legal terms
- 36 new voices Oct 2025 (Arabic, Turkish, Persian, 18 regional dialects)
- Pricing: Maker $49/mo → $199/mo + custom; avg SMB $3,869/yr; avg enterprise $28,356/yr
- No music/SFX/ambience, no screenplay format, no cinematic output
- Enterprise clients: LinkedIn, T-Mobile, ServiceNow, Accenture

### Niche Direct Competitors

**Screenplayer.ai:**
- PDF screenplay → AI table read. Auto assigns voices per character. Up to 160 pages. Monthly token rollover.
- ~$40/mo credit-based. No music/SFX/ambience. English-focused.
- No enterprise posture.

**ScreenplayRadio:**
- Web-based script reader. PDF/text/paste upload. Per-character voice from library. Narrator reads action lines. Pitch/speed controls.
- English only (US/GB/CA/AU accents). No pricing listed publicly. No music/SFX.

**Scriptmatix Studio Composer (pre-launch, early 2026):**
- AI screenwriting platform adding audio-visual production. 500-voice library, SFX library, musical composition library, image/video generation, camera movement, AI acting performance. Video-first, not audio-first. NOT LAUNCHED.

**AudioProducer.ai:**
- Automated audio drama from text (not screenplay format). Per-character narration, automatic emotion/SFX markup, background music, one-click generation.
- Works from prose/text, not screenplay PDF/FDX. No enterprise/SOC 2.

**Storywork.io:**
- Import Final Draft/Fountain → AI read-aloud. Cast AI voices per character. No music/SFX. No finished production output.

**Wondercraft:**
- Multi-voice podcast generation. Up to 8 characters. No screenplay format, no music automation.

---

## Raw Trend Findings

- AI Voice market: $4.16B (2025) → $20.71B (2031), CAGR 30.7% (MarketsandMarkets)
- AI Screenwriting software market growing 2026-2032 (OpenPR report)
- ElevenLabs $500M ARR April 2026 (5x in 12 months from $100M April 2025)
- CHI 2025 study (23 screenwriters): 78% already use AI in workflows. Want AI as Actor/Audience/Expert/Executor. Non-negotiable: human creative control maintained.
- 71% of professional screenwriters use AI tools as of end-2025 (Screenwriting Software Statistics 2025)
- Audible: 40,000+ AI-narrated titles. Publishers reducing production costs 80%.
- Major studios: AI at <3% of production budgets in 2025 (Deloitte TMT 2025). Studios cautious — "mid-market moves fastest"
- 61% of screenwriting software revenue is subscription model
- Canva: 71% of AI users upgrade to paid
- 28% of users cite "unexpected subscription costs" as #1 pain (State of Voice AI 2025 — Deepgram)
- SOC 2 Type II: no longer optional for enterprise entertainment platforms
- MPAA/TPN compliance: required for major studio content protection deals
- Deloitte: major studios spending 7% of operational budgets on AI for localization, dubbing, marketing
- YC W25: voice/audio companies = 22% of that class
- Mirelo raised $44M (a16z + Index) Dec 2025 — "AI video's silent problem" — audio matching for AI video
- Suno: $250M Series C Nov 2025 — AI music generation
- ElevenLabs raises again May 2026 to $500M ARR

---

## Sources

- https://elevenlabs.io/studio
- https://elevenlabs.io/docs/creative-platform/products/studio
- https://elevenlabs.io/v3
- https://elevenlabs.io/audiobooks
- https://elevenlabs.io/productions
- https://elevenlabs.io/enterprise
- https://www.cekura.ai/blogs/elevenlabs-pricing
- https://siliconangle.com/2026/05/05/elevenlabs-adds-high-profile-investors-annualized-revenue-tops-500m/
- https://cnbc.com/2026/02/04/nvidia-backed-ai-startup-elevenlabs-11-billion-valuation.html
- https://www.descript.com/pricing
- https://www.trebble.fm/post/descript-pricing-september-2025
- https://async.com/pricing
- https://techcrunch.com/2025/03/03/podcasting-platform-podcastle-launches-a-text-to-speech-model-with-more-than-450-ai-voices/
- https://www.resemble.ai/pricing
- https://www.wellsaid.io/resources/blog/building-the-future-of-ai-voice
- https://www.screenplayer.ai/pricing
- https://screenplayradio.com/
- https://scriptmatix.com/studio-composer/
- https://www.audioproducer.ai/
- https://www.storywork.io/ai-read-aloud
- https://arxiv.org/abs/2502.02153 (CHI 2025 screenwriter study)
- https://a16z.com/ai-voice-agents-2025-update/
- https://www.marketsandmarkets.com/Market-Reports/ai-voice-generator-market-144271159.html
- https://www.deloitte.com/us/en/insights/industry/technology/technology-media-and-telecom-predictions/2025/tmt-predictions-hollywood-cautious-of-genai-adoption.html
- https://techcrunch.com/2025/12/15/mirelo-raises-41m-from-index-and-a16z-to-solve-ai-videos-silent-problem/
- https://deepgram.com/learn/state-of-voice-ai-2025
- https://publishdrive.com/the-audiobook-surge-in-2025-why-authors-cant-ignore-it.html
