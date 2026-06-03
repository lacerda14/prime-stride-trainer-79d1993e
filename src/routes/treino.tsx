import { Outlet, createFileRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayTraining } from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { Pause, Play, SkipForward, X, Check, Loader2, Footprints, Timer, Flame, Wind, ArrowRightLeft, ListOrdered, BarChart3 } from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { buildRunPhases, paceRange, runningHeadline, type RunPhase } from "@/lib/format-running";
import { useLocalToday } from "@/hooks/use-local-today";
import {
  getActiveWorkoutSession,
  getCompletedSessionForDay,
  startWorkoutSession,
  abandonWorkoutSession,
  appendSetLog,
  type ActiveSessionDTO,
} from "@/lib/workout-session.functions";
import { getLastWeightsForExercises } from "@/lib/workout-logs.functions";
import { computeVolume, formatVolume } from "@/lib/workout-volume";
import { ExerciseSwapSheet } from "@/components/exercise-swap-sheet";
import { ExerciseReorderSheet, type ReorderItem } from "@/components/exercise-reorder-sheet";
import type { SwapSuggestion } from "@/lib/exercise-swap.functions";

import { syncSaveState, syncComplete, flushQueue } from "@/lib/offline-sync";
import { OfflineBadge } from "@/components/offline-badge";

export const Route = createFileRoute("/treino")({
  head: () => ({
    meta: [
      { title: "Treino em Execução · PM Hybrid" },
      { name: "description", content: "Lock screen mode — modo treino focado." },
    ],
  }),
  component: TreinoRouteComponent,
});

function TreinoRouteComponent() {
  const isSummaryRoute = useRouterState({
    select: (state) => state.location.pathname.startsWith("/treino/concluido/"),
  });

  if (isSummaryRoute) return <Outlet />;
  return <RequireAuth><TreinoPage /></RequireAuth>;
}

// ============================================================
// Tipos da fila
// ============================================================

type StrengthItem = {
  kind: "strength";
  name: string;
  exerciseId: string | null;
  set: number;
  totalSets: number;
  reps: string;
  rest: number;
  block: "Força" | "Core";
  exerciseIndex: number;
};

type RunItem = {
  kind: "run";
  phase: RunPhase;
  protocolName: string;
  paceText: string | null;
};

type QueueItem = StrengthItem | RunItem;

interface SetLogState {
  load: string;
  reps: string;
  completed: boolean;
}

function setKey(exerciseIndex: number, setNumber: number): string {
  return `${exerciseIndex}:${setNumber}`;
}

function lsKey(sessionId: string) {
  return `pm-workout-session:${sessionId}`;
}

interface LocalSnapshot {
  step: number;
  phase: "work" | "rest";
  phase_started_at_ms: number;
  total_elapsed_ms: number;
}

// ============================================================
// Página
// ============================================================

function TreinoPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  // Ref para evitar TDZ: sinaliza que estamos no meio de finalizar uma sessão
  const finishingRef = useRef(false);
  const sessionIdRef = useRef<string | null>(null);
  const fetchToday = useServerFn(getTodayTraining);
  const fetchActive = useServerFn(getActiveWorkoutSession);
  const fetchCompletedForDay = useServerFn(getCompletedSessionForDay);
  const startSession = useServerFn(startWorkoutSession);
  const abandonSession = useServerFn(abandonWorkoutSession);
  const localToday = useLocalToday();


  const todayQ = useQuery({
    queryKey: ["today-training", user?.id, localToday.local_date, localToday.timezone],
    queryFn: () => fetchToday({ data: localToday }),
    enabled: !!user,
  });
  const activeQ = useQuery({
    queryKey: ["active-workout-session", user?.id],
    queryFn: () => fetchActive(),
    enabled: !!user,
  });

  const today = todayQ.data?.today;
  const weekNumber = todayQ.data?.week.week_number ?? null;
  const dayKey = today?.day_name ?? null;

  // Se o treino do dia já foi concluído, vai direto pra tela de resumo
  const completedTodayQ = useQuery({
    queryKey: ["completed-session-for-day", user?.id, weekNumber, dayKey, localToday.local_date],
    queryFn: () =>
      fetchCompletedForDay({
        data: { week_number: weekNumber!, day_key: dayKey!, local_date: localToday.local_date },
      }),
    enabled: !!user && !!weekNumber && !!dayKey,
  });
  const search = typeof window !== "undefined" ? new URLSearchParams(window.location.search) : null;
  const [allowRepeat] = useState(() => search?.get("force") === "1");

  // Redireciona para o resumo UMA VEZ quando há sessão concluída hoje
  // e não estamos no meio de finalizar uma nova sessão
  const redirectedRef = useRef(false);
  useEffect(() => {
    if (redirectedRef.current) return;
    if (!completedTodayQ.data?.id) return;
    if (finishingRef.current) return;
    if (sessionIdRef.current) return;
    if (allowRepeat) return;
    redirectedRef.current = true;
    navigate({
      to: "/treino/concluido/$sessionId",
      params: { sessionId: completedTodayQ.data.id },
      replace: true,
    });
  }, [completedTodayQ.data?.id, allowRepeat, navigate]);


  // ----------------------------------------------------------
  // Trocas e reordenação de exercícios (mantidas em memória + session_data)
  // ----------------------------------------------------------
  const [swaps, setSwaps] = useState<Record<number, { id: string; name: string; category: string }>>({});
  const [exerciseOrder, setExerciseOrder] = useState<number[] | null>(null);
  const [swapOpenFor, setSwapOpenFor] = useState<{ index: number; id: string; name: string } | null>(null);
  const [reorderOpen, setReorderOpen] = useState(false);

  // Últimos pesos por exercício (sugestão de carga)
  const fetchLastWeights = useServerFn(getLastWeightsForExercises);
  const lastWeightsQ = useQuery({
    queryKey: ["last-weights", user?.id, today?.id],
    queryFn: () => {
      const ids = (today?.exercises ?? []).map((e) => e.exercise.id).filter(Boolean);
      return fetchLastWeights({ data: { exercise_ids: ids } });
    },
    enabled: !!user && !!today && (today?.exercises?.length ?? 0) > 0,
    staleTime: 60_000,
  });
  const lastWeights = lastWeightsQ.data ?? {};

  // Constrói a fila de itens (respeitando ordem customizada e swaps)
  const queue = useMemo<QueueItem[]>(() => {
    if (!today) return [];
    const items: QueueItem[] = [];
    if (today.running) {
      const phases = buildRunPhases(today.running);
      const protocolName = runningHeadline(today.running);
      const paceText = paceRange(today.running);
      for (const phase of phases) items.push({ kind: "run", phase, protocolName, paceText });
    }
    const exercises = today.exercises;
    const order = exerciseOrder && exerciseOrder.length === exercises.length
      ? exerciseOrder
      : exercises.map((_, i) => i);
    for (const exIdx of order) {
      const e = exercises[exIdx];
      if (!e) continue;
      const swap = swaps[exIdx];
      const displayName = swap?.name ?? e.exercise.name;
      const displayId = swap?.id ?? e.exercise.id ?? null;
      const cat = swap?.category ?? e.exercise.category;
      const block: "Força" | "Core" = cat === "core" ? "Core" : "Força";
      const sets = Math.max(1, e.sets);
      const rest = e.rest_seconds ?? (block === "Core" ? 30 : 60);
      for (let s = 1; s <= sets; s++) {
        items.push({
          kind: "strength",
          name: displayName,
          exerciseId: displayId,
          set: s,
          totalSets: sets,
          reps: e.reps,
          rest,
          block,
          exerciseIndex: exIdx,
        });
      }
    }
    return items;
  }, [today, exerciseOrder, swaps]);

  // ----------------------------------------------------------
  // Estado da sessão
  // ----------------------------------------------------------
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"work" | "rest">("work");
  const [paused, setPaused] = useState(false);

  // timestamp em que a fase atual começou; null = aguardando início
  const [phaseStartedAt, setPhaseStartedAt] = useState<number | null>(null);
  // acumulador da fase atual quando pausa
  const [phaseAccumMs, setPhaseAccumMs] = useState(0);
  // total acumulado da sessão inteira (somando fases já fechadas)
  const [totalAccumMs, setTotalAccumMs] = useState(0);

  // Logs por set (volume ao vivo + autosave)
  const [setLogs, setSetLogs] = useState<Record<string, SetLogState>>({});
  // Inputs visíveis do set atual (kg + reps)
  const [liveLoad, setLiveLoad] = useState("");
  const [liveReps, setLiveReps] = useState("");
  const appendSetLogFn = useServerFn(appendSetLog);

  // ticker visual
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 250);
    return () => clearInterval(t);
  }, []);

  // recálculo no retorno do background
  useEffect(() => {
    const onVis = () => setTick((n) => n + 1);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("focus", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("focus", onVis);
    };
  }, []);

  // ----------------------------------------------------------
  // Modal de recuperação
  // ----------------------------------------------------------
  const [recoverState, setRecoverState] = useState<
    | { kind: "idle" }
    | { kind: "modal"; active: ActiveSessionDTO }
    | { kind: "ready" }
  >({ kind: "idle" });

  useEffect(() => {
    if (recoverState.kind !== "idle") return;
    if (!activeQ.isSuccess || !todayQ.isSuccess) return;
    const active = activeQ.data;
    if (!active) {
      setRecoverState({ kind: "ready" });
      return;
    }
    if (active.week_number === weekNumber && active.day_key === dayKey) {
      // recupera silenciosamente
      adoptActive(active);
      setRecoverState({ kind: "ready" });
    } else {
      setRecoverState({ kind: "modal", active });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeQ.isSuccess, todayQ.isSuccess, activeQ.data, weekNumber, dayKey]);

  const adoptActive = useCallback((active: ActiveSessionDTO) => {
    setSessionId(active.id);
    setStep(active.current_step ?? 0);
    const data = (active.session_data ?? {}) as Record<string, unknown>;
    const ph = (data.phase as "work" | "rest" | undefined) ?? "work";
    setPhase(ph);
    // restaura swaps / ordem / set logs
    if (data.swaps && typeof data.swaps === "object") {
      setSwaps(data.swaps as Record<number, { id: string; name: string; category: string }>);
    }
    if (Array.isArray(data.exercise_order)) {
      setExerciseOrder(data.exercise_order as number[]);
    }
    if (data.set_logs && typeof data.set_logs === "object") {
      setSetLogs(data.set_logs as Record<string, SetLogState>);
    }
    // tenta recuperar timestamp do localStorage para precisão sub-segundo
    try {
      const raw = localStorage.getItem(lsKey(active.id));
      if (raw) {
        const snap = JSON.parse(raw) as LocalSnapshot;
        setStep(snap.step);
        setPhase(snap.phase);
        setPhaseStartedAt(snap.phase_started_at_ms);
        setPhaseAccumMs(0);
        setTotalAccumMs(snap.total_elapsed_ms);
        return;
      }
    } catch {
      /* noop */
    }
    setPhaseStartedAt(Date.now());
    setPhaseAccumMs((active.elapsed_seconds ?? 0) * 1000);
    setTotalAccumMs((active.total_elapsed_seconds ?? 0) * 1000);
  }, []);

  // ----------------------------------------------------------
  // Iniciar (ou recuperar) sessão
  // ----------------------------------------------------------
  const beginSession = useCallback(async () => {
    if (!weekNumber || !dayKey) return;
    const res = await startSession({ data: { week_number: weekNumber, day_key: dayKey } });
    adoptActive(res);
    setPhaseStartedAt(Date.now());
    setPhaseAccumMs(0);
    qc.invalidateQueries({ queryKey: ["active-workout-session", user?.id] });
  }, [weekNumber, dayKey, startSession, adoptActive, qc, user?.id]);

  // ----------------------------------------------------------
  // Cálculo de tempo decorrido (timestamp-based)
  // ----------------------------------------------------------
  const current = queue[step];
  const next = queue[step + 1];

  const elapsedMsInPhase = (() => {
    if (paused || phaseStartedAt == null) return phaseAccumMs;
    return phaseAccumMs + (Date.now() - phaseStartedAt);
  })();
  const elapsedSecondsInPhase = Math.floor(elapsedMsInPhase / 1000);

  const totalElapsedMs = (() => {
    if (paused || phaseStartedAt == null) return totalAccumMs + phaseAccumMs;
    return totalAccumMs + phaseAccumMs + (Date.now() - phaseStartedAt);
  })();
  const totalElapsedSeconds = Math.floor(totalElapsedMs / 1000);

  const phaseSeconds = !current
    ? 0
    : current.kind === "run"
      ? current.phase.seconds
      : phase === "rest"
        ? current.rest
        : 0;
  const remaining = phaseSeconds > 0 ? Math.max(0, phaseSeconds - elapsedSecondsInPhase) : elapsedSecondsInPhase;

  // ----------------------------------------------------------
  // Persistência (server + localStorage)
  // ----------------------------------------------------------
  const persistTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const persistNow = useCallback(
    (override?: Partial<{ step: number; phase: "work" | "rest" }>) => {
      if (!sessionId) return;
      const s = override?.step ?? step;
      const p = override?.phase ?? phase;
      const item = queue[s];
      const phaseAccumNowMs =
        paused || phaseStartedAt == null ? phaseAccumMs : phaseAccumMs + (Date.now() - phaseStartedAt);
      const totalNowMs =
        paused || phaseStartedAt == null
          ? totalAccumMs + phaseAccumMs
          : totalAccumMs + phaseAccumMs + (Date.now() - phaseStartedAt);

      // localStorage — atualiza imediatamente
      try {
        const snap: LocalSnapshot = {
          step: s,
          phase: p,
          phase_started_at_ms: phaseStartedAt ?? Date.now(),
          total_elapsed_ms: totalNowMs,
        };
        localStorage.setItem(lsKey(sessionId), JSON.stringify(snap));
      } catch {
        /* noop */
      }

      const payload = {
        session_id: sessionId,
        current_step: s,
        current_exercise_index: item?.kind === "strength" ? item.exerciseIndex : 0,
        current_set: item?.kind === "strength" ? item.set : 1,
        current_block: item?.kind === "run" ? (item.phase.block ?? null) : null,
        current_interval: item?.kind === "run" ? (item.phase.interval ?? null) : null,
        elapsed_seconds: Math.floor(phaseAccumNowMs / 1000),
        total_elapsed_seconds: Math.floor(totalNowMs / 1000),
        session_data: { phase: p, swaps, exercise_order: exerciseOrder, set_logs: setLogs },
        status: paused ? ("paused" as const) : ("active" as const),
      };
      // sync resiliente: tenta online, senão enfileira para mais tarde
      void syncSaveState(payload);
    },
    [sessionId, step, phase, queue, paused, phaseAccumMs, phaseStartedAt, totalAccumMs, swaps, exerciseOrder, setLogs],
  );

  const schedulePersist = useCallback(() => {
    if (persistTimer.current) clearTimeout(persistTimer.current);
    persistTimer.current = setTimeout(() => persistNow(), 1500);
  }, [persistNow]);

  // salva a cada ~5s enquanto roda
  useEffect(() => {
    if (!sessionId || paused) return;
    const t = setInterval(() => persistNow(), 5000);
    return () => clearInterval(t);
  }, [sessionId, paused, persistNow]);

  // salva ao sair da página
  useEffect(() => {
    const onLeave = () => persistNow();
    window.addEventListener("beforeunload", onLeave);
    document.addEventListener("visibilitychange", onLeave);
    return () => {
      window.removeEventListener("beforeunload", onLeave);
      document.removeEventListener("visibilitychange", onLeave);
    };
  }, [persistNow]);

  // ----------------------------------------------------------
  // Avançar / pular
  // ----------------------------------------------------------
  const advanceTo = useCallback(
    (nextStep: number, nextPhaseValue: "work" | "rest") => {
      // fecha a fase atual: soma no total
      const phaseFinalMs =
        paused || phaseStartedAt == null ? phaseAccumMs : phaseAccumMs + (Date.now() - phaseStartedAt);
      setTotalAccumMs((p) => p + phaseFinalMs);
      setPhaseAccumMs(0);
      setPhaseStartedAt(Date.now());
      setStep(nextStep);
      setPhase(nextPhaseValue);
      setPaused(false);
      // persiste com os valores novos
      setTimeout(() => persistNow({ step: nextStep, phase: nextPhaseValue }), 0);
    },
    [paused, phaseStartedAt, phaseAccumMs, persistNow],
  );

  const handleAdvance = useCallback(() => {
    if (!current) return;
    if (current.kind === "run") {
      advanceTo(step + 1, "work");
    } else if (phase === "work") {
      advanceTo(step, "rest");
    } else {
      advanceTo(step + 1, "work");
    }
  }, [current, phase, step, advanceTo]);

  // auto-advance quando countdown chega a zero
  useEffect(() => {
    if (!current || paused || phaseStartedAt == null) return;
    if (phaseSeconds <= 0) return;
    if (elapsedSecondsInPhase < phaseSeconds) return;
    handleAdvance();
  }, [current, paused, phaseStartedAt, phaseSeconds, elapsedSecondsInPhase, handleAdvance]);

  // ----------------------------------------------------------
  // Pausa
  // ----------------------------------------------------------
  const togglePause = useCallback(() => {
    if (paused) {
      setPhaseStartedAt(Date.now());
      setPaused(false);
    } else {
      // congela acumulado
      if (phaseStartedAt != null) {
        setPhaseAccumMs((m) => m + (Date.now() - phaseStartedAt));
      }
      setPhaseStartedAt(null);
      setPaused(true);
    }
    setTimeout(() => persistNow(), 50);
  }, [paused, phaseStartedAt, persistNow]);

  // ----------------------------------------------------------
  // Finalizar
  // ----------------------------------------------------------
  const [finishing, setFinishing] = useState(false);
  finishingRef.current = finishing;
  sessionIdRef.current = sessionId ?? null;
  const finished = sessionId && step >= queue.length && queue.length > 0;

  useEffect(() => {
    if (!finished || finishing) return;
    setFinishing(true);
    const sid = sessionId!;

    // Navega imediatamente para a tela de resumo — a finalização roda em background.
    // A tela de resumo já lida com o estado "ainda sincronizando".
    navigate({ to: "/treino/concluido/$sessionId", params: { sessionId: sid }, replace: true });

    void syncComplete({ session_id: sid, total_elapsed_seconds: totalElapsedSeconds })
      .then(() => {
        try { localStorage.removeItem(lsKey(sid)); } catch { /* noop */ }
        qc.invalidateQueries({ queryKey: ["active-workout-session", user?.id] });
        qc.invalidateQueries({ queryKey: ["workout-history", user?.id] });
        qc.invalidateQueries({ queryKey: ["completed-session", sid] });
      })
      .catch(() => { /* offline-sync já enfileira */ });
  }, [finished, finishing, sessionId, totalElapsedSeconds, qc, user?.id, navigate]);



  // drena a fila ao montar (caso tenha sobrado de uma sessão anterior)
  useEffect(() => {
    void flushQueue();
  }, []);

  // ----------------------------------------------------------
  // RENDER
  // ----------------------------------------------------------

  if (todayQ.isLoading || activeQ.isLoading || recoverState.kind === "idle") {
    return <FullscreenSpinner />;
  }

  // modal de recuperação para outro treino
  if (recoverState.kind === "modal") {
    const a = recoverState.active;
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 p-6 backdrop-blur-md">
        <div className="glass-strong w-full max-w-sm rounded-3xl p-6 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Play className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-xl font-semibold tracking-tight">Treino em andamento</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Encontramos uma sessão ativa de <span className="text-foreground">{a.day_key}</span> (Semana {a.week_number}). Quer continuar de onde parou?
          </p>
          <div className="mt-6 flex flex-col gap-2">
            <button
              onClick={() => {
                adoptActive(a);
                setRecoverState({ kind: "ready" });
              }}
              className="w-full rounded-full bg-primary py-3 text-sm font-semibold text-primary-foreground shadow-glow"
            >
              Continuar treino
            </button>
            <button
              onClick={async () => {
                await abandonSession({ data: { session_id: a.id } });
                try { localStorage.removeItem(lsKey(a.id)); } catch { /* noop */ }
                qc.invalidateQueries({ queryKey: ["active-workout-session", user?.id] });
                setRecoverState({ kind: "ready" });
              }}
              className="w-full rounded-full border border-border bg-surface/60 py-3 text-sm font-medium text-muted-foreground hover:text-foreground"
            >
              Encerrar treino
            </button>
          </div>
        </div>
      </div>
    );
  }

  // sem treino agendado
  if (queue.length === 0) {
    return (
      <CenteredMessage
        title="Dia de descanso"
        action={<BackToDashboard onClick={() => navigate({ to: "/" })} />}
      />
    );
  }

  // sessão concluída
  if (finished) {
    return (
      <CenteredMessage
        title={finishing ? "Salvando sessão…" : "Sessão concluída"}
        subtitle={formatHMS(totalElapsedSeconds)}
        action={!finishing ? <BackToDashboard onClick={() => navigate({ to: "/historico" })} label="Ver histórico" /> : null}
      />
    );
  }

  // ainda não iniciou
  if (!sessionId) {
    const alreadyDoneToday = !!completedTodayQ.data?.id && allowRepeat;
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-background p-6 text-center safe-pad">
        <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
          {today?.day_name} · {today?.objective ?? ""}
        </div>
        <h1 className="mt-3 text-4xl font-semibold tracking-tight">Pronto para começar?</h1>
        <p className="mt-3 max-w-sm text-sm text-muted-foreground">
          {queue.length} blocos nesta sessão. O tempo começa a contar ao tocar em iniciar — você pode fechar o app e voltar depois.
        </p>

        {alreadyDoneToday && (
          <div className="mt-6 max-w-sm rounded-2xl border border-yellow-500/30 bg-yellow-500/10 px-5 py-4 text-sm text-yellow-300">
            <div className="font-semibold">Você já treinou hoje</div>
            <div className="mt-1 text-xs text-yellow-300/70">
              Repetir o mesmo treino no mesmo dia não é recomendado — pode comprometer a recuperação muscular. Mas se tiver certeza, pode continuar.
            </div>
          </div>
        )}

        <button
          onClick={beginSession}
          className="mt-8 inline-flex items-center gap-2 rounded-full bg-primary px-8 py-4 text-base font-semibold text-primary-foreground shadow-glow active:scale-95"
        >
          <Play className="h-5 w-5 fill-current" />
          {alreadyDoneToday ? "Treinar mesmo assim" : "Começar treino"}
        </button>
        <button
          onClick={() => navigate({ to: "/hoje" })}
          className="mt-4 text-xs text-muted-foreground hover:text-foreground"
        >
          Voltar
        </button>
      </div>
    );
  }

  if (!current) return <FullscreenSpinner />;

  const mins = Math.floor(remaining / 60);
  const secs = remaining % 60;
  const progress = (step / Math.max(queue.length, 1)) * 100;
  const isRest =
    current.kind === "strength"
      ? phase === "rest"
      : current.kind === "run" &&
        (current.phase.kind === "rest" || current.phase.kind === "between" || current.phase.kind === "warmup" || current.phase.kind === "cooldown");
  const skipLabel =
    current.kind === "run"
      ? current.phase.kind === "warmup"
        ? "Pular aquecimento"
        : current.phase.kind === "cooldown"
          ? "Pular cooldown"
          : current.phase.kind === "between"
            ? "Pular descanso"
            : current.phase.kind === "rest"
              ? "Pular descanso"
              : "Concluir tiro"
      : phase === "work"
        ? "Concluir set"
        : "Pular descanso";

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background safe-pad">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-50" />
      <div className="absolute inset-x-0 top-0 h-0.5 bg-surface-elevated">
        <div
          className="h-full bg-primary shadow-glow transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
      </div>

      <header className="relative flex items-center justify-between p-4 sm:p-5">
        <button
          onClick={() => {
            persistNow();
            navigate({ to: "/hoje" });
          }}
          className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground"
          aria-label="Sair (treino salvo)"
        >
          <X className="h-4 w-4" />
        </button>
        <div className="num text-center px-2 min-w-0">
          <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground truncate">
            {current.kind === "run" ? current.protocolName : `Bloco ${step + 1} / ${queue.length}`}
          </div>
          <div className="text-[11px] font-medium text-muted-foreground">
            Total {formatHMS(totalElapsedSeconds)}
          </div>
        </div>
        <div className="w-10 flex justify-end"><OfflineBadge /></div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-4">
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
          <div className="glass mt-8 w-full max-w-md rounded-2xl px-5 py-3 text-left">
            <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">Próximo</div>
            <div className="num mt-0.5 text-sm font-semibold tracking-tight truncate">
              {next.kind === "run"
                ? `${runPhaseTitle(next.phase)} · ${formatDuration(next.phase.seconds)}`
                : `${next.name} · Set ${next.set} · ${next.reps} reps`}
            </div>
          </div>
        )}
      </main>

      <footer className="relative flex items-center justify-center gap-3 p-4 pb-[max(env(safe-area-inset-bottom),16px)] sm:p-6">
        <button
          onClick={togglePause}
          className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-surface/60 text-foreground"
          aria-label={paused ? "Retomar" : "Pausar"}
        >
          {paused ? <Play className="h-5 w-5 fill-current" /> : <Pause className="h-5 w-5" />}
        </button>
        <button
          onClick={handleAdvance}
          className="flex h-14 max-w-xs flex-1 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm sm:text-base font-semibold text-primary-foreground shadow-glow active:scale-95"
        >
          {isRest ? <SkipForward className="h-5 w-5" /> : <Check className="h-5 w-5" />}
          <span className="truncate">{skipLabel}</span>
        </button>
      </footer>
    </div>
  );
}

