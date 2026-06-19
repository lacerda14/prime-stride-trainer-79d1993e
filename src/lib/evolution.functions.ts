import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface PRRow {
  exercise_name: string;
  load_kg: number;
  reps: number | null;
  achieved_at: string;
}

export interface WeightPoint {
  date: string; // YYYY-MM-DD
  weight_kg: number | null;
}

export interface EvolutionData {
  // Força: volume semanal (kg × reps) nos últimos 7 dias
  weeklyStrengthVolume: number | null;
  prevWeekStrengthVolume: number | null;
  strengthDeltaPct: number | null;
  // Consistência: % dias treinados nos últimos 30 dias
  consistencyPct: number | null;
  sessionsLast30: number;
  daysWithSession30: boolean[]; // 30 dias, índice 0 = hoje
  // Último peso corporal registrado
  lastWeightKg: number | null;
  lastWeightDate: string | null;
  // Mini histórico (últimos 6 registros) — mantido por compat
  weightHistory: { recorded_at: string; weight_kg: number }[];
  // Série diária de peso últimos 30 dias
  weight30d: WeightPoint[];
  // PRs completos
  personalRecords: PRRow[];
  // Medidas do perfil
  measures: {
    waist_cm: number | null;
    hip_cm: number | null;
    chest_cm: number | null;
    arm_cm: number | null;
    thigh_cm: number | null;
  };
}

export const getEvolutionData = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<EvolutionData> => {
    const { supabase, userId } = context;

    const now = Date.now();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [volumeRes, sessionsRes, weight30Res, profileRes, prSetsRes] = await Promise.all([
      // Volume últimos 14 dias (semana atual + anterior para comparação)
      supabase
        .from("workout_set_logs")
        .select("actual_load_kg, actual_reps, created_at")
        .eq("user_id", userId)
        .gte("created_at", fourteenDaysAgo)
        .not("actual_load_kg", "is", null)
        .not("actual_reps", "is", null),

      // Sessões concluídas últimos 30 dias
      supabase
        .from("workout_sessions")
        .select("id, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("completed_at", thirtyDaysAgo),

      // Pesos últimos 30 dias
      supabase
        .from("weight_history")
        .select("weight_kg, recorded_at")
        .eq("user_id", userId)
        .gte("recorded_at", thirtyDaysAgo)
        .order("recorded_at", { ascending: true }),

      // Medidas do perfil
      supabase
        .from("profiles")
        .select("waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, weight_kg, updated_at")
        .eq("id", userId)
        .maybeSingle(),

      // PRs: maior carga por exercício
      supabase
        .from("workout_set_logs")
        .select("exercise_name, actual_load_kg, actual_reps, created_at")
        .eq("user_id", userId)
        .not("actual_load_kg", "is", null)
        .gt("actual_load_kg", 0)
        .order("actual_load_kg", { ascending: false })
        .limit(1000),
    ]);

    // ── Volume: esta semana vs anterior ────────────────────────
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    let weekly = 0;
    let prev = 0;
    for (const row of volumeRes.data ?? []) {
      const t = new Date(row.created_at).getTime();
      const v = Number(row.actual_load_kg ?? 0) * Number(row.actual_reps ?? 0);
      if (t >= weekStart) weekly += v;
      else prev += v;
    }
    const weeklyStrengthVolume = weekly > 0 ? Math.round(weekly) : null;
    const prevWeekStrengthVolume = prev > 0 ? Math.round(prev) : null;
    const strengthDeltaPct =
      weeklyStrengthVolume != null && prevWeekStrengthVolume != null
        ? Math.round(((weekly - prev) / prev) * 100)
        : null;

    // ── Consistência últimos 30 dias ───────────────────────────
    const sessionsLast30 = sessionsRes.data?.length ?? 0;
    const consistencyPct = Math.round((sessionsLast30 / 30) * 100);

    // Mapa de dias com sessão (índice 0 = hoje, 29 = 29 dias atrás)
    const daysWithSession30: boolean[] = new Array(30).fill(false);
    const todayMidnight = new Date();
    todayMidnight.setHours(0, 0, 0, 0);
    for (const s of sessionsRes.data ?? []) {
      if (!s.completed_at) continue;
      const d = new Date(s.completed_at);
      d.setHours(0, 0, 0, 0);
      const diffDays = Math.round((todayMidnight.getTime() - d.getTime()) / (24 * 60 * 60 * 1000));
      if (diffDays >= 0 && diffDays < 30) daysWithSession30[diffDays] = true;
    }

    // ── Peso ───────────────────────────────────────────────────
    const weightRows = (weight30Res.data ?? []) as { weight_kg: number; recorded_at: string }[];
    // último registro de peso geral (precisamos buscar separado se vazio nos 30d)
    let lastWeightFromHistory: { weight_kg: number; recorded_at: string } | null = null;
    if (weightRows.length > 0) {
      lastWeightFromHistory = weightRows[weightRows.length - 1];
    } else {
      const { data: lastAny } = await supabase
        .from("weight_history")
        .select("weight_kg, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(1);
      if (lastAny && lastAny.length > 0) lastWeightFromHistory = lastAny[0];
    }

    const profileWeight = profileRes.data?.weight_kg ?? null;
    const lastWeightKg = lastWeightFromHistory?.weight_kg ?? profileWeight ?? null;
    const lastWeightDate =
      lastWeightFromHistory?.recorded_at ?? profileRes.data?.updated_at ?? null;

    // Série diária últimos 30 dias (último registro do dia se houver)
    const weightByDay = new Map<string, number>();
    for (const w of weightRows) {
      const dayKey = w.recorded_at.slice(0, 10);
      weightByDay.set(dayKey, Number(w.weight_kg));
    }
    const weight30d: WeightPoint[] = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(todayMidnight.getTime() - i * 24 * 60 * 60 * 1000);
      const key = d.toISOString().slice(0, 10);
      weight30d.push({ date: key, weight_kg: weightByDay.get(key) ?? null });
    }

    // ── PRs: maior carga por exercício ─────────────────────────
    const prMap = new Map<string, PRRow>();
    for (const row of prSetsRes.data ?? []) {
      const name = row.exercise_name;
      const load = Number(row.actual_load_kg ?? 0);
      if (!name || load <= 0) continue;
      const existing = prMap.get(name);
      if (!existing || load > existing.load_kg) {
        prMap.set(name, {
          exercise_name: name,
          load_kg: load,
          reps: row.actual_reps ?? null,
          achieved_at: row.created_at,
        });
      }
    }
    const personalRecords = [...prMap.values()].sort((a, b) => b.load_kg - a.load_kg);

    // ── Mini histórico (mantido) ───────────────────────────────
    const weightHistory = [...weightRows]
      .reverse()
      .slice(0, 6)
      .map((w) => ({ recorded_at: w.recorded_at, weight_kg: w.weight_kg }));

    // Medidas
    const p = profileRes.data;
    const measures = {
      waist_cm: p?.waist_cm ?? null,
      hip_cm: p?.hip_cm ?? null,
      chest_cm: p?.chest_cm ?? null,
      arm_cm: p?.arm_cm ?? null,
      thigh_cm: p?.thigh_cm ?? null,
    };

    return {
      weeklyStrengthVolume,
      prevWeekStrengthVolume,
      strengthDeltaPct,
      consistencyPct,
      sessionsLast30,
      daysWithSession30,
      lastWeightKg,
      lastWeightDate,
      weightHistory,
      weight30d,
      personalRecords,
      measures,
    };
  });
