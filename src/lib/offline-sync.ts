// ============================================================
// Offline Sync Queue
// ------------------------------------------------------------
// Estratégia:
// • Toda mutação relevante (saveState do treino, completeSession)
//   passa por aqui.
// • Se estamos online → tenta enviar agora; se falhar, enfileira.
// • Se estamos offline → enfileira direto.
// • Ao reconectar (evento `online`) ou periodicamente (10s),
//   tenta drenar a fila em ordem FIFO.
// • Para saveState fazemos dedupe por session_id (mantemos apenas
//   o snapshot mais recente para não acumular lixo).
// ============================================================

import { useSyncExternalStore } from "react";
import { updateWorkoutSessionState, completeWorkoutSession } from "@/lib/workout-session.functions";

type SaveStatePayload = {
  session_id: string;
  current_step: number;
  current_exercise_index: number;
  current_set: number;
  current_block?: number | null;
  current_interval?: number | null;
  elapsed_seconds: number;
  total_elapsed_seconds: number;
  session_data?: Record<string, unknown>;
  status?: "active" | "paused";
};

type CompletePayload = {
  session_id: string;
  total_elapsed_seconds: number;
};

type QueuedOp =
  | { id: string; kind: "saveState"; payload: SaveStatePayload; ts: number }
  | { id: string; kind: "complete"; payload: CompletePayload; ts: number };

const QUEUE_KEY = "pm-offline-queue:v1";
const listeners = new Set<() => void>();

function isBrowser() {
  return typeof window !== "undefined" && typeof localStorage !== "undefined";
}

function readQueue(): QueuedOp[] {
  if (!isBrowser()) return [];
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || "[]") as QueuedOp[];
  } catch {
    return [];
  }
}

function writeQueue(ops: QueuedOp[]) {
  if (!isBrowser()) return;
  try {
    localStorage.setItem(QUEUE_KEY, JSON.stringify(ops));
  } catch {
    /* noop */
  }
  listeners.forEach((l) => l());
}

function newId(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function enqueue(op: Omit<QueuedOp, "id" | "ts">) {
  const ops = readQueue();
  if (op.kind === "saveState") {
    // dedupe: só guarda o último snapshot por session_id
    const filtered = ops.filter(
      (o) => !(o.kind === "saveState" && o.payload.session_id === op.payload.session_id),
    );
    filtered.push({ ...op, id: newId(), ts: Date.now() } as QueuedOp);
    writeQueue(filtered);
  } else {
    ops.push({ ...op, id: newId(), ts: Date.now() } as QueuedOp);
    writeQueue(ops);
  }
}

// ============================================================
// Online status
// ============================================================

function getOnline(): boolean {
  if (typeof navigator === "undefined") return true;
  return navigator.onLine;
}

const onlineListeners = new Set<() => void>();

if (isBrowser()) {
  window.addEventListener("online", () => {
    onlineListeners.forEach((l) => l());
    void flushQueue();
  });
  window.addEventListener("offline", () => {
    onlineListeners.forEach((l) => l());
  });
  // tenta drenar periodicamente quando algo está pendente
  setInterval(() => {
    if (readQueue().length > 0 && getOnline()) void flushQueue();
  }, 10_000);
}

// ============================================================
// Hooks React
// ============================================================

export function useOnlineStatus(): boolean {
  return useSyncExternalStore(
    (cb) => {
      onlineListeners.add(cb);
      return () => onlineListeners.delete(cb);
    },
    () => getOnline(),
    () => true,
  );
}

export function usePendingSyncCount(): number {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => readQueue().length,
    () => 0,
  );
}

// ============================================================
// Flush
// ============================================================

let flushing = false;

export async function flushQueue(): Promise<void> {
  if (flushing) return;
  if (!getOnline()) return;
  flushing = true;
  try {
    let ops = readQueue();
    while (ops.length > 0) {
      const op = ops[0];
      try {
        if (op.kind === "saveState") {
          await updateWorkoutSessionState({ data: op.payload });
        } else {
          await completeWorkoutSession({ data: op.payload });
        }
        ops = readQueue().filter((o) => o.id !== op.id);
        writeQueue(ops);
      } catch {
        // ainda falhando — para e tenta de novo depois
        break;
      }
    }
  } finally {
    flushing = false;
  }
}

// ============================================================
// API pública para uso no treino
// ============================================================

/**
 * Tenta salvar o estado do treino. Se offline ou falhar, enfileira.
 * Nunca lança — falha silenciosa (estado já está em localStorage).
 */
export async function syncSaveState(payload: SaveStatePayload): Promise<void> {
  if (getOnline()) {
    try {
      await updateWorkoutSessionState({ data: payload });
      // se havia pendências, aproveita pra drenar
      if (readQueue().length > 0) void flushQueue();
      return;
    } catch {
      enqueue({ kind: "saveState", payload });
      return;
    }
  }
  enqueue({ kind: "saveState", payload });
}

/**
 * Conclui a sessão. Se offline ou falhar, enfileira e retorna `{ queued: true }`.
 * Quando online e sucesso, retorna `{ queued: false }`.
 */
export async function syncComplete(payload: CompletePayload): Promise<{ queued: boolean }> {
  if (getOnline()) {
    try {
      await completeWorkoutSession({ data: payload });
      if (readQueue().length > 0) void flushQueue();
      return { queued: false };
    } catch {
      enqueue({ kind: "complete", payload });
      return { queued: true };
    }
  }
  enqueue({ kind: "complete", payload });
  return { queued: true };
}
