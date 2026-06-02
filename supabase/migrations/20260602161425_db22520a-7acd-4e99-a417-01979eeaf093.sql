ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text,
  ADD COLUMN IF NOT EXISTS training_years text,
  ADD COLUMN IF NOT EXISTS had_structured_program text,
  ADD COLUMN IF NOT EXISTS sports_notes text,
  ADD COLUMN IF NOT EXISTS sports_frequency_week integer,
  ADD COLUMN IF NOT EXISTS professional_activity text,
  ADD COLUMN IF NOT EXISTS sleep_hours numeric(3,1),
  ADD COLUMN IF NOT EXISTS water_intake text,
  ADD COLUMN IF NOT EXISTS smokes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alcohol_frequency text,
  ADD COLUMN IF NOT EXISTS had_surgery text,
  ADD COLUMN IF NOT EXISTS last_medical_checkup text,
  ADD COLUMN IF NOT EXISTS pain_intensity jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS limitations_notes text,
  ADD COLUMN IF NOT EXISTS perf_longest_run_km numeric(5,2),
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

DO $$
DECLARE
  enum_type text;
BEGIN
  SELECT udt_name INTO enum_type
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='profiles' AND column_name='sex';

  IF enum_type IS NOT NULL THEN
    EXECUTE format('ALTER TYPE public.%I ADD VALUE IF NOT EXISTS %L', enum_type, 'prefer_not_to_say');
  END IF;
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

DROP POLICY IF EXISTS "Users upload own photos" ON storage.objects;
CREATE POLICY "Users upload own photos" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users view own photos" ON storage.objects;
CREATE POLICY "Users view own photos" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users delete own photos" ON storage.objects;
CREATE POLICY "Users delete own photos" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'progress-photos' AND auth.uid()::text = (storage.foldername(name))[1]);