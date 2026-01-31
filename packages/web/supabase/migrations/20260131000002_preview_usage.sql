-- Preview usage tracking
-- Adds preview count to usage table and RPC functions for budget management.
-- Formula: remaining_pages * 5 - previews_used = remaining previews

-- Add preview tracking column to usage table
ALTER TABLE usage ADD COLUMN IF NOT EXISTS previews_used INTEGER DEFAULT 0;

-- Get remaining preview budget for current billing period
CREATE OR REPLACE FUNCTION get_remaining_previews(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    v_remaining_pages INTEGER;
    v_previews_used INTEGER;
BEGIN
    v_remaining_pages := get_remaining_pages(p_user_id);

    SELECT COALESCE(previews_used, 0) INTO v_previews_used
    FROM usage
    WHERE user_id = p_user_id
    AND period = current_billing_period();

    IF v_previews_used IS NULL THEN
        v_previews_used := 0;
    END IF;

    RETURN GREATEST(0, (v_remaining_pages * 5) - v_previews_used);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Increment preview usage after successful preview generation
CREATE OR REPLACE FUNCTION increment_preview_usage(p_user_id UUID)
RETURNS VOID AS $$
BEGIN
    INSERT INTO usage (user_id, period, previews_used)
    VALUES (p_user_id, current_billing_period(), 1)
    ON CONFLICT (user_id, period)
    DO UPDATE SET
        previews_used = usage.previews_used + 1,
        updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
