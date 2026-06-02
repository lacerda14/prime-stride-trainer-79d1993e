CREATE OR REPLACE FUNCTION public.admin_update_exercise_content(
  p_id uuid,
  p_muscles text[],
  p_instructions text,
  p_mistakes text
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.exercise_pool
  SET primary_muscles = p_muscles,
      instructions = p_instructions,
      common_mistakes = p_mistakes
  WHERE id = p_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.admin_update_exercise_content(uuid, text[], text, text) TO authenticated, service_role;