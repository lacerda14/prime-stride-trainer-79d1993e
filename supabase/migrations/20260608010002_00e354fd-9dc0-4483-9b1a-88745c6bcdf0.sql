UPDATE public.workout_sessions
SET status = 'completed',
    finished_at = COALESCE(finished_at, completed_at)
WHERE completed_at IS NOT NULL AND status <> 'completed';