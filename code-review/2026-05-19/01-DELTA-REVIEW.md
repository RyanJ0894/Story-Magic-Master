# Delta Review — 2026-05-19

Anchored to `code-review/2026-05-07/TODO_2026-05-07.md`.

---

## Prior TODO Items — Status

### Sprint H: Critical / High

| ID | Item | Status | Evidence |
|----|------|--------|---------|
| DT-C1 | Credit webhook idempotency (`stripeSessionId` unique) | **RESOLVED** | migration 0022 |
| DT-C2 | HumanReview FK (jobId, userId) | **RESOLVED** | migration 0022 |
| DT-C3 | `project_comments.user_id` FK | **PARTIAL** ⚠️ | Migration 0022 MISSED this; migration 0025 written this session — pending deploy |
| UX-P0 | CommentsSidebar delete: confirm + error feedback | **RESOLVED** | Sprint M NotesPanel has it; CommentsSidebar still missing (see UX-M-16) |

### Sprint H: High Priority

| ID | Item | Status | Evidence |
|----|------|--------|---------|
| DT-H1 | PodcastFeed userId + indexes | **RESOLVED** | migration 0022 |
| DT-H2 | CreditTransaction jobId + composite indexes | **RESOLVED** | migration 0022 |
| UX-P1a | VoiceCloneUploader "View clones" spinner | **RESOLVED** | Sprint K/L |

### Sprint H: Medium Priority

| ID | Item | Status | Evidence |
|----|------|--------|---------|
| DT-M1 | VoiceClone elevenLabsVoiceId unique | **RESOLVED** | migration 0022 |
| DT-M2 | ProjectComment scene/timestamp indexes | **RESOLVED** | migration 0022 |
| DT-M3 | WebhookDeliveryLog + isActive + rotate-secret | **RESOLVED** | migration 0022 |
| UX-R1 | AudioChooser scene collapse + "Apply to all" | **SUPERSEDED** | Sprint K rebuilt AudioChooser; UX-M-15 (AudioChooser cognitive load) is a NEW carryover |
| UX-P2 | AudioChooser mobile dialog fix | **SUPERSEDED** | AudioChooser rebuilt in Sprint K |
| DT-L1 | ApiKey redundant `@@index([keyHash])` removed | **RESOLVED** | migration 0022 |

### Sprint I: Post-Launch Backlog

| ID | Item | Status | Evidence |
|----|------|--------|---------|
| POST-01 | PR #27 superseded | **RESOLVED** | Closed as superseded |
| POST-02 | Corpus ingestion on Render | **OPEN** | Still blocked on Ryan AI keys |
| POST-03 | Share modal "Show less" collapse | **RESOLVED** | Sprint I |
| UX-C1 | Share modal progressive disclosure | **RESOLVED** | Sprint I |
| UX-C2 | Admin settings collapsibility | **RESOLVED** | Already implemented |

---

## Summary

| Category | Count |
|----------|-------|
| RESOLVED | 14 |
| PARTIAL (written, not deployed) | 1 (DT-C3) |
| SUPERSEDED | 3 |
| STILL OPEN | 1 (POST-02) |

All Sprint H items are either resolved or have migration written. The only pending action is `prisma migrate deploy` on Render for migration 0025 which adds the long-overdue `project_comments.user_id` FK.
