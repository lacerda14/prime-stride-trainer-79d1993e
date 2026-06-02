
-- =========================================
-- FASE A: Motor de Personalização PM Hybrid v1.0
-- =========================================

-- 1) Limpar dados existentes (dev reset)
TRUNCATE public.profiles CASCADE;
TRUNCATE public.workout_sessions CASCADE;
TRUNCATE public.run_sessions CASCADE;
TRUNCATE public.xp_events CASCADE;
TRUNCATE public.user_achievements CASCADE;
TRUNCATE public.weight_history CASCADE;

-- 2) Remover week_plans (substituído pela geração dinâmica)
DROP TABLE IF EXISTS public.week_plans CASCADE;

-- 3) Enums novos
CREATE TYPE public.experience_level_enum AS ENUM ('beginner','intermediate','advanced');
CREATE TYPE public.goal_enum AS ENUM ('fat_loss','hypertrophy','endurance','hybrid');
CREATE TYPE public.session_type_enum AS ENUM ('full_body','run_upper','run','rest');
CREATE TYPE public.week_type_enum AS ENUM ('A','B');
CREATE TYPE public.sex_enum AS ENUM ('male','female','other');
CREATE TYPE public.exercise_category_enum AS ENUM (
  'biceps','triceps','chest','lats','back','trap','shoulder',
  'rotator_cuff','posterior_chain','anterior_chain','calf','core','plyometric'
);
CREATE TYPE public.running_protocol_enum AS ENUM ('z2','vo2','tempo','intervals','recovery','threshold');

-- 4) Refatorar profiles
ALTER TABLE public.profiles
  DROP COLUMN IF EXISTS gender,
  DROP COLUMN IF EXISTS main_goal,
  DROP COLUMN IF EXISTS experience_level,
  DROP COLUMN IF EXISTS available_days,
  DROP COLUMN IF EXISTS onboarding_completed_at,
  DROP COLUMN IF EXISTS display_name;

ALTER TABLE public.profiles
  ADD COLUMN name TEXT,
  ADD COLUMN sex public.sex_enum,
  ADD COLUMN experience_level public.experience_level_enum,
  ADD COLUMN goal public.goal_enum,
  ADD COLUMN available_days INTEGER CHECK (available_days IN (3,4,5)),
  ADD COLUMN onboarding_completed BOOLEAN NOT NULL DEFAULT false;

-- atualizar trigger handle_new_user para novo schema
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  INSERT INTO public.profiles (id, name, avatar_url, username, friend_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'atleta_' || lower(substring(replace(NEW.id::text, '-', '') for 8)),
    public.gen_friend_code()
  );
  RETURN NEW;
END;
$$;

-- garantir trigger ativo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================
-- 5) training_programs
-- =========================================
CREATE TABLE public.training_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  goal public.goal_enum NOT NULL,
  experience_level public.experience_level_enum NOT NULL,
  available_days INTEGER NOT NULL CHECK (available_days IN (3,4,5)),
  total_weeks INTEGER NOT NULL DEFAULT 48,
  active_week INTEGER NOT NULL DEFAULT 1,
  active_day INTEGER NOT NULL DEFAULT 1,
  generated_from_engine TEXT NOT NULL DEFAULT 'v1.0',
  reference_velocity NUMERIC,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uniq_one_active_program_per_user
  ON public.training_programs(user_id) WHERE archived_at IS NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_programs TO authenticated;
GRANT ALL ON public.training_programs TO service_role;
ALTER TABLE public.training_programs ENABLE ROW LEVEL SECURITY;

CREATE POLICY tp_select_own ON public.training_programs FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tp_insert_own ON public.training_programs FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY tp_update_own ON public.training_programs FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY tp_delete_own ON public.training_programs FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE TRIGGER trg_tp_updated_at BEFORE UPDATE ON public.training_programs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- =========================================
-- 6) macrocycles
-- =========================================
CREATE TABLE public.macrocycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  objective TEXT,
  dominant_method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_macrocycles_program ON public.macrocycles(program_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.macrocycles TO authenticated;
GRANT ALL ON public.macrocycles TO service_role;
ALTER TABLE public.macrocycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY mc_select_own ON public.macrocycles FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));
CREATE POLICY mc_modify_own ON public.macrocycles FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_programs p WHERE p.id = program_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.training_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));

-- =========================================
-- 7) mesocycles
-- =========================================
CREATE TABLE public.mesocycles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  macrocycle_id UUID NOT NULL REFERENCES public.macrocycles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER NOT NULL,
  start_week INTEGER NOT NULL,
  end_week INTEGER NOT NULL,
  objective TEXT,
  method TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_mesocycles_macro ON public.mesocycles(macrocycle_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.mesocycles TO authenticated;
GRANT ALL ON public.mesocycles TO service_role;
ALTER TABLE public.mesocycles ENABLE ROW LEVEL SECURITY;

CREATE POLICY ms_select_own ON public.mesocycles FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.macrocycles m
    JOIN public.training_programs p ON p.id = m.program_id
    WHERE m.id = macrocycle_id AND p.user_id = auth.uid()
  ));
CREATE POLICY ms_modify_own ON public.mesocycles FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.macrocycles m
    JOIN public.training_programs p ON p.id = m.program_id
    WHERE m.id = macrocycle_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.macrocycles m
    JOIN public.training_programs p ON p.id = m.program_id
    WHERE m.id = macrocycle_id AND p.user_id = auth.uid()
  ));

