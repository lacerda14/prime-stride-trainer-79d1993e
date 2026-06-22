import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  Home,
  Dumbbell,
  TrendingUp,
  Users,
  User,
  LogOut,
  History,
  Settings,
  BarChart3,
  LifeBuoy,
  Crown,
  ChevronRight,
  HeartPulse,
} from "lucide-react";
import pmLogo from "@/assets/pm-logo.png";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { getMySubscription } from "@/lib/subscription.functions";
import { isPaidAccess } from "@/lib/tiers";
import { FEATURES } from "@/lib/features";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
}

// Bottom tabs — 5 abas principais
const bottomTabs = [
  { title: "Início", url: "/", icon: Home, exact: true },
  { title: "Treinos", url: "/treinos", icon: Dumbbell, exact: false },
  { title: "Evolução", url: "/evolucao", icon: TrendingUp, exact: false },
  { title: "Social", url: "/social", icon: Users, exact: false },
  { title: "Perfil", url: "/perfil", icon: User, exact: false },
];

// Abas visíveis — respeita o flag de feature (social escondido na Fase 1).
const visibleTabs = bottomTabs.filter((t) => FEATURES.social || t.url !== "/social");

// Links extras (utilidades) visíveis na seção "mais" do perfil.
// Assinatura NÃO entra aqui — vira um CTA próprio em destaque (ver abaixo).
const moreLinks = [
  { title: "Saúde", url: "/configuracoes", icon: HeartPulse },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Progressão", url: "/progressao", icon: BarChart3 },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
  { title: "Suporte", url: "/suporte", icon: LifeBuoy },
];

export function AppShell({ children, title, eyebrow, action }: AppShellProps) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Atleta";

  const isActive = (url: string, exact: boolean) =>
    exact ? currentPath === url : currentPath.startsWith(url);

  // Status de assinatura — só pra decidir o CTA da aba Perfil (free → converter,
  // premium → gerenciar). Mesma query/cache da home (não refaz request).
  const fetchSub = useServerFn(getMySubscription);
  const { data: subData } = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => fetchSub(),
    enabled: !!user && currentPath.startsWith("/perfil"),
    staleTime: 5 * 60_000,
  });
  const isPremium = isPaidAccess(subData);

  return (
    <RequireAuth>
      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
        {/* ── Top header ── */}
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)] [box-sizing:content-box]">
          <Link
            to="/"
            aria-label="Ir para o início"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated ring-1 ring-white/10 overflow-hidden transition-transform active:scale-95"
          >
            <img src={pmLogo} alt="PM Hybrid" className="h-7 w-7 object-contain" />
          </Link>
          <div className="flex flex-1 flex-col leading-tight min-w-0">
            {eyebrow && (
              <span className="truncate text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                {eyebrow}
              </span>
            )}
            <h1 className="truncate text-[15px] font-semibold tracking-tight">
              {title ?? displayName}
            </h1>
          </div>
          {action}
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground"
            onClick={() => signOut()}
            aria-label="Sair"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        </header>

        {/* ── Main content ── */}
        <main className="relative flex-1 pb-[88px]">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-25" />
          <div className="relative">{children}</div>

          {/* Seção "mais" da página de perfil */}
          {currentPath.startsWith("/perfil") && (
            <div className="relative space-y-3 px-5 pb-6 pt-2">
              {/* CTA de assinatura em destaque — contextual (free converte, premium gerencia) */}
              {subData &&
                (isPremium ? (
                  <Link
                    to="/assinaturas"
                    className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 px-4 py-3 transition active:scale-[0.99]"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/10">
                      <Crown className="h-5 w-5 fill-amber-400/30 text-amber-400" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold tracking-tight">
                        Assinatura Premium
                      </div>
                      <div className="text-[11.5px] leading-tight text-muted-foreground">
                        Ativa — toque para gerenciar
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : (
                  <Link
                    to="/assinaturas"
                    className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/20 via-amber-500/8 to-surface px-4 py-3.5 transition active:scale-[0.99]"
                  >
                    <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
                    <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15">
                      <Crown className="h-5 w-5 fill-amber-400/30 text-amber-400" />
                    </div>
                    <div className="relative min-w-0 flex-1">
                      <div className="text-[14px] font-semibold tracking-tight">Seja Premium</div>
                      <div className="text-[12px] leading-tight text-muted-foreground">
                        Coaches especialistas, treinos sob medida e tudo liberado.
                      </div>
                    </div>
                    <span className="relative shrink-0 rounded-full bg-amber-400 px-3.5 py-1.5 text-[12px] font-bold text-black">
                      Assinar
                    </span>
                  </Link>
                ))}

              {/* Utilidades */}
              <div className="grid grid-cols-3 gap-2">
                {moreLinks.map((l) => (
                  <Link
                    key={l.url}
                    to={l.url}
                    className="flex flex-col items-center gap-1.5 rounded-2xl border border-border/60 bg-surface/40 px-3 py-3 text-[11.5px] font-medium"
                  >
                    <l.icon className="h-4 w-4 text-muted-foreground" />
                    {l.title}
                  </Link>
                ))}
              </div>
            </div>
          )}
        </main>

        {/* ── Bottom Tab Bar ── */}
        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom,0px)]">
          <ul className={`grid ${visibleTabs.length >= 5 ? "grid-cols-5" : "grid-cols-4"}`}>
            {visibleTabs.map((t) => {
              const active = isActive(t.url, t.exact);
              return (
                <li key={t.url}>
                  <Link
                    to={t.url}
                    className="relative flex flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium tracking-tight"
                  >
                    {active && (
                      <span className="absolute top-0 h-[2px] w-8 rounded-full bg-primary" />
                    )}
                    <t.icon
                      className={`h-5 w-5 transition-colors ${active ? "text-primary" : "text-muted-foreground"}`}
                      strokeWidth={active ? 2.25 : 1.75}
                    />
                    <span className={active ? "text-foreground" : "text-muted-foreground"}>
                      {t.title}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </RequireAuth>
  );
}
