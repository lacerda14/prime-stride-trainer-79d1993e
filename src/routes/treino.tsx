import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayTraining } from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { Pause, Play, SkipForward, X, Check, Loader2, Footprints, Timer, Flame, Wind } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { buildRunPhases, paceRange, runningHeadline, type RunPhase } from "@/lib/format-running";

export const Route = createFileRoute("/treino")({
  head: () => ({
    meta: [
      { title: "Treino em Execução · PM Hybrid" },
      { name: "description", content: "Lock screen mode — modo treino focado." },
    ],
  }),
  component: () => <RequireAuth><TreinoPage /></RequireAuth>,
});

type StrengthItem = {
  kind: "strength";
  name: string;
  set: number;
  totalSets: number;
  reps: string;
  rest: number;
  block: "Força" | "Core";
};

type RunItem = {
  kind: "run";
  phase: RunPhase;
  protocolName: string;
  paceText: string | null;
};

type QueueItem = StrengthItem | RunItem;

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

    // 1. Corrida vem primeiro (Terça/Quinta)
    if (today.running) {
      const phases = buildRunPhases(today.running);
      const protocolName = runningHeadline(today.running);
      const paceText = paceRange(today.running);
      for (const phase of phases) {
        items.push({ kind: "run", phase, protocolName, paceText });
      }
    }

    // 2. Depois força + core
    for (const e of today.exercises) {
      const block: "Força" | "Core" = e.exercise.category === "core" ? "Core" : "Força";
      const sets = Math.max(1, e.sets);
      const rest = e.rest_seconds ?? (block === "Core" ? 30 : 60);
      for (let s = 1; s <= sets; s++) {
        items.push({
          kind: "strength",
          name: e.exercise.name,
          set: s,
          totalSets: sets,
          reps: e.reps,
          rest,
          block,
        });
      }
    }
    return items;
  }, [today]);

  const [idx, setIdx] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [seconds, setSeconds] = useState(0);
  const [timerOn, setTimerOn] = useState(false);

  const current = queue[idx];
  const next = queue[idx + 1];
  const progress = (idx / Math.max(queue.length, 1)) * 100;

  // ticker
  useEffect(() => {
    if (!timerOn) return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [timerOn]);

  // auto-start em fases de corrida
  useEffect(() => {
    if (current?.kind === "run") setTimerOn(true);
  }, [idx, current?.kind]);

  // Tempo remanescente da fase atual (apenas para countdowns)
  const phaseSeconds =
    current?.kind === "run"
      ? current.phase.seconds
      : phase === "rest" && current?.kind === "strength"
        ? current.rest
        : 0;
  const remaining = phaseSeconds > 0 ? Math.max(0, phaseSeconds - seconds) : seconds;

  // Auto-advance quando countdown chega a zero
  useEffect(() => {
    if (!current) return;
    if (current.kind === "run") {
      if (seconds >= current.phase.seconds) {
        setSeconds(0);
        setIdx((i) => Math.min(queue.length, i + 1));
      }
    } else if (phase === "rest" && seconds >= current.rest) {
      setPhase("work");
      setSeconds(0);
      setIdx((i) => Math.min(queue.length, i + 1));
    }
  }, [seconds, current, phase, queue.length]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (queue.length === 0 || !current || idx >= queue.length) {
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
    if (current.kind === "run") {
      setSeconds(0);
      setIdx((i) => Math.min(queue.length, i + 1));
      return;
    }
    if (phase === "work") {
      setPhase("rest");
      setSeconds(0);
      setTimerOn(true);
    } else {
      setPhase("work");
      setSeconds(0);
      setIdx((i) => Math.min(queue.length, i + 1));
    }
  };

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;

  // ============ RENDER ============
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
            {current.kind === "run" ? current.protocolName : `Exercício ${idx + 1} / ${queue.length}`}
          </div>
          <div className="text-xs font-medium">
            {today?.day_name} · {today?.objective ?? ""}
          </div>
        </div>
        <div className="w-10" />
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-6 py-6">
        {current.kind === "run" ? (
          <RunPhaseView phase={current.phase} remaining={remaining} paceText={current.paceText} />
        ) : (
          <StrengthView
            current={current}
            phaseLabel={phase === "work" ? `Em execução · ${current.block}` : "Descanso"}
            mins={mins}
            secs={secs}
            countdown={phase === "rest"}
          />
        )}

        {next && (
          <div className="glass mt-10 w-full max-w-md rounded-2xl px-5 py-3 text-left">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximo</div>
            <div className="num mt-0.5 text-sm font-semibold tracking-tight">
              {next.kind === "run"
                ? `${runPhaseTitle(next.phase)} · ${formatDuration(next.phase.seconds)}`
                : `${next.name} · Set ${next.set} · ${next.reps} reps`}
            </div>
          </div>
        )}
      </main>

      <footer className="relative flex items-center justify-center gap-3 p-6">
        <button
          onClick={() => setTimerOn((r) => !r)}
          className="flex h-14 w-14 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground hover:bg-surface-elevated"
        >
          {timerOn ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 fill-current" />}
        </button>
        <button
          onClick={completeSet}
          className="flex h-14 max-w-xs flex-1 items-center justify-center gap-2 rounded-full bg-primary text-base font-semibold text-primary-foreground shadow-glow transition-transform active:scale-95"
        >
          {current.kind === "run" ? (
            <><SkipForward className="h-5 w-5" /> Pular fase</>
          ) : phase === "work" ? (
            <><Check className="h-5 w-5" /> Concluir Set</>
          ) : (
            <><SkipForward className="h-5 w-5" /> Pular descanso</>
          )}
        </button>
      </footer>
    </div>
  );
}

// ============================================================
// Views
// ============================================================

function StrengthView({
  current,
  phaseLabel,
  mins,
  secs,
  countdown,
}: {
  current: StrengthItem;
  phaseLabel: string;
  mins: number;
  secs: number;
  countdown: boolean;
}) {
  return (
    <div className="w-full max-w-md text-center">
      <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">
        {phaseLabel}
      </div>
      <h1 className="mt-3 text-4xl font-semibold leading-tight tracking-tight lg:text-5xl">
        {current.name}
      </h1>

      {!countdown ? (
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
        <div>Set <span className="text-foreground">{current.set}</span> / {current.totalSets}</div>
        <div>REST <span className="text-foreground">{current.rest}s</span></div>
      </div>
    </div>
  );
}

function RunPhaseView({
  phase,
  remaining,
  paceText,
}: {
  phase: RunPhase;
  remaining: number;
  paceText: string | null;
}) {
  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const accent = phaseAccent(phase.kind);

  const Icon =
    phase.kind === "work" ? Flame :
    phase.kind === "rest" || phase.kind === "between" ? Timer :
    phase.kind === "warmup" ? Wind :
    phase.kind === "cooldown" ? Wind :
    Footprints;

  return (
    <div className="w-full max-w-md text-center">
      <div className={`inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ${accent}`}>
        <Icon className="h-3.5 w-3.5" /> {runPhaseTitle(phase)}
      </div>

      <h1 className="mt-4 text-3xl font-semibold leading-tight tracking-tight lg:text-4xl">
        {phase.label}
      </h1>
      {phase.block && phase.totalBlocks ? (
        <div className="num mt-1 text-xs text-muted-foreground">
          Bloco {phase.block} / {phase.totalBlocks}
          {phase.interval && phase.totalIntervals ? ` · Tiro ${phase.interval}/${phase.totalIntervals}` : ""}
        </div>
      ) : null}

      <div className="num mt-8 text-[140px] font-semibold leading-none tracking-tighter text-gradient-primary lg:text-[180px]">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>

      <div className="num mt-6 space-y-1 text-sm text-muted-foreground">
        <div>{phase.detail}</div>
        {paceText && phase.kind === "work" && (
          <div className="text-primary">Pace alvo: {paceText}</div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Helpers
// ============================================================

function runPhaseTitle(p: RunPhase): string {
  switch (p.kind) {
    case "warmup": return "Aquecimento";
    case "work": return "Tiro";
    case "rest": return "Recuperação";
    case "between": return "Descanso entre blocos";
    case "cooldown": return "Cooldown";
    case "continuous": return "Corrida contínua";
  }
}

function phaseAccent(k: RunPhase["kind"]): string {
  switch (k) {
    case "work": return "text-primary";
    case "rest":
    case "between":
    case "cooldown":
    case "warmup": return "text-muted-foreground";
    default: return "text-foreground";
  }
}

function formatDuration(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}min` : `${m}min ${r}s`;
}
