import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WEEKS } from "@/lib/mock-data";
import type { RawRun } from "@/lib/mock-data";
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

interface RunRow {
  week: number;
  day: string;
  session: string;
  objective: string;
  run: RawRun;
}

function CorridaPage() {
  const runs: RunRow[] = WEEKS.flatMap((w) =>
    w.days
      .filter((d) => d.run !== null && !d.isOff)
      .map((d) => ({
        week: w.number,
        day: d.day,
        session: d.session,
        objective: d.objective,
        run: d.run!,
      })),
  );

  // Categorize by keyword in session/objective
  const vo2Count = runs.filter((r) => /vo2|tiro|interval/i.test(r.run.raw + r.session + r.objective)).length;

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
            <div className="num mt-3 text-3xl font-semibold">{vo2Count}</div>
            <div className="text-xs text-muted-foreground">com VO2 / intervalado</div>
          </div>
          <div>
            <Timer className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">{WEEKS.length}</div>
            <div className="text-xs text-muted-foreground">semanas com corrida</div>
          </div>
        </section>

        <div className="space-y-3">
          {runs.map((r, i) => (
            <RunCard key={i} row={r} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function RunCard({ row }: { row: RunRow }) {
  const [open, setOpen] = useState(false);
  const first = row.run.lines[0] || "";
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between p-5 text-left hover:bg-white/[0.02]">
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Semana {String(row.week).padStart(2, "0")} · {row.day}
            </div>
            <div className="mt-0.5 text-base font-semibold tracking-tight">{row.session}</div>
            <div className="num mt-0.5 text-xs text-muted-foreground">{first}</div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border px-5 pb-5 pt-4">
            <div className="text-xs text-muted-foreground">{row.objective}</div>
            {row.run.lines.map((line, i) => (
              <div key={i} className="num rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm">
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
