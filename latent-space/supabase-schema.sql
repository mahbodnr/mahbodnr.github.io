-- ============================================
-- Latent Space - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor (Database > SQL Editor)
-- Make sure to run cleanup-database.sql first if updating existing schema
-- ============================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. USERS TABLE
-- ============================================
-- Stores additional user profile information
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT NOT NULL,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist (for re-running script)
DROP POLICY IF EXISTS "Users can view all profiles" ON users;
DROP POLICY IF EXISTS "Users can update own profile" ON users;
DROP POLICY IF EXISTS "Users can insert own profile" ON users;

-- Users can read all profiles
CREATE POLICY "Users can view all profiles" ON users
    FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- Users can insert their own profile
CREATE POLICY "Users can insert own profile" ON users
    FOR INSERT WITH CHECK (auth.uid() = id);

-- ============================================
-- 2. PUZZLES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS puzzles (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    answer_hash TEXT NOT NULL, -- SHA-256 hash of the lowercase, trimmed answer
    release_time TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    base_points INTEGER NOT NULL DEFAULT 1000,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE puzzles ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view released puzzles" ON puzzles;

-- Anyone can view puzzles that have been released
CREATE POLICY "Anyone can view released puzzles" ON puzzles
    FOR SELECT USING (release_time <= NOW());

-- ============================================
-- 3. HINTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS hints (
    id SERIAL PRIMARY KEY,
    puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    hint_text TEXT NOT NULL,
    release_time TIMESTAMP WITH TIME ZONE NOT NULL,
    superhint BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hints ENABLE ROW LEVEL SECURITY;

-- Drop existing policy if it exists
DROP POLICY IF EXISTS "Anyone can view released hints" ON hints;

-- Anyone can view released hints
CREATE POLICY "Anyone can view released hints" ON hints
    FOR SELECT USING (release_time <= NOW());

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS hints_puzzle_id_idx ON hints(puzzle_id);
CREATE INDEX IF NOT EXISTS hints_release_time_idx ON hints(release_time);

-- Add superhint column for existing deployments (no-op if already present)
ALTER TABLE hints ADD COLUMN IF NOT EXISTS superhint BOOLEAN NOT NULL DEFAULT FALSE;

-- ============================================
-- 3b. SUPERHINT_READS TABLE
-- ============================================
-- Tracks which user has acknowledged (read) which superhint; used to show spoiler warning only once per user per superhint
CREATE TABLE IF NOT EXISTS superhint_reads (
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hint_id INTEGER NOT NULL REFERENCES hints(id) ON DELETE CASCADE,
    read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    PRIMARY KEY (user_id, hint_id)
);

ALTER TABLE superhint_reads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view own superhint reads" ON superhint_reads;
CREATE POLICY "Users can view own superhint reads" ON superhint_reads
    FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own superhint reads" ON superhint_reads;
CREATE POLICY "Users can insert own superhint reads" ON superhint_reads
    FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS superhint_reads_hint_id_idx ON superhint_reads(hint_id);

-- ============================================
-- 4. SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    answer_text TEXT NOT NULL,
    answer_hash TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own submissions" ON submissions;
DROP POLICY IF EXISTS "Anyone can view correct submissions" ON submissions;
DROP POLICY IF EXISTS "Users can insert own submissions" ON submissions;

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions" ON submissions
    FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view correct submissions (for per-puzzle leaderboards)
CREATE POLICY "Anyone can view correct submissions" ON submissions
    FOR SELECT USING (is_correct = true);

-- Users can insert their own submissions
CREATE POLICY "Users can insert own submissions" ON submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes for faster queries
CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON submissions(user_id);
CREATE INDEX IF NOT EXISTS submissions_puzzle_id_idx ON submissions(puzzle_id);
CREATE INDEX IF NOT EXISTS submissions_correct_idx ON submissions(is_correct);
CREATE INDEX IF NOT EXISTS submissions_submitted_at_idx ON submissions(submitted_at);

-- ============================================
-- 5. EMAIL PREFERENCES TABLE
-- ============================================
-- Stores user email notification preferences
CREATE TABLE IF NOT EXISTS email_preferences (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    notify_new_puzzles BOOLEAN DEFAULT TRUE,
    notify_new_hints BOOLEAN DEFAULT TRUE,
    unsubscribe_token UUID DEFAULT uuid_generate_v4() UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE email_preferences ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view own email preferences" ON email_preferences;
DROP POLICY IF EXISTS "Users can update own email preferences" ON email_preferences;
DROP POLICY IF EXISTS "Users can insert own email preferences" ON email_preferences;

-- Users can view their own preferences
CREATE POLICY "Users can view own email preferences" ON email_preferences
    FOR SELECT USING (auth.uid() = user_id);

-- Users can update their own preferences
CREATE POLICY "Users can update own email preferences" ON email_preferences
    FOR UPDATE USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- Users can insert their own preferences
CREATE POLICY "Users can insert own email preferences" ON email_preferences
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create index for token lookups
CREATE INDEX IF NOT EXISTS email_preferences_token_idx ON email_preferences(unsubscribe_token);

-- ============================================
-- 6. EMAIL LOGS TABLE
-- ============================================
-- Logs all email notifications sent to users
CREATE TABLE IF NOT EXISTS email_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    email TEXT NOT NULL,
    notification_type TEXT NOT NULL, -- 'new_puzzle' or 'new_hint'
    puzzle_id INTEGER REFERENCES puzzles(id) ON DELETE SET NULL,
    hint_id INTEGER REFERENCES hints(id) ON DELETE SET NULL,
    success BOOLEAN NOT NULL DEFAULT TRUE,
    error_message TEXT,
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE email_logs ENABLE ROW LEVEL SECURITY;

-- Only allow service role to insert (edge function uses service role)
-- No public read access for privacy
DROP POLICY IF EXISTS "Service role can insert email logs" ON email_logs;
CREATE POLICY "Service role can insert email logs" ON email_logs
    FOR INSERT WITH CHECK (true);

-- Create indexes for querying logs
CREATE INDEX IF NOT EXISTS email_logs_user_id_idx ON email_logs(user_id);
CREATE INDEX IF NOT EXISTS email_logs_sent_at_idx ON email_logs(sent_at);
CREATE INDEX IF NOT EXISTS email_logs_notification_type_idx ON email_logs(notification_type);

-- ============================================
-- 7. LEADERBOARD VIEW
-- ============================================
CREATE OR REPLACE VIEW leaderboard_view
WITH (security_invoker = true) AS
SELECT 
    u.id as user_id,
    u.username,
    u.avatar_url,
    COALESCE(SUM(s.score), 0) as total_points,
    COUNT(DISTINCT s.puzzle_id) as puzzles_solved
FROM users u
LEFT JOIN submissions s ON u.id = s.user_id AND s.is_correct = true
GROUP BY u.id, u.username, u.avatar_url
HAVING COALESCE(SUM(s.score), 0) > 0
ORDER BY total_points DESC;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS check_answer(p_puzzle_id INTEGER, p_user_id UUID, p_answer_text TEXT, p_answer_hash TEXT);

CREATE OR REPLACE FUNCTION check_answer(
    p_puzzle_id INTEGER,
    p_user_id UUID,
    p_answer_text TEXT,
    p_answer_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_puzzle puzzles%ROWTYPE;
    v_hints_count INTEGER;
    v_score INTEGER;
    v_is_correct BOOLEAN;
    v_existing_correct BOOLEAN;
BEGIN
    -- Get the puzzle
    SELECT * INTO v_puzzle FROM puzzles WHERE id = p_puzzle_id;
    
    IF v_puzzle IS NULL THEN
        RETURN json_build_object('error', 'Puzzle not found', 'correct', false);
    END IF;
    
    -- Check if puzzle is released
    IF v_puzzle.release_time > NOW() THEN
        RETURN json_build_object('error', 'Puzzle not yet available', 'correct', false);
    END IF;
    
    -- Check if user already solved this puzzle
    SELECT EXISTS(
        SELECT 1 FROM submissions 
        WHERE user_id = p_user_id 
        AND puzzle_id = p_puzzle_id 
        AND is_correct = true
    ) INTO v_existing_correct;
    
    IF v_existing_correct THEN
        RETURN json_build_object('error', 'Already solved', 'correct', true, 'score', 0);
    END IF;
    
    -- Check if answer is correct
    v_is_correct := (p_answer_hash = v_puzzle.answer_hash);
    
    -- Count released hints
    SELECT COUNT(*) INTO v_hints_count
    FROM hints
    WHERE puzzle_id = p_puzzle_id
    AND release_time <= NOW();
    
    -- Calculate score if correct
    IF v_is_correct THEN
        -- Convert to integer deterministically
        v_score := (v_puzzle.base_points / POWER(2, v_hints_count))::int;
    ELSE
        v_score := 0;
    END IF;
    
    -- Record the submission
    INSERT INTO submissions (user_id, puzzle_id, answer_text, answer_hash, is_correct, score)
    VALUES (p_user_id, p_puzzle_id, p_answer_text, p_answer_hash, v_is_correct, v_score);
    
    RETURN json_build_object(
        'correct', v_is_correct,
        'score', v_score,
        'hints_used', v_hints_count
    );
END;
$$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS get_puzzles_list();

CREATE OR REPLACE FUNCTION get_puzzles_list()
RETURNS TABLE (
    id INTEGER,
    title TEXT,
    release_time TIMESTAMP WITH TIME ZONE,
    base_points INTEGER
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
    SELECT p.id, p.title, p.release_time, p.base_points
    FROM puzzles p
    ORDER BY (p.release_time > NOW())::int, p.release_time;
$$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS update_user_avatar(p_user_id UUID, p_avatar_url TEXT);

CREATE OR REPLACE FUNCTION update_user_avatar(
    p_user_id UUID,
    p_avatar_url TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow users to update their own avatar
    IF auth.uid() != p_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    UPDATE users
    SET avatar_url = p_avatar_url
    WHERE id = p_user_id;
    
    IF NOT FOUND THEN
        RETURN json_build_object('success', false, 'error', 'User not found');
    END IF;
    
    RETURN json_build_object('success', true);
END;
$$;

-- Drop existing function if it exists
DROP FUNCTION IF EXISTS ensure_user_exists(p_user_id UUID, p_email TEXT, p_username TEXT, p_avatar_url TEXT);

-- Function to create/update user profile (bypasses RLS timing issues during OAuth)
CREATE OR REPLACE FUNCTION ensure_user_exists(
    p_user_id UUID,
    p_email TEXT,
    p_username TEXT,
    p_avatar_url TEXT DEFAULT NULL
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Only allow users to create/update their own profile
    IF auth.uid() IS NULL OR auth.uid() != p_user_id THEN
        RETURN json_build_object('success', false, 'error', 'Unauthorized');
    END IF;
    
    -- Upsert the user - preserve existing username/avatar to respect user edits
    INSERT INTO users (id, email, username, avatar_url)
    VALUES (p_user_id, p_email, p_username, p_avatar_url)
    ON CONFLICT (id) DO UPDATE SET
        email = COALESCE(EXCLUDED.email, users.email),
        username = COALESCE(users.username, EXCLUDED.username),
        avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url);
    
    -- Ensure email preferences exist for this user (default: all notifications enabled)
    INSERT INTO email_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
    
    RETURN json_build_object('success', true);
END;
$$;

-- ============================================
-- 9. EMAIL PREFERENCES FUNCTIONS
-- ============================================

-- Drop existing functions if they exist
DROP FUNCTION IF EXISTS get_email_preferences_by_token(p_token UUID);
DROP FUNCTION IF EXISTS update_email_preferences_by_token(p_token UUID, p_notify_new_puzzles BOOLEAN, p_notify_new_hints BOOLEAN);
DROP FUNCTION IF EXISTS get_users_for_notification(p_notification_type TEXT);
DROP FUNCTION IF EXISTS ensure_email_preferences_exist(p_user_id UUID);

-- Function to ensure email preferences exist for a user (called during user creation)
CREATE OR REPLACE FUNCTION ensure_email_preferences_exist(p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    INSERT INTO email_preferences (user_id)
    VALUES (p_user_id)
    ON CONFLICT (user_id) DO NOTHING;
END;
$$;

-- Function to get email preferences by unsubscribe token (no auth required)
-- Returns user email (partially masked) and preferences
CREATE OR REPLACE FUNCTION get_email_preferences_by_token(p_token UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_prefs email_preferences%ROWTYPE;
    v_user users%ROWTYPE;
    v_masked_email TEXT;
BEGIN
    -- Find preferences by token
    SELECT * INTO v_prefs FROM email_preferences WHERE unsubscribe_token = p_token;
    
    IF v_prefs IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired token');
    END IF;
    
    -- Get user info
    SELECT * INTO v_user FROM users WHERE id = v_prefs.user_id;
    
    -- Mask email for privacy (show first 2 chars + domain)
    IF v_user.email IS NOT NULL AND v_user.email LIKE '%@%' THEN
        v_masked_email := SUBSTRING(v_user.email FROM 1 FOR 2) || '***@' || 
                          SUBSTRING(v_user.email FROM POSITION('@' IN v_user.email) + 1);
    ELSE
        v_masked_email := '***';
    END IF;
    
    RETURN json_build_object(
        'success', true,
        'email', v_masked_email,
        'notify_new_puzzles', v_prefs.notify_new_puzzles,
        'notify_new_hints', v_prefs.notify_new_hints
    );
END;
$$;

-- Function to update email preferences by unsubscribe token (no auth required)
CREATE OR REPLACE FUNCTION update_email_preferences_by_token(
    p_token UUID,
    p_notify_new_puzzles BOOLEAN,
    p_notify_new_hints BOOLEAN
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_user_id UUID;
BEGIN
    -- Find user by token
    SELECT user_id INTO v_user_id FROM email_preferences WHERE unsubscribe_token = p_token;
    
    IF v_user_id IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Invalid or expired token');
    END IF;
    
    -- Update preferences
    UPDATE email_preferences
    SET 
        notify_new_puzzles = p_notify_new_puzzles,
        notify_new_hints = p_notify_new_hints,
        updated_at = NOW()
    WHERE unsubscribe_token = p_token;
    
    RETURN json_build_object('success', true);
END;
$$;

-- Function to get all users who should receive a notification (for edge function)
-- p_notification_type: 'new_puzzle' or 'new_hint'
-- p_puzzle_id: Required for 'new_hint' to exclude users who already solved the puzzle
DROP FUNCTION IF EXISTS get_users_for_notification(TEXT);
DROP FUNCTION IF EXISTS get_users_for_notification(TEXT, INTEGER);

CREATE OR REPLACE FUNCTION get_users_for_notification(
    p_notification_type TEXT,
    p_puzzle_id INTEGER DEFAULT NULL
)
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    username TEXT,
    unsubscribe_token UUID
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    IF p_notification_type = 'new_puzzle' THEN
        RETURN QUERY
        SELECT u.id, u.email, u.username, ep.unsubscribe_token
        FROM users u
        JOIN email_preferences ep ON u.id = ep.user_id
        WHERE ep.notify_new_puzzles = true
        AND u.email IS NOT NULL;
    ELSIF p_notification_type = 'new_hint' THEN
        -- For hints, exclude users who have already solved this puzzle
        IF p_puzzle_id IS NULL THEN
            RAISE EXCEPTION 'puzzle_id is required for new_hint notifications';
        END IF;
        
        RETURN QUERY
        SELECT u.id, u.email, u.username, ep.unsubscribe_token
        FROM users u
        JOIN email_preferences ep ON u.id = ep.user_id
        WHERE ep.notify_new_hints = true
        AND u.email IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM submissions s
            WHERE s.user_id = u.id
            AND s.puzzle_id = p_puzzle_id
            AND s.is_correct = true
        );
    ELSE
        RAISE EXCEPTION 'Invalid notification type: %', p_notification_type;
    END IF;
END;
$$;

-- ============================================
-- 10. STORAGE POLICIES (AVATARS BUCKET)
-- ============================================
-- Note: Make sure the 'avatars' bucket is created in Supabase Storage
-- and set to Public before running these policies

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Users can upload avatars to their own folder
CREATE POLICY "Users can upload avatars" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
    );

-- Public read access to all avatars
CREATE POLICY "Public read access to avatars" ON storage.objects
    FOR SELECT USING (bucket_id = 'avatars');

-- Users can update their own avatars
CREATE POLICY "Users can update their own avatars" ON storage.objects
    FOR UPDATE TO authenticated
    WITH CHECK (
        bucket_id = 'avatars' 
        AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
    );

-- Users can delete their own avatars
CREATE POLICY "Users can delete their own avatars" ON storage.objects
    FOR DELETE TO authenticated
    USING (
        bucket_id = 'avatars' 
        AND (regexp_split_to_array(name, '/'))[1] = auth.uid()::text
    );

-- ============================================
-- 11. GRANT PERMISSIONS
-- ============================================
-- Grant table permissions
GRANT SELECT ON users TO anon, authenticated;
GRANT INSERT, UPDATE ON users TO authenticated;

GRANT SELECT ON puzzles TO anon, authenticated;

GRANT SELECT ON hints TO anon, authenticated;

GRANT SELECT, INSERT ON superhint_reads TO authenticated;

GRANT SELECT ON submissions TO anon, authenticated;
GRANT INSERT ON submissions TO authenticated;

GRANT SELECT ON email_preferences TO authenticated;
GRANT INSERT, UPDATE ON email_preferences TO authenticated;

-- Email logs: insert only via service role (edge function), no public access
GRANT INSERT ON email_logs TO authenticated;

-- Grant view permissions
GRANT SELECT ON leaderboard_view TO anon, authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON FUNCTION check_answer(INTEGER, UUID, TEXT, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION get_puzzles_list TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_user_avatar(UUID, TEXT) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_user_exists(UUID, TEXT, TEXT, TEXT) TO authenticated;

-- Email preferences functions (accessible without auth via token)
GRANT EXECUTE ON FUNCTION get_email_preferences_by_token(UUID) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION update_email_preferences_by_token(UUID, BOOLEAN, BOOLEAN) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION get_users_for_notification(TEXT, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION ensure_email_preferences_exist(UUID) TO authenticated;

