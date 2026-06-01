import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { getTodayWorkout } from "@/lib/mock-data";
import type { Exercise } from "@/lib/mock-data";
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

function ExerciseCard({ exercise, index }: { exercise: Exercise; index: number }) {
  const [open, setOpen] = useState(index === 0);
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
            <div className="text-base font-semibold tracking-tight">{exercise.name}</div>
            <div className="num mt-0.5 text-xs text-muted-foreground">
              {exercise.sets.length}x{exercise.sets[0]?.reps} · REST {exercise.sets[0]?.rest}
              {exercise.method && ` · ${exercise.method}`}
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
            {exercise.sets.map((s) => (
              <div
                key={s.set}
                className="num grid grid-cols-[40px_1fr_1fr_auto] items-center gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5"
              >
                <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Set {s.set}
                </div>
                <div className="text-sm font-semibold">{s.reps} reps</div>
                <div className="text-xs text-muted-foreground">{s.loadTarget ?? "—"}</div>
                <div className="rounded-md bg-surface-elevated px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  REST {s.rest}
                </div>
              </div>
            ))}
            {exercise.tempo && (
              <div className="text-[11px] text-muted-foreground">Tempo: {exercise.tempo}</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function HojePage() {
  const today = getTodayWorkout();
  return (
    <AppShell
      eyebrow={today.day}
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
            {today.type} · {today.method}
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{today.objective}</h2>
          <div className="num mt-5 flex flex-wrap gap-6 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Timer className="h-4 w-4" /> {today.estimatedMinutes} min
            </div>
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" /> {today.exercises.length} exercícios
            </div>
          </div>
        </section>

        <div className="space-y-3">
          {today.exercises.map((e, i) => (
            <ExerciseCard key={e.id} exercise={e} index={i} />
          ))}
        </div>

        {today.core && (
          <section className="glass rounded-2xl p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">
              {today.core.name} · {today.core.rounds} rounds
            </div>
            <div className="mt-4 space-y-2">
              {today.core.exercises.map((c) => (
                <div
                  key={c.name}
                  className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">{c.name}</span>
                  <span className="text-muted-foreground">
                    {c.reps} {c.rest && `· REST ${c.rest}`}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {today.run && (
          <section className="glass rounded-2xl p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Corrida</div>
            <div className="mt-1 text-lg font-semibold tracking-tight">
              {today.run.type} · {today.run.totalDuration}
            </div>
            <div className="mt-4 space-y-2">
              {today.run.blocks.map((b, i) => (
                <div
                  key={i}
                  className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 text-sm"
                >
                  <span className="font-medium">
                    {b.reps ? `${b.reps}x ` : ""}
                    {b.label}
                  </span>
                  <span className="text-muted-foreground">
                    {b.duration} {b.pace && `@ ${b.pace}`} {b.speed && `@ ${b.speed}`}
                    {b.rest && ` · REST ${b.rest}`}
                  </span>
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
