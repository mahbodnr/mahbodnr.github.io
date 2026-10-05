-- Regression checks run inside a transaction and leave no test data behind.
BEGIN;
-- Disable only the outbound congratulations webhook during test submissions.
ALTER TABLE public.submissions DISABLE TRIGGER "send-puzzle-congrat";
DO $$
DECLARE
    user_a uuid;
    user_b uuid;
    result json;
    first_id uuid;
    second_id uuid;
    boundary timestamptz := '2000-01-02 00:00:00+00';
BEGIN
    SELECT id INTO user_a FROM auth.users ORDER BY id LIMIT 1;
    SELECT id INTO user_b FROM auth.users WHERE id <> user_a ORDER BY id LIMIT 1;
    IF user_b IS NULL THEN RAISE EXCEPTION 'Test needs two existing users'; END IF;
    INSERT INTO puzzles(id,title,description,answer_hash,base_points,release_time)
    VALUES(-90001,'Scoring regression','Temporary rollback fixture','test-hash',1000,'2000-01-01');
    INSERT INTO hints(id,puzzle_id,hint_text,release_time)
    VALUES(-90001,-90001,'Boundary hint',boundary);
    INSERT INTO submissions(user_id,puzzle_id,answer_text,answer_hash,is_correct,submitted_at)
    VALUES(user_a,-90001,'test','test-hash',true,boundary - interval '1 microsecond') RETURNING id INTO first_id;
    INSERT INTO submissions(user_id,puzzle_id,answer_text,answer_hash,is_correct,submitted_at)
    VALUES(user_b,-90001,'test','test-hash',true,boundary) RETURNING id INTO second_id;
    IF (SELECT score FROM submissions WHERE id=first_id) <> 1500 OR
       (SELECT score FROM submissions WHERE id=second_id) <> 500 THEN
        RAISE EXCEPTION 'Hint boundary / first bonus failed';
    END IF;
    UPDATE puzzles SET base_points=2000 WHERE id=-90001;
    IF (SELECT score FROM submissions WHERE id=first_id) <> 3000 OR
       (SELECT score FROM submissions WHERE id=second_id) <> 1000 THEN
        RAISE EXCEPTION 'Historical base-point recalculation failed';
    END IF;
    INSERT INTO hints(id,puzzle_id,hint_text,release_time)
    VALUES(-90002,-90001,'Later hint',boundary + interval '1 day');
    IF (SELECT score FROM submissions WHERE id=second_id) <> 1000 THEN
        RAISE EXCEPTION 'Later hints must not reduce earlier solves';
    END IF;
    DELETE FROM submissions WHERE id=first_id;
    IF (SELECT score FROM submissions WHERE id=second_id) <> 1500 THEN
        RAISE EXCEPTION 'First-solver reassignment failed';
    END IF;
    DELETE FROM submissions WHERE puzzle_id=-90001;
    PERFORM set_config('request.jwt.claim.sub',user_a::text,true);
    result := check_answer(-90001,user_a,'wrong','wrong');
    IF (result->>'score')::integer <> 0 OR (result->>'correct')::boolean THEN
        RAISE EXCEPTION 'Wrong answer scored';
    END IF;
    result := check_answer(-90001,user_a,'test','test-hash');
    IF (result->>'score')::integer <> 750 OR NOT (result->>'is_first_solver')::boolean
       OR (result->>'bonus_points')::integer <> 250 THEN
        RAISE EXCEPTION 'RPC bonus response failed: %',result;
    END IF;
    result := check_answer(-90001,user_a,'test','test-hash');
    IF result->>'error' <> 'Already solved' THEN RAISE EXCEPTION 'Duplicate solve accepted'; END IF;
    PERFORM set_config('request.jwt.claim.sub',user_b::text,true);
    result := check_answer(-90001,user_b,'test','test-hash');
    IF (result->>'score')::integer <> 500 OR (result->>'is_first_solver')::boolean THEN
        RAISE EXCEPTION 'Second solver RPC failed';
    END IF;
END $$;
ROLLBACK;
