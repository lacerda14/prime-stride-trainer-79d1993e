import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { generatePlan, loadExercisePool, persistProgram, type Goal as EngineGoal, type UserProfileInput } from "@/lib/engine/pm-engine.server";


// ============================================================
// GET
// ============================================================

export const getProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("profiles").select("*").eq("id", userId).maybeSingle();
    if (error) throw new Error(error.message);
    return data;
  });

export interface PRItem {
  exercise_name: string;
  load_kg: number;
  reps: number | null;
  achieved_at: string;
}

export const getDashboard = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const now = Date.now();
    const sevenDaysAgo = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
    const fourteenDaysAgo = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();

    const [profileRes, achievementsRes, recentXpRes, weekSessionsRes, prSetsRes, volumeSetsRes] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_achievements")
        .select("achievement_code, unlocked_at, achievements(code,title,description,icon,xp_reward)")
        .eq("user_id", userId).order("unlocked_at", { ascending: false }).limit(3),
      supabase.from("xp_events").select("xp_amount, created_at").eq("user_id", userId)
        .gte("created_at", sevenDaysAgo),
      supabase.from("workout_sessions").select("week_number, completed_at")
        .eq("user_id", userId).not("completed_at", "is", null),
      // Todos os sets com carga registrada → calcula PRs em memória
      supabase.from("workout_set_logs")
        .select("exercise_name, actual_load_kg, actual_reps, created_at")
        .eq("user_id", userId)
        .not("actual_load_kg", "is", null)
        .gt("actual_load_kg", 0)
        .order("actual_load_kg", { ascending: false })
        .limit(500),
      // Volume últimos 14 dias para comparar esta semana vs anterior
      supabase.from("workout_set_logs")
        .select("actual_load_kg, actual_reps, created_at")
        .eq("user_id", userId)
        .gte("created_at", fourteenDaysAgo)
        .not("actual_load_kg", "is", null)
        .not("actual_reps", "is", null),
    ]);
    if (profileRes.error) throw new Error(profileRes.error.message);

    const weeklyXp = (recentXpRes.data ?? []).reduce((s, e) => s + (e.xp_amount ?? 0), 0);
    const allSessions = weekSessionsRes.data ?? [];
    const totalCompletedWorkouts = allSessions.length;

    // ── PRs: maior carga por exercício ─────────────────────────
    const prMap = new Map<string, PRItem>();
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
    const allPRs = [...prMap.values()].sort((a, b) => b.load_kg - a.load_kg);
    const topPRs = allPRs.slice(0, 3);

    // ── Volume: esta semana vs anterior ────────────────────────
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    let thisWeekVolume = 0;
    let prevWeekVolume = 0;
    let thisWeekSessions = 0;
    for (const row of volumeSetsRes.data ?? []) {
      const t = new Date(row.created_at).getTime();
      const v = Number(row.actual_load_kg ?? 0) * Number(row.actual_reps ?? 0);
      if (t >= weekStart) thisWeekVolume += v;
      else prevWeekVolume += v;
    }
    thisWeekSessions = allSessions.filter(
      (s) => s.completed_at && new Date(s.completed_at).getTime() >= weekStart,
    ).length;

    const streak = profileRes.data?.streak_current ?? 0;
    const coachInsight = buildCoachInsightServer({
      streak,
      thisWeekSessions,
      thisWeekVolume: Math.round(thisWeekVolume),
      prevWeekVolume: Math.round(prevWeekVolume),
      totalCompleted: totalCompletedWorkouts,
      weeklyXp,
      topPR: topPRs[0] ?? null,
    });

    return {
      profile: profileRes.data,
      recentAchievements: achievementsRes.data ?? [],
      weeklyXp,
      totalCompletedWorkouts,
      topPRs,
      coachInsight,
      thisWeekVolume: Math.round(thisWeekVolume),
      prevWeekVolume: Math.round(prevWeekVolume),
      thisWeekSessions,
    };
  });

