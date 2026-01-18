# Enterprise Readiness Plan

**Target Clients:** Major Studios (Warner Bros, Disney, Netflix, etc.)
**Classification:** Confidential

## Executive Summary

To serve enterprise entertainment clients, Story Magic must transform from a working prototype into a production-grade platform that meets the security, compliance, and operational standards expected by major studios. This document outlines the comprehensive changes required across architecture, security, compliance, and operations.

### Key Enterprise Requirements

| Requirement | Current State | Target State |
|-------------|---------------|--------------|
| Security Certification | None | SOC 2 Type II, ISO 27001 |
| Content Protection | None | TPN/MPAA compliant |
| Authentication | None | SSO (SAML/OIDC) + MFA |
| Data Encryption | Partial (HTTPS) | At-rest + In-transit + In-use |
| Audit Logging | None | Complete chain of custody |
| Multi-tenancy | None | Full isolation per client |
| Availability | Unknown | 99.9% SLA |
| Data Residency | US only | Configurable per client |

---

## 1. Security Architecture

### 1.1 Content Protection (Critical for Studios)

**Why this matters:** Unreleased scripts are worth millions. A leak can cost a studio $50M+ in marketing pivots and competitive damage. Warner Bros and Disney have terminated vendors for lesser breaches.

#### Content Classification

```
┌─────────────────────────────────────────────────────────────────┐
│                    CONTENT CLASSIFICATION                        │
├─────────────────────────────────────────────────────────────────┤
│  HIGHLY CONFIDENTIAL                                             │
│  • Unreleased scripts (pre-production)                          │
│  • Plot details, character names, storylines                     │
│  • Audio output files (voices reveal character details)          │
│                                                                  │
│  CONFIDENTIAL                                                    │
│  • Voice assignments, casting implications                       │
│  • Production timelines inferred from processing                 │
│  • Project names and internal codenames                          │
│                                                                  │
│  INTERNAL                                                        │
│  • Processing logs (sanitized)                                   │
│  • System metrics                                                │
│  • Error reports (without content)                               │
└─────────────────────────────────────────────────────────────────┘
```

#### TPN (Trusted Partner Network) Compliance

Studios require vendors to be TPN-assessed. Key requirements:

| Control | Implementation |
|---------|----------------|
| Physical Security | Cloud provider certification (AWS/Azure/GCP) |
| Network Security | VPC isolation, no public endpoints |
| Access Control | Role-based, MFA required |
| Data Handling | Encryption at rest, secure deletion |
| Incident Response | 24-hour notification requirement |
| Background Checks | All personnel with data access |
| Penetration Testing | Annual third-party assessment |

#### Content-Aware Security Controls

```python
# Every API request must log content access
class ContentAccessLog:
    timestamp: datetime
    user_id: str
    client_id: str          # Studio tenant
    project_id: str
    action: str             # "upload_script", "generate_audio", "download"
    content_hash: str       # SHA-256 of content (not content itself)
    ip_address: str
    user_agent: str
    geo_location: str
    session_id: str

# Implement watermarking for audio outputs
class AudioWatermark:
    project_id: str
    generation_timestamp: datetime
    user_id: str
    # Embedded in audio as inaudible signature
    # If audio leaks, can trace source
```

---

### 1.2 Authentication & Authorization

#### Identity Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    IDENTITY FLOW                                 │
│                                                                  │
│  Studio IdP (Okta/Azure AD)                                     │
│         │                                                        │
│         ▼ SAML/OIDC                                             │
│  ┌─────────────────┐                                            │
│  │  Story Magic    │                                            │
│  │  Auth Gateway   │◄─── MFA Required                           │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │   JWT Token     │────▶│  API Gateway    │                   │
│  │  (short-lived)  │     │  (rate limit)   │                   │
│  └─────────────────┘     └────────┬────────┘                   │
│                                   │                              │
│           ┌───────────────────────┼───────────────────────┐     │
│           ▼                       ▼                       ▼     │
│    ┌──────────┐           ┌──────────┐           ┌──────────┐  │
│    │ Director │           │Orchestr- │           │ Storage  │  │
│    │  Agent   │           │  ator    │           │ Service  │  │
│    └──────────┘           └──────────┘           └──────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

#### Role-Based Access Control (RBAC)

