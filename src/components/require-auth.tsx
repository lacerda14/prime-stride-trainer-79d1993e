import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getProfile } from "@/lib/profile.functions";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";

// Tela de bloqueio até o e-mail ser confirmado (vale app e web).
function EmailConfirmGate({ email }: { email: string | null }) {
  const { signOut } = useAuth();
  const [busy, setBusy] = useState(false);

  async function resend() {
    if (!email) return;
    setBusy(true);
    const { error } = await supabase.auth.resend({ type: "signup", email });
    setBusy(false);
    if (error) toast.error(error.message);
    else toast.success("E-mail de confirmação reenviado.");
  }

  async function recheck() {
    setBusy(true);
    // força refresh da sessão; se confirmou, o onAuthStateChange atualiza
    await supabase.auth.refreshSession();
    const { data } = await supabase.auth.getUser();
    setBusy(false);
    if (!data.user?.email_confirmed_at && !data.user?.confirmed_at) {
      toast.message("Ainda não confirmado", { description: "Clique no link do e-mail e tente de novo." });
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center safe-pad">
      <div className="w-full max-w-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
          <MailCheck className="h-7 w-7 text-primary" />
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight">Confirme seu e-mail</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enviamos um link de confirmação para{" "}
          <span className="font-medium text-foreground">{email ?? "seu e-mail"}</span>. Clique nele para
          liberar o acesso.
        </p>
        <div className="mt-6 flex flex-col gap-2.5">
          <button
            onClick={recheck}
            disabled={busy}
            className="flex items-center justify-center gap-2 rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Já confirmei
          </button>
          <button
            onClick={resend}
            disabled={busy}
            className="rounded-full border border-border bg-surface/60 py-3 text-sm font-medium text-foreground disabled:opacity-60"
          >
            Reenviar e-mail
          </button>
          <button onClick={() => signOut()} className="py-2 text-xs text-muted-foreground hover:text-foreground">
            Sair
          </button>
        </div>
        <p className="mt-4 text-[11px] leading-relaxed text-muted-foreground">
          Não recebeu? Verifique o spam. Se não chegar, o envio de e-mail pode não estar configurado.
        </p>
      </div>
    </div>
  );
}

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
  void profileLoaded;
  const onboardingMissing = profileLoaded && profileQ.data!.onboarding_completed !== true;

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

  // enquanto carrega sessão → spinner (perfil pode estar carregando, mas o gate
  // de e-mail não depende dele).
  if (loading || !user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  // E-mail não confirmado → BLOQUEIA (app e web). Contas Google já vêm
  // confirmadas (email_confirmed_at preenchido), então não caem aqui.
  const emailConfirmed = !!user.email_confirmed_at || !!user.confirmed_at;
  if (!emailConfirmed) {
    return <EmailConfirmGate email={user.email ?? null} />;
  }

  if (profileQ.isPending) {
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
