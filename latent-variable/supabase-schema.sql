-- ============================================
-- Latent Space - Supabase Database Schema
-- ============================================
-- Run this SQL in your Supabase SQL Editor (Database > SQL Editor)
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

-- Users can read all profiles
CREATE POLICY "Users can view all profiles" ON users
    FOR SELECT USING (true);

-- Users can update their own profile
CREATE POLICY "Users can update own profile" ON users
    FOR UPDATE USING (auth.uid() = id);

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
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE hints ENABLE ROW LEVEL SECURITY;

-- Anyone can view released hints
CREATE POLICY "Anyone can view released hints" ON hints
    FOR SELECT USING (release_time <= NOW());

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS hints_puzzle_id_idx ON hints(puzzle_id);
CREATE INDEX IF NOT EXISTS hints_release_time_idx ON hints(release_time);

-- ============================================
-- 4. SUBMISSIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    puzzle_id INTEGER NOT NULL REFERENCES puzzles(id) ON DELETE CASCADE,
    answer_hash TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL DEFAULT FALSE,
    score INTEGER DEFAULT 0,
    submitted_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE submissions ENABLE ROW LEVEL SECURITY;

-- Users can view their own submissions
CREATE POLICY "Users can view own submissions" ON submissions
    FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own submissions
CREATE POLICY "Users can insert own submissions" ON submissions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create indexes
CREATE INDEX IF NOT EXISTS submissions_user_id_idx ON submissions(user_id);
CREATE INDEX IF NOT EXISTS submissions_puzzle_id_idx ON submissions(puzzle_id);

-- ============================================
-- 5. LEADERBOARD VIEW
-- ============================================
CREATE OR REPLACE VIEW leaderboard_view AS
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

-- ============================================
-- 6. CHECK ANSWER FUNCTION
-- ============================================
-- This function checks the answer and records the submission
CREATE OR REPLACE FUNCTION check_answer(
    p_puzzle_id INTEGER,
    p_user_id UUID,
    p_answer_hash TEXT
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
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
        v_score := v_puzzle.base_points / POWER(2, v_hints_count);
    ELSE
        v_score := 0;
    END IF;
    
    -- Record the submission
    INSERT INTO submissions (user_id, puzzle_id, answer_hash, is_correct, score)
    VALUES (p_user_id, p_puzzle_id, p_answer_hash, v_is_correct, v_score);
    
    RETURN json_build_object(
        'correct', v_is_correct,
        'score', v_score,
        'hints_used', v_hints_count
    );
END;
$$;

-- ============================================
-- 7. SAMPLE DATA (OPTIONAL - for testing)
-- ============================================
-- Uncomment and modify to add your first puzzle

/*
-- Insert a sample puzzle
-- First, generate the answer hash. For answer "hello world":
-- You can use this online tool: https://emn178.github.io/online-tools/sha256.html
-- Or run: echo -n "hello world" | sha256sum
-- The hash for "hello world" is: b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9

INSERT INTO puzzles (id, title, description, answer_hash, release_time, base_points)
VALUES (
    1,
    'The First Puzzle',
    'This is your first puzzle! The answer is two words that are commonly used as a programming greeting.<br><br>
    <div class="puzzle-artifact">
    H _ _ _ _   W _ _ _ _
    </div>
    <br>Think about what programmers traditionally write as their first program...',
    'b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9', -- SHA-256 of "hello world"
    NOW(), -- Release immediately
    1000
);

-- Add some hints for the puzzle
INSERT INTO hints (puzzle_id, hint_text, release_time)
VALUES 
    (1, 'The first word starts with "H" and is a greeting.', NOW() + INTERVAL '1 day'),
    (1, 'The second word refers to our planet.', NOW() + INTERVAL '2 days'),
    (1, 'It''s what every programmer learns to print first!', NOW() + INTERVAL '3 days');
*/

-- ============================================
-- 8. GRANT PERMISSIONS
-- ============================================
-- Grant access to the check_answer function for authenticated users
GRANT EXECUTE ON FUNCTION check_answer TO authenticated;

-- Grant select on leaderboard view
GRANT SELECT ON leaderboard_view TO anon, authenticated;
