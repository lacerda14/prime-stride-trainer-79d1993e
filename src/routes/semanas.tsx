import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getProgramSummary, getWeekDetail, type TrainingDayDTO } from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, Check, Coffee, Loader2 } from "lucide-react";

export const Route = createFileRoute("/semanas")({
  head: () => ({
    meta: [
      { title: "Semanas · PM Hybrid" },
      { name: "description", content: "Periodização completa de 48 semanas." },
    ],
  }),
  component: SemanasPage,
});

function DayAccordion({ day }: { day: TrainingDayDTO }) {
  const [open, setOpen] = useState(false);
  if (day.session_type === "rest") {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl px-5 py-4 opacity-70">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated">
          <Coffee className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{day.day_name}</div>
          <div className="mt-0.5 text-sm font-semibold tracking-tight">OFF · Recuperação</div>
        </div>
      </div>
    );
  }
  const strength = day.exercises.filter((e) => e.exercise.category !== "core");
  const core = day.exercises.filter((e) => e.exercise.category === "core");
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button onClick={() => setOpen((v) => !v)} className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{day.day_name}</div>
          <div className="mt-0.5 text-base font-semibold tracking-tight">{day.objective ?? day.session_type}</div>
        </div>
        <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
            {day.running && (
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Corrida</div>
                <div className="num rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-sm">
                  {day.running.protocol_type.toUpperCase()} · {day.running.total_duration_minutes} min
                  {day.running.pace_min && day.running.pace_max && ` · ${day.running.pace_min.toFixed(2)}–${day.running.pace_max.toFixed(2)} min/km`}
                </div>
              </div>
            )}
            {strength.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Força</div>
                <div className="space-y-1.5">
                  {strength.map((e) => (
                    <div key={e.id} className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        {e.exercise.name}
                        {e.pair_slot && <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase text-primary">Biset {e.pair_slot}</span>}
                      </span>
                      <span className="text-xs text-muted-foreground">{e.sets}x{e.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {core.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core</div>
                <div className="space-y-1.5">
                  {core.map((e) => (
                    <div key={e.id} className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm">
                      <span className="font-medium">{e.exercise.name}</span>
                      <span className="text-xs text-muted-foreground">{e.sets}x{e.reps}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SemanasPage() {
  const { user } = useAuth();
  const fetchSummary = useServerFn(getProgramSummary);
  const fetchWeek = useServerFn(getWeekDetail);

  const summaryQ = useQuery({
    queryKey: ["program-summary", user?.id],
    queryFn: () => fetchSummary(),
    enabled: !!user,
  });

  const [selected, setSelected] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);

  const weekQ = useQuery({
    queryKey: ["week-detail", user?.id, selected],
    queryFn: () => fetchWeek({ data: { week_number: selected } }),
    enabled: !!user && !!summaryQ.data,
  });

  const summary = summaryQ.data;
  const week = weekQ.data;
  const totalWeeks = summary?.total_weeks ?? 48;
  const meta = summary?.weekIndex[selected];

  return (
    <AppShell eyebrow="Periodização" title="Semanas">
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="glass-strong flex w-full items-center justify-between rounded-2xl p-6 text-left transition-all hover:border-white/10"
          >
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {meta ? `${meta.macroName} · ${meta.mesoName}` : "—"}
              </div>
              <div className="num mt-1 text-4xl font-semibold tracking-tight">
                SEMANA {String(selected).padStart(2, "0")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">
                {week?.meso.objective ?? "Carregando…"}
              </div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
          </button>

          {pickerOpen && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-border bg-popover/95 p-2 shadow-elevated backdrop-blur-xl">
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8">
                {Array.from({ length: totalWeeks }).map((_, i) => {
                  const n = i + 1;
                  return (
                    <button
                      key={n}
                      onClick={() => { setSelected(n); setPickerOpen(false); }}
                      className={`num group relative rounded-lg px-3 py-3 text-sm font-semibold transition-all ${
                        n === selected ? "bg-primary text-primary-foreground shadow-glow" : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                      }`}
                    >
                      {String(n).padStart(2, "0")}
                      {n === selected && <Check className="absolute right-1 top-1 h-3 w-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {week && (
          <div className="glass rounded-2xl p-5">
            <div className="grid gap-3 text-xs sm:grid-cols-3">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</div>
                <div className="mt-0.5 font-medium">Semana {week.week_type}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Método</div>
                <div className="mt-0.5 font-medium">{week.meso.method ?? "—"}</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Macro</div>
                <div className="mt-0.5 font-medium">{week.macro.name}</div>
              </div>
            </div>
          </div>
        )}

        {weekQ.isLoading ? (
          <div className="flex justify-center p-8"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {week?.days.map((d) => <DayAccordion key={d.id} day={d} />)}
          </div>
        )}
      </div>
    </AppShell>
  );
}
