# Story Magic — Audio Sharing Strategy & Agent Distribution

**Date:** 2026-05-26  
**Scope:** How writers share finished audio with agents, talent, and collaborators.  
**Current state:** Share links built; reader library built; team sharing built. Gaps documented below.

---

## 1. Current Sharing Capabilities

### What Exists Today

| Feature | Where | How it Works |
|---------|-------|-------------|
| **Short-link share** | `/s/[code]` | One-click link; stream or download; optional password + expiry |
| **Reader library** | `/reader/dashboard` | Agents/talent have accounts; producer pushes scripts to their library |
| **Team share** | Enterprise dashboard | All team members access shared projects |
| **Email invite** | `/invite/[token]` | Invite someone to the platform; they join reader or team role |
| **ScriptShare schema** | DB | Per-share: access level, expiry, password, play count, view count, recipient |
| **ContentAccessLog** | DB | Every play/view tracked with user agent + timestamp |

### What's Missing for Agent Distribution

| Gap | Pain | Priority |
|-----|------|---------|
| No bulk share (send to 10 agents at once) | Manual link per agent | P0 |
| No share tracking dashboard | Writer can't see who opened | P0 |
| No "send via email" built-in | Writer must copy/paste link | P1 |
| No share expiration management UI | DB-only; no controls | P1 |
| No collection/bundle share | Can't share a whole pilot season | P1 |
| No revocation (deactivate a link) | isActive field exists but no UI | P1 |
| No reader notification on share | Agent doesn't know a script arrived | P1 |
| No watermark-per-recipient | Can't trace leaks | P2 |
| No QR code share | Useful for physical screenings | P2 |

---

## 2. Who Are "Agents" in Story Magic?

There are four distinct personas receiving shared audio:

| Persona | Wants | Auth required? | Typical path |
|---------|-------|----------------|-------------|
| **Film/TV Agent** | Quick preview; confirms interest | No (just the link) | Short-link → stream only |
| **Voice Talent / Actor** | Review their character only | No / optional account | Short-link with scene filter |
| **Production Company** | Full download; keep on file | Yes (reader account) | Reader library push |
| **Team Member (sub-account)** | Full access all projects | Yes (enterprise team) | Team share auto-grants |

---

## 3. Proposed Sharing Architecture

### 3a. Bulk Share (P0 — v3.1 sprint)

**What:** Writer selects a finished project → enters up to 20 email addresses → all get a
personalized share link with the same settings.

**Data model:** No schema change needed. `ScriptShare` already supports `recipientEmail` and
`recipientName`. The UI just needs a multi-input form that creates N rows.

**API:** `POST /api/projects/[id]/share/bulk`
```json
{
  "recipients": [
    { "email": "agent@wme.com", "name": "John Smith" },
    { "email": "mgr@latent.com", "name": "Sarah Jones" }
  ],
  "accessLevel": "stream",
  "expiresInDays": 30,
  "message": "Hi {name}, here's the audio for ANSWERS..."
}
```

**Email:** Resend template with play button, personalized greeting, and expiry notice.

**Tracking:** Each recipient gets a unique `shareCode`, so `ContentAccessLog` rows are
attributed per person. The writer sees "3 of 8 recipients have listened."

---

### 3b. Share Dashboard (P0 — v3.1 sprint)

**What:** Per-project page showing all outstanding shares and engagement.

```
Project: ANSWERS — Final Draft
────────────────────────────────────────────────────────
 Recipient         Sent       Status        Last Heard   Plays
 ─────────────────────────────────────────────────────────────
 John Smith (WME)  May 20     ✅ Listened   May 22       3×
 Sarah Jones       May 20     📬 Not opened  —           0×
 Maria Chen        May 21     ✅ Listened   May 21       1×
 (link)            Public     🔗 Active      May 23       7×
────────────────────────────────────────────────────────
[+ New Share]  [Deactivate All]  [Resend Unopened]
```

**Route:** `/projects/[id]/shares`  
**Data:** Aggregate `ContentAccessLog` grouped by `shareCode` + join to `ScriptShare.recipientEmail`

---

### 3c. Email-Native Share (P1 — v3.2)

**What:** Writer types email + message directly in the app. The app:
1. Creates a `ScriptShare` row
2. Sends a Resend email with: personalized note, stream button, expiry date
3. If recipient has a Story Magic account → also pushes to their Reader Library

**Why this beats "copy link":** Most agents live in email. A transactional email with a
"▶ Listen Now" button has ~70% higher open rates than a link copy-pasted from a DM.

**Templates needed:**
- `share-invite.tsx` — "You've received a script: [Title]" with large play button
- `share-reminder.tsx` — "Reminder: [Title] awaits you" (sent if unopened after 7 days)
- `share-expiring.tsx` — "Your access to [Title] expires in 3 days"

---

### 3d. Scene-Level Share for Voice Talent (P1 — v3.2)

**What:** Writer selects a character → generates a share link that drops into that character's
first scene. Actor reviews only their lines + adjacent context.

**Data model:** `ScriptShare.sceneIndex` already exists. Wire it to the player in `/s/[code]`.

**Use case:** "Here's your audition — you're playing ELENA. Listen to scenes 3, 7, 12."

---

### 3e. Revocation UI (P1 — v3.2)

**What:** Toggle `ScriptShare.isActive = false` from the share dashboard.
**Effect:** `/s/[code]` returns 410 Gone with a friendly message.  
**Email:** Optional "access has been revoked" notice to recipient.

