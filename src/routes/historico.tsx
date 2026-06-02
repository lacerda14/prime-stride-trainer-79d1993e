import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CheckCircle2, Dumbbell, Footprints } from "lucide-react";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · PM Hybrid" },
      { name: "description", content: "Sessões treinadas, volume e PRs." },
    ],
  }),
  component: HistoricoPage,
});

const mockHistory = [
  { date: "01 Jun", type: "Strength", title: "Upper Push", volume: "4.2t", duration: 64, ok: true },
  { date: "30 Mai", type: "Run", title: "VO2 5x1min", volume: "—", duration: 42, ok: true },
  { date: "29 Mai", type: "Strength", title: "Lower", volume: "5.8t", duration: 72, ok: true },
  { date: "27 Mai", type: "Strength", title: "Upper Pull", volume: "3.6t", duration: 58, ok: true },
  { date: "26 Mai", type: "Hybrid", title: "Tempo Run + Strength", volume: "2.1t", duration: 68, ok: true },
  { date: "24 Mai", type: "Strength", title: "Upper Push", volume: "4.0t", duration: 62, ok: true },
  { date: "23 Mai", type: "Run", title: "Long Run 12km", volume: "—", duration: 70, ok: false },
];

function HistoricoPage() {
  return (
    <AppShell eyebrow="Atividade" title="Histórico">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="glass-strong animate-fade-in grid gap-4 rounded-3xl p-7 sm:grid-cols-3">
          <Stat label="Sessões" value="42" hint="últimos 30 dias" />
          <Stat label="Volume total" value="156t" hint="tonelagem" />
          <Stat label="Distância" value="84 km" hint="corrida" />
        </div>

        <div className="glass overflow-hidden rounded-2xl">
          <div className="divide-y divide-border">
            {mockHistory.map((h, i) => (
              <div key={i} className="flex items-center gap-4 p-4 transition-colors hover:bg-white/[0.02]">
                <div className="num w-14 text-center text-xs text-muted-foreground">{h.date}</div>
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-surface-elevated">
                  {h.type === "Run" ? (
                    <Footprints className="h-4 w-4 text-primary" />
                  ) : (
                    <Dumbbell className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-semibold tracking-tight">{h.title}</div>
                  <div className="num mt-0.5 text-xs text-muted-foreground">
                    {h.type} · {h.duration} min · {h.volume}
                  </div>
                </div>
                {h.ok && <CheckCircle2 className="h-4 w-4 text-primary" />}
              </div>
            ))}
          </div>
        </div>
      </div>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div>
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="num mt-2 text-3xl font-semibold tracking-tight">{value}</div>
      <div className="mt-1 text-xs text-muted-foreground">{hint}</div>
    </div>
  );
}
