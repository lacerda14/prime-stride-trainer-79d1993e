import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayTraining, type SessionExerciseDTO } from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, Play, Timer, Target, Loader2, PlayCircle } from "lucide-react";
import { runningHeadline, runningInstructions } from "@/lib/format-running";
import { useLocalToday } from "@/hooks/use-local-today";
import { ExerciseDetailModal, useExerciseDetail } from "@/components/exercise-detail-modal";

export const Route = createFileRoute("/hoje")({
  head: () => ({
    meta: [
      { title: "Treino de Hoje · PM Hybrid" },
      { name: "description", content: "Sessão de treino do dia com séries, descanso e progressão." },
    ],
  }),
  component: HojePage,
});

function ExerciseCard({ exercise, index, onOpenVideo }: { exercise: SessionExerciseDTO; index: number; onOpenVideo: (id: string) => void }) {
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
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenVideo(exercise.exercise.id); }}
                className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-primary"
              >
                {exercise.exercise.name}
                <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {exercise.pair_slot && (
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                  Biset {exercise.pair_slot}
                </span>
              )}
            </div>
            <div className="num mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
              <span>{exercise.sets}x{exercise.reps}</span>
              {exercise.rest_seconds ? (
                <>
                  <span className="opacity-40">·</span>
                  <span className="inline-flex items-center gap-1 text-primary/90">
                    <Timer className="h-3 w-3" /> {exercise.rest_seconds}s
                  </span>
                </>
              ) : null}
              {exercise.rpe_target && (
                <>
                  <span className="opacity-40">·</span>
                  <span>RPE {exercise.rpe_target}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
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
                {exercise.rest_seconds ? (
                  <div className="flex items-center gap-1 rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary">
                    <Timer className="h-3 w-3" /> {exercise.rest_seconds}s
                  </div>
                ) : <div />}
                <div className="rounded-md bg-surface-elevated px-2 py-1 text-[10px] font-medium text-muted-foreground">
                  Registrar carga
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function HojePage() {
  const { user } = useAuth();
  const fetchToday = useServerFn(getTodayTraining);
  const localToday = useLocalToday();
  const detail = useExerciseDetail();
  const { data, isLoading } = useQuery({
    queryKey: ["today-training", user?.id, localToday.local_date, localToday.timezone],
    queryFn: () => fetchToday({ data: localToday }),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <AppShell eyebrow="Treino" title="Treino de Hoje">
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </AppShell>
    );
  }

  if (!data || !data.today) {
    return (
      <AppShell eyebrow="Treino" title="Treino de Hoje">
        <div className="p-8 text-center text-sm text-muted-foreground">
          Hoje é {data?.calendar.day_name ?? "um dia sem treino"}. Nenhum treino programado para esta data.
        </div>
      </AppShell>
    );
  }

  const today = data.today;
  const week = data.week;
  const strength = today.exercises.filter((e) => e.exercise.category !== "core");
  const core = today.exercises.filter((e) => e.exercise.category === "core");

  return (
    <AppShell
      eyebrow={`Hoje é ${data.calendar.day_name} · Semana ${String(week.week_number).padStart(2, "0")} de ${data.calendar.total_weeks}`}
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
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <section className="glass-strong animate-fade-in rounded-3xl p-7">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {today.session_type.replace("_", " ").toUpperCase()}
          </div>
          <h2 className="mt-2 text-3xl font-semibold tracking-tight">{today.objective ?? week.meso.name}</h2>
          {week.meso.method && (
            <p className="mt-2 text-sm text-muted-foreground">Método: {week.meso.method}</p>
          )}
          <div className="num mt-5 flex flex-wrap gap-6 text-sm">
            {today.duration_minutes && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4" /> ~{today.duration_minutes} min
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" /> {strength.length} de força · {core.length} de core
            </div>
          </div>
        </section>

        {today.running && (
          <section className="glass rounded-2xl p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Corrida
              </div>
              <div className="num text-[10px] uppercase tracking-wider text-primary/80">
                {runningHeadline(today.running)}
              </div>
            </div>
            <ol className="mt-3 space-y-2 text-sm">
              {runningInstructions(today.running).map((step, i) => (
                <li
                  key={i}
                  className="num flex gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5"
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {strength.length > 0 && (
          <div>
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Força</div>
            <div className="space-y-3">
              {strength.map((e, i) => <ExerciseCard key={e.id} exercise={e} index={i} onOpenVideo={detail.open} />)}
            </div>
          </div>
        )}

        {core.length > 0 && (
          <section className="glass rounded-2xl p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core</div>
            <div className="mt-3 space-y-2">
              {core.map((c) => (
                <div key={c.id} className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 text-sm">
                  <span className="font-medium">{c.exercise.name}</span>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{c.sets}x{c.reps}</span>
                    {c.rest_seconds && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        <Timer className="h-3 w-3" /> {c.rest_seconds}s
                      </span>
                    )}
                  </div>
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
