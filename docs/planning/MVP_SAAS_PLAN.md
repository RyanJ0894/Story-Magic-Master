# MVP SaaS 1.0 Launch Plan

**Product:** Story Magic
**Target:** Public SaaS Launch
**Goal:** Establish brand, acquire early customers, validate market

## Executive Summary

This document outlines the plan to launch Story Magic as a publicly available SaaS product. This is **not** the enterprise tier (see [ENTERPRISE_READINESS.md](ENTERPRISE_READINESS.md)) - this is the brand-building, market-validating product that proves the concept and generates revenue.

### MVP Philosophy

> "Ship the smallest thing that delivers real value, then iterate."

The MVP must:
1. **Work reliably** for the target use case (short-to-medium scripts)
2. **Demonstrate value** clearly to potential customers
3. **Generate revenue** to fund further development
4. **Build brand** through quality output and word-of-mouth
5. **Collect feedback** to guide the roadmap

### What MVP 1.0 Is NOT

- ❌ Full-length feature film scripts (90-120 pages)
- ❌ SOC 2 / TPN certified
- ❌ Multi-tenant with full isolation
- ❌ Enterprise SSO integration
- ❌ Self-hosted deployment option
- ❌ White-label / API-only access

These are **Phase 2 (Pro)** or **Phase 3 (Enterprise)** features.

---

## 1. Target Market

### Primary: Independent Creators

| Segment | Description | Pain Point |
|---------|-------------|------------|
| **Podcast Producers** | Audio drama, fiction podcasts | Manual production is slow, expensive |
| **Indie Game Developers** | Need voiced dialogue for games | Voice actors are costly, slow turnaround |
| **Audiobook Creators** | Self-published authors | Narration costs $200-500/hour |
| **Content Creators** | YouTube, TikTok storytellers | Quick audio content creation |
| **Screenwriters** | Want to hear their scripts | Table reads require actors |

### Secondary: Small Production Houses

| Segment | Description | Pain Point |
|---------|-------------|------------|
| **Animation Studios** | Pre-visualization audio | Placeholder voices before casting |
| **Ad Agencies** | Concept pitches | Quick audio mockups for clients |
| **Theater Companies** | Rehearsal audio | Scene blocking without full cast |

### NOT Target (Yet)

- Major studios (Warner Bros, Disney) → Enterprise tier
- Enterprise content teams → Enterprise tier
- Highly regulated industries → Enterprise tier

---

## 2. MVP Feature Set

### Core Features (Must Have)

| Feature | Description | Status |
|---------|-------------|--------|
| **Script Upload** | PDF, TXT, FDX (Final Draft) | 🔨 Build |
| **Scene Parsing** | Automatic scene/dialogue extraction | ✅ Exists |
| **Voice Assignment** | AI-selected voices per character | ✅ Exists |
| **Voice Override** | Manual voice selection from catalog | 🔨 Build |
| **Audio Generation** | Full scene audio with music/ambience | ✅ Exists |
| **Download Output** | MP3, WAV, M4A formats | 🔨 Build |
| **Project Dashboard** | List/manage projects | 🔨 Build |
| **Basic Auth** | Email/password, magic link | 🔨 Build |

### Enhanced Features (Should Have)

| Feature | Description | Priority |
|---------|-------------|----------|
| **Voice Preview** | Hear voice samples before generating | High |
| **Scene Preview** | Generate single scene before full script | High |
| **Regenerate Scene** | Re-run specific scene with changes | High |
| **Export Stems** | Download separate dialogue/music/SFX tracks | Medium |
| **Share Link** | Public link to listen (no download) | Medium |
| **Project Duplicate** | Clone project for variations | Low |

### Deferred to Pro/Enterprise

