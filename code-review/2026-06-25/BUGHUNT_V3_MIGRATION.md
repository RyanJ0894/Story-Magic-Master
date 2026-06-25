# BUG HUNT — Issue 5: ElevenLabs v3 expressive model migration

> Scope: Assessment only (per directive — investigate, do NOT fix).
> Trigger: Ryan's 2026-06-25 forward from Jonathan Chang @ ElevenLabs confirming voice-clone model-agnosticism + v3 expressive tag support.

## 1. Every place we send `model_id`

There are only **two** call sites:

| File | Line(s) | Purpose | How model is set |
|---|---|---|---|
| `packages/orchestrator/src/lib/audio.ts` | 32, 161, 182 | Production TTS — every dialogue line | `process.env.ELEVENLABS_MODEL \|\| 'eleven_turbo_v2_5'` |
| `packages/orchestrator/src/lib/voice-validator.ts` | 26, 87 | Pre-flight `/voices/<id>/verify` probe (1-char TTS to detect dead voices, the same check from Ryan's "voice deactivated" error today) | **Hardcoded constant** `PROBE_MODEL = 'eleven_turbo_v2_5'` |

That's it. No web-side references. The dist/ hits are build artifacts.

`.env.example:54-57` documents `ELEVENLABS_MODEL=eleven_turbo_v2_5` so the lever already exists — only the **probe** is hardcoded.

## 2. Configurability today

- **Global env-var.** `ELEVENLABS_MODEL` overrides everything in one place. There is **no** per-voice, per-project, per-character, or per-tier selection — the model is monolithic across the entire orchestrator service.
- **#379 observability** (memory) logs `modelId` in every TTS attempt (`audio.ts:191, 249`) so Sentry/log dashboards will naturally segment by model after a swap — we don't have to add metrics for the migration itself.

## 3. ElevenLabs endpoints we hit

- `POST /v1/text-to-speech/{voice_id}?output_format=pcm_24000` — main TTS, PCM 24 kHz (per audio.ts:217)
- `POST /v1/text-to-speech/{voice_id}` from `voice-validator.ts` — same shape, used for the deactivated-voice probe
- No streaming endpoint; no `/forced-alignment` endpoint usage. We do alignment **locally** via whisper.cpp (#270/#278/#279/#280) downstream of the TTS output.

Per Jonathan's email, `eleven_v3` is a drop-in `model_id` swap on the same endpoint. No URL change needed.

## 4. Format / alignment exposure

- We request `output_format=pcm_24000`. PCM is raw samples — model-architecture-independent. Whisper.cpp gets bytes, not metadata.
- Risk: **v3 may emit non-speech audio for tags** (laughter, sighs). Whisper transcription of `[laughs]` produces no recognizable token, so forced alignment will skew start/end times for any line that contains a tag. The longer the non-speech segment, the worse the line-level timing drift in `timeline.ts`. Mitigation: align on the pre-tag text or pad tag duration heuristically. Worth a UAT case.

## 5. Expressive markup integration

We already have **the start of this**, gated:

- `packages/orchestrator/src/orchestrator/workers/parallel-tts.ts:23-40` defines `EMOTION_TAG_MAP` mapping director-emitted emotions to v2-style markup (`WHISPERED → [whispers]`, etc.) and `applyEmotionTag()` prepends the tag.
- Gated by `ELEVENLABS_EXPRESSION_TAGS=true` — defaults OFF in prod.
- The director already emits `emotion` on dialogue lines (per `director/pipeline.ts` schema).

For v3 we'd:
- Flip `ELEVENLABS_EXPRESSION_TAGS=true` when `ELEVENLABS_MODEL=eleven_v3` (or auto-couple them)
- Expand `EMOTION_TAG_MAP` with v3's richer vocabulary (whispers/laughs/sighs/excited/sarcastic — the v3 expressive set)
- No director changes required for the MVP; the LLM is already emitting `emotion`.

## 6. Minimum viable migration

| Step | File | Effort |
|---|---|---|
| 1. De-hardcode `PROBE_MODEL` to use `process.env.ELEVENLABS_MODEL \|\| 'eleven_turbo_v2_5'` | `lib/voice-validator.ts:26` | 1 line |
| 2. Add `ELEVENLABS_MODEL_FALLBACK` env (use turbo when v3 throws 5xx so we don't kill a run on a model outage) | `lib/audio.ts` retry path | ~15 lines |
| 3. Auto-enable `ELEVENLABS_EXPRESSION_TAGS` when model starts with `eleven_v3` | `parallel-tts.ts:35` | 1 condition |
| 4. Per-project opt-in: read `project.elevenlabsModel` (DB column or feature flag) before falling back to env | `audio.ts` model resolution | new Prisma column + ~10 lines |
| 5. Doppler set `ELEVENLABS_MODEL=eleven_v3` on dev → soak | env only | 0 code |

**SP estimate: 3 SP for the env-flag swap (steps 1–3); 5 SP for per-project opt-in (step 4); 2 SP for an expanded EMOTION_TAG_MAP + UAT.** Total ~10 SP.

## 7. Catches

- **Latency.** v3 is generally slower than turbo v2.5 (~3× claim in our comments). On a 50-page script with parallel TTS this matters; today's 429s are already rate-limit-bound (see Issue 2/3 from tonight's hunt). Slower per-call = more chance of rate-limit interleaving. Worth a dev soak before prod.
- **Cost.** ElevenLabs prices per character; v3 is typically the same credits/char as turbo. Confirm with billing dashboard, not the marketing page.
- **Quality/stability tradeoff.** Jonathan: PVC stability sometimes limits v3 emotional range. Ryan's 137 grant-account voices are a mix of IVC/PVC — we don't track which. A `voice.clone_type` field would help post-swap A/B.
- **The probe.** Step 1 is non-optional: if env says v3 but probe says turbo, we'd "verify" voices on a model that isn't the one we'll use to render. The "Re-running the director" error today came from this verifier — moving it off a hardcoded constant matters for accuracy of the deactivation signal.
- **Out-of-scope for this hunt but related**: Issue 1 (degraded voices being deactivated) is a *separate* bug — fix that independently of the v3 migration. The hardcoded probe model in voice-validator.ts is the same file but a different problem.

## Recommendation

Open as a tracked feature: "Phase 1 — ELEVENLABS_MODEL env swap + probe de-hardcode (3 SP, dev only)" then "Phase 2 — per-project opt-in + expanded tag map (5 SP)". Don't bundle with the rate-limit / resume-button work tonight; v3 is a quality win, not a stability fix.

---

Files written: `code-review/2026-06-25/BUGHUNT_V3_MIGRATION.md`. No code committed.
