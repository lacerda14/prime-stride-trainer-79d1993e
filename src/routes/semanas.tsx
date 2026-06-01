import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WEEKS } from "@/lib/mock-data";
import type { ProgramDay, RawExercise } from "@/lib/mock-data";
import { ChevronDown, Check, Coffee } from "lucide-react";

export const Route = createFileRoute("/semanas")({
  head: () => ({
    meta: [
      { title: "Semanas · PM Hybrid" },
      { name: "description", content: "Periodização completa de 48 semanas." },
    ],
  }),
  component: SemanasPage,
});

function ExerciseRow({ ex }: { ex: RawExercise }) {
  return (
    <div className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm">
      <span className="flex items-center gap-2 font-medium">
        {ex.name}
        {ex.superset && (
          <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
            {ex.method || "Biset"} {ex.superset}
          </span>
        )}
      </span>
      <span className="text-xs text-muted-foreground">
        {ex.sets > 0 ? `${ex.sets}x${ex.reps}` : ex.reps}
      </span>
    </div>
  );
}

function DayAccordion({ day }: { day: ProgramDay }) {
  const [open, setOpen] = useState(false);

  if (day.isOff) {
    return (
      <div className="glass flex items-center gap-3 rounded-2xl px-5 py-4 opacity-70">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated">
          <Coffee className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{day.day}</div>
          <div className="mt-0.5 text-sm font-semibold tracking-tight">OFF · Recuperação</div>
        </div>
      </div>
    );
  }

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]"
      >
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{day.day}</div>
          <div className="mt-0.5 text-base font-semibold tracking-tight">{day.session}</div>
        </div>
        <div className="flex items-center gap-3">
          {day.tempo && <span className="num hidden text-xs text-muted-foreground sm:inline">{day.tempo.split("\n")[0]}</span>}
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-4 border-t border-border px-5 pb-5 pt-4">
            {day.objective && (
              <div className="text-xs text-muted-foreground">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Objetivo · </span>
                {day.objective}
              </div>
            )}
            {day.method && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] font-medium uppercase tracking-wider text-primary">
                {day.method}
              </div>
            )}
            {day.run && (
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Corrida</div>
                <div className="num space-y-1.5">
                  {day.run.lines.map((l, i) => (
                    <div key={i} className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-sm">
                      {l}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {day.strength.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Força</div>
                <div className="space-y-1.5">
                  {day.strength.map((e, i) => <ExerciseRow key={i} ex={e} />)}
                </div>
              </div>
            )}
            {day.core.length > 0 && (
              <div>
                <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core</div>
                <div className="space-y-1.5">
                  {day.core.map((e, i) => <ExerciseRow key={i} ex={e} />)}
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
  const [selected, setSelected] = useState(1);
  const [pickerOpen, setPickerOpen] = useState(false);
  const week = WEEKS[selected - 1];

  return (
    <AppShell eyebrow="Periodização" title="Semanas">
      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="glass-strong flex w-full items-center justify-between rounded-2xl p-6 text-left transition-all hover:border-white/10"
          >
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {week.macroLabel} · {week.mesociclo}
              </div>
              <div className="num mt-1 text-4xl font-semibold tracking-tight">
                SEMANA {String(selected).padStart(2, "0")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{week.objective}</div>
            </div>
            <ChevronDown className={`h-5 w-5 text-muted-foreground transition-transform ${pickerOpen ? "rotate-180" : ""}`} />
          </button>

          {pickerOpen && (
            <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[420px] overflow-y-auto rounded-2xl border border-border bg-popover/95 p-2 shadow-elevated backdrop-blur-xl">
              <div className="grid grid-cols-4 gap-1 sm:grid-cols-6 md:grid-cols-8">
                {WEEKS.map((w) => (
                  <button
                    key={w.number}
                    onClick={() => {
                      setSelected(w.number);
                      setPickerOpen(false);
                    }}
                    className={`num group relative rounded-lg px-3 py-3 text-sm font-semibold transition-all ${
                      w.number === selected
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    }`}
                  >
                    {String(w.number).padStart(2, "0")}
                    {w.number === selected && <Check className="absolute right-1 top-1 h-3 w-3" />}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="glass rounded-2xl p-5">
          <div className="grid gap-3 text-xs sm:grid-cols-3">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Volume</div>
              <div className="mt-0.5 font-medium">{week.volume}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Método</div>
              <div className="mt-0.5 font-medium">{week.methodDominant}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Regra</div>
              <div className="mt-0.5 font-medium">{week.rule}</div>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {week.days.map((d) => (
            <DayAccordion key={d.day} day={d} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
