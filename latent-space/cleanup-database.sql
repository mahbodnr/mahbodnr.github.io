-- ============================================
-- Latent Space - Database Cleanup Script
-- ============================================
-- Run this FIRST to clean up all existing objects

-- Drop all functions (with explicit parameter signatures)
DROP FUNCTION IF EXISTS check_answer(p_puzzle_id INTEGER, p_user_id UUID, p_answer_text TEXT, p_answer_hash TEXT);
DROP FUNCTION IF EXISTS get_puzzles_list();
DROP FUNCTION IF EXISTS update_user_avatar(p_user_id UUID, p_avatar_url TEXT);

DROP VIEW IF EXISTS leaderboard_view;

-- Drop all tables (CASCADE will remove dependent objects)
DROP TABLE IF EXISTS submissions CASCADE;
DROP TABLE IF EXISTS hints CASCADE;
DROP TABLE IF EXISTS puzzles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop all storage policies
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Public read access to avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;

-- Note: The 'avatars' storage bucket itself should be deleted manually
-- from the Supabase Storage UI if you want to remove all uploaded files

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Database cleanup complete! You can now run the schema file.';
END $$;
