-- =============================================================================
-- Story Magic: Sharing & Subscription System
-- Two-sided marketplace: Writers (creators) and Readers (industry)
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Extend profiles for user types
-- -----------------------------------------------------------------------------

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS user_type TEXT DEFAULT 'writer'
  CHECK (user_type IN ('writer', 'reader', 'enterprise'));

-- Unique shareable codes for writers and readers
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS writer_code TEXT UNIQUE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS reader_code TEXT UNIQUE;

-- Generate codes for existing users
UPDATE profiles
SET writer_code = UPPER(SUBSTRING(MD5(id::text || 'writer') FROM 1 FOR 8))
WHERE writer_code IS NULL;

UPDATE profiles
SET reader_code = UPPER(SUBSTRING(MD5(id::text || 'reader') FROM 1 FOR 8))
WHERE reader_code IS NULL;

-- Function to generate codes for new users
CREATE OR REPLACE FUNCTION generate_share_codes()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.writer_code IS NULL THEN
    NEW.writer_code := UPPER(SUBSTRING(MD5(NEW.id::text || 'writer' || NOW()::text) FROM 1 FOR 8));
  END IF;
  IF NEW.reader_code IS NULL THEN
    NEW.reader_code := UPPER(SUBSTRING(MD5(NEW.id::text || 'reader' || NOW()::text) FROM 1 FOR 8));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_share_codes
  BEFORE INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION generate_share_codes();

-- -----------------------------------------------------------------------------
-- 2. Subscriptions table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Plan details
  plan TEXT NOT NULL CHECK (plan IN ('writer_basic', 'writer_pro', 'enterprise')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),

  -- Stripe integration
  stripe_customer_id TEXT,
  stripe_subscription_id TEXT UNIQUE,
  stripe_price_id TEXT,

  -- Billing period
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN DEFAULT FALSE,

  -- Usage limits for the period
  generations_used INTEGER DEFAULT 0,
  generations_limit INTEGER DEFAULT 5,  -- Basic = 5, Pro = 15
  downloads_used INTEGER DEFAULT 0,
  downloads_limit INTEGER DEFAULT 1,    -- Basic = 1, Pro = 5

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Only one active subscription per user
CREATE UNIQUE INDEX idx_subscriptions_user_active
  ON subscriptions(user_id)
  WHERE status IN ('active', 'trialing');

-- Stripe lookup
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

-- -----------------------------------------------------------------------------
-- 3. Script sharing
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS script_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being shared
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- Who shared it
  shared_by UUID NOT NULL REFERENCES auth.users(id),

  -- Who it's shared with (null for link-based sharing)
  shared_with UUID REFERENCES auth.users(id),

  -- For link-based sharing
  share_token TEXT UNIQUE,

  -- Access control
  access_level TEXT DEFAULT 'stream' CHECK (access_level IN ('stream', 'download')),

  -- Optional: reader code that was used (tracks which reader pulled in this writer)
  via_reader_code TEXT,

  -- Expiration (optional, for temporary shares)
  expires_at TIMESTAMPTZ,

  -- Tracking
  view_count INTEGER DEFAULT 0,
  last_viewed_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Generate unique share tokens
CREATE OR REPLACE FUNCTION generate_share_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.share_token IS NULL THEN
    NEW.share_token := LOWER(SUBSTRING(MD5(NEW.id::text || NOW()::text) FROM 1 FOR 12));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_share_token
  BEFORE INSERT ON script_shares
  FOR EACH ROW
  EXECUTE FUNCTION generate_share_token();

-- Indexes
CREATE INDEX idx_shares_token ON script_shares(share_token);
CREATE INDEX idx_shares_project ON script_shares(project_id);
CREATE INDEX idx_shares_shared_by ON script_shares(shared_by);
CREATE INDEX idx_shares_shared_with ON script_shares(shared_with);

-- -----------------------------------------------------------------------------
-- 4. Reader library
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reader_library (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who owns this library entry
  reader_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What script
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

  -- How did they get it?
  source TEXT NOT NULL CHECK (source IN ('received', 'uploaded', 'purchased')),

  -- If received, link to the share
  share_id UUID REFERENCES script_shares(id),

  -- Status
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'archived', 'removed')),

  -- User preferences
  is_favorited BOOLEAN DEFAULT FALSE,
  notes TEXT,
  tags TEXT[],

  -- Playback state
  last_played_at TIMESTAMPTZ,
  play_position_seconds INTEGER DEFAULT 0,
  completed BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- One entry per reader/project combination
  UNIQUE(reader_id, project_id)
);