| Feature | Tier | Reason |
|---------|------|--------|
| Full-length scripts (90+ pages) | Pro | Requires chunking infrastructure |
| Custom voice cloning | Pro | Regulatory complexity, cost |
| SSO (SAML/OIDC) | Enterprise | Complexity |
| Dedicated infrastructure | Enterprise | Cost |
| Audit logging | Enterprise | Compliance |
| SLA guarantees | Enterprise | Operational maturity |
| API access | Pro | Requires rate limiting infrastructure |

---

## 3. Technical Architecture (MVP)

### Simplified Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                      MVP ARCHITECTURE                            │
│                                                                  │
│  ┌─────────────────┐                                            │
│  │   Frontend      │  Next.js on Vercel                         │
│  │   (Web App)     │  • Auth (NextAuth.js)                      │
│  │                 │  • Dashboard                                │
│  │                 │  • Upload/Download                          │
│  └────────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│  ┌─────────────────┐                                            │
│  │   API Gateway   │  Vercel Functions or separate Express      │
│  │                 │  • Rate limiting (basic)                   │
│  │                 │  • Auth validation                         │
│  └────────┬────────┘                                            │
│           │                                                      │
│     ┌─────┴─────┐                                               │
│     ▼           ▼                                               │
│  ┌──────────┐ ┌──────────┐                                     │
│  │ Director │ │Orchestr- │  Render.com / Railway               │
│  │  Agent   │ │  ator    │  • Auto-scaling                     │
│  └────┬─────┘ └────┬─────┘                                     │
│       │            │                                            │
│       └──────┬─────┘                                            │
│              ▼                                                   │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │   PostgreSQL    │     │   Supabase      │                   │
│  │   (Supabase)    │     │   Storage       │                   │
│  └─────────────────┘     └─────────────────┘                   │
│                                                                  │
│  External Services:                                              │
│  • ElevenLabs (TTS)                                             │
│  • OpenAI (LLM + Whisper)                                       │
│  • Stripe (Payments)                                            │
│  • Resend (Email)                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Key Simplifications from Enterprise

| Aspect | Enterprise | MVP |
|--------|------------|-----|
| Database | Per-tenant databases | Single database, tenant_id column |
| Encryption | Per-tenant keys, HSM | Database-level encryption |
| Auth | SSO + MFA required | Email/password + optional MFA |
| Infrastructure | Multi-AZ, DR region | Single region, managed services |
| Job Queue | Full async with webhooks | Simpler polling-based status |
| Monitoring | DataDog + custom dashboards | Sentry + basic metrics |

---

## 4. User Experience

### User Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                      USER JOURNEY                                │
│                                                                  │
│  1. DISCOVER                                                     │
│     Landing page → See demo → Understand value                  │
│                                                                  │
│  2. SIGN UP                                                      │
│     Email → Verify → Free tier (3 pages/month)                  │
│                                                                  │
│  3. FIRST PROJECT                                                │
│     Upload script → Preview parsing → Generate audio            │
│     (Guided onboarding with sample script option)               │
│                                                                  │
│  4. EXPERIENCE VALUE                                             │
│     Listen to output → Download → Share                         │
│                                                                  │
│  5. HIT LIMIT                                                    │
│     Free pages exhausted → Upgrade prompt                       │
│                                                                  │
│  6. CONVERT                                                      │
│     Choose plan → Payment → Continued usage                     │
│                                                                  │
│  7. RETAIN                                                       │
│     Regular usage → Feature requests → Referrals                │
└─────────────────────────────────────────────────────────────────┘
```

### Key Screens

#### Landing Page
```
┌─────────────────────────────────────────────────────────────────┐
│  STORY MAGIC                                          [Sign In] │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                                                            │ │
│  │     Turn Your Scripts Into                                │ │
│  │     Immersive Audio Experiences                           │ │
│  │                                                            │ │
│  │     AI-powered audio production for screenwriters,        │ │
│  │     podcasters, and storytellers.                         │ │
│  │                                                            │ │
│  │     [▶ Watch Demo]     [Try Free →]                       │ │
│  │                                                            │ │
│  └───────────────────────────────────────────────────────────┘ │
│                                                                  │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐              │
│  │ Upload      │ │ AI Voices   │ │ Full Mix    │              │
│  │ Your Script │ │ Auto-Assign │ │ With Music  │              │
│  └─────────────┘ └─────────────┘ └─────────────┘              │
│                                                                  │
│  [Audio Player: Sample Output]                                  │
│  ▶ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━ 2:34                         │
│                                                                  │
│  Pricing | Features | About | Blog                              │
└─────────────────────────────────────────────────────────────────┘
```

#### Dashboard
```
┌─────────────────────────────────────────────────────────────────┐
│  STORY MAGIC                    [Usage: 2/10 pages] [Account ▼] │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Your Projects                              [+ New Project]     │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 The Last Signal                           3 scenes    │   │
│  │    Status: ✅ Complete                       12 pages    │   │
│  │    Created: Jan 10, 2026                                 │   │
│  │    [▶ Play] [↓ Download] [⋮ More]                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ 📁 Midnight Coffee                           Processing  │   │
│  │    Status: ⏳ Generating Scene 2/4           8 pages     │   │
│  │    Created: Jan 14, 2026                                 │   │
│  │    [View Progress]                                       │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

