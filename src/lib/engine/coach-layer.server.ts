// ============================================================
// Coach Layer (Hybrid V3) — camada de especialização sobre o PM Engine.
//
// O PM Engine é SOBERANO: periodização, progressão, volume, frequência,
// recuperação, lesões, equipamento e segurança são dele. O coach NÃO gera
// treino livre — ele atua SOBRE a estrutura já criada pelo motor, dentro de
// guardrails rígidos. Esta é a primeira das três partes de cada coach
// (Methodology Pack determinístico); RAG + AI reasoning vêm depois.
// ============================================================

import type { GenerationResult, UserProfileInput } from "./pm-engine.server";

// ------------------------------------------------------------
// Guardrails do PM Engine — o coach jamais ultrapassa estes limites.
// ------------------------------------------------------------
const REP_FLOOR = 4; // nunca prescreve menos de 4 reps (segurança técnica)
const REST_FLOOR = 20; // s
const REST_CAP = 180; // s
const RPE_FLOOR = 5;
const RPE_CAP = 9.5;

// ------------------------------------------------------------
// Methodology Pack: regras determinísticas do coach. Só mexe em PRESCRIÇÃO
// (reps/descanso/RPE/técnica/notas), nunca em volume, frequência, dias de
// corrida, lesões ou equipamento — isso é do motor.
// ------------------------------------------------------------
export interface CoachMethodologyPack {
  persona: string;
  name: string;
  /** desloca a faixa de reps p/ baixo nos exercícios não-core (+ força). */
  repShiftDown: number;
  /** soma ao descanso (s) dos não-core, depois clampado [REST_FLOOR, REST_CAP]. */
  restBiasSeconds: number;
  /** soma ao RPE alvo dos não-core, depois clampado [RPE_FLOOR, RPE_CAP]. */
  rpeBias: number;
  /** desfaz supersets nos primeiros mains (séries retas p/ levantamentos pesados). */
  preferStraightSets: boolean;
  /** quantos primeiros exercícios não-core são tratados como "mains". */
  mainsTopN: number;
  /** voz do coach gravada nas notas dos mains (auditabilidade visível). */
  mainNoteTemplate: string;
  /** Tags da Knowledge Base própria do coach (camada 2 — RAG). Filtram
   *  `match_knowledge_chunks(filter_tags)`: a recuperação só traz literatura/
   *  protocolos da metodologia deste coach. Sem migration — usa tags existentes. */
  knowledgeTags: string[];
  /** Resumo de 1 linha da metodologia do coach (vai no system prompt da camada 3). */
  methodologySummary: string;
}

export interface CoachAudit {
  persona: string;
  name: string;
  days_touched: number;
  exercises_adjusted: number;
  reps_shifted: number;
  supersets_removed: number;
}

// ------------------------------------------------------------
// Packs por persona. Construídos UM A UM — começando pelo Alex (força).
// ------------------------------------------------------------
const PACKS: Record<string, CoachMethodologyPack> = {
  strength: {
    persona: "strength",
    name: "Alex",
    repShiftDown: 2, // ex.: 8-12 → 6-10, 10-15 → 8-13
    restBiasSeconds: 30, // mais descanso p/ levantar pesado
    rpeBias: 0.5,
    preferStraightSets: true, // mains pesados em séries retas, sem superset
    mainsTopN: 2,
    mainNoteTemplate:
      "Alex: carga pesada, técnica impecável e descanso completo entre as séries.",
    knowledgeTags: ["forca", "hipertrofia", "powerlifting", "periodizacao", "musculacao"],
    methodologySummary:
      "Força e hipertrofia via compostos pesados, séries retas, progressão de carga e periodização linear/ondulatória. Prioriza intensidade e recuperação completa sobre densidade.",
  },
};

export function getCoachPackByPersona(
  persona: string | null | undefined,
): CoachMethodologyPack | null {
  if (!persona) return null;
  return PACKS[persona] ?? null;
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------
function clamp(n: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, n));
}

/** Desloca uma faixa de reps p/ baixo respeitando o piso. Aceita "8-12",
 *  "12" e formatos não numéricos (ex.: "AMRAP" → intocado). */
function shiftReps(reps: string, down: number, floor: number): { reps: string; changed: boolean } {
  const range = reps.match(/^(\d+)\s*-\s*(\d+)$/);
  if (range) {
    const lo = Math.max(floor, parseInt(range[1], 10) - down);
    const hi = Math.max(lo, parseInt(range[2], 10) - down);
    const out = `${lo}-${hi}`;
    return { reps: out, changed: out !== reps };
  }
  const single = reps.match(/^(\d+)$/);
  if (single) {
    const out = String(Math.max(floor, parseInt(single[1], 10) - down));
    return { reps: out, changed: out !== reps };
  }
  return { reps, changed: false };
}

// ------------------------------------------------------------
// Aplicação do coach layer
// ------------------------------------------------------------
/**
 * Aplica o Methodology Pack do coach SOBRE o plano do PM Engine. Determinístico
 * e sempre dentro dos guardrails. Muta `plan` in-place (e também o retorna) e
 * devolve uma auditoria das mudanças. Só atua em dias de força (`full_body`);
 * dias de corrida e exercícios de core ficam intocados.
 */
export function applyCoachLayer(
  plan: GenerationResult,
  pack: CoachMethodologyPack,
  _profile: UserProfileInput,
): { plan: GenerationResult; audit: CoachAudit } {
  const audit: CoachAudit = {
    persona: pack.persona,
    name: pack.name,
    days_touched: 0,
    exercises_adjusted: 0,
    reps_shifted: 0,
    supersets_removed: 0,
  };

  for (const week of plan.weeks) {
    for (const day of week.days) {
      if (day.session_type !== "full_body") continue; // coach só atua na força
      const nonCore = day.exercises.filter((e) => !e.is_core);
      if (nonCore.length === 0) continue;

      const mains = nonCore.slice(0, Math.max(0, pack.mainsTopN));

      // Coleta os grupos de superset a dissolver (pelos mains) — dissolve o
      // GRUPO inteiro pra não deixar pair_slot órfão.
      const dissolve = new Set<number>();
      if (pack.preferStraightSets) {
        for (const m of mains) if (m.pair_slot != null) dissolve.add(m.pair_slot);
      }

      for (const ex of nonCore) {
        const r = shiftReps(ex.reps, pack.repShiftDown, REP_FLOOR);
        if (r.changed) {
          ex.reps = r.reps;
          audit.reps_shifted += 1;
        }
        if (ex.rest_seconds != null) {
          ex.rest_seconds = clamp(ex.rest_seconds + pack.restBiasSeconds, REST_FLOOR, REST_CAP);
        }
        if (ex.rpe_target != null) {
          ex.rpe_target = clamp(ex.rpe_target + pack.rpeBias, RPE_FLOOR, RPE_CAP);
        }
        if (ex.pair_slot != null && dissolve.has(ex.pair_slot)) {
          ex.pair_slot = null;
          audit.supersets_removed += 1;
        }
        audit.exercises_adjusted += 1;
      }

      for (const m of mains) m.notes = pack.mainNoteTemplate;
      audit.days_touched += 1;
    }
  }

  return { plan, audit };
}
