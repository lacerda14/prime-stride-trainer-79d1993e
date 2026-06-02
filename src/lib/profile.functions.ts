import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePlan, loadExercisePool, persistProgram, type Goal as EngineGoal, type UserProfileInput } from "@/lib/engine/pm-engine.server";


// ============================================================
// GET: profile + dashboard data
// ============================================================

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [profileRes, achievementsRes, recentXpRes, weekSessionsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase
        .from("user_achievements")
        .select("achievement_code, unlocked_at, achievements(code,title,description,icon,xp_reward)")
        .eq("user_id", userId)
        .order("unlocked_at", { ascending: false })
        .limit(3),
      supabase
        .from("xp_events")
        .select("xp_amount, created_at")
        .eq("user_id", userId)
        .gte("created_at", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()),
      supabase
        .from("workout_sessions")
        .select("week_number, completed_at")
        .eq("user_id", userId)
        .not("completed_at", "is", null),
    ]);

    if (profileRes.error) throw new Error(profileRes.error.message);

    const weeklyXp = (recentXpRes.data ?? []).reduce((s, e) => s + (e.xp_amount ?? 0), 0);
    const totalCompletedWorkouts = (weekSessionsRes.data ?? []).length;

    return {
      profile: profileRes.data,
      recentAchievements: achievementsRes.data ?? [],
      weeklyXp,
      totalCompletedWorkouts,
    };
  });

// ============================================================
// Schemas
// ============================================================

const GOAL_VALUES = [
  "fat_loss",
  "hypertrophy",
  "endurance",
  "hybrid",
  "general_health",
  "conditioning",
  "run_5k",
] as const;

const TRAINING_HISTORY = ["none", "lt_6m", "6m_2y", "2_5y", "gt_5y"] as const;
const TRAINING_LOCATION = ["gym", "home_gym", "crossfit_box", "home"] as const;
const AVAILABLE_MINUTES = [30, 45, 60, 90] as const;
const AVAILABLE_DAYS = [3, 4, 5] as const;

// Map UI goal -> engine goal (engine only knows 4 base goals).
function mapEngineGoal(g: (typeof GOAL_VALUES)[number]): EngineGoal {
  switch (g) {
    case "fat_loss":
    case "general_health":
      return "fat_loss";
    case "hypertrophy":
      return "hypertrophy";
    case "endurance":
    case "run_5k":
      return "endurance";
    case "conditioning":
    case "hybrid":
    default:
      return "hybrid";
  }
}

const onboardingSchema = z.object({
  // Step 1
  name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().nullable(),
  program_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  age: z.number().int().min(10).max(100),
  sex: z.enum(["male", "female", "other"]),
  weight_kg: z.number().min(20).max(300),
  height_cm: z.number().min(100).max(250),
  // Step 2
  goal: z.enum(GOAL_VALUES),
  // Step 3
  experience_level: z.enum(["beginner", "intermediate", "advanced"]),
  training_history: z.enum(TRAINING_HISTORY),
  training_location: z.enum(TRAINING_LOCATION),
  available_days: z.union([z.literal(3), z.literal(4), z.literal(5)]),
  available_minutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]),
  // Step 4 (multi-select, arrays)
  sports: z.array(z.string().min(1).max(40)).max(20).default([]),
  preferences: z.array(z.string().min(1).max(40)).max(20).default([]),
  motivations: z.array(z.string().min(1).max(40)).max(20).default([]),
});

