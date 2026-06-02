ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS program_start_date date,
  ADD COLUMN IF NOT EXISTS current_week integer NOT NULL DEFAULT 1;

UPDATE public.profiles
SET program_start_date = CURRENT_DATE
WHERE program_start_date IS NULL;

ALTER TABLE public.profiles
  ALTER COLUMN program_start_date SET DEFAULT CURRENT_DATE,
  ALTER COLUMN program_start_date SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'profiles_current_week_range'
      AND conrelid = 'public.profiles'::regclass
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_current_week_range CHECK (current_week >= 1 AND current_week <= 48);
  END IF;
END $$;