```yaml
roles:
  studio_admin:
    description: "Studio IT/Security team"
    permissions:
      - manage_users
      - view_audit_logs
      - configure_project_settings
      - delete_content
    cannot:
      - view_script_content  # Separation of duties

  producer:
    description: "Content creator/approver"
    permissions:
      - upload_scripts
      - trigger_generation
      - download_outputs
      - view_project_content
    restrictions:
      - own_projects_only

  editor:
    description: "Audio post-production"
    permissions:
      - download_outputs
      - view_audio_stems
    cannot:
      - view_full_script
      - upload_new_scripts

  viewer:
    description: "Review-only access"
    permissions:
      - stream_audio  # No download
      - view_project_metadata
    cannot:
      - download_anything

  api_service:
    description: "Automated integrations"
    permissions:
      - defined_per_integration
    restrictions:
      - ip_allowlist_required
      - no_interactive_login
```

#### Session Management

```python
class SessionPolicy:
    max_session_duration = timedelta(hours=8)      # Force re-auth daily
    idle_timeout = timedelta(minutes=30)           # Lock after inactivity
    max_concurrent_sessions = 2                    # Limit session sprawl
    require_mfa = True
    allowed_ip_ranges = ["studio_vpn_range"]       # Optional IP restriction

    # High-risk actions require step-up auth
    step_up_required_for = [
        "download_script",
        "download_final_audio",
        "bulk_export",
        "delete_project"
    ]
```

---

### 1.3 Encryption Strategy

#### Data States

| State | Method | Key Management |
|-------|--------|----------------|
| **At Rest** | AES-256-GCM | AWS KMS / Azure Key Vault |
| **In Transit** | TLS 1.3 | Auto-rotated certificates |
| **In Processing** | Memory encryption | Confidential computing (future) |
| **In Backups** | AES-256 + separate key | Offline key escrow |

#### Per-Client Encryption Keys

```
┌─────────────────────────────────────────────────────────────────┐
│                    KEY HIERARCHY                                 │
│                                                                  │
│  Master Key (HSM-protected)                                      │
│         │                                                        │
│         ├──▶ Warner Bros Tenant Key                             │
│         │         │                                              │
│         │         ├──▶ Project "Batman 2027" Key                │
│         │         │         │                                    │
│         │         │         ├──▶ Script encryption key          │
│         │         │         └──▶ Audio encryption key           │
│         │         │                                              │
│         │         └──▶ Project "Superman 2028" Key              │
│         │                                                        │
│         └──▶ Disney Tenant Key                                  │
│                   │                                              │
│                   └──▶ Project "Frozen 4" Key                   │
└─────────────────────────────────────────────────────────────────┘
```

**Key Rotation:**
- Master key: Annual rotation with HSM ceremony
- Tenant keys: Quarterly rotation, automatic
- Project keys: Generated per project, destroyed on project deletion

---

### 1.4 Network Security

#### Zero-Trust Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    NETWORK ARCHITECTURE                          │
│                                                                  │
│  INTERNET                                                        │
│      │                                                           │
│      ▼                                                           │
│  ┌─────────────────┐                                            │
│  │   WAF / DDoS    │  CloudFlare / AWS Shield                   │
│  │   Protection    │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │   API Gateway   │  Rate limiting, auth validation            │
│  │   (Public)      │  IP allowlisting per client                │
│  └────────┬────────┘                                            │
│           │                                                      │
│  ═══════════════════ VPC BOUNDARY ═══════════════════           │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  App Tier       │────▶│  Data Tier      │                   │
│  │  (Private)      │     │  (Isolated)     │                   │
│  │                 │     │                 │                   │
│  │  • Director     │     │  • PostgreSQL   │                   │
│  │  • Orchestrator │     │  • Redis        │                   │
│  │  • Workers      │     │  • Object Store │                   │
│  └─────────────────┘     └─────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  External APIs  │  ElevenLabs, OpenAI (via NAT Gateway)     │
│  │  (Egress only)  │  Allowlisted destinations only            │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Network Segmentation

```yaml
vpc_config:
  cidr: "10.0.0.0/16"

  subnets:
    public:
      cidr: "10.0.1.0/24"
      purpose: "API Gateway, Load Balancers"
      internet_access: true

    private_app:
      cidr: "10.0.10.0/24"
      purpose: "Director, Orchestrator"
      internet_access: false  # NAT Gateway only

    private_data:
      cidr: "10.0.20.0/24"
      purpose: "Databases, Storage"
      internet_access: false
      ingress_from: ["private_app"]  # Only app tier can access

    private_workers:
      cidr: "10.0.30.0/24"
      purpose: "Audio processing workers"
      internet_access: false
      egress_to: ["elevenlabs.io", "api.openai.com"]
```

