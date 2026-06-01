import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getTodayWorkout, getCurrentWeek } from "@/lib/mock-data";
import type { RawExercise } from "@/lib/mock-data";
import { ChevronDown, Play, Timer, Target } from "lucide-react";

export const Route = createFileRoute("/hoje")({
  head: () => ({
    meta: [
      { title: "Treino de Hoje · PM Hybrid" },
      { name: "description", content: "Sessão de treino do dia com séries, descanso e progressão." },
    ],
  }),
  component: HojePage,
});

function ExerciseCard({ exercise, index }: { exercise: RawExercise; index: number }) {
  const [open, setOpen] = useState(index === 0);
  const setCount = exercise.sets || 1;
  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-4">
          <div className="num flex h-10 w-10 items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div>
            <div className="flex items-center gap-2 text-base font-semibold tracking-tight">
              {exercise.name}
              {exercise.superset && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                  {exercise.method || "Biset"} {exercise.superset}
                </span>
              )}
            </div>
            <div className="num mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{exercise.sets}x{exercise.reps}</span>
              {exercise.rest ? (
                <>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1 text-primary/90">
                    <Timer className="h-3 w-3" /> {exercise.rest}s
                  </span>
                </>
              ) : null}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
          open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
        }`}
      >
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border px-5 pb-5 pt-4">
            {Array.from({ length: setCount }).map((_, i) => (
              <div
                key={i}
                className="num grid grid-cols-[40px_1fr_auto_auto] items-center gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Set {i + 1}
                </div>
                <div className="text-sm font-semibold">{exercise.reps} reps</div>
                {exercise.rest ? (
                  <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                    <Timer className="h-3 w-3" /> {exercise.rest}s
                  </div>
                ) : <div />}
                <div className="rounded-md bg-surface-elevated px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  Registrar carga
                </div>
              </div>
            ))}
            {exercise.restLabel && (
              <div className="pt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                Descanso: {exercise.restLabel}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HojePage() {
  const today = getTodayWorkout();
  const week = getCurrentWeek();
  return (
    <AppShell
      eyebrow={`Semana ${String(week.number).padStart(2, "0")} · ${today.day}`}
      title="Treino de Hoje"
      action={
        <Link
          to="/treino"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
        >
          <Play className="h-3.5 w-3.5 fill-current" /> Iniciar
        </Link>
      }
    >
      <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-10">
        <section className="glass-strong animate-fade-in rounded-3xl p-7">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {today.session}
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{today.objective}</h2>
          {today.method && (
            <p className="mt-2 text-sm text-muted-foreground">Método: {today.method}</p>
          )}
          <div className="num mt-5 flex flex-wrap gap-6 text-sm">
            {today.tempo && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4" /> {today.tempo}
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" /> {today.strength.length} de força · {today.core.length} de core
            </div>
          </div>
        </section>

        {today.run && (
          <section className="glass rounded-2xl p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Corrida</div>
            <div className="mt-2 space-y-1.5 num">
              {today.run.lines.map((l, i) => (
                <div key={i} className="rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-sm">
                  {l}
                </div>
              ))}
            </div>
          </section>
        )}

        {today.strength.length > 0 && (
          <div>
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Força
            </div>
            <div className="space-y-3">
              {today.strength.map((e, i) => (
                <ExerciseCard key={`${e.name}-${i}`} exercise={e} index={i} />
              ))}
            </div>
          </div>
        )}

        {today.core.length > 0 && (
          <section className="glass rounded-2xl p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core</div>
            <div className="mt-3 space-y-2">
              {today.core.map((c, i) => (
                <div
                  key={`${c.name}-${i}`}
                  className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">{c.sets}x{c.reps}</span>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pt-4 text-center">
          <Link
            to="/treino"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Play className="h-4 w-4 fill-current" /> Entrar no Lock Screen Mode
          </Link>
        </div>
      </div>
    </AppShell>
  );
}
