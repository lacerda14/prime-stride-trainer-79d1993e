
UPDATE public.profiles p
SET onboarding_completed = true
WHERE EXISTS (SELECT 1 FROM public.training_programs tp WHERE tp.user_id = p.id)
  AND p.onboarding_completed = false;
