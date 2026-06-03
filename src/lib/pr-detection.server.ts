// ============================================================
// PR Detection — server-only helpers
// ============================================================
// Lista fechada de exercícios oficiais de PR.
// Apenas estes 6 levantamentos geram registro em personal_records.

export const STRENGTH_PR_LIFTS: Record<string, { code: string; label: string; metric: "weight_load" | "reps" }> = {
  // back squat — código no exercise_pool
  back_squat: { code: "back_squat", label: "Back Squat", metric: "weight_load" },
  front_squat: { code: "front_squat", label: "Front Squat", metric: "weight_load" },
  deadlift: { code: "deadlift", label: "Deadlift", metric: "weight_load" },
  barbell_bench_press: { code: "bench_press", label: "Bench Press", metric: "weight_load" },
  overhead_press: { code: "strict_military_press", label: "Strict Military Press", metric: "weight_load" },
  // bodyweight reps
  pull_up: { code: "strict_pull_up", label: "Strict Pull-Up", metric: "reps" },
};

// Códigos canônicos de PR (usados em personal_records.exercise_code)
export const PR_EXERCISE_CODES = {
  back_squat: { label: "Back Squat", category: "strength", metric: "weight_load" },
  front_squat: { label: "Front Squat", category: "strength", metric: "weight_load" },
  deadlift: { label: "Deadlift", category: "strength", metric: "weight_load" },
  bench_press: { label: "Bench Press", category: "strength", metric: "weight_load" },
  strict_military_press: { label: "Strict Military Press", category: "strength", metric: "weight_load" },
  strict_pull_up: { label: "Strict Pull-Up", category: "strength", metric: "reps" },
  run_5k: { label: "Melhor 5km", category: "running", metric: "time_seconds" },
  run_1k: { label: "Melhor 1km", category: "running", metric: "time_seconds" },
  best_pace: { label: "Melhor Pace", category: "running", metric: "pace_seconds_km" },
  distance_30min: { label: "Distância em 30min", category: "running", metric: "distance_km" },
} as const;

export type PRExerciseCode = keyof typeof PR_EXERCISE_CODES;

// Epley 1RM: load × (1 + reps/30)
export function epley1RM(load: number, reps: number): number {
  if (!load || !reps) return 0;
  if (reps === 1) return load;
  return Math.round(load * (1 + reps / 30) * 10) / 10;
}

export interface CandidatePR {
  exercise_code: PRExerciseCode;
  category: "strength" | "running";
  metric_type: "weight_load" | "reps" | "time_seconds" | "distance_km" | "pace_seconds_km";
  value: number;
  secondary_value: number | null;
  estimated_1rm: number | null;
  source_session_id: string | null;
}

// Decide se candidato é melhor que PR atual
export function isImprovement(
  candidate: CandidatePR,
  current: { value: number; estimated_1rm: number | null } | null,
): boolean {
  if (!current) return true;
  // Tempo e pace: menor é melhor
  if (candidate.metric_type === "time_seconds" || candidate.metric_type === "pace_seconds_km") {
    return candidate.value < current.value;
  }
  // weight_load: compara 1RM estimado
  if (candidate.metric_type === "weight_load" && candidate.estimated_1rm != null && current.estimated_1rm != null) {
    return candidate.estimated_1rm > current.estimated_1rm;
  }
  // reps, distance: maior é melhor
  return candidate.value > current.value;
}

export function improvementPct(current: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