-- =========================================
-- 8) weeks
-- =========================================
CREATE TABLE public.weeks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES public.training_programs(id) ON DELETE CASCADE,
  mesocycle_id UUID NOT NULL REFERENCES public.mesocycles(id) ON DELETE CASCADE,
  week_number INTEGER NOT NULL,
  week_type public.week_type_enum NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (program_id, week_number)
);
CREATE INDEX idx_weeks_program ON public.weeks(program_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.weeks TO authenticated;
GRANT ALL ON public.weeks TO service_role;
ALTER TABLE public.weeks ENABLE ROW LEVEL SECURITY;

CREATE POLICY wk_select_own ON public.weeks FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));
CREATE POLICY wk_modify_own ON public.weeks FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.training_programs p WHERE p.id = program_id AND p.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.training_programs p WHERE p.id = program_id AND p.user_id = auth.uid()));

-- =========================================
-- 9) training_days
-- =========================================
CREATE TABLE public.training_days (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  week_id UUID NOT NULL REFERENCES public.weeks(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL,
  day_name TEXT NOT NULL,
  session_type public.session_type_enum NOT NULL,
  duration_minutes INTEGER,
  objective TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (week_id, day_number)
);
CREATE INDEX idx_training_days_week ON public.training_days(week_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_days TO authenticated;
GRANT ALL ON public.training_days TO service_role;
ALTER TABLE public.training_days ENABLE ROW LEVEL SECURITY;

CREATE POLICY td_select_own ON public.training_days FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.weeks w
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE w.id = week_id AND p.user_id = auth.uid()
  ));
CREATE POLICY td_modify_own ON public.training_days FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.weeks w
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE w.id = week_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.weeks w
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE w.id = week_id AND p.user_id = auth.uid()
  ));

-- =========================================
-- 10) exercise_pool (catálogo público para autenticados)
-- =========================================
CREATE TABLE public.exercise_pool (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  category public.exercise_category_enum NOT NULL,
  equipment TEXT,
  movement_pattern TEXT,
  allowed_beginner BOOLEAN NOT NULL DEFAULT true,
  allowed_intermediate BOOLEAN NOT NULL DEFAULT true,
  allowed_advanced BOOLEAN NOT NULL DEFAULT true,
  shoulder_safe BOOLEAN NOT NULL DEFAULT true,
  lower_body_pattern TEXT,
  banned_weeks_1_to_12 BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_exercise_pool_category ON public.exercise_pool(category);

GRANT SELECT ON public.exercise_pool TO authenticated;
GRANT ALL ON public.exercise_pool TO service_role;
ALTER TABLE public.exercise_pool ENABLE ROW LEVEL SECURITY;

CREATE POLICY ep_public_read ON public.exercise_pool FOR SELECT TO authenticated USING (true);

-- =========================================
-- 11) session_exercises
-- =========================================
CREATE TABLE public.session_exercises (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_day_id UUID NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  exercise_id UUID NOT NULL REFERENCES public.exercise_pool(id) ON DELETE RESTRICT,
  slot INTEGER NOT NULL,
  pair_slot INTEGER,
  sets INTEGER NOT NULL,
  reps TEXT NOT NULL,
  rest_seconds INTEGER,
  rpe_target NUMERIC,
  notes TEXT,
  pr_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_session_exercises_day ON public.session_exercises(training_day_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.session_exercises TO authenticated;
GRANT ALL ON public.session_exercises TO service_role;
ALTER TABLE public.session_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY se_select_own ON public.session_exercises FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_days d
    JOIN public.weeks w ON w.id = d.week_id
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE d.id = training_day_id AND p.user_id = auth.uid()
  ));
CREATE POLICY se_modify_own ON public.session_exercises FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_days d
    JOIN public.weeks w ON w.id = d.week_id
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE d.id = training_day_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_days d
    JOIN public.weeks w ON w.id = d.week_id
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE d.id = training_day_id AND p.user_id = auth.uid()
  ));

-- =========================================
-- 12) running_protocols
-- =========================================
CREATE TABLE public.running_protocols (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  training_day_id UUID NOT NULL REFERENCES public.training_days(id) ON DELETE CASCADE,
  protocol_type public.running_protocol_enum NOT NULL,
  blocks INTEGER,
  intervals INTEGER,
  work_duration_seconds INTEGER,
  rest_duration_seconds INTEGER,
  pace_min NUMERIC,
  pace_max NUMERIC,
  total_duration_minutes INTEGER,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_running_protocols_day ON public.running_protocols(training_day_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.running_protocols TO authenticated;
GRANT ALL ON public.running_protocols TO service_role;
ALTER TABLE public.running_protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY rp_select_own ON public.running_protocols FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_days d
    JOIN public.weeks w ON w.id = d.week_id
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE d.id = training_day_id AND p.user_id = auth.uid()
  ));
CREATE POLICY rp_modify_own ON public.running_protocols FOR ALL TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.training_days d
    JOIN public.weeks w ON w.id = d.week_id
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE d.id = training_day_id AND p.user_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.training_days d
    JOIN public.weeks w ON w.id = d.week_id
    JOIN public.training_programs p ON p.id = w.program_id
    WHERE d.id = training_day_id AND p.user_id = auth.uid()
  ));
