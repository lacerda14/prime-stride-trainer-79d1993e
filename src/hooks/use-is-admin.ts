import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./use-auth";
import { isOwnerEmail } from "@/lib/owner";

export function useIsAdmin() {
  const { user } = useAuth();

  // Dono do sistema é SEMPRE admin — não depende da tabela/RLS.
  const ownerAdmin = isOwnerEmail(user?.email);

  const { data } = useQuery({
    queryKey: ["is-admin", user?.id],
    enabled: !!user && !ownerAdmin,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
        .maybeSingle();
      if (error) return false;
      return !!data;
    },
  });

  return ownerAdmin || !!data;
}
