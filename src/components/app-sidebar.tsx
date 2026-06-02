import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Flame,
  CalendarDays,
  Footprints,
  TrendingUp,
  History,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import pmLogo from "@/assets/pm-logo.png.asset.json";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const items = [
  { title: "Dashboard",      url: "/",           icon: LayoutDashboard, badge: null },
  { title: "Treino de Hoje", url: "/hoje",        icon: Flame,           badge: null },
  { title: "Semanas",        url: "/semanas",     icon: CalendarDays,    badge: null },
  { title: "Corrida",        url: "/corrida",     icon: Footprints,      badge: null },
  { title: "Progressão",     url: "/progressao",  icon: TrendingUp,      badge: null },
  { title: "Histórico",      url: "/historico",   icon: History,         badge: null },
  { title: "Coaches AI",     url: "/coaches",     icon: Sparkles,        badge: "Em breve" },
  { title: "Configurações",  url: "/configuracoes", icon: Settings,      badge: null },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
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
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated ring-1 ring-white/10 overflow-hidden">
            <img src={pmLogo.url} alt="PM Hybrid" className="h-7 w-7 object-contain" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                PM Hybrid
              </span>
              <span className="text-sm font-semibold tracking-tight">Performance System</span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 pt-4">
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu className="gap-1">
              {items.map((item) => {
                const active = isActive(item.url);
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      className="h-10 rounded-lg data-[active=true]:bg-accent data-[active=true]:text-accent-foreground hover:bg-sidebar-accent/60"
                    >
                      <Link to={item.url}>
                        <item.icon
                          className={`h-[18px] w-[18px] shrink-0 ${item.badge ? "text-primary" : ""}`}
                          strokeWidth={1.75}
                        />
                        {!collapsed && (
                          <>
                            <span className="flex-1 text-[13.5px] font-medium tracking-tight">
                              {item.title}
                            </span>
                            {item.badge && (
                              <span className="ml-auto rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
                                {item.badge}
                              </span>
                            )}
                            {active && !item.badge && (
                              <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
                            )}
                          </>
                        )}
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border p-3">
        {!collapsed ? (
          <div className="glass rounded-xl p-3">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Atleta
            </div>
            <div className="mt-0.5 truncate text-sm font-semibold tracking-tight">{displayName}</div>
            {user?.email && (
              <div className="num mt-0.5 truncate text-[11px] text-muted-foreground">{user.email}</div>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-8 w-full justify-start gap-2 px-2 text-[12px] text-muted-foreground hover:text-foreground"
              onClick={() => signOut()}
            >
              <LogOut className="h-3.5 w-3.5" />
              Sair
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="icon"
            className="mx-auto h-8 w-8 rounded-full bg-primary/10 ring-1 ring-primary/30"
            onClick={() => signOut()}
            aria-label="Sair"
          >
            <LogOut className="h-3.5 w-3.5" />
          </Button>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
