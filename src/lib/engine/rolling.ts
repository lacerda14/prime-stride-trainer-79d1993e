// src/lib/engine/rolling.ts
// =============================================================================
// Engine v2 / Fase 1 — lógica PURA da geração rolante (sem I/O).
// Decide qual JANELA de semanas (= próximo mesociclo) materializar, dado o
// cursor (até onde os treinos já foram gerados). O esqueleto (programa, macro,
// meso, weeks) é sempre persistido inteiro; só os training_days/session_exercises
// são materializados em janela.
// =============================================================================

export interface MesoBounds {
  start_week: number;
  end_week: number;
}

/**
 * Próxima janela de semanas a materializar (o mesociclo que segue o cursor).
 * @param cursor última semana já materializada (0 = nada materializado ainda).
 * @returns [from, to] inclusivo (semanas a materializar) ou null se já materializou tudo.
 */
export function nextMesocycleWindow(
  cursor: number,
  mesos: MesoBounds[],
  totalWeeks: number,
): { from: number; to: number } | null {
  if (cursor >= totalWeeks) return null;
  const nextWeek = cursor + 1;
  const meso = [...mesos]
    .sort((a, b) => a.start_week - b.start_week)
    .find((m) => m.end_week >= nextWeek);
  if (!meso) return null;
  const to = Math.min(meso.end_week, totalWeeks);
  if (to < nextWeek) return null;
  return { from: nextWeek, to };
}

/**
 * Precisa materializar o próximo mesociclo agora? Dispara quando o aluno chega
 * na última (ou penúltima) semana já materializada. cursor null = programa
 * antigo (full-baked) → nunca materializa.
 */
export function needsMaterialization(
  activeWeek: number,
  cursor: number | null,
  totalWeeks: number,
): boolean {
  if (cursor == null) return false;
  if (cursor >= totalWeeks) return false;
  return activeWeek >= cursor - 1;
}