#### Project Editor
```
┌─────────────────────────────────────────────────────────────────┐
│  ← Back    The Last Signal                    [⚙ Settings]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Scenes                          │  Scene 1: The Discovery      │
│  ─────────────────────────────   │  ─────────────────────────── │
│  ▸ Scene 1: The Discovery  ✅   │                               │
│  ▸ Scene 2: The Confrontation   │  Characters:                  │
│  ▸ Scene 3: The Resolution      │  ┌─────────────────────────┐ │
│                                  │  │ SARAH     [Voice: ▼]    │ │
│                                  │  │ Preview: "Where did..." │ │
│                                  │  └─────────────────────────┘ │
│                                  │  ┌─────────────────────────┐ │
│                                  │  │ DETECTIVE [Voice: ▼]    │ │
│                                  │  │ Preview: "Ma'am, I..."  │ │
│                                  │  └─────────────────────────┘ │
│                                  │                               │
│                                  │  Audio Settings:              │
│                                  │  Music: [Auto] ▼              │
│                                  │  Ambience: [Auto] ▼           │
│                                  │                               │
│  [Generate All Scenes]          │  [▶ Preview Scene] [Generate] │
│                                  │                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Pricing Strategy

### Tier Structure

| Tier | Price | Pages/Month | Features |
|------|-------|-------------|----------|
| **Free** | $0 | 3 pages | • 1 project<br>• Basic voices<br>• MP3 download<br>• Watermarked output |
| **Creator** | $29/mo | 50 pages | • Unlimited projects<br>• All voices<br>• All formats<br>• No watermark<br>• Priority queue |
| **Pro** | $99/mo | 200 pages | • Everything in Creator<br>• Stem export<br>• API access (100 calls/day)<br>• Longer scripts (30 pages max)<br>• Email support |
| **Studio** | $299/mo | 1000 pages | • Everything in Pro<br>• Full scripts (60+ pages)<br>• Dedicated support<br>• Custom voice uploads<br>• Priority processing |

### Pricing Psychology

1. **Free tier proves value** before asking for money
2. **Watermark on free** creates upgrade incentive
3. **Page-based pricing** aligns cost with value
4. **Monthly subscription** ensures recurring revenue
5. **Annual discount (20%)** improves cash flow

### Revenue Projections (Year 1)

| Month | Free | Creator | Pro | Studio | MRR |
|-------|------|---------|-----|--------|-----|
| 1 | 100 | 5 | 1 | 0 | $244 |
| 3 | 500 | 25 | 5 | 1 | $1,519 |
| 6 | 2000 | 100 | 20 | 5 | $5,790 |
| 12 | 5000 | 300 | 60 | 15 | $18,135 |

**Target:** $15K MRR by month 12 (ramen profitable)

---

## 6. Go-to-Market Strategy

### Launch Phases

#### Phase 0: Private Beta (4 weeks before launch)

```
Objective: Validate product with real users, fix critical bugs

