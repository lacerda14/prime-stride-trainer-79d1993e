-- Extend goal_enum with new options
ALTER TYPE goal_enum ADD VALUE IF NOT EXISTS 'general_health';
ALTER TYPE goal_enum ADD VALUE IF NOT EXISTS 'conditioning';
ALTER TYPE goal_enum ADD VALUE IF NOT EXISTS 'run_5k';

-- Onboarding extension on profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS training_history text,
  ADD COLUMN IF NOT EXISTS training_location text,
  ADD COLUMN IF NOT EXISTS available_minutes integer,
  ADD COLUMN IF NOT EXISTS sports text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS preferences text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS motivations text[] NOT NULL DEFAULT '{}';

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_training_history_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_training_history_check
  CHECK (training_history IS NULL OR training_history IN ('none','lt_6m','6m_2y','2_5y','gt_5y'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_training_location_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_training_location_check
  CHECK (training_location IS NULL OR training_location IN ('gym','home_gym','crossfit_box','home'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_available_minutes_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_available_minutes_check
  CHECK (available_minutes IS NULL OR available_minutes IN (30,45,60,90));

-- Rich content fields for exercises
ALTER TABLE public.exercise_pool
  ADD COLUMN IF NOT EXISTS video_url text,
  ADD COLUMN IF NOT EXISTS gif_url text,
  ADD COLUMN IF NOT EXISTS instructions text,
  ADD COLUMN IF NOT EXISTS common_mistakes text,
  ADD COLUMN IF NOT EXISTS primary_muscles text[] NOT NULL DEFAULT '{}';

-- Allow authenticated users to read updated columns (already public read via existing policy)