// ============================================================
// Views auxiliares
// ============================================================

function FullscreenSpinner() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function CenteredMessage({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6 text-center safe-pad">
      <div>
        <Check className="mx-auto h-12 w-12 text-primary" />
        <h2 className="mt-4 text-2xl font-semibold tracking-tight">{title}</h2>
        {subtitle && <div className="num mt-2 text-sm text-muted-foreground">{subtitle}</div>}
        {action && <div className="mt-6">{action}</div>}
      </div>
    </div>
  );
}

function BackToDashboard({ onClick, label = "Voltar ao Dashboard" }: { onClick: () => void; label?: string }) {
  return (
    <button
      onClick={onClick}
      className="rounded-full bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground"
    >
      {label}
    </button>
  );
}

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
      <h1 className="mt-3 text-3xl sm:text-4xl font-semibold leading-tight tracking-tight lg:text-5xl break-words">
        {current.name}
      </h1>

      {!countdown ? (
        <div className="num mt-8 flex items-end justify-center gap-3">
          <div className="text-[96px] sm:text-[120px] font-semibold leading-none tracking-tighter text-gradient-primary lg:text-[180px]">
            {current.reps}
          </div>
          <div className="pb-4 sm:pb-6 text-xl sm:text-2xl text-muted-foreground">reps</div>
        </div>
      ) : (
        <div className="num mt-8 text-[112px] sm:text-[140px] font-semibold leading-none tracking-tighter text-gradient-primary lg:text-[200px]">
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
  const isBetweenBlocks = phase.kind === "between";

  const Icon =
    phase.kind === "work" ? Flame :
    phase.kind === "rest" || phase.kind === "between" ? Timer :
    phase.kind === "warmup" ? Wind :
    phase.kind === "cooldown" ? Wind :
    Footprints;

  return (
    <div className="w-full max-w-md text-center">
      <div className={`inline-flex items-center gap-2 rounded-full border ${isBetweenBlocks ? "border-primary/35 bg-primary/10" : "border-border bg-surface/60"} px-3 py-1 text-[10px] font-medium uppercase tracking-[0.22em] ${accent}`}>
        <Icon className="h-3.5 w-3.5" /> {runPhaseTitle(phase)}
      </div>

      <h1 className={`${isBetweenBlocks ? "mt-5 text-3xl sm:text-4xl text-primary" : "mt-4 text-2xl sm:text-3xl"} font-semibold leading-tight tracking-tight lg:text-4xl break-words`}>
        {phase.label}
      </h1>
      {isBetweenBlocks && phase.nextBlock ? (
        <div className="num mx-auto mt-4 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-3 text-sm font-semibold text-primary">
          Prepare-se para o bloco {phase.nextBlock}
        </div>
      ) : phase.block && phase.totalBlocks ? (
        <div className="num mt-1 text-xs text-muted-foreground">
          Bloco {phase.block} / {phase.totalBlocks}
          {phase.interval && phase.totalIntervals ? ` · Tiro ${phase.interval}/${phase.totalIntervals}` : ""}
        </div>
      ) : null}

      <div className="num mt-6 text-[112px] sm:text-[140px] font-semibold leading-none tracking-tighter text-gradient-primary lg:text-[180px]">
        {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
      </div>

      <div className="num mt-5 space-y-1 text-sm text-muted-foreground">
        <div>{phase.detail}</div>
        {isBetweenBlocks && phase.completedBlock && phase.totalBlocks && (
          <div className="text-primary">Fim do bloco {phase.completedBlock}/{phase.totalBlocks}</div>
        )}
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

function formatHMS(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}
