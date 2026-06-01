import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { WEEKS, type TrainingDay, type Exercise } from "@/lib/mock-data";
import { ChevronDown, Check } from "lucide-react";

export const Route = createFileRoute("/semanas")({
  head: () => ({
    meta: [
      { title: "Semanas · PM Hybrid" },
      { name: "description", content: "Periodização completa de 48 semanas." },
    ],
  }),
  component: SemanasPage,
});

function ExerciseAccordion({ ex }: { ex: Exercise }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left text-sm hover:bg-white/[0.02]"
      >
        <span className="font-medium tracking-tight">{ex.name}</span>
        <div className="flex items-center gap-3">
          <span className="num text-xs text-muted-foreground">
            {ex.sets.length}x{ex.sets[0]?.reps} · REST {ex.sets[0]?.rest}
          </span>
          <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-1.5 border-t border-border/60 px-4 pb-3 pt-3 num">
            {ex.sets.map((s) => (
              <div key={s.set} className="grid grid-cols-4 gap-2 text-xs">
                <span className="text-muted-foreground">Set {s.set}</span>
                <span className="font-semibold">{s.reps}</span>
                <span className="text-muted-foreground">{s.loadTarget ?? "—"}</span>
                <span className="text-muted-foreground">REST {s.rest}</span>
              </div>
            ))}
            {ex.method && (
              <div className="pt-2 text-[10px] uppercase tracking-wider text-primary">{ex.method}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function DayAccordion({ day }: { day: TrainingDay }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]"
      >
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{day.day}</div>
          <div className="mt-0.5 text-base font-semibold tracking-tight">
            {day.type} · {day.objective}
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="num text-xs text-muted-foreground">{day.estimatedMinutes} min</span>
          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </div>
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border px-5 pb-5 pt-4">
            {day.exercises.length > 0 && (
              <>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Força</div>
                {day.exercises.map((e) => (
                  <ExerciseAccordion key={e.id} ex={e} />
                ))}
              </>
            )}
            {day.core && (
              <div className="pt-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core · {day.core.rounds} rounds</div>
                <div className="mt-2 space-y-1.5">
                  {day.core.exercises.map((c) => (
                    <div key={c.name} className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm">
                      <span className="font-medium">{c.name}</span>
                      <span className="text-xs text-muted-foreground">{c.reps} {c.rest && `· REST ${c.rest}`}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {day.run && (
              <div className="pt-3">
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Corrida · {day.run.type}</div>
                <div className="mt-2 space-y-1.5">
                  {day.run.blocks.map((b, i) => (
                    <div key={i} className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-4 py-2.5 text-sm">
                      <span className="font-medium">{b.reps ? `${b.reps}x ` : ""}{b.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {b.duration} {b.pace && `@ ${b.pace}`} {b.speed && `@ ${b.speed}`} {b.rest && `· REST ${b.rest}`}
                      </span>
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
  const [selected, setSelected] = useState(7);
  const [pickerOpen, setPickerOpen] = useState(false);
  const week = WEEKS[selected - 1];

  return (
    <AppShell eyebrow="Periodização" title="Semanas">
      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
        {/* Week picker */}
        <div className="relative">
          <button
            onClick={() => setPickerOpen((v) => !v)}
            className="glass-strong flex w-full items-center justify-between rounded-2xl p-6 text-left transition-all hover:border-white/10"
          >
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {week.macrocycle} · {week.mesocycle} · {week.volumeLabel}
              </div>
              <div className="num mt-1 text-4xl font-semibold tracking-tight">
                SEMANA {String(selected).padStart(2, "0")}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">{week.focus}</div>
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

        {/* Days */}
        <div className="space-y-3">
          {week.days.map((d) => (
            <DayAccordion key={d.id} day={d} />
          ))}
        </div>
      </div>
    </AppShell>
  );
}
