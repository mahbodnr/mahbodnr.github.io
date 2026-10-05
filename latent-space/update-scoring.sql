BEGIN;
-- Scoring uses the puzzle's editable base and hints released at submission time.
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS is_first_solver BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.submissions ADD COLUMN IF NOT EXISTS bonus_points INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS submissions_solve_order_idx
ON public.submissions(puzzle_id, submitted_at, id) WHERE is_correct;

CREATE OR REPLACE FUNCTION public.recalculate_puzzle_scores(p_puzzle_id INTEGER)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    PERFORM 1 FROM puzzles WHERE id = p_puzzle_id FOR UPDATE;
    WITH ranked AS (
        SELECT s.id, row_number() OVER (ORDER BY s.submitted_at, s.id) AS position,
            FLOOR(p.base_points / POWER(2::numeric, (
                SELECT count(*) FROM hints h
                WHERE h.puzzle_id = s.puzzle_id AND h.release_time <= s.submitted_at
            )))::integer AS earned
        FROM submissions s JOIN puzzles p ON p.id = s.puzzle_id
        WHERE s.puzzle_id = p_puzzle_id AND s.is_correct
    ), scored AS (
        SELECT id, earned, position = 1 AS first_solver,
            CASE WHEN position = 1 THEN FLOOR(earned * 0.5)::integer ELSE 0 END AS bonus
        FROM ranked
    )
    UPDATE submissions s SET score = c.earned + c.bonus,
        is_first_solver = c.first_solver, bonus_points = c.bonus
    FROM scored c WHERE s.id = c.id
      AND (s.score, s.is_first_solver, s.bonus_points)
          IS DISTINCT FROM (c.earned + c.bonus, c.first_solver, c.bonus);
    UPDATE submissions SET score = 0, is_first_solver = false, bonus_points = 0
    WHERE puzzle_id = p_puzzle_id AND NOT is_correct
      AND (score, is_first_solver, bonus_points) IS DISTINCT FROM (0, false, 0);
END;
$$;
REVOKE ALL ON FUNCTION public.recalculate_puzzle_scores(INTEGER) FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION public.refresh_puzzle_scores()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
    IF TG_TABLE_NAME = 'puzzles' THEN
        PERFORM recalculate_puzzle_scores(NEW.id);
    ELSE
        IF TG_OP <> 'INSERT' THEN
            PERFORM recalculate_puzzle_scores(OLD.puzzle_id);
        END IF;
        IF TG_OP <> 'DELETE' THEN
            PERFORM recalculate_puzzle_scores(NEW.puzzle_id);
        END IF;
    END IF;
    RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.refresh_puzzle_scores() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS puzzle_points_changed ON public.puzzles;
CREATE TRIGGER puzzle_points_changed AFTER UPDATE OF base_points ON public.puzzles
FOR EACH ROW WHEN (OLD.base_points IS DISTINCT FROM NEW.base_points)
EXECUTE FUNCTION public.refresh_puzzle_scores();
DROP TRIGGER IF EXISTS submission_scoring_changed ON public.submissions;
CREATE TRIGGER submission_scoring_changed AFTER INSERT OR DELETE OR UPDATE OF is_correct, submitted_at, puzzle_id
ON public.submissions FOR EACH ROW EXECUTE FUNCTION public.refresh_puzzle_scores();
DROP TRIGGER IF EXISTS hint_scoring_changed ON public.hints;
CREATE TRIGGER hint_scoring_changed AFTER INSERT OR DELETE OR UPDATE OF release_time, puzzle_id
ON public.hints FOR EACH ROW EXECUTE FUNCTION public.refresh_puzzle_scores();

-- Only the authenticated answer-check RPC may write scored submissions.
REVOKE INSERT ON public.submissions FROM anon, authenticated;
GRANT SELECT (is_first_solver, bonus_points) ON public.submissions TO anon, authenticated;
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
    v_submission submissions%ROWTYPE;
    v_submitted_at TIMESTAMPTZ;
BEGIN
    IF auth.uid() IS NULL OR auth.uid() <> p_user_id THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;
    -- Serialize submissions and point edits for this puzzle.
    SELECT * INTO v_puzzle FROM puzzles WHERE id = p_puzzle_id FOR UPDATE;
    v_submitted_at := clock_timestamp();
    
    IF v_puzzle IS NULL THEN
        RETURN json_build_object('error', 'Puzzle not found', 'correct', false);
    END IF;
    
    -- Check if puzzle is released
    IF v_puzzle.release_time > v_submitted_at THEN
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
    AND release_time <= v_submitted_at;
    
    -- Calculate score if correct
    IF v_is_correct THEN
        -- Convert to integer deterministically
        v_score := FLOOR(v_puzzle.base_points / POWER(2::numeric, v_hints_count))::int;
    ELSE
        v_score := 0;
    END IF;
    
    -- Record the submission
    INSERT INTO submissions (user_id, puzzle_id, answer_text, answer_hash, is_correct, score, submitted_at)
    VALUES (p_user_id, p_puzzle_id, p_answer_text, p_answer_hash, v_is_correct, v_score, v_submitted_at) RETURNING * INTO v_submission;
    -- AFTER trigger recalculates the bonus before returning the result.
    SELECT * INTO v_submission FROM submissions WHERE id = v_submission.id;
    
    RETURN json_build_object(
        'correct', v_is_correct,
        'score', v_submission.score,
        'is_first_solver', v_submission.is_first_solver,
        'bonus_points', v_submission.bonus_points,
        'hints_used', v_hints_count
    );
END;
$$;


DO $$ DECLARE puzzle RECORD; BEGIN
    FOR puzzle IN SELECT id FROM public.puzzles ORDER BY id LOOP
        PERFORM public.recalculate_puzzle_scores(puzzle.id);
    END LOOP;
END $$;

REVOKE ALL ON FUNCTION public.check_answer(INTEGER, UUID, TEXT, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.check_answer(INTEGER, UUID, TEXT, TEXT) TO authenticated;
-- Retire the obsolete RPC that bypasses authenticated scoring and locking.
DROP FUNCTION IF EXISTS public.check_answer(INTEGER, UUID, TEXT);
COMMIT;
