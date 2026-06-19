/**
 * PM Hybrid — Program Generation Engine v1.0
 *
 * Engenharia reversa da Planilha Mestre 48 semanas.
 * NÃO importar de client code — server-only.
 *
 * Estrutura geral:
 *  - 6 mesociclos (1.1, 1.2, 2.1, 2.2, 3, 4) em 4 macros
 *  - Volume FB: sem1–12 = 12 / sem13–24 = 10 / sem25–48 = 8
 *  - Seg/Qua/Sex sempre Full Body; Ter/Qui sempre Corrida + Superior
 *  - Semanas ímpares: FB Pull+Posterior e Run+Upper Push; pares: FB Push+Anterior e Run+Upper Pull
 *  - Regra de Ouro: ≤ 2× por exercício por mesociclo
 *  - SEG ≠ QUA ≠ SEX em uma mesma semana (não-core)
 *  - Manguito: 1/sessão, máx 3/sem (sem 1–10)
 *  - Panturrilha: 2–3× / semana
 *  - Pliometria: bloqueada sem 1–4; leve sem 5–12; livre sem 13+
 *  - Core: 2 exercícios ao final
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { applyCoachLayer, getCoachPackByPersona } from "./coach-layer.server";
import { serverError } from "@/lib/server-errors";

// ============================================================
// Tipos de entrada
// ============================================================
export type Sex = "male" | "female" | "other";
export type Experience = "beginner" | "intermediate" | "advanced";
export type Goal = "fat_loss" | "hypertrophy" | "endurance" | "hybrid";
export type AvailableDays = number; // 1..7 dias por semana
export type RunningMode = "desabilitado" | "opcional" | "integrado" | "principal";

/**
 * Mapeamento CANÔNICO objetivo-do-banco → objetivo-do-motor (4 buckets).
 * O onboarding tem mais opções (condicionamento, 5k/10k, saúde geral) que são
 * persistidas em `profiles.goal`; o motor só entende 4. Esta é a única fonte
 * da verdade — usada por buildEngineInput e completeOnboarding (evita drift).
 */
export function mapDbGoalToEngineGoal(g: string | null | undefined): Goal {
  switch (g) {
    case "fat_loss":
    case "general_health": // saúde geral → base metabólica / full body
      return "fat_loss";
    case "hypertrophy":
      return "hypertrophy";
    case "endurance":
    case "run_5k": // corrida 5k/10k → resistência
      return "endurance";
    case "conditioning": // condicionamento → híbrido (força + capacidade)
    case "hybrid":
    default:
      return "hybrid";
  }
}

export interface UserProfileInput {
  age: number;
  weight_kg: number;
  height_cm: number;
  sex: Sex;
  experience_level: Experience;
  goal: Goal;
  available_days: AvailableDays;
  /** Dias da semana selecionados pelo usuário (1=Seg ... 7=Dom). Quando ausente, usa Seg..Sex. */
  selected_days?: number[];
  /** True quando o usuário quer corrida integrada/principal no plano. False = só musculação. */
  wants_running?: boolean;
  running_mode?: RunningMode | null;
  /** Lista (pt-BR) de equipamentos disponíveis vinda do onboarding (deriveEquipment).
   *  Quando vazia/undefined, assume-se academia completa (compat retroativa). */
  available_equipment?: string[];
  /** Minutos disponíveis por sessão (30/45/60/75/90). Controla nº de exercícios. */
  available_minutes?: number | null;
  /** Seed estável (ex.: userId) para variação determinística entre alunos. */
  seed?: string;
  /** Regiões com dor/lesão (pt-BR onboarding): Joelhos, Lombar, Ombros, ... */
  pain_regions?: string[];
  /** Lesões anteriores (pt-BR): Hérnia de disco, LCA, Menisco, Manguito... */
  past_injuries?: string[];
  /** Movimentos desconfortáveis (pt-BR): Agachamento, Saltos, Acima da cabeça... */
  uncomfortable_movements?: string[];
}

