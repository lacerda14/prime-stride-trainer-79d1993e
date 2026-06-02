/**
 * PM Hybrid — Program Generation Engine v1.0
 *
 * Engenharia reversa da Planilha Mestre 48 semanas.
 * NÃO importar de client code — server-only.
 *
 * Estrutura geral:
 *  - 6 mesociclos (1.1, 1.2, 2.1, 2.2, 3, 4) em 4 macros
 *  - Volume FB: sem1–12 = 12 / sem13–24 = 10 / sem25–48 = 8
 *  - Semanas ímpares = A (Pull+Posterior) | Pares = B (Push+Anterior)
 *  - Regra de Ouro: ≤ 2× por exercício por mesociclo
 *  - SEG ≠ QUA ≠ SEX em uma mesma semana (não-core)
 *  - Manguito: 1/sessão, máx 3/sem (sem 1–10)
 *  - Panturrilha: 2–3× / semana
 *  - Pliometria: bloqueada sem 1–4; leve sem 5–12; livre sem 13+
 *  - Core: 2 exercícios ao final
 */

import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================
// Tipos de entrada
// ============================================================
export type Sex = "male" | "female" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Goal = "fat_loss" | "hypertrophy" | "endurance" | "hybrid";
export type AvailableDays = 3 | 4 | 5;

export interface UserProfileInput {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: Sex;
  experience_level: Experience;
  goal: Goal;
  available_days: AvailableDays;
}

// ============================================================
// V_ref — velocidade aeróbica máx sustentável (km/h, ~1min)
// Estimativa simplificada (sem teste físico): combina idade, peso, sexo, experiência.
// ============================================================
export function calcReferenceVelocity(p: UserProfileInput): number {
  let v = 12.0;
  v -= Math.max(0, p.age - 25) * 0.05;
  v -= Math.max(0, p.weight_kg - 70) * 0.02;
  if (p.sex === "female") v -= 1.0;
  if (p.experience_level === "beginner") v -= 1.5;
  else if (p.experience_level === "intermediate") v -= 0.5;
  return Math.max(8, Math.min(14, Math.round(v * 10) / 10));
}

// ============================================================
// Macros e mesos
// ============================================================
export interface MesoDef {
  code: string;
  name: string;
  macro_code: string;
  macro_name: string;
  macro_objective: string;
  macro_method: string;
  start_week: number;
  end_week: number;
  objective: string;
  method: string;
  /** prescrição dominante "sets x reps" */
  prescription: string;
  rpe_target: number;
}

export const MESOCYCLES: MesoDef[] = [
  {
    code: "M1",
    name: "Adaptação estrutural",
    macro_code: "1.1",
    macro_name: "Adaptação estrutural + gasto calórico",
    macro_objective: "Criar base, maximizar gasto, proteger articulações",
    macro_method: "Tradicional Alternado / RML",
    start_week: 1,
    end_week: 4,
    objective: "Adaptação neuromuscular, volume alto, carga leve",
    method: "Tradicional Alternado",
    prescription: "3x12-15",
    rpe_target: 6.5,
  },
  {
    code: "M2",
    name: "Base metabólica",
    macro_code: "1.2",
    macro_name: "Base metabólica",
    macro_objective: "Capacidade aeróbica base + tolerância ao volume",
    macro_method: "Antagonista leve / Circuito controlado",
    start_week: 5,
    end_week: 8,
    objective: "Início de progressão de carga, volume mantido",
    method: "Antagonista leve",
    prescription: "3x10-15",
    rpe_target: 7,
  },
  {
    code: "M3",
    name: "Hipertrofia híbrida",
    macro_code: "2.1",
    macro_name: "Hipertrofia híbrida",
    macro_objective: "Máximo volume muscular compatível com corrida",
    macro_method: "Biset",
    start_week: 9,
    end_week: 16,
    objective: "Tempo sob tensão, range hipertrófico",
    method: "Biset",
    prescription: "3x10-12",
    rpe_target: 8,
  },
  {
    code: "M4",
    name: "Força + intensidade",
    macro_code: "2.2",
    macro_name: "Força + intensidade",
    macro_objective: "Transição de volume para intensidade",
    macro_method: "Biset / Triset",
    start_week: 17,
    end_week: 24,
    objective: "Reduzir reps, aumentar carga",
    method: "Biset/Triset",
    prescription: "3x8-10",
    rpe_target: 8.5,
  },
  {
    code: "M5",
    name: "Força bruta + eficiência 5K",
    macro_code: "3",
    macro_name: "Força bruta + eficiência 5K",
    macro_objective: "Peak de força, pace work específico para 5K",
    macro_method: "Wave / Escada / Antagonista",
    start_week: 25,
    end_week: 40,
    objective: "Intensidade máxima, volume mínimo",
    method: "Wave",
    prescription: "4x6-8",
    rpe_target: 9,
  },
  {
    code: "M6",
    name: "Pico de performance",
    macro_code: "4",
    macro_name: "Pico de performance",
    macro_objective: "Consolidar 5K confortável, manter força com volume mínimo",
    macro_method: "Wave / Pirâmide controlada",
    start_week: 41,
    end_week: 48,
    objective: "Manter força + recuperação otimizada",
    method: "Pirâmide controlada",
    prescription: "4x6-8",
    rpe_target: 8.5,
  },
];

