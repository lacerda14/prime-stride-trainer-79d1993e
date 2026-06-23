import { Capacitor, registerPlugin } from "@capacitor/core";

// Payload do treino enviado ao Apple Watch (bate com WatchWorkout do app nativo).
export interface WatchExercisePayload {
  id: string;
  name: string;
  sets: number;
  reps: string;
  restSec: number;
  suggestedWeightKg?: number | null;
}
export interface WatchWorkoutPayload {
  id: string;
  name: string;
  dayLabel: string;
  exercises: WatchExercisePayload[];
}

// Log de série vindo do relógio (bate com WatchSetLog do app nativo).
export interface WatchSetLogEvent {
  workoutId: string;
  exerciseId: string;
  setIndex: number;
  reps: number;
  weightKg: number;
  rpe?: number | null;
  completedAt?: string;
}

export interface WatchEvent {
  event: "started" | "ended" | string;
}

interface WatchBridgePlugin {
  isSupported(): Promise<{ supported: boolean }>;
  sendWorkout(opts: { workout: WatchWorkoutPayload }): Promise<{ sent: boolean }>;
  startWorkout(): Promise<{ sent: boolean }>;
  addListener(
    eventName: "setLog",
    listener: (data: WatchSetLogEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
  addListener(
    eventName: "watchEvent",
    listener: (data: WatchEvent) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

// No iOS resolve pro WatchConnectivityPlugin nativo; na web é no-op (guardar
// chamadas com Capacitor.isNativePlatform()).
export const WatchBridge = registerPlugin<WatchBridgePlugin>("WatchBridge");

// Estrutura mínima do treino do dia (TrainingDayDTO) usada para montar o payload.
interface TodayLike {
  id: string;
  day_name: string;
  objective: string | null;
  exercises: Array<{
    sets: number;
    reps: string;
    rest_seconds: number | null;
    exercise: { id: string | null; name: string };
  }>;
}

// Monta o payload do relógio a partir do treino do dia, aplicando trocas,
// ordem customizada e últimas cargas quando disponíveis.
export function buildWatchWorkout(
  today: TodayLike | null | undefined,
  opts?: {
    id?: string;
    swaps?: Record<number, { id: string; name: string }>;
    exerciseOrder?: number[] | null;
    lastWeights?: Record<string, number | null>;
  },
): WatchWorkoutPayload | null {
  if (!today) return null;
  const exercises = today.exercises ?? [];
  if (exercises.length === 0) return null;
  const order =
    opts?.exerciseOrder && opts.exerciseOrder.length === exercises.length
      ? opts.exerciseOrder
      : exercises.map((_, i) => i);
  const list: WatchExercisePayload[] = [];
  for (const exIdx of order) {
    const e = exercises[exIdx];
    if (!e) continue;
    const swap = opts?.swaps?.[exIdx];
    const id = swap?.id ?? e.exercise.id ?? "";
    if (!id) continue;
    list.push({
      id,
      name: swap?.name ?? e.exercise.name,
      sets: Math.max(1, e.sets),
      reps: e.reps,
      restSec: e.rest_seconds ?? 60,
      suggestedWeightKg: opts?.lastWeights?.[id] ?? null,
    });
  }
  if (list.length === 0) return null;
  return {
    id: opts?.id ?? today.id,
    name: today.day_name ?? "Treino",
    dayLabel: today.objective ?? today.day_name ?? "",
    exercises: list,
  };
}

// Envia pro relógio (no-op fora do iOS nativo / se relógio não pareado).
export async function sendWorkoutToWatch(workout: WatchWorkoutPayload | null): Promise<void> {
  if (!workout || !Capacitor.isNativePlatform()) return;
  try {
    await WatchBridge.sendWorkout({ workout });
  } catch {
    /* relógio não pareado / WCSession inativo */
  }
}

// Pede pro relógio iniciar a sessão de treino (HealthKit) — sincroniza o "play".
export async function startWorkoutOnWatch(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  try {
    await WatchBridge.startWorkout();
  } catch {
    /* relógio não pareado / WCSession inativo */
  }
}