-- Indexes
CREATE INDEX idx_reader_library_reader ON reader_library(reader_id);
CREATE INDEX idx_reader_library_status ON reader_library(reader_id, status);
CREATE INDEX idx_reader_library_favorited ON reader_library(reader_id, is_favorited) WHERE is_favorited = TRUE;

-- -----------------------------------------------------------------------------
-- 5. Purchases and transactions
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who purchased
  user_id UUID NOT NULL REFERENCES auth.users(id),

  -- What was purchased (optional - some purchases are account-level)
  project_id UUID REFERENCES projects(id),

  -- Type of purchase
  purchase_type TEXT NOT NULL CHECK (purchase_type IN (
    'processing',      -- Reader upload processing ($5)
    'ocr_processing',  -- Reader OCR processing ($8)
    'unlock',          -- Unlock archived script ($5)
    'download',        -- Royalty-free download ($25)
    'subscription',    -- Subscription payment
    'generation'       -- Pay-per-generation (if over limit)
  )),

  -- Payment details
  amount_cents INTEGER NOT NULL,
  currency TEXT DEFAULT 'usd',

  -- Stripe
  stripe_payment_intent_id TEXT,
  stripe_invoice_id TEXT,

  -- Status
  status TEXT DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'failed', 'refunded')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_purchases_user ON purchases(user_id);
CREATE INDEX idx_purchases_project ON purchases(project_id);
CREATE INDEX idx_purchases_stripe ON purchases(stripe_payment_intent_id);

-- -----------------------------------------------------------------------------
-- 6. Content access logging (for analytics and security)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS content_access_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who accessed
  user_id UUID REFERENCES auth.users(id),  -- Can be null for anonymous QR access

  -- What was accessed
  project_id UUID NOT NULL REFERENCES projects(id),
  share_id UUID REFERENCES script_shares(id),

  -- Type of access
  access_type TEXT NOT NULL CHECK (access_type IN ('stream_start', 'stream_end', 'download', 'share_create', 'share_click')),

  -- Stream details
  start_position_seconds INTEGER,
  end_position_seconds INTEGER,
  duration_seconds INTEGER,

  -- Context
  ip_address INET,
  user_agent TEXT,
  device_type TEXT,  -- 'mobile', 'tablet', 'desktop'

  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes (time-series optimization)
CREATE INDEX idx_access_log_project_time ON content_access_log(project_id, created_at DESC);
CREATE INDEX idx_access_log_user_time ON content_access_log(user_id, created_at DESC);

-- Partition by month for large-scale deployments (optional)
-- CREATE TABLE content_access_log_y2026m01 PARTITION OF content_access_log
--   FOR VALUES FROM ('2026-01-01') TO ('2026-02-01');

-- -----------------------------------------------------------------------------
-- 7. Helper functions
-- -----------------------------------------------------------------------------

-- Check if a writer has an active subscription
CREATE OR REPLACE FUNCTION is_writer_subscribed(writer_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM subscriptions
    WHERE user_id = writer_user_id
    AND status IN ('active', 'trialing')
    AND (current_period_end IS NULL OR current_period_end > NOW())
  );
END;
$$ LANGUAGE plpgsql;