// ============================================================
// Filtro de equipamentos — nunca gerar exercícios sem o equipamento
// disponível para o usuário (ex.: sem Leg Press, sem barra olímpica, sem rack).
// ============================================================
function normEquip(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export interface EquipmentAvailability {
  barbell: boolean; // barra olímpica utilizável (com rack ou smith)
  dumbbell: boolean;
  cable: boolean;
  machine: boolean; // alguma máquina disponível
  sled: boolean;
  rack: boolean;
  pullUpBar: boolean;
  bench: boolean;
  legPress: boolean;
  hackSquat: boolean;
  smith: boolean;
  legCurl: boolean;
  legExtension: boolean;
}

export function resolveEquipmentAvailability(userEquipment?: string[]): EquipmentAvailability {
  // Compat: sem dados de equipamento => assume academia completa.
  if (!userEquipment || userEquipment.length === 0) {
    return {
      barbell: true,
      dumbbell: true,
      cable: true,
      machine: true,
      sled: false,
      rack: true,
      pullUpBar: true,
      bench: true,
      legPress: true,
      hackSquat: true,
      smith: true,
      legCurl: true,
      legExtension: true,
    };
  }
  const items = userEquipment.map(normEquip);
  const has = (...terms: string[]) => items.some((it) => terms.some((t) => it.includes(t)));

  const fullGym = has("academia completa");
  const rack = fullGym || has("rack");
  const barbellItem = fullGym || has("barra olimpica", "barra longa", "barbell");
  const dumbbell = fullGym || has("halter", "dumbbell");
  const cable = fullGym || has("cabos", "cable");
  const pullUpBar = fullGym || has("barra fixa", "pull-up", "pull up", "argolas");
  const bench = fullGym || has("banco");
  const legPress = fullGym || has("leg press");
  const hackSquat = fullGym || has("hack squat");
  const smith = fullGym || has("smith");
  const legExtension = fullGym || has("cadeira extensora", "leg extension");
  const legCurl = fullGym || has("mesa flexora", "hamstring curl", "leg curl");
  const sled = has("treno", "sled");
  const anyMachine =
    fullGym ||
    legPress ||
    hackSquat ||
    smith ||
    legExtension ||
    legCurl ||
    cable ||
    has("maquina", "machine", "pec deck");

  return {
    // barra olímpica só é "usável" se houver rack ou smith p/ agachamento seguro.
    barbell: barbellItem && (rack || smith),
    dumbbell,
    cable,
    machine: anyMachine,
    sled,
    rack,
    pullUpBar,
    bench,
    legPress,
    hackSquat,
    smith,
    legCurl,
    legExtension,
  };
}

/** Códigos do pool que exigem equipamento específico além da categoria. */
const EQUIPMENT_CODE_GATES: Record<string, (a: EquipmentAvailability) => boolean> = {
  leg_press: (a) => a.legPress,
  leg_press_45: (a) => a.legPress,
  "45_degree_leg_press": (a) => a.legPress,
  hack_squat_machine: (a) => a.hackSquat,
  smith_squat: (a) => a.smith,
  back_squat: (a) => a.rack || a.smith,
  front_squat: (a) => a.rack || a.smith,
  pull_up: (a) => a.pullUpBar,
  scapular_pull_up: (a) => a.pullUpBar,
  assisted_pull_up: (a) => a.machine && a.pullUpBar,
  leg_extension: (a) => a.legExtension,
  hamstring_curl: (a) => a.legCurl,
  seated_hamstring_curl: (a) => a.legCurl,
  incline_db_press: (a) => a.dumbbell && a.bench,
  incline_db_press_neutral_grip: (a) => a.dumbbell && a.bench,
  incline_db_curl: (a) => a.dumbbell && a.bench,
  bench_dip: (a) => a.bench,
  incline_bench_press: (a) => a.barbell && a.bench,
};

export function filterPoolByEquipment(
  pool: ExerciseRow[],
  userEquipment?: string[],
): ExerciseRow[] {
  const avail = resolveEquipmentAvailability(userEquipment);
  return pool.filter((e) => {
    const gate = EQUIPMENT_CODE_GATES[e.code];
    if (gate && !gate(avail)) return false;
    switch (e.equipment) {
      case "barbell":
        return avail.barbell;
      case "dumbbell":
        return avail.dumbbell;
      case "cable":
        return avail.cable;
      case "machine":
        return avail.machine;
      case "sled":
        return avail.sled;
      case "bodyweight":
        return true;
      default:
        return true;
    }
  });
}

// ============================================================
// Filtro de LESÕES / restrições — exclui exercícios incompatíveis.
// Mapeia regiões de dor, lesões anteriores e movimentos desconfortáveis
// (pt-BR do onboarding) para padrões/categorias/códigos de risco.
// ============================================================
function norm(s: string): string {
  return s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

export function filterPoolByInjuries(
  pool: ExerciseRow[],
  profile: UserProfileInput,
): ExerciseRow[] {
  const pains = (profile.pain_regions ?? []).map(norm);
  const past = (profile.past_injuries ?? []).map(norm);
  const uncomf = (profile.uncomfortable_movements ?? []).map(norm);
  const all = [...pains, ...past, ...uncomf];
  if (all.length === 0) return pool;
  const hit = (...terms: string[]) => all.some((x) => terms.some((t) => x.includes(t)));

  // Categorias/padrões a excluir por lesão.
  const banCat = new Set<Category>();
  const banPattern = new Set<string>();
  const banCodeKw: string[] = [];

  // Joelho / LCA / menisco → fora saltos, agachamento livre e padrões de joelho.
  if (hit("joelho", "lca", "menisco", "patela")) {
    banCat.add("plyometric");
    banPattern.add("squat");
    banPattern.add("lunge");
    banCodeKw.push("squat", "lunge", "agachamento", "afundo", "jump", "salto", "box");
  }
  // Lombar / hérnia → fora hinge (terra/bom dia), remadas livres pesadas, saltos.
  if (hit("lombar", "hernia", "disco", "coluna")) {
    banCat.add("plyometric");
    banPattern.add("hinge");
    banCodeKw.push(
      "deadlift",
      "terra",
      "good_morning",
      "bom_dia",
      "bent_over",
      "barbell_row",
      "stiff",
    );
  }
  // Ombro / manguito → fora desenvolvimento acima da cabeça e instáveis de ombro.
  if (hit("ombro", "manguito", "rotador")) {
    banPattern.add("raise");
    banCodeKw.push(
      "overhead",
      "military",
      "desenvolvimento",
      "arnold",
      "snatch",
      "jerk",
      "behind_neck",
      "upright",
    );
  }
  // Cotovelo / tendinite → reduz isolamento pesado de tríceps/bíceps.
  if (hit("cotovelo", "tendinite", "epicond")) {
    banCodeKw.push("skull", "testa", "french", "frances", "preacher");
  }
  // Punho → fora rosca de punho e pegadas extremas.
  if (hit("punho", "wrist")) {
    banCodeKw.push("wrist", "punho");
  }
  // Cervical/pescoço → fora encolhimento e remada alta.
  if (hit("pescoco", "cervical")) {
    banCat.add("trap");
    banCodeKw.push("shrug", "encolhimento", "upright");
  }
  // Tornozelo / pé / fascite → fora pliometria e panturrilha em pé com salto.
  if (hit("tornozelo", "pe ", "fascite", "plantar")) {
    banCat.add("plyometric");
    banCodeKw.push("jump", "salto", "box", "sprint");
  }
  // Movimentos desconfortáveis explícitos do onboarding.
  if (hit("acima da cabeca", "overhead")) {
    banCodeKw.push("overhead", "military", "desenvolvimento", "arnold");
  }
  if (hit("salto")) {
    banCat.add("plyometric");
    banCodeKw.push("jump", "box");
  }
  if (hit("agachamento")) {
    banPattern.add("squat");
    banCodeKw.push("squat", "agachamento");
  }
  if (hit("puxada")) {
    banCodeKw.push("pulldown", "pull_up", "puxada", "barra_fixa");
  }
  if (hit("empurrada")) {
    banPattern.add("push");
  }

  return pool.filter((e) => {
    if (banCat.has(e.category)) return false;
    if (e.movement_pattern && banPattern.has(e.movement_pattern)) return false;
    if (e.shoulder_safe === false && hit("ombro", "manguito", "rotador")) return false;
    const code = norm(e.code ?? "");
    const name = norm(e.name ?? "");
    if (banCodeKw.some((kw) => code.includes(kw) || name.includes(kw))) return false;
    return true;
  });
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

// Relabel da periodização por OBJETIVO. A timeline de 6 mesociclos (volume→
// intensidade) é mantida, mas os NOMES/objetivos refletem a meta do aluno —
// os labels base eram todos do programa híbrido/5K do Pedro.
const GOAL_PHASE_LABELS: Record<Goal, string[]> = {
  hypertrophy: [
    "Adaptação anatômica",
    "Acúmulo de volume",
    "Hipertrofia I",
    "Hipertrofia II",
    "Intensificação",
    "Realização / deload",
  ],
  fat_loss: [
    "Base metabólica",
    "Condicionamento",
    "Densidade I",
    "Densidade II",
    "Definição",
    "Manutenção",
  ],
  endurance: [
    "Base aeróbica",
    "Volume aeróbico",
    "Limiar I",
    "Limiar II",
    "VO2 / ritmo",
    "Pico / taper",
  ],
  hybrid: [
    "Adaptação estrutural",
    "Base metabólica",
    "Hipertrofia híbrida",
    "Força + intensidade",
    "Força + eficiência",
    "Pico de performance",
  ],
};
export function mesosForGoal(goal: Goal): MesoDef[] {
  const labels = GOAL_PHASE_LABELS[goal] ?? GOAL_PHASE_LABELS.hybrid;
  return MESOCYCLES.map((m, i) => ({
    ...m,
    name: labels[i] ?? m.name,
    macro_name: labels[i] ?? m.macro_name,
    objective: m.objective, // descrição da fase (genérica) — mantida
    macro_objective: labels[i] ?? m.macro_objective,
  }));
}
export function mesoForWeekGoal(week: number, goal: Goal): MesoDef {
  return mesosForGoal(goal).find((m) => week >= m.start_week && week <= m.end_week)!;
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

function assertRunProtocol(p: RunProtocolDef, week: number): RunProtocolDef {
  if ((p.blocks ?? 0) > 1 && !p.between_blocks_rest_seconds) {
    throw new Error(`Semana ${week}: descanso entre blocos obrigatório ausente.`);
  }
  if (
    (p.blocks ?? 0) > 0 &&
    (!p.intervals_per_block || !p.work_duration_seconds || !p.rest_duration_seconds)
  ) {
    throw new Error(`Semana ${week}: protocolo intervalado incompleto.`);
  }
  return p;
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
  return assertRunProtocol(applyGoalPace(map[meso.code], goal), week);
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
  return assertRunProtocol(applyGoalPace(map[meso.code], goal), week);
}

// ============================================================
// Exercise pool — categorias por dia A/B
// ============================================================
type Category =
  | "biceps"
  | "triceps"
  | "chest"
  | "lats"
  | "back"
  | "trap"
  | "shoulder"
  | "rotator_cuff"
  | "posterior_chain"
  | "anterior_chain"
  | "calf"
  | "core"
  | "plyometric";

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
  movement_pattern?: string | null;
  shoulder_safe?: boolean | null;
  lower_body_pattern?: string | null;
}

// ============================================================
// Seleção de exercício respeitando regras
// ============================================================
interface PickContext {
  week: number;
  experience: Experience;
  usedInWeek: Set<string>; // ids já usados na semana (não-core)
  usedInDay: Set<string>; // ids no dia
  mesoUsage: Map<string, number>; // count por exercise id no mesociclo (Regra de Ouro ≤2)
  rotationOffset: number;
}

function isAllowedForLevel(ex: ExerciseRow, lvl: Experience): boolean {
  if (lvl === "beginner") return ex.allowed_beginner;
  if (lvl === "intermediate") return ex.allowed_intermediate;
  return ex.allowed_advanced;
}

function filterPool(pool: ExerciseRow[], category: Category, ctx: PickContext): ExerciseRow[] {
  return pool.filter((e) => {
    if (e.category !== category) return false;
    // Proteção semântica: alguns exercícios podem estar catalogados em uma
    // musculatura vizinha, mas o padrão motor ainda é pull. Nunca entram em Push.
    if (category === "chest" && e.code === "db_pullover") return false;
    if (category === "shoulder" && e.code === "upright_row") return false;
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
// MOTOR v2 — Splits, esquemas e métodos por OBJETIVO + FREQUÊNCIA + NÍVEL
// A metodologia (categorias, volume, progressão, métodos) vem destas regras
// + do pool. A IA é só personalização. SEM estrutura fixa por usuário.
// ============================================================
interface DayBlueprint {
  label: string;
  categories: Category[];
}

// Blocos musculares reutilizáveis (ordem ~ execução: composto → isolado).
const BLK = {
  push: ["chest", "chest", "shoulder", "triceps"] as Category[],
  pull: ["back", "lats", "biceps", "trap"] as Category[],
  legs: ["anterior_chain", "posterior_chain", "anterior_chain", "calf"] as Category[],
  upper: ["chest", "back", "shoulder", "lats", "triceps", "biceps"] as Category[],
  lower: [
    "anterior_chain",
    "posterior_chain",
    "anterior_chain",
    "posterior_chain",
    "calf",
  ] as Category[],
  fullA: ["anterior_chain", "back", "chest", "posterior_chain", "biceps"] as Category[],
  fullB: ["posterior_chain", "chest", "back", "shoulder", "triceps"] as Category[],
  fullC: ["anterior_chain", "lats", "shoulder", "posterior_chain", "calf"] as Category[],
};

/** nº de exercícios principais por sessão conforme tempo disponível. */
function mainCountForTime(min?: number | null): number {
  if (!min) return 6;
  if (min <= 30) return 4;
  if (min <= 45) return 5;
  if (min <= 60) return 6;
  if (min <= 75) return 7;
  return 8;
}

/**
 * Split de força para UMA semana, dado objetivo + nível + nº de dias de força.
 * Cada frequência tem lógica própria (não é versão reduzida de 5 dias).
 */
function strengthSplit(goal: Goal, level: Experience, nDays: number): DayBlueprint[] {
  const adv = level !== "beginner";
  // fat_loss → full body metabólico em qualquer frequência (densidade > especialização)
  if (goal === "fat_loss") {
    const rot = [BLK.fullA, BLK.fullB, BLK.fullC];
    return Array.from({ length: nDays }, (_, i) => ({
      label: `Full Body ${String.fromCharCode(65 + (i % 3))}`,
      categories: rot[i % 3],
    }));
  }
  switch (nDays) {
    case 1:
    case 2:
      return Array.from({ length: nDays }, (_, i) => ({
        label: `Full Body ${String.fromCharCode(65 + i)}`,
        categories: i % 2 === 0 ? BLK.fullA : BLK.fullB,
      }));
    case 3:
      if (adv)
        return [
          { label: "Push", categories: BLK.push },
          { label: "Pull", categories: BLK.pull },
          { label: "Pernas", categories: BLK.legs },
        ];
      return [
        { label: "Full Body A", categories: BLK.fullA },
        { label: "Full Body B", categories: BLK.fullB },
        { label: "Full Body C", categories: BLK.fullC },
      ];
    case 4:
      return [
        { label: "Superior A", categories: BLK.upper },
        { label: "Inferior A", categories: BLK.lower },
        { label: "Superior B", categories: BLK.pull.concat(BLK.push) },
        { label: "Inferior B", categories: BLK.legs },
      ];
    case 5:
      return [
        { label: "Push", categories: BLK.push },
        { label: "Pull", categories: BLK.pull },
        { label: "Pernas", categories: BLK.legs },
        { label: "Superior", categories: BLK.upper },
        { label: "Inferior", categories: BLK.lower },
      ];
    default: // 6+
      return [
        { label: "Push A", categories: BLK.push },
        { label: "Pull A", categories: BLK.pull },
        { label: "Pernas A", categories: BLK.legs },
        { label: "Push B", categories: BLK.push },
        { label: "Pull B", categories: BLK.pull },
        { label: "Pernas B", categories: BLK.legs },
      ];
  }
}

/** Esquema de séries/reps/descanso/método por objetivo + nível + mesociclo. */
interface Scheme {
  sets: number;
  reps: string;
  rest: number;
  rpe: number;
  method: "straight" | "biset" | "triset";
}
function schemeFor(goal: Goal, level: Experience, week: number): Scheme {
  const meso = mesoForWeek(week);
  // método: gating por nível (iniciante nunca usa avançado)
  let method: Scheme["method"] = "straight";
  if (level === "intermediate" && week >= 9) method = "biset";
  if (level === "advanced") method = week >= 17 ? "triset" : "biset";

  if (goal === "fat_loss") {
    return {
      sets: 3,
      reps: "12-20",
      rest: 35,
      rpe: meso.rpe_target,
      method: level === "beginner" ? "straight" : "biset",
    };
  }
  if (goal === "hypertrophy") {
    const reps = week <= 8 ? "10-15" : week <= 24 ? "8-12" : "6-10";
    return { sets: level === "beginner" ? 3 : 4, reps, rest: 75, rpe: meso.rpe_target, method };
  }
  if (goal === "endurance") {
    return {
      sets: 3,
      reps: "12-15",
      rest: 45,
      rpe: Math.min(meso.rpe_target, 7.5),
      method: "straight",
    };
  }
  // hybrid → progressão de volume→intensidade da metodologia base
  const reps = meso.prescription.includes("x") ? meso.prescription.split("x")[1] : "8-12";
  const sets = parseInt(meso.prescription.split("x")[0], 10) || 3;
  return { sets, reps, rest: week <= 12 ? 45 : 60, rpe: meso.rpe_target, method };
}

/** Quantos dos N dias selecionados são corrida, conforme modo + objetivo. */
function runDaysCount(mode: RunningMode | null | undefined, goal: Goal, nDays: number): number {
  if (!mode || mode === "desabilitado") return 0;
  if (mode === "principal") return Math.max(1, Math.min(nDays - 1, Math.ceil(nDays * 0.6)));
  if (mode === "integrado") return Math.min(nDays - 1, Math.floor(nDays / 2));
  // opcional → 1 corrida sugerida (se houver pelo menos 2 dias)
  return nDays >= 2 ? 1 : 0;
}

// hash determinístico simples p/ variação por aluno (FNV-1a)
function seedNum(s?: string): number {
  if (!s) return 0;
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
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
  /** true = exercício de core (apêndice fixo do motor). Camadas de coach não
   *  mexem em core — só em mains/acessórios. Não é persistido no banco. */
  is_core?: boolean;
}

export interface GeneratedDay {
  day_number: number; // 1..7 (Mon=1)
  day_name: string;
  session_type: "full_body" | "run_upper" | "run" | "rest";
  emphasis: "fb_pull_posterior" | "fb_push_anterior" | "run_push" | "run_pull";
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

/** Mapeia dia 1..7 para nome pt-BR. */
const PT_DAY_NAMES = ["", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

/** Distribuição flexível baseada no onboarding.
 *  - Respeita exatamente os dias selecionados pelo usuário (1=Seg ... 7=Dom).
 *  - Se o usuário NÃO quer corrida → todos os dias são Full Body.
 *  - Se quer corrida → alterna FB / Run a partir do 1º dia (FB, Run, FB, Run, ...).
 *    Com 3 dias, fica FB, Run, FB (1 corrida); com 5 dias, FB,Run,FB,Run,FB. */
export function activeDays(
  profile: UserProfileInput,
): { num: number; name: string; kind: "fb" | "run" }[] {
  let nums = (profile.selected_days ?? []).filter((n) => Number.isInteger(n) && n >= 1 && n <= 7);
  nums = [...new Set(nums)].sort((a, b) => a - b);
  if (nums.length === 0) {
    const n = Math.min(7, Math.max(1, profile.available_days || 5));
    nums = Array.from({ length: n }, (_, i) => i + 1);
  }
  // Quantas corridas, conforme modo + objetivo (não mais idx%2 fixo).
  const nRun = runDaysCount(profile.running_mode, profile.goal, nums.length);
  // Espalha as corridas de forma intercalada entre os dias selecionados.
  const runPositions = new Set<number>();
  if (nRun > 0) {
    const step = nums.length / nRun;
    for (let i = 0; i < nRun; i++)
      runPositions.add(
        Math.min(nums.length - 1, Math.round(i * step) + (nRun < nums.length ? 1 : 0)),
      );
  }
  return nums.map((num, idx) => ({
    num,
    name: PT_DAY_NAMES[num] ?? `Dia ${num}`,
    kind: (runPositions.has(idx) ? "run" : "fb") as "fb" | "run",
  }));
}

// Validação permissiva: garante apenas que os dias selecionados existem e que
// dias de corrida têm protocolo. A ESTRUTURA (split/ênfase) agora é dinâmica
// por objetivo/frequência/nível — não há mais um único padrão "correto".
function validateWeekDistribution(
  week: GeneratedWeek,
  expected: { num: number; kind: "fb" | "run" }[],
): void {
  const dayByNumber = new Map(week.days.map((day) => [day.day_number, day]));
  for (const exp of expected) {
    const day = dayByNumber.get(exp.num);
    if (!day)
      throw new Error(
        `Distribuição inválida na semana ${week.week_number}: dia ${exp.num} ausente.`,
      );
    if (exp.kind === "run" && !day.running) {
      throw new Error(
        `Distribuição inválida na semana ${week.week_number}: dia ${exp.num} deveria ter corrida.`,
      );
    }
    if ((day.exercises?.length ?? 0) === 0 && !day.running) {
      throw new Error(
        `Distribuição inválida na semana ${week.week_number}: dia ${exp.num} sem exercícios.`,
      );
    }
  }
}

function validatePlanDistribution(
  plan: GenerationResult,
  expected: { num: number; kind: "fb" | "run" }[],
): void {
  for (const week of plan.weeks) validateWeekDistribution(week, expected);
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
export function generatePlan(
  profile: UserProfileInput,
  exercisePool: ExerciseRow[],
): GenerationResult {
  const vref = calcReferenceVelocity(profile);
  const days = activeDays(profile);
  // 1) filtra por equipamento, 2) exclui exercícios incompatíveis com lesões.
  // Fallback seguro em cada etapa pra nunca zerar o pool.
  const eqPool = filterPoolByEquipment(exercisePool, profile.available_equipment);
  const baseEq = eqPool.length > 0 ? eqPool : exercisePool;
  const injPool = filterPoolByInjuries(baseEq, profile);
  const pool = injPool.length > 0 ? injPool : baseEq;
  const weeks: GeneratedWeek[] = [];

  // Variação determinística por aluno: dois perfis iguais geram programas
  // diferentes (offset de rotação semeado pelo userId).
  let globalOffset = seedNum(profile.seed);
  let currentMeso = "";
  let mesoUsage = new Map<string, number>();

  // Split de força para a frequência REAL de musculação do usuário (lógica
  // própria por nº de dias — não é versão reduzida de 5 dias).
  const nStrength = days.filter((d) => d.kind === "fb").length || 1;
  const split = strengthSplit(profile.goal, profile.experience_level, nStrength);
  const mainCount = mainCountForTime(profile.available_minutes);
  const goalMesos = mesosForGoal(profile.goal);

  for (let w = 1; w <= 48; w++) {
    const meso = goalMesos.find((m) => w >= m.start_week && w <= m.end_week)!;
    if (meso.code !== currentMeso) {
      currentMeso = meso.code;
      mesoUsage = new Map();
    }
    const scheme = schemeFor(profile.goal, profile.experience_level, w);
    const usedInWeek = new Set<string>();
    const dayPlans: GeneratedDay[] = [];
    let strengthIdx = 0;
    let calfCount = 0;

    for (const d of days) {
      const usedInDay = new Set<string>();
      const exercises: SessionExerciseRow[] = [];

      if (d.kind === "fb") {
        const bp = split[strengthIdx % split.length];
        strengthIdx += 1;
        // categorias do dia: principais (ajustadas ao tempo) + 2 core
        let cats = bp.categories.slice();
        if (cats.length > mainCount) cats = cats.slice(0, mainCount);
        let k = 0;
        while (cats.length < mainCount && bp.categories.length > 0) {
          cats.push(bp.categories[k % bp.categories.length]);
          k += 1;
        }
        const dayCats: Category[] = [...cats, "core", "core"];

        const groupSize = scheme.method === "triset" ? 3 : scheme.method === "biset" ? 2 : 1;
        let slot = 1,
          pairCounter = 0,
          inGroup = 0,
          curPair: number | null = null;
        for (const rawCat of dayCats) {
          let category = rawCat;
          if (category === "calf" && calfCount >= 3) category = "core";
          const isCore = category === "core";
          const ex = pickExercise(
            pool,
            category,
            {
              week: w,
              experience: profile.experience_level,
              usedInDay,
              usedInWeek,
              mesoUsage,
              rotationOffset: globalOffset++,
            },
            isCore,
          );
          if (!ex) continue;
          if (category === "calf") calfCount += 1;
          if (!isCore) usedInWeek.add(ex.id);
          usedInDay.add(ex.id);
          mesoUsage.set(ex.id, (mesoUsage.get(ex.id) ?? 0) + 1);

          let pair_slot: number | null = null;
          if (!isCore && groupSize > 1) {
            if (inGroup === 0) {
              pairCounter += 1;
              curPair = pairCounter;
            }
            pair_slot = curPair;
            inGroup = (inGroup + 1) % groupSize;
          }
          exercises.push({
            slot,
            pair_slot,
            exercise_id: ex.id,
            sets: isCore ? 3 : scheme.sets,
            reps: isCore ? "12-15" : scheme.reps,
            rpe_target: scheme.rpe,
            rest_seconds: isCore ? 30 : scheme.rest,
            notes: null,
            is_core: isCore,
          });
          slot += 1;
        }

        dayPlans.push({
          day_number: d.num,
          day_name: d.name,
          session_type: "full_body",
          emphasis: strengthIdx % 2 === 1 ? "fb_pull_posterior" : "fb_push_anterior",
          objective: `${bp.label} · ${meso.objective}${scheme.method !== "straight" ? ` · ${scheme.method === "triset" ? "Trisets" : "Bisets"}` : ""}`,
          duration_minutes: profile.available_minutes ?? 55,
          exercises,
        });
      } else {
        // Dia de corrida: protocolo selecionado por objetivo + acessório curto opcional.
        const runIndex = days.filter((x) => x.kind === "run" && x.num <= d.num).length - 1;
        const running =
          runIndex % 2 === 0 ? tuesdayProtocol(w, profile.goal) : thursdayProtocol(w, profile.goal);
        const accessory =
          (profile.available_minutes ?? 60) >= 45 && profile.running_mode !== "principal";
        let slot = 1;
        if (accessory) {
          const seq: Category[] =
            runIndex % 2 === 0
              ? ["chest", "shoulder", "triceps", "core"]
              : ["back", "lats", "biceps", "core"];
          for (const category of seq) {
            const isCore = category === "core";
            const ex = pickExercise(
              pool,
              category,
              {
                week: w,
                experience: profile.experience_level,
                usedInDay,
                usedInWeek,
                mesoUsage,
                rotationOffset: globalOffset++,
              },
              isCore,
            );
            if (!ex) continue;
            if (!isCore) usedInWeek.add(ex.id);
            usedInDay.add(ex.id);
            mesoUsage.set(ex.id, (mesoUsage.get(ex.id) ?? 0) + 1);
            exercises.push({
              slot,
              pair_slot: null,
              exercise_id: ex.id,
              sets: 3,
              reps: isCore ? "12" : "10-12",
              rpe_target: scheme.rpe,
              rest_seconds: 45,
              notes: null,
              is_core: isCore,
            });
            slot += 1;
          }
        }
        dayPlans.push({
          day_number: d.num,
          day_name: d.name,
          session_type: "run_upper",
          emphasis: runIndex % 2 === 0 ? "run_push" : "run_pull",
          objective: `Corrida ${running.protocol_type.toUpperCase()}${accessory ? " + acessório superior" : ""}`,
          duration_minutes: running.total_duration_minutes + (accessory ? 25 : 0),
          exercises,
          running,
        });
      }
    }

    const generatedWeek: GeneratedWeek = {
      week_number: w,
      week_type: w % 2 === 1 ? "A" : "B",
      mesocycle_code: meso.code,
      days: dayPlans,
    };
    validateWeekDistribution(
      generatedWeek,
      days.map((d) => ({ num: d.num, kind: d.kind })),
    );
    weeks.push(generatedWeek);
  }

  return { total_weeks: 48, reference_velocity: vref, weeks, mesos: goalMesos };
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
  // Coach Layer (Hybrid V3): se o usuário "contratou" um coach (is_primary),
  // aplica o Methodology Pack dele SOBRE o plano do motor. Opt-in: sem coach
  // primário, o programa é o motor puro (retrocompatível). Choke point único —
  // cobre todas as rotas de geração de uma vez.
  try {
    const { data: uac } = await supabase
      .from("user_ai_coaches")
      .select("ai_coaches(persona)")
      .eq("user_id", userId)
      .eq("is_primary", true)
      .maybeSingle();
    const persona = (uac as { ai_coaches?: { persona?: string } } | null)?.ai_coaches?.persona;
    const pack = getCoachPackByPersona(persona);
    if (pack) {
      const r = applyCoachLayer(plan, pack, profile);
      plan = r.plan;
      console.info("[coach-layer]", JSON.stringify(r.audit));
    }
  } catch (e) {
    // Coach layer nunca derruba a geração — degrada para o motor puro.
    console.warn("[coach-layer] falhou, usando motor puro:", e);
  }

  // Guardrail: a estrutura (dias/corrida) tem que continuar válida após o coach.
  validatePlanDistribution(
    plan,
    activeDays(profile).map((d) => ({ num: d.num, kind: d.kind })),
  );

  // Persistência transacional (#10): cria o novo programa como DRAFT
  // (archived_at = agora → ainda NÃO ativo). NÃO arquivamos o antigo aqui.
  // Inserimos todos os filhos e só então ativamos atomicamente (RPC
  // activate_program). Se a montagem falhar no meio, apagamos o draft (cascade)
  // e o programa ANTIGO segue ativo — o usuário nunca fica sem programa.
  const draftIso = new Date().toISOString();
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
      archived_at: draftIso, // draft até a ativação atômica no fim
    })
    .select("id")
    .single();
  if (pErr) serverError("Não foi possível concluir a operação. Tente novamente.", pErr);
  const programId = prog.id as string;

  // A partir daqui qualquer falha apaga o draft e preserva o programa antigo.
  try {
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
      if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
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
      if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
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
  } catch (e) {
    // Falha na montagem → remove o draft (cascade apaga macro/meso/weeks/days/
    // exercises) e mantém o programa ANTIGO ativo. Propaga o erro.
    await supabase.from("training_programs").delete().eq("id", programId);
    throw e;
  }

  // Ativação ATÔMICA: arquiva os antigos + ativa o novo numa transação (RPC).
  const { error: actErr } = await supabase.rpc("activate_program", { p_program_id: programId });
  if (actErr) {
    await supabase.from("training_programs").delete().eq("id", programId);
    throw new Error(`activate_program: ${actErr.message}`);
  }

  return { program_id: programId };
}

// ============================================================
// Loader do pool — leitura do exercise_pool
// ============================================================
export async function loadExercisePool(supabase: DB): Promise<ExerciseRow[]> {
  const { data, error } = await supabase
    .from("exercise_pool")
    .select(
      "id, code, name, category, equipment, allowed_beginner, allowed_intermediate, allowed_advanced, banned_weeks_1_to_12, movement_pattern, shoulder_safe, lower_body_pattern",
    );
  if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
  return (data ?? []) as ExerciseRow[];
}
