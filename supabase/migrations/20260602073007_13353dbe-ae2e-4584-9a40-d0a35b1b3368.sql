-- 1. Novos valores do enum de protocolo
ALTER TYPE public.running_protocol_enum ADD VALUE IF NOT EXISTS 'vo2_intervals';
ALTER TYPE public.running_protocol_enum ADD VALUE IF NOT EXISTS 'tempo_run';
ALTER TYPE public.running_protocol_enum ADD VALUE IF NOT EXISTS 'zone_2';
ALTER TYPE public.running_protocol_enum ADD VALUE IF NOT EXISTS 'pace_work';
ALTER TYPE public.running_protocol_enum ADD VALUE IF NOT EXISTS 'recovery_run';

-- 2. Campos extras em running_protocols
ALTER TABLE public.running_protocols
  ADD COLUMN IF NOT EXISTS protocol_name text,
  ADD COLUMN IF NOT EXISTS goal text,
  ADD COLUMN IF NOT EXISTS warmup_minutes integer,
  ADD COLUMN IF NOT EXISTS cooldown_minutes integer,
  ADD COLUMN IF NOT EXISTS intervals_per_block integer,
  ADD COLUMN IF NOT EXISTS between_blocks_rest_seconds integer,
  ADD COLUMN IF NOT EXISTS target_pace_min numeric,
  ADD COLUMN IF NOT EXISTS target_pace_max numeric;

-- 3. Campos reservados para Apple Watch em run_sessions
ALTER TABLE public.run_sessions
  ADD COLUMN IF NOT EXISTS heart_rate_avg integer,
  ADD COLUMN IF NOT EXISTS heart_rate_max integer,
  ADD COLUMN IF NOT EXISTS cadence integer,
  ADD COLUMN IF NOT EXISTS pace_real_seconds_per_km integer,
  ADD COLUMN IF NOT EXISTS calories integer,
  ADD COLUMN IF NOT EXISTS zone text;