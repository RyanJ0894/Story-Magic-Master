# Story Magic — Update Report

**To:** Ryan Jae
**From:** Chris Therriault
**Date:** April 23, 2026

---

## Summary

Everything from your April 22 email has been addressed except the audio player notes feature (in progress next) and the dashboard layout image (didn't come through — please resend). The app is live and fully deployed. Here's what changed.

---

## 1. Full-Length Script Failure at 95% — FIXED

**What was happening:** Scripts were getting stuck at 95% for about 8 minutes and then erroring out.

**Root cause:** The audio pipeline was running an MP3 conversion step synchronously inside the final assembly stage. For a 60–100 minute audio file, that FFmpeg conversion takes 5–10 minutes. The web server has a connection timeout shorter than that, so it gave up and reported a failure even though the audio was actually done on the backend.

**What was fixed:**

- Removed the blocking MP3 conversion entirely. The pipeline now delivers M4A (AAC 192kbps) which plays natively in every modern browser, iPhone, Android, and desktop app — no conversion needed.
- Increased the fetch timeout from 5 minutes to 20 minutes as a safety net for future long operations.

**Please test with your longest script and report back.** Full 100-page scripts should now complete without stalling.

---

## 2. Wrong Voices Being Used — FIXED

**What was happening:** Short scripts completed, but the AI was using voices not from your curated library. Teenagers were being voiced by adults, and on longer scripts the same character was getting different voices at different points.

**Root cause:** The Director (the AI voice-casting engine) was only loading 18 voices from a partial cache file. Your full curated library of 80 voices — including Teen Male, Teen Female, Older Male, Female Child, and other age-specific voices — was sitting in a separate file that was never being read. The AI was also using hardcoded ElevenLabs default voices (Drew, Rachel) as fallbacks, which are not in your library at all.

**What was fixed:**

- The Director now loads all 80 voices from your curated library as its primary source.
- Age-range matching (teen, child, older adult, etc.) now works correctly because those voices are finally in the pool.
- Hardcoded fallbacks replaced with voices confirmed in your library: George (narrator), Will (male lead), Jessica (female lead).

**Known limitation still open:** On very long scripts (close to 100 pages), the AI parser has an output size limit. If the script is long enough to hit that limit mid-parse, the second half may lose character voice assignments and recast. This is the next audio fix — it requires splitting the script into chunks with voice state carried across chunks. Does not affect short and medium-length scripts.

---

## 3. Enterprise Plans — Accessible and Working

**What was happening:** The enterprise system was fully built but you couldn't get to it. Entry points were hidden and there was no way to actually upgrade a plan inside the app.

**What was fixed:**

The **"Enterprise Plans" button** in the dashboard header now shows for all users regardless of current tier. Previously it only appeared for already-paid accounts.

### Full Upgrade Path — End-to-End

| Step | URL | Action |
|------|-----|--------|
| 1 | `/dashboard` | Click "View Enterprise Packages →" or header "Enterprise Plans" button |
| 2 | `/enterprise` | Enter password: **`Masejase0894!`** |
| 3 | `/enterprise-plans` | Browse all four enterprise tier cards |
| 4 | Any card | Click **"Activate Plan"** → tier updates instantly, redirects to dashboard |

The Activate Plan button is live now. No Stripe required — direct tier assignment for testing and client onboarding.

### Referral Code Path

Also live at `/referral`. Working codes:

| Code | Upgrades To |
|------|-------------|
| `STORYMAGIC2026` | Starter Enterprise |
| `SMCREATOR` | Starter Enterprise |
| `SMPRO` | Professional |
| `SMSTUDIO` | Studio |
| `SMENTERPRISE` | Enterprise Unlimited |

The **Dashboard Subscription Plans section** now shows all four tiers with your current plan highlighted and Upgrade buttons linking to the referral page.

---

## 4. What's Next

### Audio Player Notes
Your "vital to the prototype" feature. The synchronized screenplay text display is already in the player. What needs to be added:

- Hover over text → small notes popover
- Click → full write/save notes modal
- Color indicator on sections with saved notes
- Notes accessible per project from the dashboard
- Like / Dislike / Undecided decisions recorded and surfaced to the master account

The database tables for all of this already exist. This is the next scheduled build session.

### Dashboard Layout Redesign
The image you attached ("Dashboard - Individual Plan - NEW LAYOUT") in your April 22 email didn't come through on my end. **Please resend** and I'll implement it.

### Voice Consistency on 100-Page Scripts
The script chunking fix described in section 2. Scheduled after audio player notes.

---

## Test Checklist for Today

- [ ] Run a full 100-page script — should complete without stalling at 95%
- [ ] Enterprise upgrade flow — log in as a fresh individual account, click Enterprise Plans, enter the password, click Activate Plan on any tier, confirm dashboard tier updates
- [ ] Voice casting on a short script — verify voices are from your curated library and age-appropriate for each character

---

## Live URLs

- **https://app.storymagicapp.net**
- **https://story-magic-web.onrender.com**

---

Questions or issues — reply here or email chris@servicevision.net.cent
