import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayTraining } from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { Pause, Play, SkipForward, X, Check, Loader2, Footprints } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { runningHeadline, runningInstructions } from "@/lib/format-running";

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
  kind: "strength" | "running";
  name: string;
  set: number;
  totalSets: number;
  reps: string;
  rest: number;
  block: "Força" | "Core" | "Corrida";
  runningSteps?: string[];
  runningHead?: string;
}

function TreinoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fetchToday = useServerFn(getTodayTraining);
  const { data, isLoading } = useQuery({
    queryKey: ["today-training", user?.id],
    queryFn: () => fetchToday(),
    enabled: !!user,
  });

  const today = data?.today;

  const queue = useMemo<QueueItem[]>(() => {
    if (!today) return [];
    const items: QueueItem[] = [];
    if (today.running) {
      items.push({
        kind: "running",
        name: "Corrida",
        set: 1,
        totalSets: 1,
        reps: runningHeadline(today.running),
        rest: 0,
        block: "Corrida",
        runningSteps: runningInstructions(today.running),
        runningHead: runningHeadline(today.running),
      });
    }
    for (const e of today.exercises) {
      const block: "Força" | "Core" = e.exercise.category === "core" ? "Core" : "Força";
      const sets = Math.max(1, e.sets);
      const rest = e.rest_seconds ?? (block === "Core" ? 30 : 60);
      for (let s = 1; s <= sets; s++) {
        items.push({ kind: "strength", name: e.exercise.name, set: s, totalSets: sets, reps: e.reps, rest, block });
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

  if (isLoading) {
    return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  }

  if (queue.length === 0 || !current) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center">
        <div>
          <Check className="mx-auto h-12 w-12 text-primary" />
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">
            {queue.length === 0 ? "Dia de descanso" : "Sessão concluída"}
          </h2>
          <button onClick={() => navigate({ to: "/" })} className="mt-6 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground">
            Voltar ao Dashboard
          </button>
        </div>
      </div>
    );
  }

  const completeSet = () => {
    if (current.kind === "running") {
      setPhase("work"); setSeconds(0); setIdx((i) => Math.min(queue.length - 1, i + 1));
      return;
    }
    if (phase === "work") {
      setPhase("rest"); setSeconds(0); setRunning(true);
    } else {
      setPhase("work"); setSeconds(0); setIdx((i) => Math.min(queue.length - 1, i + 1));
    }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-50" />
      <div className="absolute inset-x-0 top-0 h-0.5 bg-surface-elevated">
        <div className="h-full bg-primary shadow-glow transition-all duration-500" style={{ width: `${progress}%` }} />
      </div>

      <header className="relative flex items-center justify-between p-5">
        <button onClick={() => navigate({ to: "/hoje" })} className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
        <div className="num text-center">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
            Exercício {idx + 1} / {queue.length}
          </div>
          <div className="text-xs font-medium">{today?.day_name} · {today?.objective ?? ""}</div>
        </div>
        <div className="w-10" />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-8">
        <div className="w-full max-w-md text-center">
          <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
            {phase === "work" ? `Em execução · ${current.block}` : "Descanso"}
          </div>
          <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
            {current.kind === "running" ? (
              <span className="inline-flex items-center gap-3">
                <Footprints className="h-8 w-8 text-primary" /> {current.runningHead}
              </span>
            ) : (
              current.name
            )}
          </h1>

          {current.kind === "running" && phase === "work" ? (
            <ol className="num mt-8 space-y-2 text-left">
              {(current.runningSteps ?? []).map((step, i) => (
                <li
                  key={i}
                  className="flex gap-3 rounded-xl border border-border/60 bg-surface/40 px-4 py-3 text-sm leading-snug"
                >
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>
          ) : phase === "work" ? (
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

          {current.kind === "strength" && (
            <div className="num mt-6 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div>Set <span className="text-foreground">{current.set}</span> / {current.totalSets}</div>
              <div>REST <span className="text-foreground">{current.rest}s</span></div>
            </div>
          )}
        </div>

        {next && (
          <div className="glass mt-10 w-full max-w-md rounded-2xl px-5 py-3 text-left">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximo</div>
            <div className="num mt-0.5 text-sm font-semibold tracking-tight">
              {next.kind === "running" ? next.runningHead : `${next.name} · Set ${next.set} · ${next.reps} reps`}
            </div>
          </div>
        )}
      </main>

      <footer className="relative flex items-center justify-center gap-3 p-6">
        <button onClick={() => setRunning((r) => !r)} className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground hover:bg-surface-elevated">
          {running ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <button onClick={completeSet} className="flex h-14 max-w-xs flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-95">
          {current.kind === "running"
            ? (<><Check className="h-5 w-5" /> Corrida concluída</>)
            : phase === "work"
              ? (<><Check className="h-5 w-5" /> Concluir Set</>)
              : (<><SkipForward className="h-5 w-5" /> Pular descanso</>)}
        </button>
      </footer>
    </div>
  );
}
