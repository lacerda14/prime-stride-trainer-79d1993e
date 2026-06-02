
-- =====================================================
-- ENTREGA 1: Onboarding Inteligente v2
-- Expansão do perfil + tabela de fotos de progresso
-- =====================================================

-- 1) Expandir profiles com todos os novos campos do onboarding
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS birth_date date,
  ADD COLUMN IF NOT EXISTS waist_cm numeric,
  ADD COLUMN IF NOT EXISTS hip_cm numeric,
  ADD COLUMN IF NOT EXISTS chest_cm numeric,
  ADD COLUMN IF NOT EXISTS arm_cm numeric,
  ADD COLUMN IF NOT EXISTS thigh_cm numeric,
  ADD COLUMN IF NOT EXISTS primary_goal text,
  ADD COLUMN IF NOT EXISTS secondary_goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS sports_frequency jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS running_mode text,
  ADD COLUMN IF NOT EXISTS running_level text,
  ADD COLUMN IF NOT EXISTS running_continuous_minutes text,
  ADD COLUMN IF NOT EXISTS running_goals text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS running_preferred_days text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS cardio_preference text,
  ADD COLUMN IF NOT EXISTS available_days_list text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferred_time text,
  ADD COLUMN IF NOT EXISTS medical_conditions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS medications text,
  ADD COLUMN IF NOT EXISTS surgeries jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS medical_restrictions text,
  ADD COLUMN IF NOT EXISTS current_pain_level integer,
  ADD COLUMN IF NOT EXISTS pain_regions text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS past_injuries text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS uncomfortable_movements text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS equipment text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS training_style text,
  ADD COLUMN IF NOT EXISTS perf_max_pushups integer,
  ADD COLUMN IF NOT EXISTS perf_max_squats integer,
  ADD COLUMN IF NOT EXISTS perf_max_plank_seconds integer,
  ADD COLUMN IF NOT EXISTS perf_max_run_minutes integer,
  ADD COLUMN IF NOT EXISTS perf_lifts_done text[] NOT NULL DEFAULT '{}';

-- 2) Tabela de fotos de progresso
CREATE TABLE IF NOT EXISTS public.progress_photos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  photo_type text NOT NULL CHECK (photo_type IN ('frente','lado','costas')),
  storage_path text NOT NULL,
  uploaded_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.progress_photos TO authenticated;
GRANT ALL ON public.progress_photos TO service_role;

ALTER TABLE public.progress_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY pp_select_own ON public.progress_photos
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY pp_insert_own ON public.progress_photos
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY pp_delete_own ON public.progress_photos
  FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_progress_photos_user ON public.progress_photos(user_id, uploaded_at DESC);

-- 3) RLS policies para o bucket progress-photos (criado via tool)
-- Pasta = user_id; cada usuário só acessa sua pasta
CREATE POLICY pp_storage_select ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY pp_storage_insert ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY pp_storage_delete ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);
