import { useEffect, useMemo, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { WatchBridge, buildWatchWorkout, sendWorkoutToWatch } from "@/lib/watch-bridge";
import type { TrainingDayDTO } from "@/lib/program.queries";

type SwapMap = Record<number, { id: string; name: string; category: string }>;

interface AppendSetLogArgs {
  data: {
    session_id: string;
    exercise_id?: string | null;
    exercise_index: number;
    exercise_name: string;
    set_number: number;
    actual_reps?: number | null;
    actual_load_kg?: number | null;
  };
}

interface UseWatchSyncParams {
  today: TrainingDayDTO | null | undefined;
  sessionId: string | null;
  swaps: SwapMap;
  exerciseOrder: number[] | null;
  lastWeights: Record<string, number | null>;
  appendSetLog: (args: AppendSetLogArgs) => Promise<unknown>;
}

/**
 * Toda a I/O com o Apple Watch (extraída do treino.tsx):
 * - envia o treino do dia (debounce + dedup, pra não floodar o WCSession);
 * - recebe os logs de série feitos no pulso e salva no Supabase.
 * No-op fora do iOS nativo / sem relógio pareado.
 */
export function useWatchSync({
  today,
  sessionId,
  swaps,
  exerciseOrder,
  lastWeights,
  appendSetLog,
}: UseWatchSyncParams): void {
  const watchWorkout = useMemo(
    () =>
      buildWatchWorkout(today, { id: sessionId ?? today?.id, swaps, exerciseOrder, lastWeights }),
    [today, sessionId, swaps, exerciseOrder, lastWeights],
  );

  // Envia quando muda. Dedup por conteúdo + debounce evita floodar a fila do
  // WCSession (transferUserInfo é FIFO persistente) a cada digitação de carga/troca.
  const lastSentRef = useRef<string>("");
  useEffect(() => {
    if (!watchWorkout) return;
    const sig = JSON.stringify(watchWorkout);
    if (sig === lastSentRef.current) return;
    const t = setTimeout(() => {
      lastSentRef.current = sig;
      void sendWorkoutToWatch(watchWorkout);
    }, 400);
    return () => clearTimeout(t);
  }, [watchWorkout]);

  // Recebe os logs de série feitos no pulso e salva no Supabase.
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let handle: { remove: () => Promise<void> } | undefined;
    WatchBridge.addListener("setLog", (log) => {
      if (!sessionId || !today) return;
      const exIdx = today.exercises.findIndex(
        (e, i) => (swaps[i]?.id ?? e.exercise.id) === log.exerciseId,
      );
      const e = exIdx >= 0 ? today.exercises[exIdx] : null;
      void appendSetLog({
        data: {
          session_id: sessionId,
          exercise_id: log.exerciseId,
          exercise_index: exIdx >= 0 ? exIdx : 0,
          exercise_name: swaps[exIdx]?.name ?? e?.exercise.name ?? "Exercício",
          set_number: (log.setIndex ?? 0) + 1,
          actual_reps: log.reps ?? null,
          actual_load_kg: log.weightKg ?? null,
        },
      }).catch(() => {
        /* offline — fila local cobre */
      });
    })
      .then((h) => {
        handle = h;
      })
      .catch(() => {
        /* sem watch */
      });
    return () => {
      void handle?.remove?.();
    };
  }, [sessionId, today, swaps, appendSetLog]);
}
