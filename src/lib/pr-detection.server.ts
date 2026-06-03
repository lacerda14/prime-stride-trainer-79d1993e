// ============================================================
// PR Detection — server-only helpers
// ============================================================
// Lista fechada de exercícios oficiais de PR.

export const STRENGTH_PR_LIFTS: Record<string, { code: string; label: string; metric: "weight_load" | "reps" }> = {
  back_squat: { code: "back_squat", label: "Back Squat", metric: "weight_load" },
  front_squat: { code: "front_squat", label: "Front Squat", metric: "weight_load" },
  deadlift: { code: "deadlift", label: "Deadlift", metric: "weight_load" },
  barbell_bench_press: { code: "bench_press", label: "Bench Press", metric: "weight_load" },
  overhead_press: { code: "strict_military_press", label: "Strict Military Press", metric: "weight_load" },
  pull_up: { code: "strict_pull_up", label: "Strict Pull-Up", metric: "reps" },
};

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

export function isImprovement(
  candidate: CandidatePR,
  current: { value: number; estimated_1rm: number | null } | null,
): boolean {
  if (!current) return true;
  if (candidate.metric_type === "time_seconds" || candidate.metric_type === "pace_seconds_km") {
    return candidate.value < current.value;
  }
  if (candidate.metric_type === "weight_load" && candidate.estimated_1rm != null && current.estimated_1rm != null) {
    return candidate.estimated_1rm > current.estimated_1rm;
  }
  return candidate.value > current.value;
}

export function improvementPct(current: number, previous: number): number {
  if (!previous) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// ============================================================
// Core detection — chamado de servidor (workout-session + personal-records fn)
// ============================================================

// Tipo mínimo do supabase client (estrutural, evita import circular)
interface SupabaseLike {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  from: (table: string) => any;
}

export interface PRDetectedItem {
  exercise_code: PRExerciseCode;
  label: string;
  value: number;
  estimated_1rm: number | null;
  previous_value: number | null;
  improvement_pct: number | null;
}

export interface PRDetectionRunResult {
  newPRs: PRDetectedItem[];
  xpGained: number;
}

export async function runPRDetectionForSession(
  supabase: SupabaseLike,
  userId: string,
  sessionId: string,
): Promise<PRDetectionRunResult> {
  // 1) set logs
  const { data: logs } = await supabase
    .from("workout_set_logs")
    .select("exercise_id, exercise_name, actual_load_kg, actual_reps")
    .eq("user_id", userId)
    .eq("workout_session_id", sessionId)
    .not("actual_reps", "is", null);
  if (!logs || logs.length === 0) return { newPRs: [], xpGained: 0 };

  // 2) pool ids -> codes
  const exerciseIds = [
    ...new Set(
      (logs as Array<{ exercise_id: string | null }>)
        .map((l) => l.exercise_id)
        .filter((x): x is string => !!x),
    ),
  ];
  let poolMap = new Map<string, string>();
  if (exerciseIds.length > 0) {
    const { data: pool } = await supabase
      .from("exercise_pool")
      .select("id, code")
      .in("id", exerciseIds);
    poolMap = new Map(
      ((pool ?? []) as Array<{ id: string; code: string }>).map((p) => [p.id, p.code]),
    );
  }

  // 3) candidatos por lift
  const candidates = new Map<PRExerciseCode, CandidatePR>();
  for (const log of logs as Array<{
    exercise_id: string | null;
    actual_load_kg: number | null;
    actual_reps: number | null;
  }>) {
    const poolCode = log.exercise_id ? poolMap.get(log.exercise_id) : null;
    if (!poolCode) continue;
    const lift = STRENGTH_PR_LIFTS[poolCode];
    if (!lift) continue;

    const reps = Number(log.actual_reps);
    const load = log.actual_load_kg != null ? Number(log.actual_load_kg) : 0;
    if (!reps || reps <= 0) continue;

    const code = lift.code as PRExerciseCode;

    if (lift.metric === "weight_load") {
      if (load <= 0) continue;
      const oneRM = epley1RM(load, reps);
      const existing = candidates.get(code);
      if (!existing || (existing.estimated_1rm ?? 0) < oneRM) {
        candidates.set(code, {
          exercise_code: code,
          category: "strength",
          metric_type: "weight_load",
          value: load,
          secondary_value: reps,
          estimated_1rm: oneRM,
          source_session_id: sessionId,
        });
      }
    } else {
      const existing = candidates.get(code);
      if (!existing || existing.value < reps) {
        candidates.set(code, {
          exercise_code: code,
          category: "strength",
          metric_type: "reps",
          value: reps,
          secondary_value: null,
          estimated_1rm: null,
          source_session_id: sessionId,
        });
      }
    }
  }

  if (candidates.size === 0) return { newPRs: [], xpGained: 0 };

  // 4) compara com atual
  const codes = [...candidates.keys()];
  const { data: currentRows } = await supabase
    .from("personal_records")
    .select("exercise_code, value, estimated_1rm")
    .eq("user_id", userId)
    .in("exercise_code", codes);
  const currentMap = new Map(
    ((currentRows ?? []) as Array<{ exercise_code: string; value: number; estimated_1rm: number | null }>).map((r) => [
      r.exercise_code as PRExerciseCode,
      { value: Number(r.value), estimated_1rm: r.estimated_1rm != null ? Number(r.estimated_1rm) : null },
    ]),
  );

  const newPRs: PRDetectedItem[] = [];
  let totalXp = 0;

  for (const cand of candidates.values()) {
    const current = currentMap.get(cand.exercise_code) ?? null;
    if (!isImprovement(cand, current)) continue;

    const previousValue = current?.value ?? null;
    const improvement =
      previousValue != null && cand.metric_type === "weight_load" && cand.estimated_1rm && current?.estimated_1rm
        ? improvementPct(cand.estimated_1rm, current.estimated_1rm)
        : previousValue != null
          ? improvementPct(cand.value, previousValue)
          : null;

    await supabase.from("personal_records").upsert(
      {
        user_id: userId,
        exercise_code: cand.exercise_code,
        category: cand.category,
        metric_type: cand.metric_type,
        value: cand.value,
        secondary_value: cand.secondary_value,
        estimated_1rm: cand.estimated_1rm,
        previous_value: previousValue,
        source_session_id: cand.source_session_id,
        achieved_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise_code" },
    );

    await supabase.from("pr_history").insert({
      user_id: userId,
      exercise_code: cand.exercise_code,
      category: cand.category,
      metric_type: cand.metric_type,
      value: cand.value,
      secondary_value: cand.secondary_value,
      estimated_1rm: cand.estimated_1rm,
      previous_value: previousValue,
      improvement_pct: improvement,
      source_session_id: cand.source_session_id,
    });

    const xp = Math.min(300, 100 + Math.max(0, Math.round(improvement ?? 0)) * 5);
    await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: "pr_strength",
      xp_amount: xp,
      source_id: sessionId,
    });
    totalXp += xp;

    const meta = PR_EXERCISE_CODES[cand.exercise_code];
    newPRs.push({
      exercise_code: cand.exercise_code,
      label: meta?.label ?? cand.exercise_code,
      value: cand.value,
      estimated_1rm: cand.estimated_1rm,
      previous_value: previousValue,
      improvement_pct: improvement,
    });
  }

  return { newPRs, xpGained: totalXp };
}
