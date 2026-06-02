import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { getTodayWorkout } from "@/lib/mock-data";
import { Pause, Play, SkipForward, X, Check } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";

export const Route = createFileRoute("/treino")({
  head: () => ({
    meta: [
      { title: "Treino em Execução · PM Hybrid" },
      { name: "description", content: "Lock screen mode — modo treino focado." },
    ],
  }),
  component: () => <RequireAuth><TreinoPage /></RequireAuth>,
});

interface QueueItem {
  name: string;
  set: number;
  totalSets: number;
  reps: string;
  rest: number;
  block: "Força" | "Core";
}

function fallbackRest(reps: string, block: "Força" | "Core"): number {
  if (block === "Core") return 30;
  const n = parseInt(reps, 10);
  if (isNaN(n)) return 60;
  if (n <= 6) return 150;
  if (n <= 10) return 90;
  return 60;
}

function TreinoPage() {
  const navigate = useNavigate();
  const today = getTodayWorkout();

  const queue = useMemo<QueueItem[]>(() => {
    const items: QueueItem[] = [];
    for (const e of today.strength) {
      const sets = Math.max(1, e.sets);
      const rest = e.rest ?? fallbackRest(e.reps, "Força");
      for (let s = 1; s <= sets; s++) {
        items.push({
          name: e.name,
          set: s,
          totalSets: sets,
          reps: e.reps,
          rest,
          block: "Força",
        });
      }
    }
    for (const e of today.core) {
      const sets = Math.max(1, e.sets);
      const rest = e.rest ?? fallbackRest(e.reps, "Core");
      for (let s = 1; s <= sets; s++) {
        items.push({
          name: e.name,
          set: s,
          totalSets: sets,
          reps: e.reps,
          rest,
          block: "Core",
        });
      }
    }
    return items;
  }, [today]);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);

  const current = queue[idx];
  const next = queue[idx + 1];
  const progress = ((idx + (phase === "rest" ? 0.5 : 0)) / Math.max(queue.length, 1)) * 100;

  useEffect(() => {
    if (!running) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [running]);

  const restSeconds = current?.rest ?? 60;
  const remaining = phase === "rest" ? Math.max(0, restSeconds - seconds) : seconds;

  useEffect(() => {
    if (phase === "rest" && seconds >= restSeconds) {
      setPhase("work");
      setSeconds(0);
      setIdx((i) => Math.min(queue.length - 1, i + 1));
    }
  }, [phase, seconds, restSeconds, queue.length]);

  if (queue.length === 0 || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <Check className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            {queue.length === 0 ? "Dia de descanso" : "Sessão concluída"}
          </h2>
          <button
            onClick={() => navigate({ to: "/" })}
            className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
          >
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  const completeSet = () => {
    if (phase === "work") {
      setPhase("rest");
      setSeconds(0);
      setRunning(true);
    } else {
      setPhase("work");
      setSeconds(0);
      setIdx((i) => Math.min(queue.length - 1, i + 1));
    }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-50" />
      <div className="absolute inset-x-0 top-0 h-0.5 bg-surface-elevated">
        <div
          className="h-full bg-primary shadow-glow transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="relative flex items-center justify-between p-5">
        <button
          onClick={() => navigate({ to: "/hoje" })}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="num text-center">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Exercício {idx + 1} / {queue.length}
          </div>
          <div className="text-xs font-medium">{today.day} · {today.session}</div>
          {today.restProtocol && (
            <div className="mt-0.5 text-[10px] uppercase tracking-[0.18em] text-primary/80">
              {today.restProtocol}
            </div>
          )}
        </div>
        <div className="w-10" />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6">
        <div className="text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            {phase === "work" ? `Em execução · ${current.block}` : "Descanso"}
          </div>
          <h1 className="mt-3 text-5xl font-semibold leading-tight tracking-tight lg:text-6xl">
            {current.name}
          </h1>

          {phase === "work" ? (
            <div className="num mt-10 flex items-end justify-center gap-3">
              <div className="text-[120px] font-semibold leading-none tracking-tighter text-gradient-primary lg:text-[180px]">
                {current.reps}
              </div>
              <div className="pb-6 text-2xl text-muted-foreground">reps</div>
            </div>
          ) : (
            <div className="num mt-10 text-[140px] font-semibold leading-none tracking-tighter text-gradient-primary lg:text-[200px]">
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
          )}

          <div className="num mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
            <div>
              Set <span className="text-foreground">{current.set}</span> / {current.totalSets}
            </div>
            <div>
              REST <span className="text-foreground">{current.rest}s</span>
            </div>
          </div>
        </div>

        {next && (
          <div className="glass mt-12 w-full max-w-md rounded-2xl px-5 py-3 text-left">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximo</div>
            <div className="num mt-0.5 text-sm font-semibold tracking-tight">
              {next.name} · Set {next.set} · {next.reps} reps
            </div>
          </div>
        )}
      </main>

      <footer className="relative flex items-center justify-center gap-3 p-6">
        <button
          onClick={() => setRunning((r) => !r)}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground hover:bg-surface-elevated"
        >
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <button
          onClick={completeSet}
          className="flex h-14 max-w-xs flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-95"
        >
          {phase === "work" ? (
            <>
              <Check className="h-5 w-5" /> Concluir Set
            </>
          ) : (
            <>
              <SkipForward className="h-5 w-5" /> Pular descanso
            </>
          )}
        </button>
      </footer>
    </div>
  );
}
