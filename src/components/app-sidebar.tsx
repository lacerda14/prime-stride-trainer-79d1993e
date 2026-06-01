import { Link, useRouterState } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Flame,
  CalendarDays,
  Footprints,
  TrendingUp,
  History,
  Settings,
  Zap,
} from "lucide-react";

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
  { title: "Dashboard", url: "/", icon: LayoutDashboard },
  { title: "Treino de Hoje", url: "/hoje", icon: Flame },
  { title: "Semanas", url: "/semanas", icon: CalendarDays },
  { title: "Corrida", url: "/corrida", icon: Footprints },
  { title: "Progressão", url: "/progressao", icon: TrendingUp },
  { title: "Histórico", url: "/historico", icon: History },
  { title: "Configurações", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const currentPath = useRouterState({ select: (r) => r.location.pathname });
  const isActive = (path: string) =>
    path === "/" ? currentPath === "/" : currentPath.startsWith(path);

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-2.5 px-2 py-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary shadow-glow">
            <Zap className="h-4 w-4 text-primary-foreground" strokeWidth={2.5} />
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
                        <item.icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
                        {!collapsed && (
                          <span className="text-[13.5px] font-medium tracking-tight">
                            {item.title}
                          </span>
                        )}
                        {active && !collapsed && (
                          <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary shadow-glow" />
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
            <div className="mt-0.5 text-sm font-semibold tracking-tight">PM Athlete</div>
            <div className="num mt-1 text-[11px] text-muted-foreground">
              Semana 07 · Build · Meso 2
            </div>
          </div>
        ) : (
          <div className="mx-auto h-8 w-8 rounded-full bg-primary/20 ring-1 ring-primary/40" />
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
