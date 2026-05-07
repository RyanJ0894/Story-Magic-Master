# Sprint Plan — 2026-05-07

Unified sprint plan from all three review parts (Code Review V3 + UX + Data Tiers).

---

## Sprint H: Data Integrity + UX Polish (~21 SP)

### Tier 1: CRITICAL Data Fixes (7 SP)

| ID | SP | Task | File / Location |
|----|-----|------|-----------------|
| DT-C1 | 3 | Credit webhook idempotency — add `stripeSessionId` unique to `CreditTransaction`, upsert in webhook handler | `stripe/webhook/route.ts` + `schema.prisma` + new migration |
| DT-C2 | 2 | HumanReview FK constraints — add `job Job @relation` + `user Profile @relation` to schema | `schema.prisma` + migration |
| DT-C3 | 1 | ProjectComment missing DB FK — `ALTER TABLE` to add FK on `user_id` | new migration SQL only |
| UX-P0 | 2 | CommentsSidebar delete: add confirmation + loading state + error feedback | `CommentsSidebar.tsx:82` |

### Tier 2: HIGH Priority (5 SP)

| ID | SP | Task | File / Location |
|----|-----|------|-----------------|
| DT-H1 | 3 | PodcastFeed: denormalize `userId` + add ownership/rss-slug indexes | `schema.prisma` + migration (backfill needed) |
| DT-H2 | 1 | CreditTransaction: add `@@index([jobId])` + `@@index([profileId, createdAt(sort: Desc)])` | `schema.prisma` + migration |
| UX-P1 | 1 | VoiceCloneUploader: add loading indicator on "View clones" button | `VoiceCloneUploader.tsx:142` |

### Tier 3: MEDIUM Priority (5 SP)

| ID | SP | Task | File / Location |
|----|-----|------|-----------------|
| DT-M1 | 1 | VoiceClone: add `@@unique([elevenLabsVoiceId])` constraint | `schema.prisma` + migration |
| DT-M2 | 1 | ProjectComment: add `@@index([projectId, sceneIndex])` + timestamp index | `schema.prisma` + migration |
| DT-M3 | 5 | WebhookEndpoint: `WebhookDeliveryLog` model + rotation endpoint | new model + migration + route |
| UX-P1b | 1 | AudioChooser mobile dialog height fix | `audio-chooser.tsx:259` |

### Tier 4: UX Refactor (4 SP)

| ID | SP | Task | File / Location |
|----|-----|------|-----------------|
| UX-R1 | 3 | AudioChooser: collapse scenes by default; reduce 90+ element cognitive load | `audio-chooser.tsx:300+` |
| DT-L1 | 1 | Remove redundant `@@index([keyHash])` from ApiKey (keep `@unique`) | `schema.prisma` |

---

## Sprint I: Post-Launch Backlog

| ID | SP | Task |
|----|-----|------|
| POST-01 | 3 | Rebase PR #27 (`feat/enterprise-master-account`) |
| POST-02 | 2 | Corpus ingestion on Render (blocked: Ryan's AI keys) |
| POST-03 | 2 | Share modal "View all" > 5 pagination |
| UX-C1 | 2 | Fix carryover P0s from 2026-05-06: share modal field explosion |
| UX-C2 | 2 | Fix carryover P0s from 2026-05-06: admin settings 16 controls |

---

## Ryan Actions (External — No Sprint Needed)

| Action | Impact |
|--------|--------|
| DNS CNAME `app.storymagicapp.net` → Render | P0 — custom domain live |
| Stripe production account + Doppler keys | P0 — revenue |
| Stripe webhook `checkout.session.completed` event | P0 — subscriptions |
| Clerk TOTP for admin org | P1 — admin MFA |