---

## 2. Multi-Tenancy Architecture

### 2.1 Isolation Model

Studios require **strong isolation** - Warner Bros content must never be accessible to Disney users, even through bugs or misconfigurations.

#### Database Isolation Options

| Model | Isolation | Cost | Complexity | Recommendation |
|-------|-----------|------|------------|----------------|
| Shared DB, shared schema | Low | $ | Low | ❌ Not acceptable |
| Shared DB, separate schemas | Medium | $$ | Medium | ⚠️ Minimum viable |
| Separate databases | High | $$$ | High | ✅ Recommended |
| Separate clusters | Very High | $$$$ | Very High | 🏆 Enterprise tier |

**Recommended: Separate Databases per Client**

```
┌─────────────────────────────────────────────────────────────────┐
│                    TENANT ISOLATION                              │
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  Warner Bros    │     │     Disney      │                   │
│  │                 │     │                 │                   │
│  │  ┌───────────┐  │     │  ┌───────────┐  │                   │
│  │  │ Director  │  │     │  │ Director  │  │                   │
│  │  │ Instance  │  │     │  │ Instance  │  │                   │
│  │  └─────┬─────┘  │     │  └─────┬─────┘  │                   │
│  │        │        │     │        │        │                   │
│  │  ┌─────▼─────┐  │     │  ┌─────▼─────┐  │                   │
│  │  │Orchestrat-│  │     │  │Orchestrat-│  │                   │
│  │  │   or      │  │     │  │   or      │  │                   │
│  │  └─────┬─────┘  │     │  └─────┬─────┘  │                   │
│  │        │        │     │        │        │                   │
│  │  ┌─────▼─────┐  │     │  ┌─────▼─────┐  │                   │
│  │  │  DB +     │  │     │  │  DB +     │  │                   │
│  │  │  Storage  │  │     │  │  Storage  │  │                   │
│  │  │(encrypted)│  │     │  │(encrypted)│  │                   │
│  │  └───────────┘  │     │  └───────────┘  │                   │
│  │                 │     │                 │                   │
│  │  Tenant Key: K1 │     │  Tenant Key: K2 │                   │
│  └─────────────────┘     └─────────────────┘                   │
│                                                                  │
│  Shared: Control Plane, Monitoring, Billing                     │
└─────────────────────────────────────────────────────────────────┘
```

#### Tenant Context Propagation

```python
# Every request must carry tenant context
class TenantContext:
    tenant_id: str              # "warner_bros", "disney"
    tenant_db_url: str          # Resolved from tenant registry
    tenant_storage_bucket: str
    tenant_encryption_key_id: str
    user_id: str
    session_id: str
    correlation_id: str         # For distributed tracing

# Middleware enforces tenant isolation
@app.middleware("http")
async def tenant_isolation_middleware(request: Request, call_next):
    # Extract tenant from JWT
    tenant_id = get_tenant_from_token(request.headers.get("Authorization"))

    # Validate user belongs to tenant
    if not user_authorized_for_tenant(request.state.user_id, tenant_id):
        raise HTTPException(403, "Access denied to this tenant")

    # Inject tenant-specific database connection
    request.state.db = get_tenant_database(tenant_id)
    request.state.storage = get_tenant_storage(tenant_id)

    # All queries automatically scoped to tenant
    response = await call_next(request)
    return response
```

---

### 2.2 Resource Isolation

```yaml
tenant_resource_limits:
  warner_bros:
    tier: "enterprise"
    limits:
      concurrent_jobs: 50
      daily_processing_minutes: 10000
      storage_gb: 5000
      api_requests_per_minute: 1000
    dedicated_resources:
      worker_pool: "wb-workers"
      database: "wb-postgres-cluster"

  indie_studio:
    tier: "professional"
    limits:
      concurrent_jobs: 5
      daily_processing_minutes: 500
      storage_gb: 100
      api_requests_per_minute: 100
    shared_resources:
      worker_pool: "shared-workers"
      database: "shared-postgres"
```

---

## 3. Audit & Compliance

### 3.1 Audit Log Requirements

Studios require complete chain of custody for content. Every action must be logged immutably.

#### Audit Event Schema

