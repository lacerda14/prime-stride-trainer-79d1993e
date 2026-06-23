// Motor de Autorregulação — puro, server-side
// Combina feedback subjetivo + cargas + performance + histórico.
// NUNCA altera estrutura semanal, Push/Pull ou periodização — só sugere
// ajustes de carga, séries acessórias e descansos.

export type SessionFeedback = "muito_leve" | "leve" | "ideal" | "pesado" | "muito_pesado";

export interface SetLogForEngine {
  planned_reps: string | null;
  actual_reps: number | null;
  planned_load_kg: number | null;
  actual_load_kg: number | null;
  set_status?: "completed" | "failed" | "skipped" | null;
}

export interface SessionForEngine {
  id: string;
  feedback: SessionFeedback | null;
  sets: SetLogForEngine[];
  pr_count?: number;
  created_at: string; // ISO
}

export interface ReadinessSignals {
  feedback_score: number;
  load_delta_pct: number;
  rep_delta_pct: number;
  completion_rate: number;
  failure_rate: number;
  pr_count: number;
  trend_load_4w: number; // slope normalizado [-1..+1]
  trend_failure_4w: number;
  consistency_4w: number; // 0..1
}

export interface Decision {
  load_adjust_pct: number; // ex.: +0.05 = +5%
  accessory_volume_adjust: number; // séries +/-
  deload_recommended: boolean;
  monitor_only: boolean;
  message: string;
}

export interface ReadinessResult {
  score: number; // 0..100
  signals: ReadinessSignals;
  decision: Decision;
}

const FEEDBACK_MAP: Record<SessionFeedback, number> = {
  muito_leve: -2,
  leve: -1,
  ideal: 0,
  pesado: 1,
  muito_pesado: 2,
};

function repsMin(planned: string | null): number {
  if (!planned) return 0;
  const m = String(planned).match(/\d+/);
  return m ? Number(m[0]) : 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function linearSlope(values: number[]): number {
  if (values.length < 2) return 0;
  const n = values.length;
  const xMean = (n - 1) / 2;
  const yMean = values.reduce((a, b) => a + b, 0) / n;
  let num = 0,
    den = 0;
  for (let i = 0; i < n; i++) {
    num += (i - xMean) * (values[i] - yMean);
    den += (i - xMean) ** 2;
  }
  if (den === 0) return 0;
  const slope = num / den;
  // normaliza por média
  return yMean !== 0 ? clamp(slope / Math.abs(yMean), -1, 1) : 0;
}

// ----------------------------------------------------------
// Métricas por sessão
// ----------------------------------------------------------
function sessionSignals(s: SessionForEngine) {
  let loadDeltaSum = 0;
  let loadDeltaCount = 0;
  let repDeltaSum = 0;
  let repDeltaCount = 0;
  let completed = 0;
  let failed = 0;
  let total = 0;

  for (const set of s.sets) {
    total++;
    const status = set.set_status ?? "completed";
    if (status === "completed") completed++;
    if (status === "failed") failed++;

    if (set.planned_load_kg && set.planned_load_kg > 0 && set.actual_load_kg != null) {
      loadDeltaSum += (set.actual_load_kg - set.planned_load_kg) / set.planned_load_kg;
      loadDeltaCount++;
    }
    const plannedReps = repsMin(set.planned_reps);
    if (plannedReps > 0 && set.actual_reps != null) {
      repDeltaSum += (set.actual_reps - plannedReps) / plannedReps;
      repDeltaCount++;
    }
  }

  return {
    load_delta_pct: loadDeltaCount > 0 ? loadDeltaSum / loadDeltaCount : 0,
    rep_delta_pct: repDeltaCount > 0 ? repDeltaSum / repDeltaCount : 0,
    completion_rate: total > 0 ? completed / total : 0,
    failure_rate: total > 0 ? failed / total : 0,
    feedback_score: s.feedback ? FEEDBACK_MAP[s.feedback] : 0,
    pr_count: s.pr_count ?? 0,
  };
}

// ----------------------------------------------------------
// API principal
// ----------------------------------------------------------
export function computeReadiness(
  current: SessionForEngine,
  history4w: SessionForEngine[], // últimas ~12 sessões (4 sem * 3/sem)
  scheduledSessions4w: number, // sessões planejadas nos últimos 28 dias
): ReadinessResult {
  const cur = sessionSignals(current);

  // Tendências
  const historical = history4w
    .slice()
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));

  const loadSeries: number[] = [];
  const failureSeries: number[] = [];
  for (const h of historical) {
    const sig = sessionSignals(h);
    const avgLoad = h.sets.map((x) => x.actual_load_kg ?? 0).filter((v) => v > 0);
    if (avgLoad.length) loadSeries.push(avgLoad.reduce((a, b) => a + b, 0) / avgLoad.length);
    failureSeries.push(sig.failure_rate);
  }

  const trend_load_4w = linearSlope(loadSeries);
  const trend_failure_4w = linearSlope(failureSeries);
  const consistency_4w =
    scheduledSessions4w > 0 ? clamp(historical.length / scheduledSessions4w, 0, 1) : 0;

  const signals: ReadinessSignals = {
    ...cur,
    trend_load_4w,
    trend_failure_4w,
    consistency_4w,
  };

  // Score 0..100
  const raw =
    50 +
    15 * Math.sign(trend_load_4w) -
    25 * cur.failure_rate +
    10 * (cur.completion_rate - 0.8) * 5 -
    8 * Math.max(0, cur.feedback_score) +
    5 * cur.pr_count +
    10 * (consistency_4w - 0.7) * 3;

  const score = Math.round(clamp(raw, 0, 100));

  // Decisão
  const decision = decide(signals);

  return { score, signals, decision };
}

