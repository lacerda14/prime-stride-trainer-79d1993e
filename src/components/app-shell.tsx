import type { ReactNode } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Flame, CalendarDays, Footprints, TrendingUp, History, LogOut, LayoutDashboard, Settings, User } from "lucide-react";
import pmLogo from "@/assets/pm-logo.png.asset.json";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
}

const tabs = [
  { title: "Hoje", url: "/hoje", icon: Flame },
  { title: "Semanas", url: "/semanas", icon: CalendarDays },
  { title: "Início", url: "/", icon: LayoutDashboard },
  { title: "Corrida", url: "/corrida", icon: Footprints },
  { title: "Perfil", url: "/perfil", icon: User },
];

const moreLinks = [
  { title: "Progressão", url: "/progressao", icon: TrendingUp },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppShell({ children, title, eyebrow, action }: AppShellProps) {
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const { user, signOut } = useAuth();
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);
  const displayName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "Atleta";

  return (
    <RequireAuth>
      <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
        <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-4 backdrop-blur-xl">
          <Link
            to="/"
            aria-label="Ir para o início"
            className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated ring-1 ring-white/10 overflow-hidden transition-transform active:scale-95"
          >
            <img src={pmLogo.url} alt="PM Hybrid" className="h-7 w-7 object-contain" />
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

        <main className="relative flex-1 pb-[88px]">
          <div className="pointer-events-none absolute inset-0 grid-fade opacity-25" />
          <div className="relative">{children}</div>

          {currentPath.startsWith("/perfil") && (
            <div className="relative px-5 pb-6 pt-2">
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

        <nav className="fixed bottom-0 left-1/2 z-40 w-full max-w-[480px] -translate-x-1/2 border-t border-border/60 bg-background/95 backdrop-blur-xl pb-[env(safe-area-inset-bottom)]">
          <ul className="grid grid-cols-5">
            {tabs.map((t) => {
              const active = isActive(t.url);
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
                    <span className={active ? "text-foreground" : "text-muted-foreground"}>{t.title}</span>
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
