import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePlan, loadExercisePool, persistProgram, type UserProfileInput } from "./pm-engine.server";

/**
 * Gera (ou regenera) o programa de 48 semanas para o usuário autenticado,
 * usando os campos do profile (sex, age, weight, height, experience, goal, available_days).
 * Arquiva programas anteriores.
 */
export const generateProgramForCurrentUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("age, sex, weight_kg, height_cm, experience_level, goal, available_days, equipment")
      .eq("id", userId)
      .single();
    if (pErr) throw new Error(pErr.message);
    if (!profile.age || !profile.sex || !profile.weight_kg || !profile.height_cm ||
        !profile.experience_level || !profile.goal || !profile.available_days) {
      throw new Error("Onboarding incompleto: faltam campos do perfil.");
    }

    const input: UserProfileInput = {
      age: profile.age,
      sex: profile.sex as UserProfileInput["sex"],
      weight_kg: Number(profile.weight_kg),
      height_cm: Number(profile.height_cm),
      experience_level: profile.experience_level as UserProfileInput["experience_level"],
      goal: profile.goal as UserProfileInput["goal"],
      available_days: profile.available_days as UserProfileInput["available_days"],
      available_equipment: (profile.equipment ?? []) as string[],
    };

    const pool = await loadExercisePool(supabase);
    if (pool.length === 0) throw new Error("Catálogo de exercícios vazio.");

    const plan = generatePlan(input, pool);
    const result = await persistProgram(supabase, userId, input, plan);
    return result;
  });
