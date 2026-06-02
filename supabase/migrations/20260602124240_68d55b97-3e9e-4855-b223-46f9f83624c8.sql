-- ============= ROLES SYSTEM =============
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);

GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE POLICY ur_select_self ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY ur_admin_all ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============= EXERCISE MEDIA =============
CREATE TYPE public.exercise_media_type AS ENUM (
  'youtube_embed', 'vimeo_embed', 'external_video', 'uploaded_video', 'gif', 'image'
);

CREATE TABLE public.exercise_media (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id uuid NOT NULL REFERENCES public.exercise_pool(id) ON DELETE CASCADE,
  media_type public.exercise_media_type NOT NULL,
  source text,
  title text,
  url text,
  embed_url text,
  thumbnail_url text,
  storage_path text,
  duration_seconds integer,
  instructor_name text,
  channel_name text,
  source_quality_score integer,
  embed_allowed boolean NOT NULL DEFAULT false,
  is_primary boolean NOT NULL DEFAULT false,
  is_approved boolean NOT NULL DEFAULT false,
  reviewed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewed_at timestamptz,
  created_by_agent boolean NOT NULL DEFAULT false,
  reason_for_recommendation text,
  safety_notes text,
  external_id text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_exercise_media_exercise ON public.exercise_media(exercise_id);
CREATE INDEX idx_exercise_media_approved ON public.exercise_media(exercise_id, is_approved, is_primary);
CREATE UNIQUE INDEX uniq_exercise_media_primary_approved
  ON public.exercise_media(exercise_id)
  WHERE is_primary AND is_approved;
CREATE UNIQUE INDEX uniq_exercise_media_external
  ON public.exercise_media(exercise_id, source, external_id)
  WHERE external_id IS NOT NULL;

GRANT SELECT ON public.exercise_media TO authenticated;
GRANT ALL ON public.exercise_media TO service_role;

ALTER TABLE public.exercise_media ENABLE ROW LEVEL SECURITY;

-- Students see only approved + embeddable media
CREATE POLICY em_select_approved ON public.exercise_media
  FOR SELECT TO authenticated
  USING (is_approved = true OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY em_admin_insert ON public.exercise_media
  FOR INSERT TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY em_admin_update ON public.exercise_media
  FOR UPDATE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY em_admin_delete ON public.exercise_media
  FOR DELETE TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_exercise_media_updated_at
  BEFORE UPDATE ON public.exercise_media
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