export function mesoForWeek(week: number): MesoDef {
  return MESOCYCLES.find((m) => week >= m.start_week && week <= m.end_week)!;
}

export function fbVolumeForWeek(week: number): number {
  if (week <= 12) return 12;
  if (week <= 24) return 10;
  return 8;
}

// ============================================================
// Goal modifiers
// ============================================================
const GOAL_PACE_MULTIPLIER: Record<Goal, number> = {
  hybrid: 1.0,
  hypertrophy: 0.9,
  fat_loss: 0.95,
  endurance: 1.05,
};

// ============================================================
// Running protocols por mesociclo (versão completa: warmup, blocks,
// intervals, between-block rest, cooldown e pace alvo)
// ============================================================
export type RunProtoType =
  | "vo2_intervals"
  | "tempo_run"
  | "zone_2"
  | "pace_work"
  | "recovery_run"
  | "threshold";

export interface RunProtocolDef {
  protocol_type: RunProtoType;
  protocol_name: string;
  goal: string;
  total_duration_minutes: number;
  warmup_minutes: number;
  cooldown_minutes: number;
  /** quantos blocos de tiros; null para sessões contínuas */
  blocks: number | null;
  /** tiros por bloco; null para sessões contínuas */
  intervals_per_block: number | null;
  /** duração do tiro forte em segundos */
  work_duration_seconds: number | null;
  /** descanso entre tiros (caminhada leve) em segundos */
  rest_duration_seconds: number | null;
  /** descanso entre blocos em segundos */
  between_blocks_rest_seconds: number | null;
  target_pace_min: number;
  target_pace_max: number;
  notes: string;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function applyGoalPace(p: RunProtocolDef, goal: Goal): RunProtocolDef {
  const mult = GOAL_PACE_MULTIPLIER[goal];
  return {
    ...p,
    target_pace_min: round1(p.target_pace_min * mult),
    target_pace_max: round1(p.target_pace_max * mult),
  };
}

function tuesdayProtocol(week: number, goal: Goal): RunProtocolDef {
  const meso = mesoForWeek(week);
  const map: Record<string, RunProtocolDef> = {
    // Semanas 1-4
    M1: {
      protocol_type: "vo2_intervals",
      protocol_name: "VO2 Intervals Beginner",
      goal: "VO2 / adaptação",
      total_duration_minutes: 30,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: 2,
      intervals_per_block: 5,
      work_duration_seconds: 45,
      rest_duration_seconds: 60,
      between_blocks_rest_seconds: 195, // 3min15s
      target_pace_min: 9.0,
      target_pace_max: 9.5,
      notes: "Adaptação ao VO2: 2 blocos × 5 tiros 45/60s, 3min15s entre blocos.",
    },
    // Semanas 5-8
    M2: {
      protocol_type: "vo2_intervals",
      protocol_name: "VO2 Intervals · Progressão",
      goal: "VO2 / consistência",
      total_duration_minutes: 32,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: 2,
      intervals_per_block: 5,
      work_duration_seconds: 60,
      rest_duration_seconds: 60,
      between_blocks_rest_seconds: 180,
      target_pace_min: 9.5,
      target_pace_max: 10.5,
      notes: "2 blocos × 5 tiros 60/60s, 3 min entre blocos.",
    },
    // Semanas 9-16
    M3: {
      protocol_type: "vo2_intervals",
      protocol_name: "VO2 Intervals · Volume",
      goal: "VO2 / potência aeróbica",
      total_duration_minutes: 38,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: 2,
      intervals_per_block: 6,
      work_duration_seconds: 75,
      rest_duration_seconds: 60,
      between_blocks_rest_seconds: 150, // 2min30s
      target_pace_min: 10.5,
      target_pace_max: 11.0,
      notes: "2 blocos × 6 tiros 75/60s, 2min30s entre blocos.",
    },
    // Semanas 17-24
    M4: {
      protocol_type: "vo2_intervals",
      protocol_name: "VO2 Intervals · Intensidade",
      goal: "VO2 / força específica",
      total_duration_minutes: 42,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: 3,
      intervals_per_block: 5,
      work_duration_seconds: 75,
      rest_duration_seconds: 60,
      between_blocks_rest_seconds: 120,
      target_pace_min: 11.0,
      target_pace_max: 11.5,
      notes: "3 blocos × 5 tiros 75/60s, 2 min entre blocos.",
    },
    // Semanas 25-40
    M5: {
      protocol_type: "pace_work",
      protocol_name: "Pace Work 5K",
      goal: "Eficiência de pace para 5K",
      total_duration_minutes: 30,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: 1,
      intervals_per_block: 12,
      work_duration_seconds: 90,
      rest_duration_seconds: 60,
      between_blocks_rest_seconds: null,
      target_pace_min: 11.0,
      target_pace_max: 12.0,
      notes: "30 min contínuos alternando 90s forte / 60s leve. Sem divisão em blocos.",
    },
    // Semanas 41-48
    M6: {
      protocol_type: "pace_work",
      protocol_name: "Pace Work · Manutenção",
      goal: "Manutenção de velocidade",
      total_duration_minutes: 30,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: 1,
      intervals_per_block: 15,
      work_duration_seconds: 60,
      rest_duration_seconds: 60,
      between_blocks_rest_seconds: null,
      target_pace_min: 11.0,
      target_pace_max: 12.0,
      notes: "30 min contínuos alternando 60s forte / 60s leve.",
    },
  };
  return applyGoalPace(map[meso.code], goal);
}

function thursdayProtocol(week: number, goal: Goal): RunProtocolDef {
  const meso = mesoForWeek(week);
  const map: Record<string, RunProtocolDef> = {
    // Semanas 1-4 — Zone 2 base
    M1: {
      protocol_type: "zone_2",
      protocol_name: "Zone 2 Base",
      goal: "Resistência aeróbica",
      total_duration_minutes: 30,
      warmup_minutes: 5,
      cooldown_minutes: 5,
      blocks: null,
      intervals_per_block: null,
      work_duration_seconds: null,
      rest_duration_seconds: null,
      between_blocks_rest_seconds: null,
      target_pace_min: 6.5,
      target_pace_max: 7.5,
      notes: "5 min caminhada + 20 min Z2 contínuo + 5 min caminhada.",
    },
    // Semanas 5-8 — Tempo progressivo
    M2: {
      protocol_type: "tempo_run",
      protocol_name: "Tempo Run · Progressivo",
      goal: "Capacidade aeróbica + ritmo",
      total_duration_minutes: 30,
      warmup_minutes: 0,
      cooldown_minutes: 0,
      blocks: null,
      intervals_per_block: null,
      work_duration_seconds: null,
      rest_duration_seconds: null,
      between_blocks_rest_seconds: null,
      target_pace_min: 7.0,
      target_pace_max: 8.5,
      notes: "10 min leve + 10 min moderado + 10 min leve.",
    },
    // Semanas 9-16
    M3: {
      protocol_type: "tempo_run",
      protocol_name: "Tempo Run · Sustentável",
      goal: "Capacidade aeróbica avançada",
      total_duration_minutes: 30,
      warmup_minutes: 0,
      cooldown_minutes: 0,
      blocks: null,
      intervals_per_block: null,
      work_duration_seconds: null,
      rest_duration_seconds: null,
      between_blocks_rest_seconds: null,
      target_pace_min: 8.0,
      target_pace_max: 9.0,
      notes: "10 min leve + 15 min moderado + 5 min leve.",
    },
    // Semanas 17-24
    M4: {
      protocol_type: "tempo_run",
      protocol_name: "Tempo Run · Contínuo",
      goal: "Resistência ao ritmo",
      total_duration_minutes: 30,
      warmup_minutes: 0,
      cooldown_minutes: 0,
      blocks: null,
      intervals_per_block: null,
      work_duration_seconds: null,
      rest_duration_seconds: null,
      between_blocks_rest_seconds: null,
      target_pace_min: 8.5,
      target_pace_max: 9.5,
      notes: "30 min contínuos em ritmo sustentável.",
    },
    // Semanas 25-40
    M5: {
      protocol_type: "tempo_run",
      protocol_name: "Tempo Run · Economia",
      goal: "Economia de corrida",
      total_duration_minutes: 30,
      warmup_minutes: 0,
      cooldown_minutes: 0,
      blocks: null,
      intervals_per_block: null,
      work_duration_seconds: null,
      rest_duration_seconds: null,
      between_blocks_rest_seconds: null,
      target_pace_min: 9.0,
      target_pace_max: 10.0,
      notes: "30 min sustentáveis em ritmo de 5K confortável.",
    },
    // Semanas 41-48
    M6: {
      protocol_type: "recovery_run",
      protocol_name: "Recovery Run · 5K Confortável",
      goal: "Controle respiratório + recuperação",
      total_duration_minutes: 30,
      warmup_minutes: 0,
      cooldown_minutes: 0,
      blocks: null,
      intervals_per_block: null,
      work_duration_seconds: null,
      rest_duration_seconds: null,
      between_blocks_rest_seconds: null,
      target_pace_min: 9.0,
      target_pace_max: 10.0,
      notes: "30 min contínuos, foco em controle respiratório e 5K confortável.",
    },
  };
  return applyGoalPace(map[meso.code], goal);
}

// ============================================================
// Exercise pool — categorias por dia A/B
// ============================================================
type Category =
  | "biceps" | "triceps" | "chest" | "lats" | "back" | "trap" | "shoulder"
  | "rotator_cuff" | "posterior_chain" | "anterior_chain" | "calf" | "core" | "plyometric";

interface ExerciseRow {
  id: string;
  code: string;
  name: string;
  category: Category;
  equipment: string | null;
  allowed_beginner: boolean;
  allowed_intermediate: boolean;
  allowed_advanced: boolean;
  banned_weeks_1_to_12: boolean;
}

/**
 * Sequência de categorias por slot (A = pull+post, B = push+ant).
 * Volume cai removendo isolações tardias.
 */
const A_FULL_SEQ: Category[] = [
  "biceps",          // 1
  "lats",            // 2
  "back",            // 3
  "trap",            // 4
  "rotator_cuff",    // 5  (semanas 1-10)
  "posterior_chain", // 6
  "posterior_chain", // 7
  "posterior_chain", // 8
  "posterior_chain", // 9
  "calf",            // 10 (2-3x/semana)
  "core",            // 11
  "core",            // 12
];
const B_FULL_SEQ: Category[] = [
  "chest",          // 1
  "chest",          // 2
  "shoulder",       // 3
  "triceps",        // 4
  "rotator_cuff",   // 5
  "anterior_chain", // 6
  "anterior_chain", // 7
  "anterior_chain", // 8
  "anterior_chain", // 9
  "calf",           // 10
  "core",           // 11
  "core",           // 12
];

/** retorna a sequência de categorias adaptada ao volume da semana */
function categorySequence(week: number, type: "A" | "B"): Category[] {
  const full = type === "A" ? A_FULL_SEQ : B_FULL_SEQ;
  const volume = fbVolumeForWeek(week);
  if (volume === 12) return full;
  // 10: remove um acessório inferior + um acessório superior, mantém core
  if (volume === 10) {
    const trimmed = [...full];
    // remove slot 9 (posterior/anterior extra) e slot 4 (trap/triceps acessório)
    trimmed.splice(8, 1); // remove índice 8
    trimmed.splice(3, 1); // remove índice 3
    return trimmed;
  }
  // 8: remove mais 2 (slot 7 e slot 2)
  const trimmed = [...full];
  trimmed.splice(8, 1);
  trimmed.splice(6, 1);
  trimmed.splice(3, 1);
  trimmed.splice(1, 1);
  return trimmed;
}

/** Categorias do dia de corrida (run_upper) — bisets pós-corrida + 2 core */
function runUpperSequence(type: "A" | "B"): Category[] {
  // 4 bisets (8 exercícios) + 2 core
  if (type === "A") {
    // dia tradicional Quinta na planilha: dorsais/bíceps/trap (pull bisets)
    return [
      "lats", "lats",
      "back", "back",
      "biceps", "biceps",
      "trap", "trap",
      "core", "core",
    ];
  }
  // B: peito/ombro/tríceps (push bisets)
  return [
    "chest", "chest",
    "chest", "chest",
    "shoulder", "shoulder",
    "triceps", "triceps",
    "core", "core",
  ];
}

// ============================================================
// Seleção de exercício respeitando regras
// ============================================================
interface PickContext {
  week: number;
  experience: Experience;
  usedInWeek: Set<string>;           // ids já usados na semana (não-core)
  usedInDay: Set<string>;            // ids no dia
  mesoUsage: Map<string, number>;    // count por exercise id no mesociclo (Regra de Ouro ≤2)
  rotationOffset: number;
}

function isAllowedForLevel(ex: ExerciseRow, lvl: Experience): boolean {
  if (lvl === "beginner") return ex.allowed_beginner;
  if (lvl === "intermediate") return ex.allowed_intermediate;
  return ex.allowed_advanced;
}

function filterPool(
  pool: ExerciseRow[],
  category: Category,
  ctx: PickContext,
): ExerciseRow[] {
  return pool.filter((e) => {
    if (e.category !== category) return false;
    if (!isAllowedForLevel(e, ctx.experience)) return false;
    if (ctx.week <= 12 && e.banned_weeks_1_to_12) return false;
    return true;
  });
}

function pickExercise(
  pool: ExerciseRow[],
  category: Category,
  ctx: PickContext,
  isCore: boolean,
): ExerciseRow | null {
  const candidates = filterPool(pool, category, ctx);
  if (candidates.length === 0) return null;
  // ordena por: 1) usado no dia (bloqueia), 2) usado na semana (bloqueia se !core),
  // 3) menos vezes no meso, 4) rotação determinística
  const scored = candidates.map((e) => {
    const inDay = ctx.usedInDay.has(e.id);
    const inWeek = !isCore && ctx.usedInWeek.has(e.id);
    const mesoCount = ctx.mesoUsage.get(e.id) ?? 0;
    return { e, inDay, inWeek, mesoCount };
  });
  // primeiro candidatos válidos
  const valid = scored.filter((s) => !s.inDay && !s.inWeek && s.mesoCount < 2);
  const pickFrom = valid.length > 0 ? valid : scored.filter((s) => !s.inDay);
  if (pickFrom.length === 0) return candidates[0];
  pickFrom.sort((a, b) => a.mesoCount - b.mesoCount);
  const offset = ctx.rotationOffset % pickFrom.length;
  return pickFrom[offset].e;
}

// ============================================================
// Geração principal
// ============================================================
export interface SessionExerciseRow {
  slot: number;
  pair_slot: number | null;
  exercise_id: string;
  sets: number;
  reps: string;
  rpe_target: number | null;
  rest_seconds: number | null;
  notes: string | null;
}

export interface GeneratedDay {
  day_number: number; // 1..7 (Mon=1)
  day_name: string;
  session_type: "full_body" | "run_upper" | "run" | "rest";
  objective: string | null;
  duration_minutes: number | null;
  exercises: SessionExerciseRow[];
  running?: RunProtocolDef;
}

export interface GeneratedWeek {
  week_number: number;
  week_type: "A" | "B";
  mesocycle_code: string;
  days: GeneratedDay[];
}

/** Dias da semana ativos por disponibilidade */
function activeDays(available: AvailableDays): { num: number; name: string; kind: "fb" | "run" }[] {
  if (available === 5) {
    return [
      { num: 1, name: "Segunda", kind: "fb" },
      { num: 2, name: "Terça", kind: "run" },
      { num: 3, name: "Quarta", kind: "fb" },
      { num: 4, name: "Quinta", kind: "run" },
      { num: 5, name: "Sexta", kind: "fb" },
    ];
  }
  if (available === 4) {
    return [
      { num: 1, name: "Segunda", kind: "fb" },
      { num: 2, name: "Terça", kind: "run" },
      { num: 3, name: "Quarta", kind: "fb" },
      { num: 5, name: "Sexta", kind: "fb" },
    ];
  }
  return [
    { num: 1, name: "Segunda", kind: "fb" },
    { num: 3, name: "Quarta", kind: "run" },
    { num: 5, name: "Sexta", kind: "fb" },
  ];
}

export interface GenerationResult {
  total_weeks: number;
  reference_velocity: number;
  weeks: GeneratedWeek[];
  /** mesociclos consolidados (mesma referência usada em DB) */
  mesos: MesoDef[];
}

/**
 * Gera o plano completo de 48 semanas para um perfil.
 * Não escreve no banco — apenas retorna o objeto.
 */
export function generatePlan(profile: UserProfileInput, exercisePool: ExerciseRow[]): GenerationResult {
  const vref = calcReferenceVelocity(profile);
  const days = activeDays(profile.available_days);
  const weeks: GeneratedWeek[] = [];

  // rotação offset por (week, day) para distribuir variedade
  let globalOffset = 0;

  // usage por mesociclo é resetado a cada novo meso
  let currentMeso = "";
  let mesoUsage = new Map<string, number>();

  for (let w = 1; w <= 48; w++) {
    const meso = mesoForWeek(w);
    if (meso.code !== currentMeso) {
      currentMeso = meso.code;
      mesoUsage = new Map();
    }
    const type: "A" | "B" = w % 2 === 1 ? "A" : "B";
    const usedInWeek = new Set<string>();
    const dayPlans: GeneratedDay[] = [];

    // tracking de manguito e panturrilha por semana
    let rotatorCount = 0;
    let calfCount = 0;

    for (const d of days) {
      const usedInDay = new Set<string>();
      const exercises: SessionExerciseRow[] = [];

      if (d.kind === "fb") {
        const seq = categorySequence(w, type);
        let slot = 1;
        for (const cat of seq) {
          let category = cat;
          // manguito: pular após semana 10 (não obrigatório) ou se já 3x/semana
          if (category === "rotator_cuff" && (w > 10 || rotatorCount >= 3)) {
            category = type === "A" ? "lats" : "shoulder";
          }
          // panturrilha: garantir 2-3x/sem — se já tivermos 3, swap por core extra
          if (category === "calf" && calfCount >= 3) {
            category = "core";
          }
          // pliometria opcional (sem 13+ pode injetar 1 no slot final lower, deixamos fora por enquanto)

          const isCore = category === "core";
          const ex = pickExercise(exercisePool, category, {
            week: w,
            experience: profile.experience_level,
            usedInDay,
            usedInWeek,
            mesoUsage,
            rotationOffset: globalOffset++,
          }, isCore);
          if (!ex) continue;
          if (category === "rotator_cuff") rotatorCount += 1;
          if (category === "calf") calfCount += 1;
          if (!isCore) usedInWeek.add(ex.id);
          usedInDay.add(ex.id);
          mesoUsage.set(ex.id, (mesoUsage.get(ex.id) ?? 0) + 1);

          exercises.push({
            slot,
            pair_slot: null,
            exercise_id: ex.id,
            sets: parseInt(meso.prescription.split("x")[0], 10),
            reps: meso.prescription.split("x")[1],
            rpe_target: meso.rpe_target,
            rest_seconds: w <= 12 ? 45 : 60,
            notes: null,
          });
          slot += 1;
        }

        dayPlans.push({
          day_number: d.num,
          day_name: d.name,
          session_type: "full_body",
          objective: `${meso.objective} — ${type === "A" ? "Pull + Posterior" : "Push + Anterior"}`,
          duration_minutes: 55,
          exercises,
        });
      } else {
        // run_upper: 4 bisets + 2 core (par_slot agrupa biset)
        const seq = runUpperSequence(type);
        let slot = 1;
        for (let i = 0; i < seq.length; i += 2) {
          const catA = seq[i];
          const catB = seq[i + 1];
          const isCore = catA === "core";
          const pairId = Math.floor(i / 2) + 1;
          const exA = pickExercise(exercisePool, catA, {
            week: w, experience: profile.experience_level,
            usedInDay, usedInWeek, mesoUsage, rotationOffset: globalOffset++,
          }, isCore);
          const exB = pickExercise(exercisePool, catB, {
            week: w, experience: profile.experience_level,
            usedInDay: new Set([...usedInDay, ...(exA ? [exA.id] : [])]),
            usedInWeek, mesoUsage, rotationOffset: globalOffset++,
          }, isCore);
          for (const ex of [exA, exB]) {
            if (!ex) continue;
            if (!isCore) usedInWeek.add(ex.id);
            usedInDay.add(ex.id);
            mesoUsage.set(ex.id, (mesoUsage.get(ex.id) ?? 0) + 1);
            exercises.push({
              slot,
              pair_slot: isCore ? null : pairId,
              exercise_id: ex.id,
              sets: 3,
              reps: isCore ? "12" : "10-12",
              rpe_target: meso.rpe_target,
              rest_seconds: 45,
              notes: null,
            });
            slot += 1;
          }
        }
        const running = d.num === 2 ? tuesdayProtocol(w, profile.goal) : thursdayProtocol(w, profile.goal);
        dayPlans.push({
          day_number: d.num,
          day_name: d.name,
          session_type: "run_upper",
          objective: `${running.protocol_type.toUpperCase()} + ${type === "A" ? "PULL" : "PUSH"} bisets`,
          duration_minutes: running.total_duration_minutes + 30,
          exercises,
          running,
        });
      }
    }

    weeks.push({
      week_number: w,
      week_type: type,
      mesocycle_code: meso.code,
      days: dayPlans,
    });
  }

  return {
    total_weeks: 48,
    reference_velocity: vref,
    weeks,
    mesos: MESOCYCLES,
  };
}

// ============================================================
// Persistência: grava no banco usando uma supabase client autenticada
// ============================================================
type DB = SupabaseClient<any, any, any>;

export async function persistProgram(
  supabase: DB,
  userId: string,
  profile: UserProfileInput,
  plan: GenerationResult,
): Promise<{ program_id: string }> {
  // arquivar programas anteriores
  await supabase
    .from("training_programs")
    .update({ archived_at: new Date().toISOString() })
    .eq("user_id", userId)
    .is("archived_at", null);

  // criar programa
  const { data: prog, error: pErr } = await supabase
    .from("training_programs")
    .insert({
      user_id: userId,
      goal: profile.goal,
      experience_level: profile.experience_level,
      available_days: profile.available_days,
      total_weeks: plan.total_weeks,
      reference_velocity: plan.reference_velocity,
      active_week: 1,
      active_day: 1,
      generated_from_engine: "v1.0",
    })
    .select("id")
    .single();
  if (pErr) throw new Error(pErr.message);
  const programId = prog.id as string;

  // macrociclos (4) — agrupados por macro_code
  const macroMap = new Map<string, MesoDef[]>();
  for (const m of plan.mesos) {
    const arr = macroMap.get(m.macro_code) ?? [];
    arr.push(m);
    macroMap.set(m.macro_code, arr);
  }
  const macroIdByCode = new Map<string, string>();
  let macroOrder = 0;
  for (const [code, mesos] of macroMap) {
    macroOrder += 1;
    const startWeek = Math.min(...mesos.map((m) => m.start_week));
    const endWeek = Math.max(...mesos.map((m) => m.end_week));
    const { data: macro, error } = await supabase
      .from("macrocycles")
      .insert({
        program_id: programId,
        name: mesos[0].macro_name,
        sort_order: macroOrder,
        start_week: startWeek,
        end_week: endWeek,
        objective: mesos[0].macro_objective,
        dominant_method: mesos[0].macro_method,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    macroIdByCode.set(code, macro.id);
  }

  // mesociclos (6)
  const mesoIdByCode = new Map<string, string>();
  let mesoOrder = 0;
  for (const m of plan.mesos) {
    mesoOrder += 1;
    const { data: meso, error } = await supabase
      .from("mesocycles")
      .insert({
        macrocycle_id: macroIdByCode.get(m.macro_code)!,
        name: m.name,
        sort_order: mesoOrder,
        start_week: m.start_week,
        end_week: m.end_week,
        objective: m.objective,
        method: m.method,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    mesoIdByCode.set(m.code, meso.id);
  }

  // ------------------------------------------------------------
  // Bulk insert — gera UUIDs client-side e insere em lote para evitar
  // ~600 round-trips sequenciais (causa de 504 upstream timeout).
  // ------------------------------------------------------------
  const weekRows = plan.weeks.map((w) => ({
    id: crypto.randomUUID(),
    program_id: programId,
    mesocycle_id: mesoIdByCode.get(w.mesocycle_code)!,
    week_number: w.week_number,
    week_type: w.week_type,
  }));
  {
    const { error } = await supabase.from("weeks").insert(weekRows);
    if (error) throw new Error(`weeks: ${error.message}`);
  }
  const weekIdByNumber = new Map<number, string>();
  weekRows.forEach((r) => weekIdByNumber.set(r.week_number, r.id));

  const dayRows: any[] = [];
  const sessionExerciseRows: any[] = [];
  const runningRows: any[] = [];

  for (const w of plan.weeks) {
    const weekId = weekIdByNumber.get(w.week_number)!;
    for (const d of w.days) {
      const dayId = crypto.randomUUID();
      dayRows.push({
        id: dayId,
        week_id: weekId,
        day_number: d.day_number,
        day_name: d.day_name,
        session_type: d.session_type,
        objective: d.objective,
        duration_minutes: d.duration_minutes,
      });
      for (const e of d.exercises) {
        sessionExerciseRows.push({
          training_day_id: dayId,
          exercise_id: e.exercise_id,
          slot: e.slot,
          pair_slot: e.pair_slot,
          sets: e.sets,
          reps: e.reps,
          rpe_target: e.rpe_target,
          rest_seconds: e.rest_seconds,
          notes: e.notes,
        });
      }
      if (d.running) {
        runningRows.push({
          training_day_id: dayId,
          protocol_type: d.running.protocol_type,
          protocol_name: d.running.protocol_name,
          goal: d.running.goal,
          total_duration_minutes: d.running.total_duration_minutes,
          warmup_minutes: d.running.warmup_minutes,
          cooldown_minutes: d.running.cooldown_minutes,
          blocks: d.running.blocks,
          intervals: d.running.intervals_per_block, // legado
          intervals_per_block: d.running.intervals_per_block,
          work_duration_seconds: d.running.work_duration_seconds,
          rest_duration_seconds: d.running.rest_duration_seconds,
          between_blocks_rest_seconds: d.running.between_blocks_rest_seconds,
          target_pace_min: d.running.target_pace_min,
          target_pace_max: d.running.target_pace_max,
          pace_min: d.running.target_pace_min, // legado
          pace_max: d.running.target_pace_max, // legado
          notes: d.running.notes,
        });
      }
    }
  }

  const insertChunks = async (table: string, rows: any[], size = 500) => {
    for (let i = 0; i < rows.length; i += size) {
      const slice = rows.slice(i, i + size);
      const { error } = await supabase.from(table).insert(slice);
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };

  await insertChunks("training_days", dayRows);
  await insertChunks("session_exercises", sessionExerciseRows);
  await insertChunks("running_protocols", runningRows);

  return { program_id: programId };
}

// ============================================================
// Loader do pool — leitura do exercise_pool
// ============================================================
export async function loadExercisePool(supabase: DB): Promise<ExerciseRow[]> {
  const { data, error } = await supabase
    .from("exercise_pool")
    .select("id, code, name, category, equipment, allowed_beginner, allowed_intermediate, allowed_advanced, banned_weeks_1_to_12");
  if (error) throw new Error(error.message);
  return (data ?? []) as ExerciseRow[];
}