function decide(s: ReadinessSignals): Decision {
  // Exemplo 1: usuário diz "muito pesado" mas performou bem
  if (
    s.feedback_score >= 2 &&
    s.pr_count > 0 &&
    s.completion_rate >= 0.95 &&
    s.load_delta_pct > 0
  ) {
    return {
      load_adjust_pct: 0,
      accessory_volume_adjust: 0,
      deload_recommended: false,
      monitor_only: true,
      message:
        "Você relatou pesado mas bateu PR e completou tudo. Vamos monitorar antes de reduzir.",
    };
  }

  // Exemplo 2: "ideal" mas falhou + reduziu
  if (s.feedback_score <= 0 && s.failure_rate > 0.3 && s.load_delta_pct < 0) {
    return {
      load_adjust_pct: -0.05,
      accessory_volume_adjust: -1,
      deload_recommended: false,
      monitor_only: false,
      message: "Muitas séries falharam. Reduzindo 5% na carga e 1 série acessória para recuperar.",
    };
  }

  // Exemplo 3: "muito leve" + superou cargas + sem falhas
  if (s.feedback_score <= -2 && s.load_delta_pct > 0 && s.failure_rate === 0) {
    return {
      load_adjust_pct: +0.05,
      accessory_volume_adjust: +1,
      deload_recommended: false,
      monitor_only: false,
      message:
        "Você passou por cima do planejado. Subindo 5% na carga e adicionando 1 série acessória.",
    };
  }

  // Deload por sobrecarga acumulada
  if (s.trend_failure_4w > 0.2 && s.failure_rate > 0.25) {
    return {
      load_adjust_pct: -0.1,
      accessory_volume_adjust: -2,
      deload_recommended: true,
      monitor_only: false,
      message:
        "Sinais de fadiga acumulada. Sugerimos uma semana de deload (-10% carga, -2 séries).",
    };
  }

  // Microprogressão (estagnação leve)
  if (Math.abs(s.trend_load_4w) < 0.02 && s.feedback_score <= 0 && s.failure_rate < 0.15) {
    return {
      load_adjust_pct: +0.025,
      accessory_volume_adjust: 0,
      deload_recommended: false,
      monitor_only: false,
      message: "Estagnação leve detectada. Microprogressão de +2,5% para destravar.",
    };
  }

  return {
    load_adjust_pct: 0,
    accessory_volume_adjust: 0,
    deload_recommended: false,
    monitor_only: false,
    message: "Tudo dentro do esperado. Mantenha a prescrição.",
  };
}
