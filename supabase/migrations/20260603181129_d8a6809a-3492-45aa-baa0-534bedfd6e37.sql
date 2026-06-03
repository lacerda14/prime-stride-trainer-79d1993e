
ALTER TABLE public.workout_set_logs
  ADD COLUMN IF NOT EXISTS set_status text NOT NULL DEFAULT 'completed'
    CHECK (set_status IN ('completed','failed','skipped'));

CREATE TABLE IF NOT EXISTS public.readiness_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id uuid REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
  score integer NOT NULL CHECK (score >= 0 AND score <= 100),
  signals jsonb NOT NULL DEFAULT '{}'::jsonb,
  decision jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_readiness_user_created
  ON public.readiness_scores(user_id, created_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.readiness_scores TO authenticated;
GRANT ALL ON public.readiness_scores TO service_role;

ALTER TABLE public.readiness_scores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rs_select_own" ON public.readiness_scores
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rs_insert_own" ON public.readiness_scores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rs_delete_own" ON public.readiness_scores
  FOR DELETE TO authenticated USING (auth.uid() = user_id);
