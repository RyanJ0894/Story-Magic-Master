-- Auto-create profile if missing when checking remaining pages
-- This handles cases where the signup trigger failed or user existed before migration

CREATE OR REPLACE FUNCTION get_remaining_pages(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_usage RECORD;
    v_limit INTEGER;
    v_email TEXT;
BEGIN
    -- Get user's tier limit
    SELECT
        CASE subscription_tier
            WHEN 'free' THEN 3
            WHEN 'creator' THEN 50
            WHEN 'pro' THEN 200
            WHEN 'studio' THEN 1000
            ELSE 3
        END INTO v_limit
    FROM profiles
    WHERE id = p_user_id;

    -- If no profile exists, create one with free tier
    IF v_limit IS NULL THEN
        -- Get email from auth.users
        SELECT email INTO v_email FROM auth.users WHERE id = p_user_id;

        -- Create profile with free tier
        INSERT INTO profiles (id, email, subscription_tier)
        VALUES (p_user_id, v_email, 'free')
        ON CONFLICT (id) DO NOTHING;

        -- Set default free tier limit
        v_limit := 3;
    END IF;

    -- Get current usage
    SELECT pages_used INTO v_usage
    FROM usage
    WHERE user_id = p_user_id
    AND period = current_billing_period();

    IF v_usage IS NULL THEN
        RETURN v_limit;
    END IF;

    RETURN GREATEST(0, v_limit - v_usage.pages_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Also create a helper function to sync all users missing profiles
CREATE OR REPLACE FUNCTION sync_missing_profiles()
RETURNS INTEGER AS $$
DECLARE
    v_count INTEGER := 0;
BEGIN
    INSERT INTO profiles (id, email, subscription_tier)
    SELECT u.id, u.email, 'free'
    FROM auth.users u
    LEFT JOIN profiles p ON p.id = u.id
    WHERE p.id IS NULL
    ON CONFLICT (id) DO NOTHING;

    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
