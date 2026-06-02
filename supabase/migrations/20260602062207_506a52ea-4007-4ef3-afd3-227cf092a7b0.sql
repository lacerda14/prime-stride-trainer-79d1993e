
CREATE OR REPLACE FUNCTION public.gen_friend_code()
RETURNS text
LANGUAGE plpgsql
SET search_path = public
AS $$
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
