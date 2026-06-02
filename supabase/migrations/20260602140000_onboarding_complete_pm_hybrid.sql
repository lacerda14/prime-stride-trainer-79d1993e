-- ============================================================
-- Onboarding Completo PM Hybrid — 14 Etapas
-- Adiciona campos ausentes em profiles + bucket storage
-- ============================================================

-- Etapa 1 — Perfil pessoal (campos já existentes via migrations anteriores:
--   first_name, last_name, birth_date, waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, phone)
-- Adiciona campos que ainda faltam:
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS emergency_contact_name text,
  ADD COLUMN IF NOT EXISTS emergency_contact_phone text;

-- Corrigir coluna sex: a migração anterior a criou como enum sex_enum (male/female/other).
-- Precisamos de 'prefer_not_to_say' também; adicionamos ao enum se não existir.
DO $$
BEGIN
  ALTER TYPE public.sex_enum ADD VALUE IF NOT EXISTS 'prefer_not_to_say';
EXCEPTION WHEN duplicate_object THEN NULL;
END$$;

-- Etapa 4 — Experiência (training_years, had_structured_program — extras além do já existente)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_years text,
  ADD COLUMN IF NOT EXISTS had_structured_program text;

-- Etapa 5 — Disponibilidade (campos já existentes: available_days, available_minutes,
--   available_days_list, preferred_time — todos já adicionados)
-- Nada novo aqui.

-- Etapa 7 — Corrida (campos já existentes: running_mode, running_level,
--   running_continuous_minutes, running_goals, running_preferred_days, cardio_preference)
-- Corrida: running_mode pode ter valores diferentes dos da spec.
-- running_mode atual aceita texto livre; vamos manter assim para não quebrar dados.

-- Etapa 8 — Esportes
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sports_notes text,
  ADD COLUMN IF NOT EXISTS sports_frequency_week integer;

-- Etapa 9 — Hábitos e estilo de vida
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS professional_activity text,
  ADD COLUMN IF NOT EXISTS sleep_hours numeric(3,1),
  ADD COLUMN IF NOT EXISTS water_intake text,
  ADD COLUMN IF NOT EXISTS smokes boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS alcohol_frequency text;

-- Etapa 10 — Saúde (campos já existentes: medical_conditions, medications,
--   medical_restrictions)
-- Adiciona campos extras da spec:
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS had_surgery text,
  ADD COLUMN IF NOT EXISTS last_medical_checkup text;

-- Etapa 11 — Lesões (campos já existentes: pain_regions, past_injuries,
--   uncomfortable_movements, current_pain_level)
-- Adiciona pain_regions como jsonb para mapa de intensidade por região:
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS pain_intensity jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS limitations_notes text;

-- Etapa 12 — Preferências (campos já existentes: preferences, training_style, motivations)
-- Nada novo.

-- Etapa 13 — Performance (campos já existentes: perf_max_pushups, perf_max_squats,
--   perf_max_plank_seconds, perf_max_run_minutes, perf_lifts_done)
-- Adiciona km para corrida:
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS perf_longest_run_km numeric(5,2);

-- Controle de onboarding (onboarding_completed já existe; adicionar step)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS onboarding_step integer DEFAULT 0;

-- ============================================================
-- Storage bucket progress-photos (idempotente)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('progress-photos', 'progress-photos', false)
  ON CONFLICT (id) DO NOTHING;

-- Políticas de storage (idempotente via DROP IF EXISTS)
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
