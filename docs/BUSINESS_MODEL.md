# Story Magic Business Model

## Executive Summary

Story Magic operates as a **two-sided marketplace** connecting screenwriters (creators) with industry readers (consumers: agents, managers, producers, development executives, studio readers).

**Core Value Proposition:**
- **Writers:** Transform scripts into professional audio experiences to stand out in a crowded market
- **Readers:** Evaluate scripts faster and more immersively—listen during commutes, workouts, etc.

---

## Pricing Tiers

### Writer Tier: "Creator" ($10-20/month)

| Feature | Basic ($10/mo) | Pro ($20/mo) |
|---------|---------------|--------------|
| Script uploads | Unlimited | Unlimited |
| Audio generations | 5/month | 15/month |
| Full downloads (WAV/MP3) | 1/month | 5/month |
| Shareable links | Unlimited | Unlimited |
| Script Score analysis | 2/month | Unlimited |
| Voice customization | Basic | Advanced |
| Priority processing | No | Yes |
| Analytics | Basic views | Full engagement |

**Why this works:**
- Low barrier ($10) captures hobbyist/emerging writers
- Unlimited uploads = they bring their whole catalog
- Limited downloads = keeps them on platform, sharing links
- Upgrade path to Pro when they get serious

### Reader Tier: "Industry" (Pay-per-use)

| Action | Cost |
|--------|------|
| Monthly subscription | **$0** |
| Receive script from subscribed writer | **$0** |
| Upload own script (PDF/text) | $5 processing |
| Upload scanned pages (OCR) | $8 processing |
| Store in library | $0.50/month/script |
| Stream playback | Free (ad-supported option) |
| Download (royalty-free) | $25/script |

**Why this works:**
- Zero monthly cost removes friction for busy executives
- Free to receive = readers WANT writers to subscribe
- Storage fee encourages cleanup, generates recurring revenue
- High download fee captures serious value

---

## Sharing Dynamics

### The "Writer Code" System

Every subscribed writer gets a unique shareable code:
```
story.magic/w/JANE-WRITER-7X9K
```