```typescript
interface AuditEvent {
  // Identity
  event_id: string;           // UUID
  timestamp: string;          // ISO 8601 with timezone
  tenant_id: string;
  user_id: string;
  session_id: string;
  correlation_id: string;     // Links related events

  // Action
  action: AuditAction;        // Enum of allowed actions
  resource_type: string;      // "script", "project", "audio"
  resource_id: string;

  // Context
  ip_address: string;
  user_agent: string;
  geo_location: string;

  // Outcome
  status: "success" | "failure" | "denied";
  error_code?: string;

  // Content tracking (hashes, not content)
  content_hash_before?: string;
  content_hash_after?: string;

  // Tamper-evidence
  previous_event_hash: string;  // Chain linking
  event_hash: string;           // SHA-256 of this event
}

type AuditAction =
  | "script.upload"
  | "script.view"
  | "script.delete"
  | "project.create"
  | "project.delete"
  | "generation.start"
  | "generation.complete"
  | "audio.download"
  | "audio.stream"
  | "user.login"
  | "user.logout"
  | "user.mfa_challenge"
  | "settings.change"
  | "api_key.create"
  | "api_key.revoke";
```

#### Immutable Audit Storage

```
┌─────────────────────────────────────────────────────────────────┐
│                    AUDIT LOG ARCHITECTURE                        │
│                                                                  │
│  Application                                                     │
│      │                                                           │
│      ▼ (async, non-blocking)                                    │
│  ┌─────────────────┐                                            │
│  │  Audit Queue    │  (Kafka / SQS)                             │
│  │                 │                                            │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  Audit Writer   │────▶│  Immutable      │                   │
│  │  (validates,    │     │  Storage        │                   │
│  │   chains)       │     │  (S3 + Glacier) │                   │
│  └────────┬────────┘     └─────────────────┘                   │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  Audit Index    │────▶│  SIEM Export    │                   │
│  │  (Elasticsearch)│     │  (Splunk/etc)   │                   │
│  └─────────────────┘     └─────────────────┘                   │
│                                                                  │
│  Retention: 7 years (legal hold capable)                        │
│  Access: Security team only, requires justification             │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.2 Compliance Certifications Required

| Certification | Purpose | Timeline |
|---------------|---------|----------|
| **SOC 2 Type II** | Security controls assurance | 6-12 months |
| **ISO 27001** | Information security management | 9-15 months |
| **TPN Assessment** | Entertainment industry standard | 3-6 months |
| **GDPR Compliance** | EU data protection | Ongoing |
| **CCPA Compliance** | California privacy | Ongoing |

#### SOC 2 Control Categories

```
┌─────────────────────────────────────────────────────────────────┐
│                    SOC 2 TRUST SERVICES                          │
│                                                                  │
│  SECURITY (Required)                                             │
│  □ Access controls                                               │
│  □ Network security                                              │
│  □ Encryption                                                    │
│  □ Incident response                                             │
│  □ Vulnerability management                                      │
│                                                                  │
│  AVAILABILITY (Required for SaaS)                                │
│  □ Uptime monitoring                                             │
│  □ Disaster recovery                                             │
│  □ Capacity planning                                             │
│  □ Incident management                                           │
│                                                                  │
│  CONFIDENTIALITY (Critical for studios)                          │
│  □ Data classification                                           │
│  □ Access restrictions                                           │
│  □ Secure disposal                                               │
│  □ NDA enforcement                                               │
│                                                                  │
│  PROCESSING INTEGRITY                                            │
│  □ Input validation                                              │
│  □ Error handling                                                │
│  □ Output verification                                           │
│                                                                  │
│  PRIVACY (If handling PII)                                       │
│  □ Consent management                                            │
│  □ Data subject rights                                           │
│  □ Retention policies                                            │
└─────────────────────────────────────────────────────────────────┘
```

---

### 3.3 Data Retention & Destruction

```yaml
retention_policy:
  scripts:
    active_project: "Until project deletion + 30 days"
    after_deletion: "Secure wipe within 24 hours"

  generated_audio:
    active_project: "Until project deletion + 30 days"
    after_deletion: "Secure wipe within 24 hours"

  audit_logs:
    minimum: "7 years"
    legal_hold: "Indefinite when applied"

  system_logs:
    operational: "90 days"
    security: "1 year"

  backups:
    retention: "30 days rolling"
    destruction: "Cryptographic erasure (key destruction)"

secure_deletion_process:
  1. Mark content for deletion in database
  2. Remove from active storage
  3. Queue for secure wipe (DoD 5220.22-M or cryptographic erasure)
  4. Verify deletion across all replicas
  5. Log deletion completion in audit trail
  6. Purge from backups after retention window
