
-- 1) workout_sessions: novos campos
ALTER TABLE public.workout_sessions
  ADD COLUMN IF NOT EXISTS estimated_calories numeric,
  ADD COLUMN IF NOT EXISTS completed_summary jsonb NOT NULL DEFAULT '{}'::jsonb;

-- 2) workout_set_logs
CREATE TABLE IF NOT EXISTS public.workout_set_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  exercise_id uuid,
  exercise_name text NOT NULL,
  exercise_index integer NOT NULL DEFAULT 0,
  set_number integer NOT NULL,
  planned_reps text,
  actual_reps integer,
  planned_load_kg numeric,
  actual_load_kg numeric,
  planned_rpe numeric,
  actual_rpe numeric,
  rest_seconds integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_session_id, exercise_index, set_number)
);

CREATE INDEX IF NOT EXISTS idx_wsl_session ON public.workout_set_logs(workout_session_id);
CREATE INDEX IF NOT EXISTS idx_wsl_user ON public.workout_set_logs(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_set_logs TO authenticated;
GRANT ALL ON public.workout_set_logs TO service_role;

ALTER TABLE public.workout_set_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "wsl_select_own" ON public.workout_set_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wsl_insert_own" ON public.workout_set_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wsl_update_own" ON public.workout_set_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wsl_delete_own" ON public.workout_set_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_wsl_updated_at
  BEFORE UPDATE ON public.workout_set_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3) running_session_logs
CREATE TABLE IF NOT EXISTS public.running_session_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  workout_session_id uuid NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  planned_protocol_id uuid,
  total_duration_seconds integer,
  total_running_seconds integer,
  total_rest_seconds integer,
  distance_km numeric,
  average_speed_kmh numeric,
  max_speed_kmh numeric,
  average_pace text,
  perceived_effort integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workout_session_id)
);

CREATE INDEX IF NOT EXISTS idx_rsl_user ON public.running_session_logs(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.running_session_logs TO authenticated;
GRANT ALL ON public.running_session_logs TO service_role;

ALTER TABLE public.running_session_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rsl_select_own" ON public.running_session_logs
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rsl_insert_own" ON public.running_session_logs
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rsl_update_own" ON public.running_session_logs
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rsl_delete_own" ON public.running_session_logs
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_rsl_updated_at
  BEFORE UPDATE ON public.running_session_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
