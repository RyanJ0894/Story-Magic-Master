# Placeholder Voice Entries — Pending Ryan's ElevenLabs Catalog

**Created:** 2026-05-26  
**Status:** Awaiting voice IDs from Ryan's ElevenLabs account

---

## What Was Added

Three `Female Teen` entries were added to the voice catalog as **placeholders** so the
pipeline can route age-matched voices for young female characters right now, rather than
silently falling back to 20s voices.

The placeholder entries borrow voice IDs from the closest-sounding existing female
voices (all 20-somethings). Audio will render correctly — just without the youthful teen
quality that Ryan's real teen voices will provide.

## Files to Update

| File | Change needed |
|------|--------------|
| `knowledge_bases/eleven_labs_voices_current.json` | Replace `voice_id` in the 3 `Female Teen` entries |
| `src/director/tools/hybrid-voice-search.ts` | Replace `voice_id` in `DEFAULT_VOICES.female_teen` |

## Current Placeholder Entries

```json
{ "label": "Female Teen", "voice_id": "cgSgspJ2msm6clMCkdW9", "gender": "Female", "tone": "Warm",      "style": "American", "_placeholder": true }
{ "label": "Female Teen", "voice_id": "FGY2WhTYpPnrIDTdsKH5", "gender": "Female", "tone": "Energetic", "style": "American", "_placeholder": true }
{ "label": "Female Teen", "voice_id": "XhNlP8uwiH6XZSFnH1yL", "gender": "Female", "tone": "calm",      "style": "American", "_placeholder": true }
```

## How to Replace (when Ryan provides voice IDs)

1. **Log in to ElevenLabs** → My Voices → Collections → Teen
2. Identify 1–3 female teen voices. For each, copy the **Voice ID**
   (click the voice → Settings → copy the ID string, e.g. `abc123XYZ...`).
3. Update `eleven_labs_voices_current.json` — grep for `"_placeholder": true` to find the lines.
   Replace `voice_id` values in order of best match: Warm → most natural/relatable teen,
   Energetic → upbeat/excited teen, calm → quiet/introspective teen.
4. Update `DEFAULT_VOICES.female_teen` in `hybrid-voice-search.ts` with the Warm voice ID.
5. Run `pnpm test` to confirm no regressions (1,634 tests should all pass).
6. Commit: `fix(voices): replace female teen placeholders with Ryan ElevenLabs catalog IDs`.

## Quick Grep to Find Placeholders

```bash
grep -n "_placeholder" packages/orchestrator/knowledge_bases/eleven_labs_voices_current.json
grep -n "PLACEHOLDER" packages/orchestrator/src/director/tools/hybrid-voice-search.ts
```

## Why Same Voice IDs Appear Twice

The catalog intentionally has duplicate `voice_id` values while placeholders are in place:
once under `Female - 20s to 30s` and once under `Female Teen`. This is safe because:
- The voice search `excludeVoiceIds` mechanism prevents the same voice being assigned
  to two characters in the same script.
- Once real teen voice IDs are substituted, the duplicates disappear.
