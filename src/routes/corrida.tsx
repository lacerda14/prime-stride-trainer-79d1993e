import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WEEKS } from "@/lib/mock-data";
import { ChevronDown, Footprints, Timer, Gauge } from "lucide-react";

export const Route = createFileRoute("/corrida")({
  head: () => ({
    meta: [
      { title: "Corrida · PM Hybrid" },
      { name: "description", content: "Sessões de corrida programadas com pace, velocidade e descanso." },
    ],
  }),
  component: CorridaPage,
});

function CorridaPage() {
  const runs = WEEKS.flatMap((w) =>
    w.days
      .filter((d) => d.run)
      .map((d) => ({ week: w.number, day: d.day, run: d.run! })),
  );

  return (
    <AppShell eyebrow="Corrida" title="Sessões de Running">
      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
        <section className="glass-strong animate-fade-in grid gap-4 rounded-3xl p-7 sm:grid-cols-3">
          <div>
            <Footprints className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">{runs.length}</div>
            <div className="text-xs text-muted-foreground">sessões programadas</div>
          </div>
          <div>
            <Gauge className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">VO2 · Tempo</div>
            <div className="text-xs text-muted-foreground">tipos predominantes</div>
          </div>
          <div>
            <Timer className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">~36h</div>
            <div className="text-xs text-muted-foreground">tempo total no bloco</div>
          </div>
        </section>

        <div className="space-y-3">
          {runs.slice(0, 20).map((r, i) => (
            <RunCard key={i} week={r.week} day={r.day} run={r.run} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function RunCard({ week, day, run }: { week: number; day: string; run: NonNullable<ReturnType<typeof WEEKS[0]["days"][0]["run"] extends infer T ? () => T : never>> | any }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between p-5 text-left hover:bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Semana {String(week).padStart(2, "0")} · {day}
            </div>
            <div className="mt-0.5 text-base font-semibold tracking-tight">
              {run.type} · <span className="num text-muted-foreground">{run.totalDuration}</span>
            </div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border px-5 pb-5 pt-4">
            <div className="text-xs text-muted-foreground">{run.objective}</div>
            {run.blocks.map((b: any, i: number) => (
              <div key={i} className="num grid grid-cols-[1fr_auto] gap-3 rounded-lg border border-border/60 bg-surface/40 px-4 py-3 text-sm">
                <span className="font-semibold">{b.reps ? `${b.reps}x ` : ""}{b.label}</span>
                <span className="text-right text-xs text-muted-foreground">
                  {b.duration} {b.pace && `@ ${b.pace}`} {b.speed && `@ ${b.speed}`}
                  {b.rest && <><br />REST {b.rest}</>}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