Actions:
├── Invite 50 beta users from target segments
├── Provide free Creator-tier access
├── Daily feedback calls with active users
├── Bug triage and priority fixes
├── Collect testimonials for launch
└── Refine onboarding based on confusion points

Exit Criteria:
├── NPS > 40 from beta users
├── 80% of users complete first project
├── No P1 bugs open
└── 5+ video testimonials recorded
```

#### Phase 1: Soft Launch (Week 1-2)

```
Objective: Limited public availability, controlled growth

Actions:
├── Open sign-ups with waitlist
├── 100 invites per day (controlled)
├── Monitor infrastructure under load
├── Customer support via chat (founder-led)
├── Content: 3 blog posts, 2 YouTube demos
└── Reach out to 20 podcast producers personally

Channels:
├── Product Hunt (schedule for Tuesday)
├── Hacker News "Show HN"
├── Twitter/X announcement thread
├── Reddit: r/podcasting, r/screenwriting, r/audiobooks
└── Direct outreach to indie game devs (Discord)
```

#### Phase 2: Public Launch (Week 3-4)

```
Objective: Full public availability, growth push

Actions:
├── Remove waitlist
├── Launch Product Hunt campaign
├── Press outreach (TechCrunch, The Verge)
├── Influencer partnerships (3-5 YouTubers)
├── Paid ads test ($500 budget)
│   ├── Google Ads: "AI audio production"
│   ├── Reddit Ads: r/podcasting
│   └── Twitter Ads: Screenwriter audience
└── Webinar: "How to produce audio drama with AI"

Goals:
├── 1000 sign-ups
├── 50 paid conversions
├── 3 press mentions
└── Product Hunt Top 5
```

#### Phase 3: Growth (Month 2-6)

```
Objective: Sustainable growth, product-market fit

Actions:
├── Content marketing (2 posts/week)
├── SEO optimization for key terms
├── Partnership with screenwriting software
├── Podcast guest appearances
├── User-generated content program
├── Referral program launch
└── Feature requests → Pro tier upsell

Metrics to Track:
├── CAC (target: < $50)
├── LTV (target: > $200)
├── Churn (target: < 5%/month)
├── NPS (target: > 50)
└── Time to Value (target: < 10 min)
```

---

## 7. Technical Implementation Plan

### Sprint 0: Foundation (Week 1-2)

```
Goal: Monorepo setup, CI/CD, dev environment

Tasks:
├── Consolidate Director + Orchestrator into monorepo
├── Set up pnpm workspaces (or similar)
├── Create shared schema package (JSON Schema → types)
├── Set up CI/CD (GitHub Actions)
│   ├── Lint + type check
│   ├── Unit tests
│   ├── Build verification
│   └── Deploy to staging
├── Docker Compose for local development
├── Environment management (.env.example, validation)
└── Fix critical bugs from CODE_REVIEW.md
    ├── Complete requirements.txt
    ├── Fix path traversal vulnerability
    ├── Add basic input validation
    └── Delete dead code

Deliverable: Clean, working dev environment
```

### Sprint 1: Security Baseline (Week 3-4)

```
Goal: Secure enough for public launch

Tasks:
├── Authentication system
│   ├── NextAuth.js setup
│   ├── Email/password provider
│   ├── Magic link provider
│   ├── Session management
│   └── Password reset flow
├── Authorization
│   ├── User → Projects ownership
│   ├── Middleware for route protection
│   └── API endpoint auth
├── Rate limiting
│   ├── Per-user limits
│   ├── Per-IP limits for unauthenticated
│   └── Endpoint-specific limits
├── Input validation
│   ├── Script size limits
│   ├── File type validation
│   └── Sanitization
└── HTTPS everywhere + secure headers

