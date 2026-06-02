
-- Expand workout_sessions to support persistent session engine
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'not_started',
  ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_exercise_index INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS current_set INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS current_block INTEGER,
  ADD COLUMN IF NOT EXISTS current_interval INTEGER,
  ADD COLUMN IF NOT EXISTS elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_elapsed_seconds INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS session_data JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Constrain status
DO $$ BEGIN
  ALTER TABLE public.workout_sessions
    ADD CONSTRAINT workout_sessions_status_chk
    CHECK (status IN ('not_started','active','paused','completed','abandoned'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Index for fast active-session lookup
CREATE INDEX IF NOT EXISTS workout_sessions_user_status_idx
  ON public.workout_sessions(user_id, status)
  WHERE status IN ('active','paused');

-- Ensure only one active session per user
CREATE UNIQUE INDEX IF NOT EXISTS workout_sessions_one_active_per_user
  ON public.workout_sessions(user_id)
  WHERE status IN ('active','paused');
