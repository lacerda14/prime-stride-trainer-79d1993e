import type { ReactNode } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { RequireAuth } from "@/components/require-auth";

interface AppShellProps {
  children: ReactNode;
  title?: string;
  eyebrow?: string;
  action?: ReactNode;
}

export function AppShell({ children, title, eyebrow, action }: AppShellProps) {
  return (
    <RequireAuth>
    <SidebarProvider defaultOpen>
      <div className="flex min-h-screen w-full bg-background">
        <AppSidebar />
        <div className="flex flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/60 px-4 backdrop-blur-xl">
            <SidebarTrigger className="h-8 w-8" />
            <div className="flex flex-1 flex-col leading-tight">
              {eyebrow && (
                <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  {eyebrow}
                </span>
              )}
              {title && (
                <h1 className="text-[15px] font-semibold tracking-tight">{title}</h1>
              )}
            </div>
            {action}
          </header>
          <main className="relative flex-1">
            <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
            <div className="relative">{children}</div>
          </main>
        </div>
      </div>
    </SidebarProvider>
    </RequireAuth>
  );
}
