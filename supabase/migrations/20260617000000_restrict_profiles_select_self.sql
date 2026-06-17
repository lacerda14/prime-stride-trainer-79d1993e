-- Restringe SELECT em public.profiles a self-only.
-- Em 2026-06-05 (migration 20260605005055) o time já restringiu pra self-only,
-- mas o estado remoto voltou a permitir que qualquer autenticado lesse todos os
-- perfis (dados sensíveis: condições médicas, medicações, lesões, etc.).
-- Este migration é idempotente e GARANTE o estado self-only: dropa TODAS as
-- policies atuais de profiles e recria as 3 padrão. O service_role (admin, /users)
-- ignora RLS e segue lendo todos os perfis normalmente.

DO $$
DECLARE pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.profiles', pol.policyname);
  END LOOP;
END $$;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile"
  ON public.profiles FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (auth.uid() = id);
