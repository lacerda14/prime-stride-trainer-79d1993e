import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface EvolutionData {
  // Força: volume semanal (kg × reps) nos últimos 7 dias
  weeklyStrengthVolume: number | null;
  // Consistência: % dias treinados nos últimos 30 dias
  consistencyPct: number | null;
  sessionsLast30: number;
  // Último peso corporal registrado
  lastWeightKg: number | null;
  lastWeightDate: string | null;
  // Mini histórico de peso (últimos 6 registros)
  weightHistory: { recorded_at: string; weight_kg: number }[];
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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const [setLogsRes, sessionsRes, weightRes, profileRes] = await Promise.all([
      // Volume de força últimos 7 dias
      supabase
        .from("workout_set_logs")
        .select("actual_load_kg, actual_reps")
        .eq("user_id", userId)
        .gte("created_at", sevenDaysAgo)
        .not("actual_load_kg", "is", null)
        .not("actual_reps", "is", null),

      // Sessões concluídas últimos 30 dias
      supabase
        .from("workout_sessions")
        .select("id, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("completed_at", thirtyDaysAgo),

      // Histórico de peso (últimos 6 registros)
      supabase
        .from("weight_history")
        .select("weight_kg, recorded_at")
        .eq("user_id", userId)
        .order("recorded_at", { ascending: false })
        .limit(6),

      // Medidas do perfil
      supabase
        .from("profiles")
        .select("waist_cm, hip_cm, chest_cm, arm_cm, thigh_cm, weight_kg, updated_at")
        .eq("id", userId)
        .maybeSingle(),
    ]);

    // Volume semanal
    let weeklyStrengthVolume: number | null = null;
    if (setLogsRes.data && setLogsRes.data.length > 0) {
      const total = setLogsRes.data.reduce((acc, row) => {
        const load = row.actual_load_kg ?? 0;
        const reps = row.actual_reps ?? 0;
        return acc + load * reps;
      }, 0);
      weeklyStrengthVolume = Math.round(total);
    }

    // Consistência últimos 30 dias (max 30 dias possíveis)
    const sessionsLast30 = sessionsRes.data?.length ?? 0;
    const consistencyPct = Math.round((sessionsLast30 / 30) * 100);

    // Peso
    const weightRows = (weightRes.data ?? []) as { weight_kg: number; recorded_at: string }[];
    const lastWeight = weightRows[0] ?? null;

    // Se não tem histórico de peso mas tem no perfil
    const profileWeight = profileRes.data?.weight_kg ?? null;
    const lastWeightKg = lastWeight?.weight_kg ?? profileWeight ?? null;
    const lastWeightDate = lastWeight?.recorded_at ?? profileRes.data?.updated_at ?? null;

    // Medidas do perfil
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
      consistencyPct,
      sessionsLast30,
      lastWeightKg,
      lastWeightDate,
      weightHistory: weightRows.map((w) => ({
        recorded_at: w.recorded_at,
        weight_kg: w.weight_kg,
      })),
      measures,
    };
  });
