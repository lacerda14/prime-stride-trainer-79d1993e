ALTER TABLE public.running_protocols
  DROP CONSTRAINT IF EXISTS running_protocols_between_blocks_required;

ALTER TABLE public.running_protocols
  ADD CONSTRAINT running_protocols_between_blocks_required
  CHECK (
    COALESCE(blocks, 0) <= 1
    OR between_blocks_rest_seconds IS NOT NULL
  ) NOT VALID;

ALTER TABLE public.running_protocols
  DROP CONSTRAINT IF EXISTS running_protocols_between_blocks_positive;

ALTER TABLE public.running_protocols
  ADD CONSTRAINT running_protocols_between_blocks_positive
  CHECK (
    between_blocks_rest_seconds IS NULL
    OR between_blocks_rest_seconds > 0
  ) NOT VALID;