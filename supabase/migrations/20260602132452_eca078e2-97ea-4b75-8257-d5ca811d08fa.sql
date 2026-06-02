-- Restaurar EXECUTE em has_role para authenticated.
-- Policies RLS que chamam has_role(auth.uid(),'admin') exigem que o caller tenha EXECUTE,
-- mesmo a função sendo SECURITY DEFINER. Sem isso, admins perdem acesso a tudo que depende de has_role.
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated;