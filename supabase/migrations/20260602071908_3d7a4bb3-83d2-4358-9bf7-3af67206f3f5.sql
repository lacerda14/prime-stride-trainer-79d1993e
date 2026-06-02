
-- Anexa o trigger handle_new_user em auth.users (estava faltando)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Backfill: cria perfis para usuários existentes sem profile
INSERT INTO public.profiles (id, name, avatar_url, username, friend_code)
SELECT
  u.id,
  COALESCE(u.raw_user_meta_data->>'name', u.raw_user_meta_data->>'full_name', split_part(u.email, '@', 1)),
  u.raw_user_meta_data->>'avatar_url',
  'atleta_' || lower(substring(replace(u.id::text, '-', '') for 8)),
  public.gen_friend_code()
FROM auth.users u
LEFT JOIN public.profiles p ON p.id = u.id
WHERE p.id IS NULL;
