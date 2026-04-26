# Story Magic — SOC 2 Controls Inventory

**Version:** 1.0  
**Date:** 2026-04-25  
**Status:** Draft — Sprint 6/7 implementation in progress  
**Scope:** SaaS monorepo (`story-magic/`) — web + orchestrator services

---

## Overview

This document maps Story Magic's implemented and planned controls to the five SOC 2 Trust Service Criteria (TSC):
**Security (CC)**, **Availability (A)**, **Processing Integrity (PI)**, **Confidentiality (C)**, and **Privacy (P)**.

Controls are rated: **IMPLEMENTED**, **PARTIAL**, or **PLANNED**.

---

## CC6 — Logical and Physical Access Controls

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| CC6.1 | Authentication via approved IdP | IMPLEMENTED | Clerk (`@clerk/nextjs`); JWT verification on all protected routes |
| CC6.1-MFA | Multi-factor authentication | PARTIAL | Clerk TOTP available; admin enforcement UI added (Sprint 7 BL-018); Clerk dashboard config pending |
| CC6.2 | Least-privilege access | IMPLEMENTED | Role-based: `free`, `creator`, `pro`, `studio`, `admin`; `withAdminAuth` middleware |
| CC6.3 | Project ownership enforcement | IMPLEMENTED | `withProjectAuth` (web), `req.user` ownership checks (orchestrator BL-013) |
| CC6.3-TEAM | Team-shared project access | IMPLEMENTED | `withProjectAuth` OR clause checks `TeamShare` + `TeamMember.acceptedAt` (BL-014) |
| CC6.6 | Remote access controls | IMPLEMENTED | All API routes require Clerk JWT; rate limiting via `rateLimit()` |
| CC6.7 | Transmission encryption | IMPLEMENTED | TLS enforced via Render.com/Vercel (HTTPS only); HSTS headers |

---

## CC7 — System Operations

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| CC7.1 | Vulnerability detection | PARTIAL | GitHub Actions CI runs `pnpm lint`; no automated SAST yet |
| CC7.2 | Monitoring and alerting | PARTIAL | Sentry (error tracking); Checkly heartbeats; no SIEM |
| CC7.3 | Incident response | PARTIAL | See `docs/INCIDENT_RESPONSE.md` (stub) |
| CC7.4 | Anomaly detection | PLANNED | Audit log analysis; not yet automated |

---

## CC8 — Change Management

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| CC8.1 | Code review before deploy | IMPLEMENTED | GitHub PRs required; branch protection on `main` |
| CC8.1-CI | Automated tests in CI | IMPLEMENTED | 1,337+ tests via `pnpm test`; must pass before merge |
| CC8.1-TYPES | TypeScript strict mode | IMPLEMENTED | `strict: true`; 0 type errors in baseline |

---

## CC9 — Risk Mitigation

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| CC9.1 | Vendor risk assessment | PARTIAL | Clerk (SOC 2 certified); Render (SOC 2 in progress); ElevenLabs (DPA available) |
| CC9.2 | Business continuity | PLANNED | Render auto-scaling; DB backups via Supabase/Render managed PostgreSQL |

---

## A1 — Availability

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| A1.1 | Uptime SLA | PLANNED | Target 99.9%; Checkly monitors `/health` endpoint |
| A1.2 | Capacity planning | PARTIAL | Connection pool 16 total (8/service); Redis queue buffers peak load |
| A1.3 | Backup and recovery | PARTIAL | PostgreSQL managed backups; no documented RTO/RPO yet |

---

## C1 — Confidentiality

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| C1.1 | Data classification | PARTIAL | Script text = CONFIDENTIAL; audio output = INTERNAL |
| C1.2 | Encryption at rest | PARTIAL | `FIELD_ENCRYPTION_KEY` + AES-256-GCM for `Project.scriptText` (BL-017 PoC); DB-level encryption via managed PostgreSQL |
| C1.3 | Encryption in transit | IMPLEMENTED | TLS 1.2+ on all endpoints |
| C1.4 | Data access logging | PARTIAL | `logReadAccess()` on GET project, export endpoints (BL-015); full coverage in progress |
| C1.5 | NDA / DPA with vendors | PARTIAL | Clerk DPA signed; others pending |

---

## P1 — Privacy

| Control ID | Description | Status | Implementation |
|------------|-------------|--------|---------------|
| P1.1 | Privacy notice | PLANNED | No public privacy policy yet |
| P1.2 | Data subject rights | PARTIAL | Account deletion via Clerk; `project.delete` cascade; no formal DSR process |
| P1.3 | Data retention | PLANNED | No defined retention policy; audit logs persist indefinitely |

---

## Audit Logging Coverage

| Event Type | Logged | Implementation |
|------------|--------|---------------|
| User signup | Yes | Clerk webhook → `user.signup` |
| User update | Yes | `logAuditEvent(USER_UPDATE)` |
| User delete | Partial | `logDeletion()` added (BL-015) — needs webhook trigger |
| Project create | Yes | `logAuditEvent(PROJECT_CREATE)` |
| Project read | Yes | `logReadAccess()` on GET /api/projects/[id] (BL-015) |
| Project delete | Yes | `logDeletion()` on DELETE /api/projects/[id] (BL-015) |
| Audio download | Yes | `logReadAccess(AUDIO_DOWNLOAD)` on export route (BL-015) |
| Script text read | Planned | Needs `SCRIPT_READ` log on orchestrator pipeline |
| Subscription change | Yes | `logAuditEvent(SUBSCRIPTION_*)` |
| Admin action | Yes | `withAdminAuth` routes log `ADMIN_*` events |
| Cross-tenant attempt | Yes | `log.warn()` in ownership check middleware |

---

## Open Gaps (Priority Order)

1. **No SAST pipeline** — Add `npm audit` + Snyk/CodeQL to GitHub Actions CI
2. **Audit log retention policy** — Define 7-year retention; implement log archival
3. **FIELD_ENCRYPTION_KEY rotation procedure** — Document key rotation for `Project.scriptText` re-encryption
4. **Privacy policy** — Required for SOC 2 Type II; legal review pending
5. **Data subject request (DSR) process** — Formal GDPR/CCPA deletion procedure
6. **SIEM integration** — Route `AuditLog` entries to CloudWatch / Datadog for alerting
7. **Penetration test** — External pentest before SOC 2 Type II audit engagement
8. **Clerk 2FA enforcement** — Enable TOTP requirement for admin org in Clerk dashboard

---

*Last updated: 2026-04-25. See also: `docs/DATA_FLOW.md`, `docs/INCIDENT_RESPONSE.md`*
