// Engine v2 / Fase 2 — FECHA O LOOP.
// Agrega o feedback do mesociclo CONCLUÍDO e devolve um ajuste DETERMINÍSTICO
// para o próximo mesociclo. Puro / testável.
//
// PRINCÍPIO (igual autoregulation.server, que é advisory): NÃO altera a estrutura
// (macro/meso/microciclo, push/pull, periodização). Só mexe em:
//   - carga → via nudge de `rpe_target` (o motor prescreve RPE, não kg);
//   - volume acessório → séries +/- em exercícios slot>=2 (preserva o principal);
//   - dor articular recorrente → entra em `pain_regions` na regeneração (o
//     filterPoolByInjuries já exclui os padrões correspondentes).
// Consome: feedback de esforço/performance (via Decision da autoregulação) +
// sono + energia + dor (índice de recuperação subjetivo).

import type { Decision } from "./autoregulation.server";

export interface SubjectiveSummary {
  sleep_quality?: "ruim" | "ok" | "otimo" | null;
  energy_level?: "baixa" | "normal" | "alta" | null;
  joint_pain?: string[] | null;
  muscle_soreness?: string[] | null;
}

export interface MesoAdjustment {
  accessory_volume_adjust: number; // séries +/- em acessórios (slot >= 2)
  rpe_adjust: number; // nudge de intensidade aplicado a rpe_target
  deload: boolean;
  avoid_pain_regions: string[]; // mescladas em pain_regions na regeneração
  reason: string;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

// Índice de recuperação subjetivo: -1 (mal recuperado) .. +1 (bem recuperado).
// Média, por sessão, de sono + energia, penalizado pela carga de dor relatada.
export function recoveryIndex(summaries: SubjectiveSummary[]): number {
  const sleepMap = { ruim: -1, ok: 0, otimo: 1 } as const;
  const energyMap = { baixa: -1, normal: 0, alta: 1 } as const;
  let sum = 0;
  let n = 0;
  for (const s of summaries) {
    let v = 0;
    let parts = 0;
    if (s.sleep_quality) {
      v += sleepMap[s.sleep_quality];
      parts++;
    }
    if (s.energy_level) {
      v += energyMap[s.energy_level];
      parts++;
    }
    const painCount = (s.joint_pain?.length ?? 0) + (s.muscle_soreness?.length ?? 0);
    if (painCount > 0) {
      v += clamp(-painCount / 3, -1, 0);
      parts++;
    }
    if (parts > 0) {
      sum += v / parts;
      n++;
    }
  }
  return n > 0 ? clamp(sum / n, -1, 1) : 0;
}

// Regiões de dor ARTICULAR que aparecem em >= minCount sessões da janela.
// (Dor muscular é esperada no treino → não vira restrição; só a articular.)
export function recurringPainRegions(summaries: SubjectiveSummary[], minCount = 2): string[] {
  const count = new Map<string, number>();
  for (const s of summaries) {
    for (const r of s.joint_pain ?? []) {
      const k = (r ?? "").trim();
      if (k) count.set(k, (count.get(k) ?? 0) + 1);
    }
  }
  return [...count.entries()].filter(([, c]) => c >= minCount).map(([r]) => r);
}

// Combina a Decision (carga/volume/deload — advisory) com a recuperação subjetiva
// e a dor recorrente → ajuste a aplicar no próximo mesociclo.
export function deriveMesoAdjustment(
  decision: Decision,
  recovery: number,
  painRegions: string[],
): MesoAdjustment {
  // Intensidade: o sinal do ajuste de carga vira nudge de RPE (±0.5), modulado
  // pela recuperação subjetiva.
  let rpe_adjust = Math.sign(decision.load_adjust_pct) * 0.5;
  if (recovery <= -0.5) rpe_adjust -= 0.5;
  else if (recovery >= 0.5 && rpe_adjust >= 0) rpe_adjust += 0.25;
  rpe_adjust = clamp(rpe_adjust, -1, 0.5);

  // Volume acessório vem da Decision; recuperação ruim força reduzir.
  let vol = decision.accessory_volume_adjust;
  if (recovery <= -0.5) vol = Math.min(vol, -1);
  vol = clamp(vol, -2, 1);

  const deload = decision.deload_recommended || recovery <= -0.75;
  if (deload) {
    rpe_adjust = Math.min(rpe_adjust, -1);
    vol = Math.min(vol, -1);
  }

  const bits: string[] = [];
  if (deload) bits.push("deload (recuperação baixa / fadiga acumulada)");
  else if (rpe_adjust > 0 || vol > 0) bits.push("progressão");
  else if (rpe_adjust < 0 || vol < 0) bits.push("alívio");
  else bits.push("manutenção");
  if (painRegions.length) bits.push(`evitando dor articular: ${painRegions.join(", ")}`);

  return {
    accessory_volume_adjust: vol,
    rpe_adjust,
    deload,
    avoid_pain_regions: painRegions,
    reason: bits.join(" · "),
  };
}

// Aplica o ajuste às linhas de exercício da janela (puro, clampado).
// slot 1 = principal (volume preservado); acessórios = slot >= 2.
export interface AdjustableExercise {
  slot: number;
  sets: number;
  rpe_target: number | null;
}
export function applyMesoAdjustment<T extends AdjustableExercise>(
  exercises: T[],
  adj: MesoAdjustment,
): T[] {
  return exercises.map((e) => ({
    ...e,
    sets: e.slot >= 2 ? clamp(e.sets + adj.accessory_volume_adjust, 2, 5) : e.sets,
    rpe_target: e.rpe_target != null ? clamp(e.rpe_target + adj.rpe_adjust, 6, 9.5) : e.rpe_target,
  }));
}
