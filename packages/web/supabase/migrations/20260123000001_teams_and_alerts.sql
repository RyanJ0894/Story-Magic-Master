-- =============================================================================
-- Story Magic: Teams and Alert System
-- Teams for known collaborators, alerts for master account notifications
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Teams table
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team owner (master account)
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Team info
  name TEXT NOT NULL,
  description TEXT,

  -- Settings
  default_share_access TEXT DEFAULT 'stream' CHECK (default_share_access IN ('stream', 'download')),
  auto_share_new_projects BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_teams_owner ON teams(owner_id);

-- -----------------------------------------------------------------------------
-- 2. Team members
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Team reference
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Member (can be null if invite is pending)
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Invited email (for pending invites)
  invited_email TEXT,

  -- Role
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member', 'viewer')),

  -- Invite status
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'removed')),

  -- Invite tracking
  invite_token TEXT UNIQUE,
  invited_by UUID REFERENCES auth.users(id),
  invited_at TIMESTAMPTZ DEFAULT NOW(),
  accepted_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Unique constraint: one membership per user per team
  UNIQUE(team_id, user_id)
);

-- Generate invite tokens
CREATE OR REPLACE FUNCTION generate_invite_token()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.invite_token IS NULL AND NEW.status = 'pending' THEN
    NEW.invite_token := LOWER(ENCODE(gen_random_bytes(16), 'hex'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_generate_invite_token
  BEFORE INSERT ON team_members
  FOR EACH ROW
  EXECUTE FUNCTION generate_invite_token();

CREATE INDEX idx_team_members_team ON team_members(team_id);
CREATE INDEX idx_team_members_user ON team_members(user_id);
CREATE INDEX idx_team_members_invite_token ON team_members(invite_token);
CREATE INDEX idx_team_members_email ON team_members(invited_email);

-- -----------------------------------------------------------------------------
-- 3. Script read status (Like/Pass/Undecided)
-- -----------------------------------------------------------------------------

-- Add read_status column to reader_library
ALTER TABLE reader_library
ADD COLUMN IF NOT EXISTS read_status TEXT DEFAULT 'undecided'
CHECK (read_status IN ('like', 'pass', 'undecided'));

-- Add read_status_updated_at for tracking when status changed
ALTER TABLE reader_library
ADD COLUMN IF NOT EXISTS read_status_updated_at TIMESTAMPTZ;

-- Index for filtering by read status
CREATE INDEX IF NOT EXISTS idx_reader_library_read_status
ON reader_library(reader_id, read_status);

-- -----------------------------------------------------------------------------
-- 4. Alerts system
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Who receives the alert
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Alert type
  alert_type TEXT NOT NULL CHECK (alert_type IN (
    'team_invite',
    'script_shared',
    'script_status_changed',  -- When team member changes Like/Pass/Undecided
    'script_comment',
    'team_member_joined',
    'team_member_left',
    'generation_complete',
    'generation_failed'
  )),

  -- Alert content
  title TEXT NOT NULL,
  message TEXT,

  -- Related entities (for navigation)
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  team_id UUID REFERENCES teams(id) ON DELETE SET NULL,
  related_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,

  -- Additional data as JSON
  metadata JSONB DEFAULT '{}',

  -- Status
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ,

  -- Email notification sent?
  email_sent BOOLEAN DEFAULT FALSE,
  email_sent_at TIMESTAMPTZ,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_alerts_user ON alerts(user_id, created_at DESC);
CREATE INDEX idx_alerts_unread ON alerts(user_id, is_read) WHERE is_read = FALSE;

-- -----------------------------------------------------------------------------
-- 5. Team shares (share projects with entire team)
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS team_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- What's being shared
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES teams(id) ON DELETE CASCADE,

  -- Who shared it
  shared_by UUID NOT NULL REFERENCES auth.users(id),

  -- Access control
  access_level TEXT DEFAULT 'stream' CHECK (access_level IN ('stream', 'download')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- One share per project per team
  UNIQUE(project_id, team_id)
);

CREATE INDEX idx_team_shares_team ON team_shares(team_id);
CREATE INDEX idx_team_shares_project ON team_shares(project_id);

-- -----------------------------------------------------------------------------
-- 6. Alert preferences
-- -----------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS alert_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,

  -- Email preferences
  email_team_invites BOOLEAN DEFAULT TRUE,
  email_script_shared BOOLEAN DEFAULT TRUE,
  email_status_changes BOOLEAN DEFAULT TRUE,  -- When team members change Like/Pass
  email_comments BOOLEAN DEFAULT TRUE,
  email_team_changes BOOLEAN DEFAULT TRUE,
  email_generation_complete BOOLEAN DEFAULT FALSE,  -- Can be noisy

  -- In-app preferences (all default on)
  inapp_all BOOLEAN DEFAULT TRUE,

  -- Digest preferences
  email_digest_frequency TEXT DEFAULT 'instant' CHECK (email_digest_frequency IN ('instant', 'daily', 'weekly', 'never')),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create default preferences for existing users
INSERT INTO alert_preferences (user_id)
SELECT id FROM auth.users
ON CONFLICT (user_id) DO NOTHING;

-- Trigger to create preferences for new users
CREATE OR REPLACE FUNCTION create_alert_preferences()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO alert_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Only create trigger if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trigger_create_alert_preferences') THEN
    CREATE TRIGGER trigger_create_alert_preferences
      AFTER INSERT ON auth.users
      FOR EACH ROW
      EXECUTE FUNCTION create_alert_preferences();
  END IF;
END;
$$;

-- -----------------------------------------------------------------------------
-- 7. Function to create alerts with optional email
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION create_alert(
  p_user_id UUID,
  p_alert_type TEXT,
  p_title TEXT,
  p_message TEXT DEFAULT NULL,
  p_project_id UUID DEFAULT NULL,
  p_team_id UUID DEFAULT NULL,
  p_related_user_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_alert_id UUID;
BEGIN
  INSERT INTO alerts (
    user_id, alert_type, title, message,
    project_id, team_id, related_user_id, metadata
  )
  VALUES (
    p_user_id, p_alert_type, p_title, p_message,
    p_project_id, p_team_id, p_related_user_id, p_metadata
  )
  RETURNING id INTO v_alert_id;

  RETURN v_alert_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- -----------------------------------------------------------------------------
-- 8. Trigger for read status changes to alert master account
-- -----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION notify_status_change()
RETURNS TRIGGER AS $$
DECLARE
  v_project_owner_id UUID;
  v_project_name TEXT;
  v_reader_name TEXT;
  v_status_label TEXT;
BEGIN
  -- Only trigger on read_status changes
  IF OLD.read_status IS DISTINCT FROM NEW.read_status THEN
    -- Get project owner
    SELECT p.user_id, p.name INTO v_project_owner_id, v_project_name
    FROM projects p
    WHERE p.id = NEW.project_id;

    -- Get reader name
    SELECT COALESCE(pr.full_name, 'A reader') INTO v_reader_name
    FROM profiles pr
    WHERE pr.id = NEW.reader_id;

    -- Format status label
    v_status_label := CASE NEW.read_status
      WHEN 'like' THEN 'liked'
      WHEN 'pass' THEN 'passed on'
      ELSE 'marked as undecided'
    END;

    -- Create alert for project owner
    PERFORM create_alert(
      v_project_owner_id,
      'script_status_changed',
      v_reader_name || ' ' || v_status_label || ' your script',
      '"' || v_project_name || '" was ' || v_status_label || ' by ' || v_reader_name,
      NEW.project_id,
      NULL,
      NEW.reader_id,
      jsonb_build_object(
        'old_status', OLD.read_status,
        'new_status', NEW.read_status,
        'reader_id', NEW.reader_id
      )
    );

    -- Update timestamp
    NEW.read_status_updated_at := NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_status_change
  BEFORE UPDATE ON reader_library
  FOR EACH ROW
  EXECUTE FUNCTION notify_status_change();

-- -----------------------------------------------------------------------------
-- 9. Row Level Security for new tables
-- -----------------------------------------------------------------------------

-- Teams: owner can manage, members can view
ALTER TABLE teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY teams_select ON teams
  FOR SELECT USING (
    auth.uid() = owner_id
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = id
      AND tm.user_id = auth.uid()
      AND tm.status = 'accepted'
    )
  );

CREATE POLICY teams_insert ON teams
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY teams_update ON teams
  FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY teams_delete ON teams
  FOR DELETE USING (auth.uid() = owner_id);

-- Team members: team owner can manage, members can view their own
ALTER TABLE team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_members_select ON team_members
  FOR SELECT USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
    OR invite_token IS NOT NULL  -- Allow viewing by invite token
  );

CREATE POLICY team_members_insert ON team_members
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY team_members_update ON team_members
  FOR UPDATE USING (
    auth.uid() = user_id
    OR EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
  );

CREATE POLICY team_members_delete ON team_members
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM teams t
      WHERE t.id = team_id AND t.owner_id = auth.uid()
    )
  );

-- Alerts: users can only see their own
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY alerts_select ON alerts
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY alerts_update ON alerts
  FOR UPDATE USING (auth.uid() = user_id);

-- Team shares: owner and team members can view
ALTER TABLE team_shares ENABLE ROW LEVEL SECURITY;

CREATE POLICY team_shares_select ON team_shares
  FOR SELECT USING (
    auth.uid() = shared_by
    OR EXISTS (
      SELECT 1 FROM team_members tm
      WHERE tm.team_id = team_shares.team_id
      AND tm.user_id = auth.uid()
      AND tm.status = 'accepted'
    )
  );

CREATE POLICY team_shares_insert ON team_shares
  FOR INSERT WITH CHECK (auth.uid() = shared_by);

CREATE POLICY team_shares_delete ON team_shares
  FOR DELETE USING (auth.uid() = shared_by);

-- Alert preferences: users can only manage their own
ALTER TABLE alert_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY alert_prefs_select ON alert_preferences
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY alert_prefs_update ON alert_preferences
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY alert_prefs_insert ON alert_preferences
  FOR INSERT WITH CHECK (auth.uid() = user_id);