-- Get available generations for a user
CREATE OR REPLACE FUNCTION get_remaining_generations(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_limit INTEGER;
  v_used INTEGER;
BEGIN
  SELECT generations_limit, generations_used
  INTO v_limit, v_used
  FROM subscriptions
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing');

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  RETURN GREATEST(0, v_limit - v_used);
END;
$$ LANGUAGE plpgsql;

-- Increment generation usage
CREATE OR REPLACE FUNCTION use_generation(p_user_id UUID)
RETURNS BOOLEAN AS $$
DECLARE
  v_remaining INTEGER;
BEGIN
  v_remaining := get_remaining_generations(p_user_id);

  IF v_remaining <= 0 THEN
    RETURN FALSE;
  END IF;

  UPDATE subscriptions
  SET generations_used = generations_used + 1,
      updated_at = NOW()
  WHERE user_id = p_user_id
  AND status IN ('active', 'trialing');

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Archive scripts when writer unsubscribes
CREATE OR REPLACE FUNCTION archive_writer_shares()
RETURNS TRIGGER AS $$
BEGIN
  -- When subscription becomes inactive, archive all reader library entries
  IF NEW.status NOT IN ('active', 'trialing') AND OLD.status IN ('active', 'trialing') THEN
    UPDATE reader_library rl
    SET status = 'archived', updated_at = NOW()
    FROM script_shares ss
    WHERE rl.share_id = ss.id
    AND ss.shared_by = NEW.user_id
    AND rl.source = 'received';
  END IF;

  -- When subscription becomes active, restore archived entries
  IF NEW.status IN ('active', 'trialing') AND OLD.status NOT IN ('active', 'trialing') THEN
    UPDATE reader_library rl
    SET status = 'active', updated_at = NOW()
    FROM script_shares ss
    WHERE rl.share_id = ss.id
    AND ss.shared_by = NEW.user_id
    AND rl.status = 'archived';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_archive_writer_shares
  AFTER UPDATE ON subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION archive_writer_shares();

-- -----------------------------------------------------------------------------
-- 8. Row Level Security
-- -----------------------------------------------------------------------------

-- Subscriptions: users can only see their own
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY subscriptions_select ON subscriptions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY subscriptions_insert ON subscriptions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Script shares: owner can manage, recipient can view
ALTER TABLE script_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY shares_select ON script_shares
  FOR SELECT USING (
    auth.uid() = shared_by
    OR auth.uid() = shared_with
    OR share_token IS NOT NULL  -- Public links
  );

CREATE POLICY shares_insert ON script_shares
  FOR INSERT WITH CHECK (auth.uid() = shared_by);

CREATE POLICY shares_delete ON script_shares
  FOR DELETE USING (auth.uid() = shared_by);

-- Reader library: users can only see their own
ALTER TABLE reader_library ENABLE ROW LEVEL SECURITY;

CREATE POLICY reader_library_select ON reader_library
  FOR SELECT USING (auth.uid() = reader_id);

CREATE POLICY reader_library_insert ON reader_library
  FOR INSERT WITH CHECK (auth.uid() = reader_id);

CREATE POLICY reader_library_update ON reader_library
  FOR UPDATE USING (auth.uid() = reader_id);

CREATE POLICY reader_library_delete ON reader_library
  FOR DELETE USING (auth.uid() = reader_id);

-- Purchases: users can only see their own
ALTER TABLE purchases ENABLE ROW LEVEL SECURITY;

CREATE POLICY purchases_select ON purchases
  FOR SELECT USING (auth.uid() = user_id);

-- Access log: users can see their own, project owners can see their project's logs
ALTER TABLE content_access_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY access_log_select ON content_access_log
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM projects p
      WHERE p.id = project_id AND p.user_id = auth.uid()
    )
  );

-- -----------------------------------------------------------------------------
-- 9. Views for common queries
-- -----------------------------------------------------------------------------

-- Writer dashboard: their scripts with share counts
CREATE OR REPLACE VIEW writer_scripts_summary AS
SELECT
  p.id AS project_id,
  p.name,
  p.status,
  p.page_count,
  p.created_at,
  COUNT(DISTINCT ss.id) AS share_count,
  COUNT(DISTINCT rl.id) AS reader_count,
  SUM(COALESCE(ss.view_count, 0)) AS total_views
FROM projects p
LEFT JOIN script_shares ss ON ss.project_id = p.id
LEFT JOIN reader_library rl ON rl.share_id = ss.id AND rl.status = 'active'
WHERE p.user_id = auth.uid()
GROUP BY p.id;

-- Reader library with writer subscription status
CREATE OR REPLACE VIEW reader_library_detailed AS
SELECT
  rl.*,
  p.name AS script_name,
  p.page_count,
  pr.full_name AS writer_name,
  pr.writer_code,
  is_writer_subscribed(p.user_id) AS writer_subscribed
FROM reader_library rl
JOIN projects p ON p.id = rl.project_id
JOIN profiles pr ON pr.id = p.user_id
WHERE rl.reader_id = auth.uid();
