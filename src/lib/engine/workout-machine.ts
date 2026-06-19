// Máquina de estados PURA da sessão de treino — extraída do treino.tsx para ser
// testável sem React/DOM/I/O. O componente delega tempo e avanço pra cá.

export type Phase = "work" | "rest";

export interface PhaseTiming {
  paused: boolean;
  phaseStartedAt: number | null; // timestamp (ms) do início da fase; null = aguardando
  phaseAccumMs: number; // tempo acumulado da fase atual (somado ao pausar)
}

export interface SessionTiming extends PhaseTiming {
  totalAccumMs: number; // tempo total das fases já fechadas
}

// Tempo decorrido na fase atual (ms). Pausado ou não iniciado → só o acumulado.
export function elapsedMsInPhase(t: PhaseTiming, now: number): number {
  if (t.paused || t.phaseStartedAt == null) return t.phaseAccumMs;
  return t.phaseAccumMs + (now - t.phaseStartedAt);
}

// Tempo total decorrido da sessão (ms).
export function totalElapsedMs(t: SessionTiming, now: number): number {
  if (t.paused || t.phaseStartedAt == null) return t.totalAccumMs + t.phaseAccumMs;
  return t.totalAccumMs + t.phaseAccumMs + (now - t.phaseStartedAt);
}

// Sessão concluída quando o passo ultrapassou o fim de uma fila não-vazia.
export function isFinished(step: number, queueLen: number): boolean {
  return step >= queueLen && queueLen > 0;
}

export interface AdvanceResult {
  step: number;
  phase: Phase;
  /** true quando se deve registrar a série atual (transição work→rest de força). */
  captureSet: boolean;
}

// Decide a próxima posição na fila. Espelha exatamente o handleAdvance:
// - run            → próximo item (work)
// - strength/work  → rest do MESMO item + marca captureSet
// - strength/rest  → próximo item (work)
export function computeAdvance(
  currentKind: "run" | "strength" | undefined,
  phase: Phase,
  step: number,
): AdvanceResult {
  if (!currentKind) return { step, phase, captureSet: false };
  if (currentKind === "run") return { step: step + 1, phase: "work", captureSet: false };
  if (phase === "work") return { step, phase: "rest", captureSet: true };
  return { step: step + 1, phase: "work", captureSet: false };
}
