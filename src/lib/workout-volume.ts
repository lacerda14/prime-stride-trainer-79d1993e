// Helper puro para cálculo de volume (kg × reps) compartilhado entre
// a tela de execução do treino e a tela de resumo.

export interface VolumeSetInput {
  actual_load_kg?: number | string | null;
  planned_load_kg?: number | string | null;
  actual_reps?: number | string | null;
  planned_reps?: number | string | null;
  completed?: boolean;
}

function num(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : 0;
}

/** Extrai o primeiro número de strings tipo "8-12" ou "10" → usa o mínimo. */
function repsFromText(v: number | string | null | undefined): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const m = String(v).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

/**
 * Soma o volume (kg × reps) das séries.
 * Quando `actual_*` não estiver disponível, cai para `planned_*` (útil
 * para mostrar uma estimativa ao vivo durante o treino).
 * Se `completed` for fornecido, só conta séries marcadas como concluídas.
 */
export function computeVolume(sets: VolumeSetInput[]): number {
  let total = 0;
  for (const s of sets) {
    if (s.completed === false) continue;
    const kg = num(s.actual_load_kg) || num(s.planned_load_kg);
    const reps = num(s.actual_reps) || repsFromText(s.planned_reps);
    total += kg * reps;
  }
  return total;
}

export function formatVolume(v: number): string {
  if (v <= 0) return "—";
  if (v >= 1000) return `${(v / 1000).toFixed(1)}t`;
  return `${Math.round(v)}kg`;
}
