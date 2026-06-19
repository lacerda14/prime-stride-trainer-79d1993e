import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  generatePlan,
  loadExercisePool,
  mapDbGoalToEngineGoal,
  persistProgram,
  type UserProfileInput,
  type RunningMode,
} from "./pm-engine.server";
import { serverError } from "@/lib/server-errors";

/** "Segunda" → 1 ... "Domingo" → 7. Aceita variações com/sem acento. */
const DAY_NAME_TO_NUM: Record<string, number> = {
  segunda: 1,
  terca: 2,
  terça: 2,
  quarta: 3,
  quinta: 4,
  sexta: 5,
  sabado: 6,
  sábado: 6,
  domingo: 7,
};
export function dayNamesToNumbers(list: string[] | null | undefined): number[] {
  if (!Array.isArray(list)) return [];
  const out = new Set<number>();
  for (const raw of list) {
    if (typeof raw !== "string") continue;
    const key = raw.toLowerCase().trim();
    if (DAY_NAME_TO_NUM[key]) out.add(DAY_NAME_TO_NUM[key]);
  }
  return [...out].sort((a, b) => a - b);
}

export function buildEngineInput(profile: {
  id?: string;
  age: number;
  sex: string;
  weight_kg: number | string;
  height_cm: number | string;
  experience_level: string;
  goal: string;
  available_days: number;
  equipment?: string[] | null;
  available_days_list?: string[] | null;
  running_mode?: string | null;
  available_minutes?: number | null;
  pain_regions?: string[] | null;
  past_injuries?: string[] | null;
  uncomfortable_movements?: string[] | null;
}): UserProfileInput {
  const selected = dayNamesToNumbers(profile.available_days_list ?? []);
  const days = selected.length > 0 ? selected.length : profile.available_days;
  const runningMode = (profile.running_mode ?? null) as RunningMode | null;
  const wantsRunning = runningMode ? runningMode !== "desabilitado" : true;
  return {
    age: profile.age,
    sex: profile.sex as UserProfileInput["sex"],
    weight_kg: Number(profile.weight_kg),
    height_cm: Number(profile.height_cm),
    experience_level: profile.experience_level as UserProfileInput["experience_level"],
    // `profile.goal` é o objetivo do banco (pode ser conditioning/run_5k/
    // general_health); o motor só entende 4 buckets → mapeia aqui.
    goal: mapDbGoalToEngineGoal(profile.goal),
    available_days: days,
    selected_days: selected.length > 0 ? selected : undefined,
    wants_running: wantsRunning,
    running_mode: runningMode,
    available_equipment: (profile.equipment ?? []) as string[],
    available_minutes: profile.available_minutes ?? null,
    seed: profile.id,
    pain_regions: (profile.pain_regions ?? []) as string[],
    past_injuries: (profile.past_injuries ?? []) as string[],
    uncomfortable_movements: (profile.uncomfortable_movements ?? []) as string[],
  };
}

/**
 * Gera (ou regenera) o programa de 48 semanas para o usuário autenticado,
 * respeitando dias selecionados e preferência de corrida do onboarding.
 */
export const generateProgramForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select(
        "id, age, sex, weight_kg, height_cm, experience_level, goal, available_days, equipment, available_days_list, running_mode, available_minutes, pain_regions, past_injuries, uncomfortable_movements",
      )
      .eq("id", userId)
      .single();
    if (pErr) serverError("Não foi possível concluir a operação. Tente novamente.", pErr);
    if (
      !profile.age ||
      !profile.sex ||
      !profile.weight_kg ||
      !profile.height_cm ||
      !profile.experience_level ||
      !profile.goal ||
      !profile.available_days
    ) {
      throw new Error("Onboarding incompleto: faltam campos do perfil.");
    }

    const input = buildEngineInput(profile as any);
    const pool = await loadExercisePool(supabase);
    if (pool.length === 0) throw new Error("Catálogo de exercícios vazio.");

    const plan = generatePlan(input, pool);
    const result = await persistProgram(supabase, userId, input, plan);
    return result;
  });
