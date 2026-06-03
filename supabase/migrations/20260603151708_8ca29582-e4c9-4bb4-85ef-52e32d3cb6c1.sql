
-- 1. metric_type on exercise_pool
ALTER TABLE public.exercise_pool 
  ADD COLUMN IF NOT EXISTS metric_type text NOT NULL DEFAULT 'weight_reps' 
  CHECK (metric_type IN ('weight_reps','bodyweight_reps','distance_time','duration_hold'));

-- Backfill isometrics by name
UPDATE public.exercise_pool 
SET metric_type = 'duration_hold' 
WHERE lower(name) ~ '(plank|hollow hold|wall sit|isomet|hold|prancha)';

UPDATE public.exercise_pool
SET metric_type = 'bodyweight_reps'
WHERE lower(name) ~ '(pull[- ]?up|chin[- ]?up|barra fixa)' AND metric_type = 'weight_reps';

-- 2. personal_records (current PR only, one per user+exercise_code)
CREATE TABLE public.personal_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_code text NOT NULL,
  category text NOT NULL CHECK (category IN ('strength','running')),
  metric_type text NOT NULL CHECK (metric_type IN ('weight_load','reps','time_seconds','distance_km','pace_seconds_km')),
  value numeric NOT NULL,
  secondary_value numeric,
  estimated_1rm numeric,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  previous_value numeric,
  source_session_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_code)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.personal_records TO authenticated;
GRANT ALL ON public.personal_records TO service_role;

ALTER TABLE public.personal_records ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select_own" ON public.personal_records FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pr_insert_own" ON public.personal_records FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "pr_update_own" ON public.personal_records FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "pr_delete_own" ON public.personal_records FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER pr_updated_at BEFORE UPDATE ON public.personal_records 
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 3. pr_history (every PR achievement, immutable log)
CREATE TABLE public.pr_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  exercise_code text NOT NULL,
  category text NOT NULL,
  metric_type text NOT NULL,
  value numeric NOT NULL,
  secondary_value numeric,
  estimated_1rm numeric,
  previous_value numeric,
  improvement_pct numeric,
  source_session_id uuid,
  achieved_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, DELETE ON public.pr_history TO authenticated;
GRANT ALL ON public.pr_history TO service_role;

ALTER TABLE public.pr_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "prh_select_own" ON public.pr_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "prh_insert_own" ON public.pr_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "prh_delete_own" ON public.pr_history FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_pr_history_user_achieved ON public.pr_history (user_id, achieved_at DESC);
CREATE INDEX idx_pr_history_user_exercise ON public.pr_history (user_id, exercise_code, achieved_at DESC);

-- 4. Add actual_duration_seconds to workout_set_logs for isometrics
ALTER TABLE public.workout_set_logs ADD COLUMN IF NOT EXISTS actual_duration_seconds integer;
ALTER TABLE public.workout_set_logs ADD COLUMN IF NOT EXISTS planned_duration_seconds integer;

-- 5. Seed PR achievements
INSERT INTO public.achievements (code, title, description, icon, xp_reward, sort_order, criteria) VALUES
  ('first_pr', 'Primeiro PR', 'Você conquistou seu primeiro recorde pessoal', '🏆', 100, 200, '{"type":"pr_count","threshold":1}'::jsonb),
  ('five_prs', '5 Recordes', 'Conquistou 5 recordes pessoais', '🥇', 250, 201, '{"type":"pr_count","threshold":5}'::jsonb),
  ('ten_prs', '10 Recordes', 'Conquistou 10 recordes pessoais', '🏅', 500, 202, '{"type":"pr_count","threshold":10}'::jsonb),
  ('big_six', 'Big Six', 'PR nos 6 levantamentos oficiais', '👑', 1000, 203, '{"type":"pr_all_lifts"}'::jsonb),
  ('sub_30_5k', 'Sub-30 5K', 'Correu 5km abaixo de 30 minutos', '🏃', 500, 204, '{"type":"run_5k_time","threshold":1800}'::jsonb)
ON CONFLICT (code) DO NOTHING;