```

---

## 4. Infrastructure Architecture

### 4.1 Production Deployment

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION ARCHITECTURE                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                      REGION: US-WEST-2                    │   │
│  │                                                           │   │
│  │  ┌─────────────────┐     ┌─────────────────┐            │   │
│  │  │   AZ-A          │     │   AZ-B          │            │   │
│  │  │                 │     │                 │            │   │
│  │  │  ┌───────────┐  │     │  ┌───────────┐  │            │   │
│  │  │  │ Director  │  │     │  │ Director  │  │            │   │
│  │  │  │ (2 pods)  │  │     │  │ (2 pods)  │  │            │   │
│  │  │  └───────────┘  │     │  └───────────┘  │            │   │
│  │  │                 │     │                 │            │   │
│  │  │  ┌───────────┐  │     │  ┌───────────┐  │            │   │
│  │  │  │Orchestr-  │  │     │  │Orchestr-  │  │            │   │
│  │  │  │ator (3)   │  │     │  │ator (3)   │  │            │   │
│  │  │  └───────────┘  │     │  └───────────┘  │            │   │
│  │  │                 │     │                 │            │   │
│  │  │  ┌───────────┐  │     │  ┌───────────┐  │            │   │
│  │  │  │ Workers   │  │     │  │ Workers   │  │            │   │
│  │  │  │ (auto)    │  │     │  │ (auto)    │  │            │   │
│  │  │  └───────────┘  │     │  └───────────┘  │            │   │
│  │  └─────────────────┘     └─────────────────┘            │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐│   │
│  │  │                    DATA TIER                         ││   │
│  │  │                                                      ││   │
│  │  │  PostgreSQL (Multi-AZ)    Redis (Cluster)           ││   │
│  │  │  S3 (Cross-region)        Elasticsearch             ││   │
│  │  └─────────────────────────────────────────────────────┘│   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                  DR REGION: US-EAST-1                     │   │
│  │                                                           │   │
│  │  • Database replicas (async)                             │   │
│  │  • S3 cross-region replication                           │   │
│  │  • Standby infrastructure (warm)                         │   │
│  │  • RTO: 4 hours, RPO: 1 hour                            │   │
│  └─────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

### 4.2 Kubernetes Configuration

```yaml
# Director Deployment
apiVersion: apps/v1
kind: Deployment
metadata:
  name: director
  namespace: story-magic
spec:
  replicas: 4
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero-downtime deployments
  template:
    spec:
      serviceAccountName: director-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1000
        fsGroup: 1000
      containers:
      - name: director
        image: story-magic/director:${VERSION}
        resources:
          requests:
            memory: "2Gi"
            cpu: "1000m"
          limits:
            memory: "4Gi"
            cpu: "2000m"
        env:
        - name: DB_PASSWORD
          valueFrom:
            secretKeyRef:
              name: director-secrets
              key: db-password
        livenessProbe:
          httpGet:
            path: /health/live
            port: 8000
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /health/ready
            port: 8000
          initialDelaySeconds: 5
          periodSeconds: 5
        volumeMounts:
        - name: tmp
          mountPath: /tmp
          readOnly: false
      volumes:
      - name: tmp
        emptyDir:
          sizeLimit: 1Gi
      affinity:
        podAntiAffinity:
          requiredDuringSchedulingIgnoredDuringExecution:
          - labelSelector:
              matchLabels:
                app: director
            topologyKey: "topology.kubernetes.io/zone"
```

---

### 4.3 Job Queue Architecture

Replace synchronous processing with async job queue:

```
┌─────────────────────────────────────────────────────────────────┐
│                    JOB PROCESSING ARCHITECTURE                   │
│                                                                  │
│  API Request                                                     │
│      │                                                           │
│      ▼                                                           │
│  ┌─────────────────┐                                            │
│  │  Director API   │  Validates, creates job, returns job_id   │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │   Job Queue     │────▶│  Job Status DB  │                   │
│  │   (Redis/SQS)   │     │                 │                   │
│  └────────┬────────┘     └─────────────────┘                   │
│           │                       ▲                              │
│           ▼                       │ Status updates              │
│  ┌─────────────────┐             │                              │
│  │  Worker Pool    │─────────────┘                              │
│  │                 │                                            │
│  │  ┌───────────┐  │                                            │
│  │  │ Worker 1  │  │  • TTS generation                         │
│  │  │           │  │  • Alignment                               │
│  │  └───────────┘  │  • Mixing                                  │
│  │  ┌───────────┐  │  • Export                                  │
│  │  │ Worker 2  │  │                                            │
│  │  │           │  │                                            │
│  │  └───────────┘  │                                            │
│  │  ┌───────────┐  │                                            │
│  │  │ Worker N  │  │  Auto-scales based on queue depth         │
│  │  │           │  │                                            │
│  │  └───────────┘  │                                            │
│  └─────────────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │  Webhook        │  Notifies client on completion             │
│  │  Delivery       │  POST to client-configured URL             │
│  └─────────────────┘                                            │
└─────────────────────────────────────────────────────────────────┘
```

#### Job Status API

```typescript
// POST /api/v1/jobs - Create job
// Response: { job_id: "uuid", status: "queued" }