---

### 3f. Collection / Bundle Share (P1 — v3.2)

**What:** Share multiple scripts at once (a pilot + two episodes).
**Data model:** New `ShareBundle` table: `id, title, createdBy, shareCode, expiresAt` with
a join table `ShareBundleItem (bundleId, projectId, order)`.
**Route:** `/b/[code]` — shows a playlist view.
**Use case:** "Here's the full pilot season of ANSWERS. Episodes 1–3."

---

## 4. Tracking & Observability

### Per-Share Analytics

| Signal | Table | Column |
|--------|-------|--------|
| Link opened | ContentAccessLog | action = 'view' |
| Audio started | ContentAccessLog | action = 'play' |
| Audio completed | ContentAccessLog | action = 'complete' |
| Download | ContentAccessLog | action = 'download' |
| Time on page | (not tracked yet) | needs JS beacon |

### Writer Dashboard Metrics (to add to project page)

```
Audio Performance — ANSWERS Final Draft
  Shares:    8 sent      Opened: 5 (63%)     Listened: 4 (50%)
  Avg plays: 2.3×        Avg listen time: 47 min (of 62 min total)
  Downloads: 2           Last activity: 2 hours ago
```

### Admin Analytics (already built at `/admin/analytics`)
Extend to show:
- Scripts shared per day
- Avg time-to-first-listen (share sent → first play)
- Conversion rate: share → Reader account signup
- Top content by share engagement

---

## 5. Agent Distribution Workflow

The full recommended flow for a writer sending to agents:

```
Writer finishes script
        │
        ▼
[Generate Audio] → Job completes → Email notification
        │
        ▼
[Listen] → Writer approves quality
        │
        ▼
[Share] → Enter agent emails + personalized note
        │
        ├──→ Resend email: "▶ Listen to ANSWERS"  (each agent)
        │         │
        │         ▼
        │   Agent clicks link → /s/abc123 → Stream player
        │         │ (no account required)
        │         ▼
        │   ContentAccessLog: view + play events
        │
        ▼
[Share Dashboard] → Writer sees who listened
        │
        ├──→ "Sarah hasn't listened" → Resend reminder
        └──→ "John loved it" → Follow up
```

---

## 6. Technical Implementation Plan

### Sprint v3.1 (P0 — 1 week, ~12 SP)

| ID | SP | Task |
|----|-----|------|
| SH-01 | 3 | `POST /api/projects/[id]/share/bulk` — create N ScriptShare rows + fire Resend emails |
| SH-02 | 2 | Resend email template: `share-invite.tsx` with play button |
| SH-03 | 3 | `/projects/[id]/shares` page — share dashboard with engagement table |
| SH-04 | 2 | "Deactivate" toggle — `PATCH /api/projects/[id]/share/[shareId]` sets isActive=false |
| SH-05 | 2 | Play/complete events in `/s/[code]` page → POST to ContentAccessLog |

### Sprint v3.2 (P1 — 2 weeks, ~18 SP)

| ID | SP | Task |
|----|-----|------|
| SH-06 | 3 | Scene-level share — wire `sceneIndex` to player |
| SH-07 | 3 | Share bundle (`/b/[code]`) — new schema + playlist player |
| SH-08 | 3 | Reminder email (7-day unopened) — Resend scheduled send |
| SH-09 | 2 | Expiry email (3-day warning) — CRON job |
| SH-10 | 3 | Writer analytics card on project page (% opened, avg plays) |
| SH-11 | 2 | Reader library push — when share recipient has SM account, auto-add |
| SH-12 | 2 | QR code download — `qrcode` library, show on share creation modal |

---

## 7. Database Schema Changes Needed

### v3.1 (no schema changes — existing ScriptShare handles it)

### v3.2

```sql
-- Share bundles
CREATE TABLE share_bundles (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title         TEXT NOT NULL,
  created_by    TEXT NOT NULL REFERENCES profiles(id),
  share_code    TEXT UNIQUE NOT NULL,
  expires_at    TIMESTAMP,
  is_active     BOOLEAN DEFAULT true,
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE share_bundle_items (
  bundle_id     UUID REFERENCES share_bundles(id) ON DELETE CASCADE,
  project_id    UUID REFERENCES projects(id) ON DELETE CASCADE,
  position      INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY   (bundle_id, project_id)
);
```

### Extend ContentAccessLog

```sql
-- Add listen completion tracking
ALTER TABLE content_access_logs ADD COLUMN progress_pct NUMERIC(5,2);
ALTER TABLE content_access_logs ADD COLUMN session_duration_s INTEGER;
```

---

## 8. Priority Summary

For the 3-day launch window, no sharing changes are blocking. The existing short-link share
(`/s/[code]`) is fully functional for manual agent outreach.

Post-launch priority:
1. **Bulk share + dashboard** (SH-01 through SH-05) — biggest UX upgrade, writer workflow
2. **Email-native share** (SH-02 template polish) — drives agent engagement  
3. **Scene-level talent share** (SH-06) — unique differentiator vs competitors
4. **Analytics card** (SH-10) — gives writers confidence their audio is being heard

---

*Informed by: ScriptShare schema (packages/web/prisma/schema.prisma), existing /s/[code] page,
ReaderLibrary model, ContentAccessLog, and competitive analysis (FEATURE-ROADMAP-2026-05-06.md).*
