
-- ============================================================
-- FASE 1: Fundação gamificada
-- ============================================================

-- 1) PROFILES — estender
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS phone text,
  ADD COLUMN IF NOT EXISTS age integer,
  ADD COLUMN IF NOT EXISTS gender text CHECK (gender IN ('male','female','other','prefer_not_to_say')),
  ADD COLUMN IF NOT EXISTS weight_kg numeric(5,2),
  ADD COLUMN IF NOT EXISTS height_cm numeric(5,2),
  ADD COLUMN IF NOT EXISTS experience_level text CHECK (experience_level IN ('beginner','intermediate','advanced')),
  ADD COLUMN IF NOT EXISTS main_goal text CHECK (main_goal IN ('weight_loss','hypertrophy','aerobic','hybrid','general_health')),
  ADD COLUMN IF NOT EXISTS available_days integer[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS username text UNIQUE,
  ADD COLUMN IF NOT EXISTS friend_code text UNIQUE,
  ADD COLUMN IF NOT EXISTS xp_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS level integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS streak_current integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_longest integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS streak_last_date date;

CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);
CREATE INDEX IF NOT EXISTS idx_profiles_friend_code ON public.profiles(friend_code);

-- Permitir busca de username/friend_code por outros usuários autenticados
DROP POLICY IF EXISTS "Authenticated users can search profiles" ON public.profiles;
CREATE POLICY "Authenticated users can search profiles"
ON public.profiles FOR SELECT
TO authenticated
USING (true);
-- (substitui o policy antigo "Users can view own profile" — agora todos autenticados podem ler perfis,
--  mas a política de UPDATE/INSERT continua restrita ao próprio user)

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;

-- 2) WEIGHT_HISTORY
CREATE TABLE IF NOT EXISTS public.weight_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  weight_kg numeric(5,2) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, DELETE ON public.weight_history TO authenticated;
GRANT ALL ON public.weight_history TO service_role;
ALTER TABLE public.weight_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wh_select_own" ON public.weight_history FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wh_insert_own" ON public.weight_history FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wh_delete_own" ON public.weight_history FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_weight_history_user_date ON public.weight_history(user_id, recorded_at DESC);

-- 3) WORKOUT_SESSIONS
CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  day_key text NOT NULL,
  scheduled_date date,
  completed_at timestamptz,
  duration_min integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT ALL ON public.workout_sessions TO service_role;
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ws_select_own" ON public.workout_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ws_insert_own" ON public.workout_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "ws_update_own" ON public.workout_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ws_delete_own" ON public.workout_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_ws_user_week ON public.workout_sessions(user_id, week_number);
CREATE INDEX idx_ws_user_completed ON public.workout_sessions(user_id, completed_at DESC);
CREATE TRIGGER trg_ws_updated_at BEFORE UPDATE ON public.workout_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- 4) RUN_SESSIONS
CREATE TABLE IF NOT EXISTS public.run_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number integer,
  scheduled_date date,
  completed_at timestamptz,
  distance_km numeric(6,2),
  duration_min integer,
  pace_seconds_per_km integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.run_sessions TO authenticated;
GRANT ALL ON public.run_sessions TO service_role;
ALTER TABLE public.run_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rs_select_own" ON public.run_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rs_insert_own" ON public.run_sessions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "rs_update_own" ON public.run_sessions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "rs_delete_own" ON public.run_sessions FOR DELETE TO authenticated USING (auth.uid() = user_id);
CREATE INDEX idx_rs_user_completed ON public.run_sessions(user_id, completed_at DESC);

-- 5) WEEK_PLANS
CREATE TABLE IF NOT EXISTS public.week_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  week_number integer NOT NULL,
  days_distribution jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, week_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.week_plans TO authenticated;
GRANT ALL ON public.week_plans TO service_role;
ALTER TABLE public.week_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wp_select_own" ON public.week_plans FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wp_insert_own" ON public.week_plans FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wp_update_own" ON public.week_plans FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "wp_delete_own" ON public.week_plans FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 6) XP_EVENTS
CREATE TABLE IF NOT EXISTS public.xp_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  xp_amount integer NOT NULL,
  source_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.xp_events TO authenticated;
GRANT ALL ON public.xp_events TO service_role;
ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "xp_select_own" ON public.xp_events FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "xp_insert_own" ON public.xp_events FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_xp_user_date ON public.xp_events(user_id, created_at DESC);

-- 7) ACHIEVEMENTS (catálogo)
CREATE TABLE IF NOT EXISTS public.achievements (
  code text PRIMARY KEY,
  title text NOT NULL,
  description text NOT NULL,
  icon text,
  xp_reward integer NOT NULL DEFAULT 0,
  criteria jsonb NOT NULL DEFAULT '{}',
  sort_order integer NOT NULL DEFAULT 0
);
GRANT SELECT ON public.achievements TO authenticated;
GRANT ALL ON public.achievements TO service_role;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ach_public_read" ON public.achievements FOR SELECT TO authenticated USING (true);