function buildCoachInsightServer(d: {
  streak: number;
  thisWeekSessions: number;
  thisWeekVolume: number;
  prevWeekVolume: number;
  totalCompleted: number;
  weeklyXp: number;
  topPR: PRItem | null;
}): string {
  if (d.totalCompleted === 0) {
    return "Bem-vindo ao PM Hybrid. Complete seu primeiro treino e a sua jornada começa de verdade.";
  }
  if (d.prevWeekVolume > 0 && d.thisWeekVolume > 0) {
    const delta = ((d.thisWeekVolume - d.prevWeekVolume) / d.prevWeekVolume) * 100;
    if (delta >= 10) {
      return `Volume de força +${Math.round(delta)}% vs semana passada. Progressão saudável — mantenha a técnica em primeiro lugar.`;
    }
    if (delta <= -15) {
      return `Volume ${Math.round(Math.abs(delta))}% abaixo da semana passada. Pode ser deload ou cansaço acumulado — cuide do sono e da alimentação.`;
    }
  }
  if (d.streak >= 14) {
    return `${d.streak} dias consecutivos. Esse tipo de consistência é raro — você está construindo algo sólido.`;
  }
  if (d.streak >= 7) {
    return `Você treinou ${d.thisWeekSessions}x essa semana e está em uma sequência de ${d.streak} dias. Continue assim.`;
  }
  if (d.thisWeekSessions >= 4) {
    return `${d.thisWeekSessions} treinos essa semana${d.weeklyXp ? ` · +${d.weeklyXp} XP` : ""}. Frequência ideal para resultado consistente.`;
  }
  if (d.topPR) {
    return `Seu maior PR é ${d.topPR.exercise_name} com ${d.topPR.load_kg}kg. Treine essa semana para superá-lo.`;
  }
  return "Cada treino é um passo. Mantenha a consistência e os resultados vêm inevitavelmente.";
}

// ============================================================
// Goal mapping
// ============================================================

const PRIMARY_GOALS = [
  "emagrecimento", "hipertrofia", "ganho_forca", "condicionamento",
  "correr_5k", "correr_10k", "saude_geral", "performance_hibrida", "outro",
] as const;
type PrimaryGoal = (typeof PRIMARY_GOALS)[number];

// Legacy engine goals (kept for backwards compat with the rest of the codebase).
const ENGINE_DB_GOALS = [
  "fat_loss", "hypertrophy", "endurance", "hybrid",
  "general_health", "conditioning", "run_5k",
] as const;
type DbGoal = (typeof ENGINE_DB_GOALS)[number];

function mapPrimaryToDbGoal(g: PrimaryGoal): DbGoal {
  switch (g) {
    case "emagrecimento": return "fat_loss";
    case "hipertrofia": return "hypertrophy";
    case "ganho_forca": return "hypertrophy";
    case "condicionamento": return "conditioning";
    case "correr_5k": return "run_5k";
    case "correr_10k": return "run_5k";
    case "saude_geral": return "general_health";
    case "performance_hibrida": return "hybrid";
    case "outro": return "general_health";
  }
}

function mapDbToEngineGoal(g: DbGoal): EngineGoal {
  switch (g) {
    case "fat_loss": case "general_health": return "fat_loss";
    case "hypertrophy": return "hypertrophy";
    case "endurance": case "run_5k": return "endurance";
    case "conditioning": case "hybrid": default: return "hybrid";
  }
}

// Aceita 1..7 dias por semana — respeita o onboarding (não força mais 3..5).
function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 5;
  return Math.min(7, Math.max(1, Math.round(n)));
}
function clampMinutes(n: number): 30 | 45 | 60 | 90 {
  if (n <= 30) return 30;
  if (n <= 45) return 45;
  if (n <= 60) return 60;
  if (n === 75) return 60;
  return 90;
}

// ============================================================
// Onboarding v2 schema
// ============================================================