// GET /api/v1/jobs/{job_id} - Get status
interface JobStatus {
  job_id: string;
  status: "queued" | "processing" | "completed" | "failed";
  progress: {
    current_stage: string;  // "tts", "alignment", "mixing"
    scenes_completed: number;
    scenes_total: number;
    percent: number;
  };
  created_at: string;
  started_at?: string;
  completed_at?: string;
  error?: {
    code: string;
    message: string;
    retryable: boolean;
  };
  result?: {
    audio_url: string;
    manifest_url: string;
  };
}

// Webhook payload on completion
interface JobWebhook {
  event: "job.completed" | "job.failed";
  job_id: string;
  tenant_id: string;
  project_id: string;
  timestamp: string;
  result?: JobResult;
  error?: JobError;
  signature: string;  // HMAC for verification
}
```

---

## 5. SLA & Reliability

### 5.1 Service Level Agreement

```yaml
sla:
  availability:
    target: 99.9%  # ~8.7 hours downtime/year
    measurement: Monthly rolling
    exclusions:
      - Scheduled maintenance (with 72h notice)
      - Force majeure
      - Client-caused issues

  performance:
    api_latency_p99: 500ms  # Non-generation endpoints
    job_queue_time: 60s     # Time to start processing
    generation_time:        # Varies by script length
      per_page: 30s
      maximum: 2h           # For 120-page scripts

  support:
    enterprise_tier:
      response_time_critical: 15 minutes
      response_time_high: 1 hour
      response_time_medium: 4 hours
      dedicated_slack_channel: true

  credits:
    below_99.9%: 10% credit
    below_99.5%: 25% credit
    below_99.0%: 50% credit
```

### 5.2 Incident Response

```yaml
incident_severity:
  P1_critical:
    definition: "Service unavailable or data breach"
    response_time: 15 minutes
    update_frequency: 30 minutes
    escalation: VP Engineering + Security
    client_notification: Immediate

  P2_high:
    definition: "Major feature unavailable, no workaround"
    response_time: 1 hour
    update_frequency: 2 hours
    escalation: Engineering Manager
    client_notification: Within 1 hour

  P3_medium:
    definition: "Feature degraded, workaround available"
    response_time: 4 hours
    update_frequency: Daily
    escalation: On-call engineer
    client_notification: Next business day

  P4_low:
    definition: "Minor issue, cosmetic"
    response_time: Next business day
    escalation: Standard queue
    client_notification: Via release notes
```

---

## 6. API Design for Enterprise

### 6.1 API Versioning

```
/api/v1/...  # Current stable
/api/v2/...  # Next major (when breaking changes needed)

Deprecation policy:
- 12 months notice before removing API version
- Sunset header in responses: "Sunset: Sat, 01 Jan 2028 00:00:00 GMT"
- Migration guide published 6 months before sunset
```

### 6.2 Enterprise API Endpoints

```yaml
# Project Management
POST   /api/v1/projects                    # Create project
GET    /api/v1/projects                    # List projects (paginated)
GET    /api/v1/projects/{id}               # Get project details
DELETE /api/v1/projects/{id}               # Delete project (soft delete)
POST   /api/v1/projects/{id}/archive       # Archive project

# Script Upload
POST   /api/v1/projects/{id}/scripts       # Upload script
GET    /api/v1/projects/{id}/scripts/{id}  # Get script metadata (not content)
DELETE /api/v1/projects/{id}/scripts/{id}  # Delete script

# Generation Jobs
POST   /api/v1/projects/{id}/jobs          # Start generation
GET    /api/v1/projects/{id}/jobs          # List jobs
GET    /api/v1/projects/{id}/jobs/{id}     # Get job status
POST   /api/v1/projects/{id}/jobs/{id}/cancel  # Cancel job

