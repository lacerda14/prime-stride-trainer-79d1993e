import { useEffect, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getProfile } from "@/lib/profile.functions";
import { Loader2 } from "lucide-react";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (r) => r.location.pathname });
  const fetchProfile = useServerFn(getProfile);
  const isOnboarding = pathname === "/onboarding";

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!user,
    staleTime: 60_000,
    retry: 1,
  });

  // só sabemos o status quando o query terminou com sucesso e devolveu uma row
  const profileLoaded = profileQ.isSuccess && profileQ.data != null;
  const onboardingCompleted = profileLoaded && profileQ.data.onboarding_completed === true;
  const onboardingMissing = profileLoaded && profileQ.data.onboarding_completed !== true;

  // 1) não autenticado → /auth
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: pathname } as never, replace: true });
    }
  }, [loading, user, navigate, pathname]);

  // 2) autenticado mas onboarding ainda não foi feito → /onboarding
  //    só redireciona quando temos CERTEZA (query terminou e retornou row com flag false)
  useEffect(() => {
    if (!user) return;
    if (!onboardingMissing) return;
    if (isOnboarding) return;
    navigate({ to: "/onboarding", replace: true });
  }, [user, onboardingMissing, isOnboarding, navigate]);

  // enquanto carrega sessão ou primeira carga do perfil → spinner
  if (loading || !user || profileQ.isPending) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // perfil carregado mas onboarding pendente → spinner enquanto o redirect acontece
  if (onboardingMissing && !isOnboarding) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // Em qualquer outro caso (onboarding completo, ou query com erro/null mas usuário autenticado)
  // renderiza os filhos — não trava o app por causa de um refetch em background.
  return <>{children}</>;
}