Deliverable: Secure authentication system
```

### Sprint 2: Core Product (Week 5-6)

```
Goal: End-to-end user flow working

Tasks:
├── Frontend: Dashboard
│   ├── Project list view
│   ├── Create project flow
│   ├── Upload script interface
│   └── Project status tracking
├── Frontend: Project Editor
│   ├── Scene list view
│   ├── Character/voice display
│   ├── Voice override selector
│   └── Generate button
├── Backend: Project API
│   ├── CRUD operations
│   ├── Script upload (S3/Supabase)
│   ├── Trigger generation
│   └── Status polling
├── Backend: Generation Pipeline
│   ├── Job queue (simple Redis-based)
│   ├── Status updates
│   ├── Error handling
│   └── Completion notification
└── Integration testing

Deliverable: Users can upload → generate → download
```

### Sprint 3: Polish & Payments (Week 7-8)

```
Goal: Production-ready with monetization

Tasks:
├── Stripe integration
│   ├── Subscription plans
│   ├── Checkout flow
│   ├── Webhook handling
│   ├── Usage metering
│   └── Invoice/receipt emails
├── Usage tracking
│   ├── Page counting
│   ├── Limit enforcement
│   ├── Upgrade prompts
│   └── Usage dashboard
├── Audio player
│   ├── Embedded player component
│   ├── Download buttons
│   ├── Share link generation
│   └── Waveform visualization (nice to have)
├── Email system
│   ├── Welcome email
│   ├── Generation complete
│   ├── Usage warning (80%)
│   ├── Limit reached
│   └── Password reset
├── Error handling & UX
│   ├── Loading states
│   ├── Error messages
│   ├── Empty states
│   └── Success celebrations
└── Mobile responsiveness

Deliverable: Complete, polished product
```

### Sprint 4: Launch Prep (Week 9-10)

```
Goal: Ready for public launch

Tasks:
├── Landing page
│   ├── Hero section with demo
│   ├── Feature highlights
│   ├── Pricing table
│   ├── Testimonials
│   ├── FAQ
│   └── Footer with links
├── Documentation
│   ├── Getting started guide
│   ├── Script formatting tips
│   ├── FAQ
│   └── Contact/support
├── Legal
│   ├── Terms of Service
│   ├── Privacy Policy
│   ├── Acceptable Use Policy
│   └── DMCA/Copyright policy
├── Analytics
│   ├── PostHog or Mixpanel
│   ├── Conversion tracking
│   ├── Feature usage tracking
│   └── Error tracking (Sentry)
├── Performance testing
│   ├── Load testing
│   ├── Concurrent users
│   └── API response times
└── Beta user feedback incorporation

Deliverable: Launch-ready product
```

---

## 8. Infrastructure & Costs

### MVP Infrastructure

| Service | Purpose | Est. Cost/Month |
|---------|---------|-----------------|
| **Vercel** | Frontend hosting | $20 (Pro) |
| **Render.com** | Director + Orchestrator | $50 (2 services) |
| **Supabase** | Database + Storage + Auth | $25 (Pro) |
| **Redis** (Upstash) | Job queue, rate limiting | $10 |
| **Sentry** | Error tracking | $26 (Team) |
| **Resend** | Transactional email | $20 |
| **Domain + DNS** | name.com | $15/year |
| **Total Infrastructure** | | **~$150/month** |

### Variable Costs (Per Usage)

| Service | Cost | Est. at 1000 pages/month |
|---------|------|--------------------------|
| **ElevenLabs** | ~$0.30/1000 chars | ~$150 |
| **OpenAI GPT-4** | ~$0.03/1K tokens | ~$50 |
| **OpenAI Whisper** | $0.006/min | ~$30 |
| **Supabase Storage** | $0.021/GB | ~$10 |
| **Total Variable** | | **~$240/month** |

### Break-Even Analysis

```
Fixed costs: ~$150/month
Variable costs: ~$0.25/page