# Audio Outputs
GET    /api/v1/projects/{id}/audio         # List outputs
GET    /api/v1/projects/{id}/audio/{id}    # Get output metadata
GET    /api/v1/projects/{id}/audio/{id}/download  # Download (signed URL)
GET    /api/v1/projects/{id}/audio/{id}/stream    # Stream (range requests)

# Admin (tenant admins only)
GET    /api/v1/admin/users                 # List users
POST   /api/v1/admin/users                 # Invite user
DELETE /api/v1/admin/users/{id}            # Remove user
GET    /api/v1/admin/audit                 # Query audit logs
GET    /api/v1/admin/usage                 # Usage reports

# Webhooks
POST   /api/v1/webhooks                    # Register webhook
GET    /api/v1/webhooks                    # List webhooks
DELETE /api/v1/webhooks/{id}               # Remove webhook
```

### 6.3 Rate Limiting

```yaml
rate_limits:
  by_tier:
    enterprise:
      requests_per_minute: 1000
      concurrent_jobs: 50
      burst_allowance: 2000

    professional:
      requests_per_minute: 100
      concurrent_jobs: 10
      burst_allowance: 200

  by_endpoint:
    # Heavy operations
    "POST /api/v1/projects/{id}/jobs":
      per_minute: 10
      concurrent: 5

    # Downloads
    "GET /api/v1/projects/{id}/audio/{id}/download":
      per_minute: 30

    # Reads (generous)
    "GET /api/v1/projects":
      per_minute: 100

  headers:
    X-RateLimit-Limit: "1000"
    X-RateLimit-Remaining: "999"
    X-RateLimit-Reset: "1640000000"
    Retry-After: "60"  # On 429
```

---

## 7. Implementation Roadmap

### Phase 1: Security Foundation (Weeks 1-4)

```
Week 1-2: Authentication & Authorization
├── Implement JWT-based authentication
├── Add RBAC with role definitions
├── Integrate with Auth0/Okta for SSO
├── Add MFA requirement
└── Implement session management

Week 3-4: Network & Encryption
├── Deploy behind API Gateway (Kong/AWS API Gateway)
├── Implement TLS 1.3 everywhere
├── Set up KMS for encryption keys
├── Configure VPC with proper segmentation
└── Add WAF rules
```

### Phase 2: Multi-Tenancy & Isolation (Weeks 5-8)

```
Week 5-6: Database Isolation
├── Design per-tenant database provisioning
├── Implement tenant context middleware
├── Add row-level security policies
├── Test isolation (penetration testing)
└── Document tenant onboarding process

Week 7-8: Storage & Processing Isolation
├── Per-tenant S3 buckets with separate keys
├── Worker pool isolation per tenant tier
├── Implement resource quotas
└── Add usage metering
```

### Phase 3: Audit & Compliance (Weeks 9-12)

```
Week 9-10: Audit Logging
├── Design audit event schema
├── Implement audit middleware
├── Set up immutable log storage
├── Build audit query API
└── Integrate with SIEM

Week 11-12: Compliance Documentation
├── Document security controls
├── Prepare SOC 2 evidence
├── Schedule TPN assessment
├── Create security questionnaire responses
└── Develop incident response playbooks
```

### Phase 4: Operational Excellence (Weeks 13-16)

```
Week 13-14: Job Queue & Async Processing
├── Implement job queue (Bull/SQS)
├── Add progress tracking
├── Implement webhooks
├── Add job retry/recovery
└── Build admin dashboard

Week 15-16: Monitoring & Reliability
├── Implement health checks (deep)
├── Set up monitoring (DataDog/New Relic)
├── Configure alerting
├── Build runbooks
├── Conduct chaos engineering tests
└── Document SLA measurement
```

### Phase 5: Enterprise Features (Weeks 17-20)

```
Week 17-18: API Hardening
├── API versioning
├── Rate limiting per tenant
├── Request signing
├── SDK development (Python, JavaScript)
└── OpenAPI documentation