const onboardingV2Schema = z.object({
  // S1
  first_name: z.string().trim().min(1).max(60),
  last_name: z.string().trim().max(80).optional().nullable(),
  birth_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
  sex: z.enum(["male", "female", "other", "prefer_not_to_say"]).optional().nullable(),
  height_cm: z.number().min(50).max(250).optional().nullable(),
  weight_kg: z.number().min(10).max(500).optional().nullable(),
  waist_cm: z.number().min(20).max(300).optional().nullable(),
  hip_cm: z.number().min(20).max(300).optional().nullable(),
  chest_cm: z.number().min(20).max(300).optional().nullable(),
  arm_cm: z.number().min(10).max(150).optional().nullable(),
  thigh_cm: z.number().min(10).max(200).optional().nullable(),
  phone: z.string().trim().max(40).optional().nullable(),
  // S2
  primary_goal: z.string().min(1).max(60).optional().nullable(),
  // S3
  secondary_goals: z.array(z.string().min(1).max(60)).max(3).default([]),
  // S4
  experience_level: z.string().max(40).optional().nullable(),
  training_history: z.string().max(60).optional().nullable(),
  training_location: z.string().max(60).optional().nullable(),
  available_days: z.number().int().min(0).max(14).optional().nullable(),
  available_minutes: z.number().int().min(0).max(300).optional().nullable(),
  // S5
  sports: z.array(z.string().min(1).max(40)).max(20).default([]),
  sports_frequency: z.record(z.string(), z.number().int().min(0).max(14)).default({}),
  // S6
  running_mode: z.string().max(40).optional().nullable(),
  running_level: z.string().max(40).optional().nullable(),
  running_continuous_minutes: z.string().max(40).optional().nullable(),
  running_goals: z.array(z.string().min(1).max(80)).max(10).default([]),
  running_preferred_days: z.array(z.string().min(1).max(20)).max(7).default([]),
  cardio_preference: z.string().max(40).optional().nullable(),
  // S7
  available_days_list: z.array(z.string().min(1).max(20)).max(7).default([]),
  preferred_time: z.string().max(20).optional().nullable(),
  // S8
  medical_conditions: z.array(z.string().min(1).max(60)).max(20).default([]),
  medications: z.string().max(500).optional().nullable(),
  surgeries: z.array(z.object({
    name: z.string().min(1).max(120),
    year: z.string().max(10).optional().nullable(),
  })).max(10).default([]),
  medical_restrictions: z.string().max(500).optional().nullable(),
  // S9
  current_pain_level: z.number().int().min(0).max(10).default(0),
  pain_regions: z.array(z.string().min(1).max(40)).max(20).default([]),
  past_injuries: z.array(z.string().min(1).max(60)).max(20).default([]),
  uncomfortable_movements: z.array(z.string().min(1).max(40)).max(20).default([]),
  // S10
  equipment: z.array(z.string().min(1).max(60)).max(60).default([]),
  gym_setup: z.object({
    location: z.string().max(60).optional().nullable(),
    full_gym_completeness: z.string().max(60).optional().nullable(),
    full_gym_missing: z.array(z.string().max(60)).max(30).default([]),
    full_gym_missing_other: z.string().max(300).optional().nullable(),
    condo_equipment: z.array(z.string().max(60)).max(40).default([]),
    condo_other: z.string().max(300).optional().nullable(),
    home_equipment: z.array(z.string().max(60)).max(40).default([]),
    home_other: z.string().max(300).optional().nullable(),
    box_completeness: z.string().max(10).optional().nullable(),
    box_equipment: z.array(z.string().max(60)).max(30).default([]),
    box_other: z.string().max(300).optional().nullable(),
    mixed_primary: z.string().max(40).optional().nullable(),
    mixed_other_locations: z.array(z.string().max(40)).max(10).default([]),
  }).default({}),
  // S11
  preferences: z.array(z.string().min(1).max(40)).max(20).default([]),
  training_style: z.string().max(40).optional().nullable(),
  motivations: z.array(z.string().min(1).max(40)).max(20).default([]),
  // S12
  perf_max_pushups: z.number().int().min(0).max(500).optional().nullable(),
  perf_max_squats: z.number().int().min(0).max(1000).optional().nullable(),
  perf_max_plank_seconds: z.number().int().min(0).max(7200).optional().nullable(),
  perf_max_run_minutes: z.number().int().min(0).max(1440).optional().nullable(),
  perf_longest_run_km: z.number().min(0).max(500).optional().nullable(),
  perf_lifts_done: z.array(z.string().min(1).max(40)).max(20).default([]),
  // meta
  program_start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

function computeAge(birth: string): number {
  const b = new Date(birth + "T00:00:00Z");
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return Math.max(0, Math.min(120, age));
}

// ============================================================
// POST: complete onboarding v2
// ============================================================

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => onboardingV2Schema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const age = data.birth_date ? computeAge(data.birth_date) : null;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbGoal = data.primary_goal ? mapPrimaryToDbGoal(data.primary_goal as any) : null;
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim() || data.first_name;

    const { error: updateErr } = await supabase
      .from("profiles")
      .upsert({
        id: userId,
        // legacy
        name,
        phone: data.phone ?? null,
        age,
        sex: data.sex,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        experience_level: data.experience_level as any,
        goal: dbGoal,
        available_days: clampDays(data.available_days ?? 4),
        available_minutes: clampMinutes(data.available_minutes ?? 60),
        training_history: data.training_history,
        training_location: data.training_location,
        sports: data.sports,
        preferences: data.preferences,
        motivations: data.motivations,
        program_start_date: data.program_start_date,
        current_week: 1,
        onboarding_completed: true,
        // v2 fields
        first_name: data.first_name,
        last_name: data.last_name ?? null,
        birth_date: data.birth_date,
        waist_cm: data.waist_cm ?? null,
        hip_cm: data.hip_cm ?? null,
        chest_cm: data.chest_cm ?? null,
        arm_cm: data.arm_cm ?? null,
        thigh_cm: data.thigh_cm ?? null,
        primary_goal: data.primary_goal,
        secondary_goals: data.secondary_goals,
        sports_frequency: data.sports_frequency,
        running_mode: data.running_mode,
        running_level: data.running_level ?? null,
        running_continuous_minutes: data.running_continuous_minutes ?? null,
        running_goals: data.running_goals,
        running_preferred_days: data.running_preferred_days,
        cardio_preference: data.cardio_preference ?? null,
        available_days_list: data.available_days_list,
        preferred_time: data.preferred_time ?? null,
        medical_conditions: data.medical_conditions,
        medications: data.medications ?? null,
        surgeries: data.surgeries,
        medical_restrictions: data.medical_restrictions ?? null,
        current_pain_level: data.current_pain_level,
        pain_regions: data.pain_regions,
        past_injuries: data.past_injuries,
        uncomfortable_movements: data.uncomfortable_movements,
        equipment: data.equipment,
        gym_setup: data.gym_setup,
        training_style: data.training_style ?? null,
        perf_max_pushups: data.perf_max_pushups ?? null,
        perf_max_squats: data.perf_max_squats ?? null,
        perf_max_plank_seconds: data.perf_max_plank_seconds ?? null,
        perf_max_run_minutes: data.perf_max_run_minutes ?? null,
        perf_lifts_done: data.perf_lifts_done,
      }, { onConflict: "id" });
    if (updateErr) throw new Error(updateErr.message);

    if (data.weight_kg) {
      await supabase.from("weight_history").insert({
        user_id: userId, weight_kg: data.weight_kg,
      });
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const input: UserProfileInput = {
      age:              age ?? 30,
      sex:              (data.sex as any) ?? "other",
      weight_kg:        data.weight_kg ?? 70,
      height_cm:        data.height_cm ?? 170,
      experience_level: (data.experience_level as any) ?? "beginner",
      goal:             mapDbToEngineGoal(dbGoal as any) ?? "general_health",
      available_days:   clampDays(data.available_days ?? 4),
    };
    const pool = await loadExercisePool(supabase);
    if (pool.length === 0) throw new Error("Catálogo de exercícios vazio.");
    const plan = generatePlan(input, pool);
    const { program_id } = await persistProgram(supabase, userId, input, plan);

    return { ok: true, program_id };
  });

// ============================================================
// POST: update profile (partial, from /perfil page)
// ============================================================

const partialSchema = onboardingV2Schema.partial().extend({
  // Legacy fields kept for the existing /perfil page.
  name: z.string().trim().min(1).max(120).optional(),
  goal: z.enum(ENGINE_DB_GOALS).optional(),
  regenerate_plan: z.boolean().optional(),
});

export const updateProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => partialSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { regenerate_plan, ...rest } = data;

    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) patch[k] = v;
    }
    // derived fields
    if (rest.birth_date) patch.age = computeAge(rest.birth_date);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if (rest.primary_goal) patch.goal = mapPrimaryToDbGoal(rest.primary_goal as any);
    if (rest.first_name || rest.last_name) {
      const fn = (rest.first_name ?? "").trim();
      const ln = (rest.last_name ?? "").trim();
      const composed = [fn, ln].filter(Boolean).join(" ");
      if (composed) patch.name = composed;
    }
    if (rest.available_days != null) patch.available_days = clampDays(rest.available_days);
    if (rest.available_minutes != null) patch.available_minutes = clampMinutes(rest.available_minutes);

    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("profiles").update(patch as never).eq("id", userId);
      if (error) throw new Error(error.message);
    }

    if (rest.weight_kg != null) {
      await supabase.from("weight_history").insert({
        user_id: userId, weight_kg: rest.weight_kg,
      });
    }

    let regenerated = false;
    if (regenerate_plan) {
      const { data: profile, error: pErr } = await supabase
        .from("profiles").select("*").eq("id", userId).maybeSingle();
      if (pErr || !profile) throw new Error(pErr?.message ?? "Perfil não encontrado.");
      if (
        profile.age && profile.weight_kg && profile.height_cm &&
        profile.experience_level && profile.goal && profile.available_days
      ) {
        await supabase.from("training_programs")
          .update({ archived_at: new Date().toISOString() })
          .eq("user_id", userId).is("archived_at", null);

        const input: UserProfileInput = {
          age: profile.age,
          sex: (profile.sex ?? "other") as "male" | "female" | "other",
          weight_kg: Number(profile.weight_kg),
          height_cm: Number(profile.height_cm),
          experience_level: profile.experience_level,
          goal: mapDbToEngineGoal(profile.goal as DbGoal),
          available_days: clampDays(profile.available_days),
        };
        const pool = await loadExercisePool(supabase);
        const plan = generatePlan(input, pool);
        await persistProgram(supabase, userId, input, plan);
        regenerated = true;
      }
    }

    return { ok: true, regenerated };
  });

// ============================================================
// Progress photos
// ============================================================

export const listProgressPhotos = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("progress_photos")
      .select("id, photo_type, storage_path, uploaded_at")
      .eq("user_id", userId)
      .order("uploaded_at", { ascending: false });
    if (error) throw new Error(error.message);

    const out = await Promise.all((data ?? []).map(async (p) => {
      const { data: signed } = await supabase.storage
        .from("progress-photos")
        .createSignedUrl(p.storage_path, 60 * 60);
      return { ...p, url: signed?.signedUrl ?? null };
    }));
    return out;
  });

export const registerProgressPhoto = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({
    photo_type: z.enum(["frente", "lado", "costas"]),
    storage_path: z.string().min(1).max(500),
  }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase.from("progress_photos").insert({
      user_id: userId,
      photo_type: data.photo_type,
      storage_path: data.storage_path,
    });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Reset
// ============================================================

export const resetOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    await supabase.from("training_programs")
      .update({ archived_at: new Date().toISOString() })
      .eq("user_id", userId).is("archived_at", null);
    const { error } = await supabase.from("profiles")
      .update({ onboarding_completed: false, current_week: 1 })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