Break-even at $29/mo Creator tier:
├── Per Creator subscriber: $29 - (50 pages × $0.25) = $16.50 margin
├── Need: $150 / $16.50 = ~10 Creator subscribers

With mix of tiers:
├── 5 Creator ($145 revenue, $62.50 variable) = $82.50 margin
├── 2 Pro ($198 revenue, $100 variable) = $98 margin
├── Total: $180.50 margin > $150 fixed costs
└── Break-even: ~5 Creator + 2 Pro subscribers
```

---

## 9. Success Metrics

### North Star Metric

**Audio Minutes Generated per Month**

This captures:
- User engagement (they're using the product)
- Value delivery (they're getting output)
- Revenue potential (usage → paid conversion)

### Key Performance Indicators

| Metric | Week 1 | Month 1 | Month 3 | Month 6 |
|--------|--------|---------|---------|---------|
| **Sign-ups** | 100 | 500 | 2000 | 5000 |
| **Activation Rate** | 50% | 60% | 65% | 70% |
| **Paid Conversion** | 2% | 5% | 7% | 10% |
| **MRR** | $200 | $1000 | $3000 | $8000 |
| **Churn** | - | 10% | 7% | 5% |
| **NPS** | 30 | 40 | 50 | 55 |

### Activation Definition

User is "activated" when they:
1. Upload a script
2. Generate at least one scene
3. Listen to the output

**Target: Activation within 10 minutes of sign-up**

### Retention Cohorts

| Cohort | Week 1 | Week 2 | Week 4 | Week 8 |
|--------|--------|--------|--------|--------|
| Free | 100% | 40% | 20% | 10% |
| Creator | 100% | 80% | 70% | 60% |
| Pro | 100% | 90% | 85% | 80% |

---

## 10. Risk Mitigation

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| ElevenLabs outage | Medium | High | Fallback to alternative TTS (PlayHT, AWS Polly) |
| OpenAI rate limits | Medium | High | Implement queue with backpressure, retry logic |
| Long generation times | High | Medium | Progress indicators, background processing, email notification |
| Audio quality issues | Medium | High | Quality validation step, regeneration option |
| Script parsing failures | High | Medium | Manual override, format documentation |

### Business Risks

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Low conversion rate | Medium | High | A/B test pricing, improve onboarding, add testimonials |
| High churn | Medium | High | Usage emails, feature improvements, customer interviews |
| Competitor launch | Medium | Medium | Focus on niche, build community, rapid iteration |
| API cost increase | Low | High | Multi-provider support, renegotiate at scale |
| Copyright claims | Medium | High | Clear ToS, user responsibility, DMCA process |

### Legal Risks

| Risk | Mitigation |
|------|------------|
| Voice actor likeness claims | Use licensed voices only, clear ElevenLabs ToS |
| Copyright infringement by users | User agreement, DMCA takedown process |
| Privacy concerns | Clear data handling policy, GDPR compliance |
| Content moderation | Content policy, reporting mechanism |

---

## 11. Post-Launch Roadmap

### Version 1.1 (Month 2-3)

```
Focus: Quality of life improvements

Features:
├── Voice preview before generation
├── Scene-by-scene regeneration
├── Improved script parsing (better FDX support)
├── Export stems (separate audio tracks)
├── Mobile-responsive improvements
└── Performance optimizations
```

### Version 1.2 (Month 4-5)

```
Focus: Collaboration & sharing

Features:
├── Team workspaces (share projects)
├── Comments on scenes
├── Public share links (listen only)
├── Embed player for websites
├── Export to podcast hosting (Anchor, Spotify)
└── Character voice consistency improvements
```

### Version 2.0 - Pro Tier (Month 6-8)

```
Focus: Professional features

Features:
├── Longer scripts (30-60 pages)
├── API access for integrations
├── Custom voice uploads
├── Advanced audio controls (pacing, emphasis)
├── Batch processing
└── Priority support
```

### Version 3.0 - Enterprise (Month 9-12)

```
Focus: Enterprise readiness

