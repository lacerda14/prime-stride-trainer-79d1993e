import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getRunningSessions,
  type RunningSessionListItem,
} from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, Footprints, Timer, Gauge, Loader2 } from "lucide-react";

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
  const { user } = useAuth();
  const fetchRuns = useServerFn(getRunningSessions);
  const { data: runs, isLoading } = useQuery({
    queryKey: ["running-sessions", user?.id],
    queryFn: () => fetchRuns(),
    enabled: !!user,
  });

  const list = runs ?? [];
  const vo2Count = list.filter((r) =>
    /vo2|interval|tiro/i.test(r.protocol.protocol_type + " " + (r.objective ?? "")),
  ).length;
  const weeks = new Set(list.map((r) => r.week_number)).size;

  return (
    <AppShell eyebrow="Corrida" title="Sessões de Running">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <section className="glass-strong animate-fade-in grid gap-4 rounded-3xl p-7 sm:grid-cols-3">
          <div>
            <Footprints className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">{list.length}</div>
            <div className="text-xs text-muted-foreground">sessões programadas</div>
          </div>
          <div>
            <Gauge className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">{vo2Count}</div>
            <div className="text-xs text-muted-foreground">com VO2 / intervalado</div>
          </div>
          <div>
            <Timer className="h-5 w-5 text-primary" />
            <div className="num mt-3 text-3xl font-semibold">{weeks}</div>
            <div className="text-xs text-muted-foreground">semanas com corrida</div>
          </div>
        </section>

        {isLoading ? (
          <div className="flex justify-center py-10 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        ) : list.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 p-6 text-center text-sm text-muted-foreground">
            Nenhuma sessão de corrida programada. Conclua o onboarding para gerar seu plano.
          </div>
        ) : (
          <div className="space-y-3">
            {list.map((r, i) => (
              <RunCard key={`${r.week_number}-${r.day_number}-${i}`} row={r} />
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function describeProtocol(r: RunningSessionListItem): string[] {
  const p = r.protocol;
  const lines: string[] = [];
  if (p.total_duration_minutes) lines.push(`${p.total_duration_minutes} min total`);
  if (p.blocks) lines.push(`${p.blocks} blocos`);
  if (p.intervals && p.work_duration_seconds && p.rest_duration_seconds) {
    lines.push(
      `${p.intervals}× ${p.work_duration_seconds}s on / ${p.rest_duration_seconds}s off`,
    );
  }
  if (p.pace_min && p.pace_max) {
    lines.push(`Pace ${p.pace_min}–${p.pace_max} min/km`);
  } else if (p.pace_min) {
    lines.push(`Pace ${p.pace_min} min/km`);
  }
  if (p.notes) lines.push(p.notes);
  return lines;
}

function RunCard({ row }: { row: RunningSessionListItem }) {
  const [open, setOpen] = useState(false);
  const lines = describeProtocol(row);
  const first = lines[0] ?? row.protocol.protocol_type;
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Footprints className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
              Semana {String(row.week_number).padStart(2, "0")} · {row.day_name}
            </div>
            <div className="mt-0.5 text-base font-semibold tracking-tight capitalize">
              {row.protocol.protocol_type.replace(/_/g, " ")}
            </div>
            <div className="num mt-0.5 text-xs text-muted-foreground">{first}</div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border px-5 pb-5 pt-4">
            {row.objective && (
              <div className="text-xs text-muted-foreground">{row.objective}</div>
            )}
            {lines.map((line, i) => (
              <div
                key={i}
                className="num rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm"
              >
                {line}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