Week 19-20: Final Certification
├── Penetration testing (third party)
├── SOC 2 Type I audit
├── Security review with first enterprise client
├── Go-live preparation
└── Support training
```

---

## 8. Cost Estimation

### 8.1 Infrastructure Costs (Monthly)

| Component | Specification | Est. Cost |
|-----------|--------------|-----------|
| Kubernetes (EKS) | 3 node pools, multi-AZ | $2,000 |
| PostgreSQL (RDS) | db.r6g.xlarge, Multi-AZ | $800 |
| Redis (ElastiCache) | cache.r6g.large, cluster | $400 |
| S3 Storage | 5TB + cross-region | $200 |
| API Gateway | 10M requests | $350 |
| CloudFront | 1TB egress | $150 |
| WAF | Standard rules | $100 |
| KMS | 1000 key operations | $50 |
| Monitoring | DataDog Pro | $500 |
| **Total Infrastructure** | | **~$4,550/mo** |

### 8.2 External API Costs (Per Project)

| Service | Usage | Est. Cost |
|---------|-------|-----------|
| ElevenLabs TTS | 100 pages × 3 chars × 50 words | $15-50 |
| OpenAI (Director LLM) | 120 pages analysis | $5-20 |
| OpenAI Whisper | 60 min alignment | $5-10 |
| **Total per 120-page script** | | **~$25-80** |

### 8.3 Compliance Costs (One-Time)

| Item | Est. Cost |
|------|-----------|
| SOC 2 Type II Audit | $30,000-50,000 |
| TPN Assessment | $10,000-20,000 |
| Penetration Testing | $15,000-25,000 |
| Legal (contracts, NDAs) | $10,000-20,000 |
| **Total Compliance** | **~$65,000-115,000** |

---

## 9. Success Criteria

### 9.1 Security Readiness

- [ ] SOC 2 Type I report issued
- [ ] TPN assessment passed
- [ ] Zero critical vulnerabilities in pentest
- [ ] All endpoints authenticated
- [ ] Encryption at rest and in transit verified
- [ ] Audit logging operational with 7-year retention

### 9.2 Operational Readiness

- [ ] 99.9% availability demonstrated over 30 days
- [ ] RTO < 4 hours tested
- [ ] Job processing scales to 50 concurrent
- [ ] Monitoring dashboards complete
- [ ] Runbooks documented for all P1/P2 scenarios
- [ ] On-call rotation established

### 9.3 Enterprise Features

- [ ] SSO integration tested with sample IdP
- [ ] Multi-tenancy isolation verified
- [ ] Usage metering accurate
- [ ] API documentation complete
- [ ] SDK available (Python + JavaScript)
- [ ] Webhook delivery reliable

---

## Appendix A: Security Questionnaire Responses

Pre-drafted responses for common enterprise security questionnaires:

```yaml
data_handling:
  q: "Where is customer data stored?"
  a: "All data is stored in AWS US regions (us-west-2 primary, us-east-1 DR).
      Data is encrypted at rest using AES-256 with customer-dedicated keys
      managed in AWS KMS. No data is stored outside the US unless explicitly
      requested by the customer."

access_control:
  q: "How is access to customer data controlled?"
  a: "Access is controlled via RBAC with SSO integration (SAML 2.0/OIDC).
      MFA is required for all users. All access is logged to immutable
      audit storage with 7-year retention. No Story Magic employee has
      access to customer content without explicit customer authorization
      and audit trail."

incident_response:
  q: "What is your incident response process?"
  a: "We maintain a 24/7 security team with 15-minute response SLA for
      critical incidents. Customers are notified within 1 hour of confirmed
      security incidents affecting their data. We conduct post-incident
      reviews within 72 hours and share findings with affected customers."

subprocessors:
  q: "What third parties have access to customer data?"
  a: "- AWS (infrastructure): SOC 2, ISO 27001, TPN certified
      - ElevenLabs (TTS): Data processed for voice generation only,
        not retained. SOC 2 certified.
      - OpenAI (LLM): Data processed for script analysis only,
        not retained per API terms. SOC 2 certified.
      All subprocessors have DPAs in place."
```

---

## Appendix B: Compliance Checklist

### TPN Assessment Preparation

- [ ] Physical security documentation (cloud provider certs)
- [ ] Network diagram with security controls
- [ ] Access control matrix
- [ ] Encryption key management documentation
- [ ] Incident response plan
- [ ] Background check policy for personnel
- [ ] Visitor policy (N/A for remote-only)
- [ ] Asset inventory
- [ ] Vulnerability management program
- [ ] Security awareness training records

### SOC 2 Evidence Collection

- [ ] Information security policy
- [ ] Risk assessment
- [ ] Vendor management program
- [ ] Change management procedures
- [ ] Logical access controls evidence
- [ ] Encryption configuration evidence
- [ ] Monitoring and alerting configuration
- [ ] Incident response procedures
- [ ] Business continuity plan
- [ ] Employee onboarding/offboarding procedures