// ============================================================
// POST: complete onboarding
// ============================================================

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => onboardingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error: updateErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        name: data.name,
        phone: data.phone ?? null,
        age: data.age,
        sex: data.sex,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        experience_level: data.experience_level,
        goal: data.goal,
        available_days: data.available_days,
        available_minutes: data.available_minutes,
        training_history: data.training_history,
        training_location: data.training_location,
        sports: data.sports,
        preferences: data.preferences,
        motivations: data.motivations,
        program_start_date: data.program_start_date,
        current_week: 1,
        onboarding_completed: true,
      }, { onConflict: "id" });
    if (updateErr) throw new Error(updateErr.message);

    await supabase.from("weight_history").insert({
      user_id: userId,
      weight_kg: data.weight_kg,
    });

    const input: UserProfileInput = {
      age: data.age,
      sex: data.sex,
      weight_kg: data.weight_kg,
      height_cm: data.height_cm,
      experience_level: data.experience_level,
      goal: mapEngineGoal(data.goal),
      available_days: data.available_days,
    };
    const pool = await loadExercisePool(supabase);
    if (pool.length === 0) throw new Error("Catálogo de exercícios vazio.");
    const plan = generatePlan(input, pool);
    const { program_id } = await persistProgram(supabase, userId, input, plan);

    return { ok: true, program_id };
  });

// ============================================================
// POST: update profile (from /perfil page)
// ============================================================

const updateProfileSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  phone: z.string().trim().max(40).nullable().optional(),
  weight_kg: z.number().min(20).max(300).optional(),
  height_cm: z.number().min(100).max(250).optional(),
  goal: z.enum(GOAL_VALUES).optional(),
  available_days: z.union([z.literal(3), z.literal(4), z.literal(5)]).optional(),
  available_minutes: z.union([z.literal(30), z.literal(45), z.literal(60), z.literal(90)]).optional(),
  sports: z.array(z.string().min(1).max(40)).max(20).optional(),
  preferences: z.array(z.string().min(1).max(40)).max(20).optional(),
  motivations: z.array(z.string().min(1).max(40)).max(20).optional(),
  regenerate_plan: z.boolean().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => updateProfileSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const patch: Record<string, unknown> = {};
    for (const k of [
      "name", "phone", "weight_kg", "height_cm", "goal",
      "available_days", "available_minutes",
      "sports", "preferences", "motivations",
    ] as const) {
      if (data[k] !== undefined) patch[k] = data[k];
    }

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("profiles").update(patch).eq("id", userId);
      if (error) throw new Error(error.message);
    }

    if (data.weight_kg !== undefined) {
      await supabase.from("weight_history").insert({
        user_id: userId,
        weight_kg: data.weight_kg,
      });
    }

    // Optionally regenerate program if structural fields changed.
    if (data.regenerate_plan) {
      const { data: profile, error: pErr } = await supabase
        .from("profiles").select("*").eq("id", userId).maybeSingle();
      if (pErr || !profile) throw new Error(pErr?.message ?? "Perfil não encontrado.");
      if (
        profile.age && profile.weight_kg && profile.height_cm &&
        profile.experience_level && profile.goal && profile.available_days
      ) {
        await supabase
          .from("training_programs")
          .update({ archived_at: new Date().toISOString() })
          .eq("user_id", userId)
          .is("archived_at", null);

        const input: UserProfileInput = {
          age: profile.age,
          sex: (profile.sex ?? "other") as "male" | "female" | "other",
          weight_kg: Number(profile.weight_kg),
          height_cm: Number(profile.height_cm),
          experience_level: profile.experience_level,
          goal: mapEngineGoal(profile.goal as (typeof GOAL_VALUES)[number]),
          available_days: profile.available_days as 3 | 4 | 5,
        };
        const pool = await loadExercisePool(supabase);
        const plan = generatePlan(input, pool);
        await persistProgram(supabase, userId, input, plan);
      }
    }

    return { ok: true };
  });

// ============================================================
// ADMIN/DEV: reset onboarding for current user
// ============================================================

export const resetOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    await supabase
      .from("training_programs")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId)
      .is("archived_at", null);

    const { error } = await supabase
      .from("profiles")
      .update({ onboarding_completed: false, current_week: 1 })
      .eq("id", userId);
    if (error) throw new Error(error.message);

    return { ok: true };
  });
