# Story Magic — Data Flow Diagram

**Version:** 1.0  
**Date:** 2026-04-25  
**Audience:** SOC 2 auditors, security reviewers, engineering

---

## System Overview

```
User Browser
    │
    │ HTTPS / Clerk JWT
    ▼
┌───────────────────────────────────────┐
│  Web Service (Next.js 14, port 22000)  │
│  Render.com — Node 20 runtime          │
│                                        │
│  ┌──────────────────────────────────┐  │
│  │  clerkMiddleware (auth)           │  │
│  │  withProjectAuth (ownership)      │  │
│  │  withAdminAuth (admin only)       │  │
│  └──────────────────────────────────┘  │
│                                        │
│  API Routes (/api/**)                  │
│  App Pages (/dashboard, /projects, …) │
└──────────────┬────────────────────────┘
               │
     ┌─────────┴──────────┐
     │                    │
     ▼                    ▼
┌──────────┐    ┌─────────────────────────────┐
│PostgreSQL│    │  Orchestrator Service         │
│(Render   │    │  (Express, port 22002)        │
│managed)  │    │                               │
│          │    │  POST /generate-scenes        │
│  Tables: │    │  POST /orchestrate            │
│  users   │    │  POST /analyze                │
│  projects│    │                               │
│  jobs    │◄───│  ┌────────────────────────┐  │
│  audit_  │    │  │  authMiddleware (JWT)   │  │
│   logs   │    │  │  ownership check       │  │
│  team*   │    │  │  (BL-013)              │  │
│  ...     │    │  └────────────────────────┘  │
└──────────┘    │                               │
                │  Director Pipeline:           │
                │  → LLM (Claude Sonnet 4.6)   │
                │  → ElevenLabs TTS             │
                │  → FFmpeg mixer               │
                └───────────────────────────────┘
```

---

## Data Classification

| Data Type | Classification | Storage | Encryption |
|-----------|---------------|---------|-----------|
| Script text (original) | CONFIDENTIAL | `Project.scriptText` (PostgreSQL) | AES-256-GCM (BL-017) when `FIELD_ENCRYPTION_KEY` set |
| Generated audio | INTERNAL | Supabase Storage / R2 | TLS in transit; bucket ACL |
| User PII (name, email) | PERSONAL | Clerk (primary); `Profile` table (sync) | Clerk-managed; TLS |
| Stripe payment data | FINANCIAL | Stripe (not stored locally) | PCI-DSS via Stripe |
| Audit logs | INTERNAL | `audit_logs` table (PostgreSQL) | TLS in transit |
| API keys / secrets | SECRET | Render env vars; `.env.local` (local) | Never logged or returned in API responses |

---

## Authentication & Authorization Flow

```
1. User → Browser → Clerk (sign-in)
2. Clerk → Browser: short-lived JWT (session token)
3. Browser → Web API: request + Authorization: Bearer <JWT>
4. Web API → Clerk SDK: auth() / clerkMiddleware() verifies JWT
5. Web API → PostgreSQL: ownership check via withProjectAuth
6. Web API → Orchestrator: forwards Clerk JWT in Authorization header
7. Orchestrator → Clerk: verifies JWT via authMiddleware
8. Orchestrator → PostgreSQL: ownership check (req.user.id vs project.userId)
```

---

## Script Processing Data Flow

```
1. User uploads/types script in browser
2. Browser → POST /api/projects/[id] (PATCH) — script_text saved to DB
   └── Project.scriptText encrypted before write (BL-017)
3. User triggers generation → POST /api/generate → Redis queue job created
4. Queue worker → POST http://orchestrator/generate-scenes
   └── Ownership verified (BL-013)
   └── Pre-flight: char/page limits checked (BL-008)
5. Orchestrator → Anthropic Claude API: script parsing + voice assignment
6. Orchestrator → ElevenLabs API: TTS synthesis per dialogue line
7. Orchestrator → FFmpeg: audio mixing (timeline + crossfades + normalization)
8. Orchestrator → Supabase Storage: upload final M4A/MP3
9. Orchestrator → PostgreSQL: update job status, store audio_urls
10. Browser polls job status → displays player when complete
```

---

## External Service Dependencies

| Service | Purpose | Data Shared | DPA Status |
|---------|---------|------------|-----------|
| Clerk | Authentication | User email, name, session tokens | Signed |
| Anthropic | LLM (script parsing, scoring) | Script text, dialogue excerpts | Pending |
| ElevenLabs | TTS synthesis | Dialogue text per character | Pending |
| Stripe | Payment processing | Customer ID, subscription data | Signed (Stripe standard) |
| Render.com | Hosting | Application code, env vars | SOC 2 in progress |
| Supabase | File storage (audio) | Audio file bytes | Pending |
| Upstash | Redis queue | Job payloads (project_id, scene count) | Pending |
| Cloudflare R2 | Impact audio storage | Audio bytes for public stories | Pending |

---

## Data Retention

| Data Type | Current Retention | Target (SOC 2) |
|-----------|------------------|----------------|
| Script text | Indefinite (user-controlled delete) | Until account deletion + 30 days |
| Generated audio | Indefinite | 7 years (enterprise) / 1 year (standard) |
| Audit logs | Indefinite | 7 years (SOC 2 Type II requirement) |
| Job records | Indefinite | 1 year |
| User PII | Until account deletion | Until deletion + 30 days |

**Note:** Retention policy enforcement not yet implemented. Manual deletion only.

---

*Last updated: 2026-04-25. See also: `docs/SOC2_CONTROLS.md`, `docs/INCIDENT_RESPONSE.md`*
