# Requirements Sync
**Date:** February 1, 2026
**Sources:** REQUIREMENTS.md, MVP_SAAS_PLAN.md, ENTERPRISE_READINESS.md, FULL_CAPABILITY_PLAN.md

---

## Requirements Matrix

### P0 Requirements (Must Have)

| Requirement | Status | Implementation | Gap |
|-------------|--------|----------------|-----|
| **Long-context processing (90-120 pages)** | Not Started | No chunking, no state persistence | Entire feature missing |
| Scene-based chunking | Not Started | — | Need INT/EXT splitting + batch processing |
| State checkpoint/resume | Not Started | — | Need Supabase partial save + resume |
| Character registry across chunks | Not Started | — | Voice map not persisted between chunks |
| **LLM determinism** | Partial (40%) | Validators catch some drift | No seed, inconsistent temperature, explicit randomization |
| JSON mode structured output | Done | Zod validation at boundaries | — |
| Voice consistency enforcement | Partial | Per-scene only, not cross-scene | Global voice map needed |
| Audio selection rules | Partial | Logic exists, no intensity thresholds | Need 0.0-1.0 scale |
| Output verification | Partial | Schema validation | No line_id cross-reference |
| Confidence scoring | Not Started | — | No metrics on any selection |

### P1 Requirements

| Requirement | Status | Implementation | Gap |
|-------------|--------|----------------|-----|
| **Audio selection quality** | Partial (50%) | Voice matching works | Missing accent/ethnicity, time-of-day |
| Voice age/gender matching | Partial | Semantic search, no explicit constraints | — |
| Location keyword extraction | Partial | INT/EXT parsed | No validation |
| Time-of-day handling | Not Started | — | DAY/NIGHT not detected |
| Music intensity calibration | Partial | Selected but no scale | Need 0.0-1.0 |
| **Failure resilience** | Partial (30%) | Basic TTS retry | No checkpointing, no partial recovery |
| Per-line TTS retry | Partial | 3 concurrent, basic retry | No exponential backoff |
| Partial scene recovery | Not Started | — | Failed lines crash whole scene |
| Pipeline checkpointing | Not Started | — | setImmediate pattern loses state |
| Error classification | Not Started | — | All errors treated same |
| **Testing** | Minimal (18%) | 28 test files, ~95 tests | Missing pipeline E2E, audio quality, determinism |
| **Operational readiness** | Partial (60%) | Pino logging, Sentry, Checkly | Missing correlation IDs, deep health checks |

---

## MVP Feature Completeness

### Done (Ready to Ship)

| Feature | Notes |
|---------|-------|
| Script upload (PDF, TXT, FDX) | All formats working |
| Scene parsing | Automatic extraction |
| Voice assignment (AI) | Semantic embedding search |
| Audio generation (TTS) | ElevenLabs with caching |
| Audio mixing | Professional EBU R128 |
| Project dashboard | Full CRUD |
| User auth (email/password) | Supabase Auth + SSR |
| Stripe payments | Subscriptions + usage |
| Usage tracking | Per-billing-period limits |

### Partially Done (Needs Polish)

| Feature | % | What's Missing |
|---------|---|----------------|
| Voice override (manual) | 60% | API not wired in `voice-chooser.tsx` |
| Voice preview | 80% | Audio sample integration |
| Share links | 50% | Public page missing, password hashing weak |
| Audio player | 80% | Speed controls, chapter nav |
| StoryScore | 70% | UI incomplete, LLM pipeline needed |
| Story-Adviser | 40% | Suggestion generation missing |
| Revision tracking | 50% | Version history, diff view partial |

### Not Started (Blocked or Deferred)

| Feature | Reason |
|---------|--------|
| Long scripts (90+ pages) | No chunking infrastructure |
| Scene regeneration | No individual scene update API |
| Stem export | Separate track download not built |
| Project duplication | Not implemented |
| Custom voice upload | Deferred to Pro tier |
| SSO (SAML/OIDC) | Enterprise only |
| TPN/MPAA compliance | Enterprise only |
| API access | Platform feature |
| Team workspaces | Deferred |

---

## Roadmap Document Conflicts

### Conflict 1: MVP Scope
| Document | Definition |
|----------|-----------|
| PROJECT_PLAN.md | 2-week minimal: upload → generate → download |
| MVP_SAAS_PLAN.md | 10-week feature-rich: + voice preview, share, scoring |
| FULL_CAPABILITY_PLAN.md | Full platform: + marketplace, API access |

**Resolution:** Launch with PROJECT_PLAN scope (upload → generate → download) plus share links and voice override. Defer scoring to Phase 2.

### Conflict 2: Long Script Timing
| Document | Position |
|----------|----------|
| REQUIREMENTS.md | P0 priority — implies required for MVP |
| MVP_SAAS_PLAN.md | "Short scripts (≤15 pages)" for launch |
| CURRENT_STATE.md | "Currently untested/unsupported" |

**Resolution:** MVP launches with ≤15 pages. Long scripts deferred to Pro tier (Phase 3).

### Conflict 3: Pricing Tiers
| Document | Tiers |
|----------|-------|
| MVP_SAAS_PLAN.md | Free, Creator, Pro, Studio |
| PROJECT_PLAN.md | Free, Creator only |
| FULL_CAPABILITY_PLAN.md | Tiered marketplace |

**Resolution:** Launch with Free + Creator. Add Pro in Phase 2, Studio in Phase 3.

### Conflict 4: StoryScore Dimensions
| Document | Dimensions |
|----------|-----------|
| AUTOSCORE_PLAN.md | 8 dimensions |
| STORYSCORE_DESIGN.md | 12 dimensions |
| IMPLEMENTATION_ROADMAP.md | 12 dimensions |

**Resolution:** Use 12-dimension StoryScore. Backwards-compatible with 8-dimension subset.

### Conflict 5: Enterprise Architecture
| Layer | MVP Plan | Enterprise Plan |
|-------|----------|-----------------|
| Database | Single shared | Per-tenant |
| Encryption | None | Per-tenant keys |
| Auth | Email/password | SSO + MFA |
| Audit | None | 7-year immutable |

**Impact:** MVP architecture won't cleanly upgrade. Add tenant_id column and audit logging now to ease transition.

---

## Gap Analysis: What's Needed for 1.0

### Critical Blockers (22h)
1. Public share page implementation — 4h
2. Share password hashing (bcrypt) — 2h
3. Type safety cleanup (remove `as any`) — 8h
4. Input validation (Zod everywhere) — 6h
5. Prototype deprecation — 2h

### Must-Have Features (10h)
1. Voice override API wiring — 3h
2. MP3 export format — 2h
3. Basic E2E test suite — 5h

### Total to 1.0 Launch: ~32 hours
