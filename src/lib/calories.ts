// ============================================================
// Estimativa simples de calorias por treino
// Fórmula: calorias = MET × peso_kg × duração_horas
// ============================================================

export type SessionKind = "strength" | "run" | "hybrid";

export interface CalorieInput {
  weight_kg: number | null | undefined;
  duration_seconds: number;
  has_run: boolean;
  strength_set_count: number;
  perceived_effort?: number | null; // 1..10
  avg_speed_kmh?: number | null;
  running_seconds?: number | null;
}

/** MET para corrida pela velocidade (km/h) — Compendium of Physical Activities (aprox.) */
function metForRun(kmh: number): number {
  if (kmh <= 0) return 3.5;
  if (kmh < 6) return 6.0;          // jog leve
  if (kmh < 8) return 8.3;          // ~7,5 min/km
  if (kmh < 9.7) return 9.8;        // ~6:30 min/km
  if (kmh < 11.3) return 11.0;      // ~5:30 min/km
  if (kmh < 12.9) return 11.8;
  if (kmh < 14.5) return 12.8;
  return 14.5;
}

/** MET musculação por esforço percebido */
function metForStrength(effort?: number | null): number {
  if (!effort) return 4.5;
  if (effort >= 8) return 6.0;       // intenso
  if (effort >= 5) return 5.0;       // moderado
  return 3.5;                        // leve
}

export function estimateCalories(input: CalorieInput): number {
  const weight = Math.max(40, Math.min(200, input.weight_kg ?? 75));
  const totalHours = Math.max(0, input.duration_seconds) / 3600;
  if (totalHours <= 0) return 0;

  // se temos uma corrida separada com tempo conhecido, divide o tempo
  const runSec = Math.max(0, input.running_seconds ?? 0);
  const strengthSec = Math.max(0, input.duration_seconds - runSec);

  const runHours = runSec / 3600;
  const strengthHours = strengthSec / 3600;

  const runMet = input.has_run ? metForRun(input.avg_speed_kmh ?? 8.5) : 0;
  const strMet = metForStrength(input.perceived_effort ?? null);

  const runCal = runMet * weight * runHours;
  const strCal = strMet * weight * strengthHours;

  return Math.round(runCal + strCal);
}