Features:
├── SOC 2 Type II certification
├── SSO integration
├── Audit logging
├── Dedicated infrastructure option
├── SLA guarantees
└── See ENTERPRISE_READINESS.md
```

---

## 12. Team & Resources

### MVP Team (Minimum)

| Role | Responsibility | Allocation |
|------|----------------|------------|
| **Full-Stack Engineer** | Frontend, backend, infrastructure | 100% |
| **Founder/Product** | Product decisions, customer development, marketing | 100% |
| **Designer** (contract) | UI/UX, landing page, brand | 20% |

### Scaling Team (Post-Launch)

| Hire | When | Why |
|------|------|-----|
| Customer Support | Month 2 | Handle growing ticket volume |
| Marketing | Month 3 | Content, SEO, paid acquisition |
| Second Engineer | Month 4 | Feature velocity, on-call rotation |
| DevOps/SRE | Month 6 | Reliability, scaling |

---

## 13. Launch Checklist

### Week Before Launch

- [ ] All critical bugs fixed
- [ ] Load testing passed (100 concurrent users)
- [ ] Payment flow tested end-to-end
- [ ] Email flows tested (all templates)
- [ ] Error tracking configured (Sentry)
- [ ] Analytics configured (PostHog)
- [ ] Landing page live
- [ ] Documentation complete
- [ ] Legal pages reviewed
- [ ] Support email configured
- [ ] Social media accounts ready
- [ ] Product Hunt draft submitted
- [ ] Press kit prepared
- [ ] Beta user testimonials collected

### Launch Day

- [ ] Remove waitlist
- [ ] Publish Product Hunt
- [ ] Post on Hacker News
- [ ] Tweet announcement thread
- [ ] Reddit posts scheduled
- [ ] Email beta users
- [ ] Monitor error rates
- [ ] Monitor infrastructure
- [ ] Respond to all comments/questions
- [ ] Celebrate! 🎉

### Week After Launch

- [ ] Analyze conversion funnel
- [ ] Review user feedback
- [ ] Prioritize bug fixes
- [ ] Plan Week 2 improvements
- [ ] Follow up with press
- [ ] Customer interviews (5+)
- [ ] Team retrospective

---

## Summary

### MVP Scope

| In Scope | Out of Scope |
|----------|--------------|
| Short scripts (≤15 pages) | Long scripts (90+ pages) |
| Email auth | SSO/SAML |
| Basic rate limiting | Enterprise SLAs |
| Single-tenant database | Per-tenant isolation |
| Manual support | Dedicated support |
| Stripe billing | Enterprise invoicing |

### Timeline

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| Sprint 0: Foundation | 2 weeks | Clean monorepo, CI/CD |
| Sprint 1: Security | 2 weeks | Auth, rate limiting |
| Sprint 2: Core Product | 2 weeks | Upload → Generate → Download |
| Sprint 3: Polish | 2 weeks | Payments, emails, UX |
| Sprint 4: Launch | 2 weeks | Landing page, legal, testing |
| **Total** | **10 weeks** | **Public launch** |

### Investment Required

| Category | Amount |
|----------|--------|
| Engineering time | 10 weeks |
| Infrastructure (6 months) | $900 |
| API costs (first 6 months) | $1,500 |
| Design (contract) | $2,000 |
| Legal (ToS, Privacy) | $500 |
| Marketing (launch) | $1,000 |
| **Total** | **~$6,000 + time** |

### Success Definition

**MVP 1.0 is successful if by Month 6:**
- 5,000+ registered users
- 100+ paying customers
- $5,000+ MRR
- NPS > 40
- Clear path to enterprise tier

---

*This plan provides the foundation to launch Story Magic as a public SaaS product while building toward the enterprise tier outlined in [ENTERPRISE_READINESS.md](ENTERPRISE_READINESS.md).*
