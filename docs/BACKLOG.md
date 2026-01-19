# Story Magic Feature Backlog

## Voice Casting UI (Priority: Medium)

**Problem:** Currently AI auto-selects voices, users have no control over casting.

**Solution:** Add an optional voice selection step between script upload and generation.

**Flow:**
1. User uploads script → clicks "Customize Voices" (or auto if enabled)
2. Quick AI pass extracts characters with descriptions (name, age, gender, ethnicity)
3. UI shows each character with:
   - Extracted description from script
   - Dropdown of ElevenLabs voices filtered by attributes
   - Play button to preview each voice sample
   - AI-suggested default (user can override)
4. User confirms selections → stored in project
5. Generation uses user-selected voices (skips AI voice search)

**Technical Components:**
- `POST /api/extract-characters` - Lightweight character extraction endpoint
- `VoiceCastingDialog` component with audio preview
- ElevenLabs voice preview URL integration
- `projects.voice_selections` JSON column in database
- Modify DirectorAgent to accept pre-selected voices

**ElevenLabs Preview URLs:**
- Format: `https://api.elevenlabs.io/v1/voices/{voice_id}/preview`
- Or use `preview_url` field from voices list API

**Effort:** ~2-3 days
**Dependencies:** None (can be added incrementally)

---