INSERT INTO public.achievements (code, title, description, icon, xp_reward, criteria, sort_order) VALUES
  ('first_workout', 'Primeiro treino', 'Concluiu o primeiro treino', 'dumbbell', 50, '{"workouts":1}', 10),
  ('streak_7',  '7 dias seguidos',   'Manteve ofensiva por 7 dias',   'flame', 100, '{"streak":7}',   20),
  ('streak_30', '30 dias seguidos',  'Manteve ofensiva por 30 dias',  'flame', 500, '{"streak":30}',  30),
  ('streak_100','100 dias seguidos', 'Manteve ofensiva por 100 dias', 'flame',1500,'{"streak":100}', 40),
  ('workouts_100', '100 treinos', 'Concluiu 100 treinos', 'trophy', 750, '{"workouts":100}', 50),
  ('first_run', 'Primeira corrida', 'Concluiu a primeira corrida', 'footprints', 50, '{"runs":1}', 60),
  ('runs_100km','100km corridos', 'Acumulou 100km de corrida', 'footprints', 500, '{"run_km":100}', 70),
  ('week_complete', 'Semana completa', 'Concluiu todos os treinos da semana', 'calendar-check', 250, '{"weeks_complete":1}', 80),
  ('first_pr', 'Primeiro PR', 'Quebrou seu primeiro recorde pessoal', 'medal', 100, '{"prs":1}', 90)
ON CONFLICT (code) DO NOTHING;

-- 8) USER_ACHIEVEMENTS
CREATE TABLE IF NOT EXISTS public.user_achievements (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  achievement_code text NOT NULL REFERENCES public.achievements(code) ON DELETE CASCADE,
  unlocked_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_code)
);
GRANT SELECT, INSERT ON public.user_achievements TO authenticated;
GRANT ALL ON public.user_achievements TO service_role;
ALTER TABLE public.user_achievements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ua_select_own" ON public.user_achievements FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "ua_insert_own" ON public.user_achievements FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

-- 9) FRIENDSHIPS
CREATE TABLE IF NOT EXISTS public.friendships (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  addressee_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','blocked')),
  created_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  UNIQUE (requester_id, addressee_id),
  CHECK (requester_id <> addressee_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.friendships TO authenticated;
GRANT ALL ON public.friendships TO service_role;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
CREATE POLICY "fr_select_involved" ON public.friendships FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "fr_insert_requester" ON public.friendships FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "fr_update_involved" ON public.friendships FOR UPDATE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY "fr_delete_involved" ON public.friendships FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE INDEX idx_fr_requester ON public.friendships(requester_id);
CREATE INDEX idx_fr_addressee ON public.friendships(addressee_id);

-- 10) Estrutura futura (vazias, sem UI)
CREATE TABLE IF NOT EXISTS public.challenges (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  metric text NOT NULL,
  target_value numeric NOT NULL,
  starts_at timestamptz NOT NULL,
  ends_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.challenges TO authenticated;
GRANT ALL ON public.challenges TO service_role;
ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ch_select_own" ON public.challenges FOR SELECT TO authenticated USING (auth.uid() = creator_id);
CREATE POLICY "ch_modify_own" ON public.challenges FOR ALL TO authenticated USING (auth.uid() = creator_id) WITH CHECK (auth.uid() = creator_id);

CREATE TABLE IF NOT EXISTS public.groups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gr_select_own" ON public.groups FOR SELECT TO authenticated USING (auth.uid() = owner_id);
CREATE POLICY "gr_modify_own" ON public.groups FOR ALL TO authenticated USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE TABLE IF NOT EXISTS public.group_members (
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (group_id, user_id)
);
GRANT SELECT, INSERT, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "gm_select_own" ON public.group_members FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "gm_insert_self" ON public.group_members FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "gm_delete_self" ON public.group_members FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- 11) Geração de friend_code e username
CREATE OR REPLACE FUNCTION public.gen_friend_code()
RETURNS text LANGUAGE plpgsql AS $$
DECLARE
  code text;
  exists_already boolean;
BEGIN
  LOOP
    code := upper(substring(md5(random()::text || clock_timestamp()::text) for 6));
    SELECT EXISTS(SELECT 1 FROM public.profiles WHERE friend_code = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- Backfill: gerar friend_code e username para perfis existentes
UPDATE public.profiles
SET friend_code = public.gen_friend_code()
WHERE friend_code IS NULL;

UPDATE public.profiles
SET username = 'atleta_' || lower(substring(replace(id::text, '-', '') for 8))
WHERE username IS NULL;

-- 12) Atualizar handle_new_user para popular novos campos
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url, username, friend_code)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'atleta_' || lower(substring(replace(NEW.id::text, '-', '') for 8)),
    public.gen_friend_code()
  );
  RETURN NEW;
END;
$$;

-- Garante que o trigger existe
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