When a reader receives a script via this link:
1. Reader creates free account (or logs in)
2. Script appears in their "Received" library
3. **Cost to reader: $0** (writer's subscription covers it)
4. Reader can stream indefinitely
5. Download requires $25 payment

### The "Reader Code" System

Readers can generate invite codes for writers:
```
story.magic/r/ACME-STUDIOS-R3M2
```

When a writer submits via reader code:
1. If writer is subscribed → Reader gets script free
2. If writer is NOT subscribed → Writer sees signup prompt
3. Creates network effect pushing writers to subscribe

### Sharing Flow Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        WRITER (Subscribed)                       │
├─────────────────────────────────────────────────────────────────┤
│  1. Uploads script                                               │
│  2. Generates audio                                              │
│  3. Gets shareable link: story.magic/w/JANE-7X9K/midnight-sun   │
│  4. Emails link to agent                                         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                        READER (Agent)                            │
├─────────────────────────────────────────────────────────────────┤
│  1. Clicks link                                                  │
│  2. Creates free account (one time)                              │
│  3. Script appears in "Received" library                         │
│  4. Streams audio (free)                                         │
│  5. Options:                                                     │
│     • Keep in library (free while writer subscribes)             │
│     • Download royalty-free ($25)                                │
│     • Share with colleagues (generates new reader code)          │
└─────────────────────────────────────────────────────────────────┘
```

---

## Library Management

### Writer Library

```
┌─────────────────────────────────────────────────────────────────┐
│  MY SCRIPTS                                          [+ New]     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📄 "Midnight Sun"                              [Share] [⋮]  ││
│  │    Drama | 112 pages | Score: 7.8/10                        ││
│  │    Audio: ✓ Generated | 1:47:23                             ││
│  │    Shared with: 3 readers | 12 plays                        ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📄 "Desert Wind"                               [Share] [⋮]  ││
│  │    Thriller | 98 pages | Score: 6.2/10                      ││
│  │    Audio: ○ Not generated                                   ││
│  │    Shared with: 0 readers                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  SHARED WITH ME (from other writers)                             │
├─────────────────────────────────────────────────────────────────┤
│  │ 📄 "The Long Game" by @mike-writer                          ││
│  │    Received: Jan 15, 2026 | Drama                           ││
└─────────────────────────────────────────────────────────────────┘
```

### Reader Library

```
┌─────────────────────────────────────────────────────────────────┐
│  RECEIVED SCRIPTS                              [My Reader Code]  │
├─────────────────────────────────────────────────────────────────┤
│  Filter: [All ▼] [Unread ▼] [Favorited ▼]                       │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ ⭐ "Midnight Sun" from @jane-writer           [▶ Play] [⋮]  ││
│  │    Drama | 112 pages | Received: Jan 18                     ││
│  │    Status: ● Active (writer subscribed)                     ││
│  │    Played: 45 min / 1:47:23                                 ││
│  │    [Download $25] [Share to colleague]                      ││
│  └─────────────────────────────────────────────────────────────┘│
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ 📄 "Old script"                                        [⋮]  ││
│  │    Status: ○ Archived (writer unsubscribed)                 ││
│  │    [Unlock for $5] [Remove]                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  MY UPLOADS                                          [+ Upload]  │
├─────────────────────────────────────────────────────────────────┤
│  │ 📄 "Unsolicited Spec #47"                     [▶ Play] [⋮]  ││
│  │    Uploaded: Jan 10 | 95 pages                              ││
│  │    Processing cost: $5 (paid)                               ││
│  │    Storage: $0.50/mo                                        ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ─────────────────────────────────────────────────────────────  │
│  PURCHASED DOWNLOADS                                             │
├─────────────────────────────────────────────────────────────────┤
│  │ 📥 "Midnight Sun" - Downloaded Jan 20         [Re-download] ││
│  │    License: Royalty-free, unlimited use                     ││
└─────────────────────────────────────────────────────────────────┘
```

---

## Content Protection Strategy

### The Problem
Audio files are easy to copy and share. We need to protect writer IP while enabling legitimate use.

### Solution: Tiered Access Model

```
┌─────────────────────────────────────────────────────────────────┐
│                     CONTENT ACCESS TIERS                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TIER 1: Stream Only (Default)                                   │
│  ├── Protected web/mobile player                                 │
│  ├── No download button                                          │
│  ├── Chunked streaming (no single file)                          │
│  ├── Session-based authentication                                │
│  ├── QR code for mobile access                                   │
│  └── Watermarked audio (inaudible, traceable)                   │
│                                                                  │
│  TIER 2: Downloaded ($25)                                        │
│  ├── Full MP3/WAV file                                          │
│  ├── Royalty-free license                                       │
│  ├── Visible watermark in metadata                              │
│  ├── License agreement recorded                                  │
│  └── Can use for pitches, internal sharing                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Protected Player Features

```typescript
interface ProtectedPlayer {
  // Playback
  streaming: true;              // Chunked, not downloadable
  offline: false;               // No offline caching
  backgroundPlay: true;         // Can listen while doing other things

  // Security
  screenRecordingDetection: true;   // Pause if detected
  audioWatermarking: true;          // Inaudible unique identifier
  sessionTimeout: '24h';            // Re-auth required
  deviceLimit: 3;                   // Max concurrent devices

  // UX
  speedControl: [0.75, 1, 1.25, 1.5, 2];
  bookmarking: true;
  sceneNavigation: true;            // Jump to scenes
  characterHighlight: true;         // See who's speaking
  scriptSync: optional;             // Follow along with text
}
```

### QR Code Access

For meetings/pitches, writers can generate temporary QR codes:

```
┌─────────────────────────────────────────────────────────────────┐
│                    SHARE "MIDNIGHT SUN"                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐  Shareable Link:                               │
│  │             │  story.magic/w/JANE-7X9K/midnight-sun          │
│  │   [QR CODE] │                                                │
│  │             │  Quick Access QR (expires in 24h):             │
│  │             │  ○ Anyone with QR can listen once              │
│  └─────────────┘  ○ No account required                         │
│                   ○ Cannot save/download                        │
│                                                                  │
│  [Copy Link]  [Download QR]  [Email to...]                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Subscription Lifecycle & Edge Cases

### When Writer Unsubscribes

```
Writer cancels subscription
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  WRITER'S CONTENT                                                │
├─────────────────────────────────────────────────────────────────┤
│  • Scripts remain in account (read-only)                         │
│  • Cannot generate new audio                                     │
│  • Cannot share new links                                        │
│  • Existing shares become "archived" for readers                 │
└─────────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────┐
│  READER'S ACCESS                                                 │
├─────────────────────────────────────────────────────────────────┤
│  • Scripts marked "Archived - Writer Unsubscribed"               │
│  • Playback disabled                                             │
│  • Options:                                                      │
│    1. Wait for writer to resubscribe                             │
│    2. "Unlock" for $5 (pays processing cost)                     │
│    3. Purchase download for $25 (full ownership)                 │
└─────────────────────────────────────────────────────────────────┘
```

### When Reader Wants to Share Internally

Readers (production companies) often need to share with colleagues:

```
┌─────────────────────────────────────────────────────────────────┐
│  SHARE WITH COLLEAGUE                                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Share "Midnight Sun" with:                                      │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Email: colleague@studio.com                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  Access type:                                                    │
│  ○ View only (can stream, no download)          FREE            │
│  ○ Full access (can download)                   $25             │
│                                                                  │
│  Note: Colleague will need to create a free Reader account       │
│                                                                  │
│  [Send Invitation]                                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Revenue Model & Unit Economics

### Revenue Streams

| Stream | Model | Est. ARPU |
|--------|-------|-----------|
| Writer subscriptions | Recurring | $12/mo avg |
| Reader processing fees | Transactional | $6/upload |
| Reader storage fees | Recurring | $2/mo avg |
| Download purchases | Transactional | $25 each |
| Enterprise (studios) | Contract | $500-5000/mo |

### Unit Economics (Per Script Generated)

| Cost Component | Estimated Cost |
|----------------|----------------|
| LLM (Director) | $0.15-0.50 |
| TTS (ElevenLabs) | $0.50-2.00 |
| Compute (mixing) | $0.05-0.10 |
| Storage (audio) | $0.02/mo |
| Bandwidth | $0.01/play |
| **Total per generation** | **$0.75-2.65** |

### Break-even Analysis

**Writer at $10/mo:**
- Can generate ~5 scripts before we lose money
- Most writers generate 1-2/month
- Margin: ~70%

**Reader upload at $5:**
- Processing cost: ~$2.50
- Margin: 50%

**Download at $25:**
- No additional cost (already generated)
- Margin: ~95%

---

## Database Schema Additions

```sql
-- User types and subscription status
ALTER TABLE profiles ADD COLUMN user_type TEXT DEFAULT 'writer'
  CHECK (user_type IN ('writer', 'reader', 'enterprise'));
ALTER TABLE profiles ADD COLUMN writer_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN reader_code TEXT UNIQUE;

-- Subscriptions
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  plan TEXT NOT NULL CHECK (plan IN ('writer_basic', 'writer_pro', 'enterprise')),
  status TEXT NOT NULL CHECK (status IN ('active', 'canceled', 'past_due')),
  stripe_subscription_id TEXT,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Script sharing
CREATE TABLE script_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id),
  shared_by UUID REFERENCES auth.users(id),  -- Writer
  shared_with UUID REFERENCES auth.users(id), -- Reader (nullable for link shares)
  share_token TEXT UNIQUE,  -- For link-based sharing
  access_level TEXT DEFAULT 'stream' CHECK (access_level IN ('stream', 'download')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Reader library
CREATE TABLE reader_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reader_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  source TEXT NOT NULL CHECK (source IN ('received', 'uploaded', 'purchased')),
  share_id UUID REFERENCES script_shares(id),
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'removed')),
  is_favorited BOOLEAN DEFAULT FALSE,
  last_played_at TIMESTAMPTZ,
  play_position_seconds INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(reader_id, project_id)
);

-- Purchases/transactions
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  purchase_type TEXT NOT NULL CHECK (purchase_type IN (
    'processing',      -- Reader upload processing
    'ocr_processing',  -- Reader OCR processing
    'unlock',          -- Unlock archived script
    'download'         -- Royalty-free download
  )),
  amount_cents INTEGER NOT NULL,
  stripe_payment_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Usage tracking
CREATE TABLE content_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  project_id UUID REFERENCES projects(id),
  access_type TEXT NOT NULL CHECK (access_type IN ('stream', 'download', 'share')),
  duration_seconds INTEGER,  -- For streams
  ip_address INET,
  user_agent TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_shares_token ON script_shares(share_token);
CREATE INDEX idx_shares_project ON script_shares(project_id);
CREATE INDEX idx_reader_library_reader ON reader_library(reader_id);
CREATE INDEX idx_access_log_project ON content_access_log(project_id, created_at);
```

---

## Growth Flywheel

```
                    ┌──────────────────────┐
                    │   Writer subscribes   │
                    │      ($10/mo)         │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │  Generates audio &   │
                    │  shares with readers │
                    └──────────┬───────────┘
                               │
              ┌────────────────┴────────────────┐
              │                                 │
              ▼                                 ▼
   ┌──────────────────────┐       ┌──────────────────────┐
   │  Reader signs up      │       │  Reader tells other  │
   │  (free)               │       │  writers about it    │
   └──────────┬───────────┘       └──────────┬───────────┘
              │                               │
              ▼                               │
   ┌──────────────────────┐                   │
   │  Reader gives their   │                   │
   │  code to MORE writers │                   │
   └──────────┬───────────┘                   │
              │                               │
              └───────────────┬───────────────┘
                              │
                              ▼
                   ┌──────────────────────┐
                   │  More writers join   │
                   │  to share with       │
                   │  industry readers    │
                   └──────────────────────┘
```

**Key Insight:** Readers (agents, producers) are the distribution mechanism. They WANT writers to subscribe because it's free for them. They actively push their network of writers to join.

---

## Competitive Positioning

| Feature | Story Magic | Coverfly | The Black List | WeScreenplay |
|---------|-------------|----------|----------------|--------------|
| Audio generation | ✓ | ✗ | ✗ | ✗ |
| Script Score | ✓ | ✓ | ✓ | ✓ |
| Industry sharing | ✓ | ✓ | ✓ | ✓ |
| Protected playback | ✓ | N/A | N/A | N/A |
| Reader-pays model | ✓ | ✗ | ✗ | ✗ |
| Mobile listening | ✓ | ✗ | ✗ | ✗ |
| Price (writer) | $10/mo | Free-$99 | $30/eval | $79/eval |

**Unique Value:** We're the only platform that transforms scripts into a **consumable audio format** that fits into how busy industry professionals actually work (commutes, workouts, walking meetings).

---

## Launch Strategy

### Phase 1: Writer-First (Months 1-3)
- Focus on writer acquisition
- Heavy emphasis on audio quality demos
- Partner with screenwriting communities (Stage32, ISA, etc.)
- Goal: 1,000 paying writers

### Phase 2: Reader Seeding (Months 4-6)
- Identify 100 "power readers" (agents, managers)
- Give them premium accounts
- Have them distribute their reader codes
- Goal: 50 active industry readers

### Phase 3: Flywheel (Months 7-12)
- Readers pulling in writers
- Writers competing for reader attention
- Network effects kick in
- Goal: 10,000 writers, 500 readers

---

## Risk Mitigation

| Risk | Mitigation |
|------|------------|
| Audio quality not good enough | Continuous improvement, voice library expansion |
| Writers share raw audio files | Watermarking, license tracking, DMCA tools |
| Readers don't adopt | Free tier, mobile-first UX, integrations |
| Competition copies model | First-mover advantage, network effects |
| LLM/TTS costs increase | Multi-provider strategy, caching, efficiency |

---

## Success Metrics

### Writer Metrics
- Monthly Active Writers (MAW)
- Scripts generated per writer
- Share rate (% of scripts shared)
- Upgrade rate (Basic → Pro)
- Churn rate

### Reader Metrics
- Monthly Active Readers (MAR)
- Scripts received per reader
- Listen completion rate
- Download conversion rate
- Reader code distribution rate

### Business Metrics
- MRR (Monthly Recurring Revenue)
- ARPU (Average Revenue Per User)
- CAC (Customer Acquisition Cost)
- LTV (Lifetime Value)
- Gross Margin
