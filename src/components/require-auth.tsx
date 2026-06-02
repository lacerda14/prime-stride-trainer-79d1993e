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
  });
  const profileChecking = profileQ.isLoading || profileQ.isFetching;
  const onboardingCompleted = profileQ.data?.onboarding_completed === true;

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: pathname } as never, replace: true });
    }
  }, [loading, user, navigate, pathname]);

  useEffect(() => {
    if (!user) return;
    if (profileChecking) return;
    if (!onboardingCompleted && !isOnboarding) {
      navigate({ to: "/onboarding", replace: true });
    }
  }, [user, profileChecking, onboardingCompleted, isOnboarding, navigate]);

  if (loading || !user || profileChecking || !onboardingCompleted) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
