import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { History } from "lucide-react";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · PM Hybrid" },
      { name: "description", content: "Sessões treinadas, volume e PRs." },
    ],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  return (
    <AppShell eyebrow="Atividade" title="Histórico">
      <div className="space-y-5 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Sessões" value="0" hint="30 dias" />
          <Stat label="Volume" value="0t" hint="tonelagem" />
          <Stat label="Corrida" value="0 km" hint="distância" />
        </div>

        <div className="glass flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
            <History className="h-5 w-5 text-muted-foreground" />
          </div>
          <div>
            <div className="text-sm font-semibold tracking-tight">Sem sessões registradas</div>
            <p className="mt-1 text-xs text-muted-foreground">
              Conclua um treino em <span className="text-foreground">Hoje</span> para começar seu histórico.
            </p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="num mt-1.5 text-xl font-semibold tracking-tight">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}
