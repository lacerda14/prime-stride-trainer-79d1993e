import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

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
// POST: complete onboarding
// ============================================================

const onboardingSchema = z.object({
  display_name: z.string().trim().min(1).max(80),
  phone: z.string().trim().max(40).optional().nullable(),
  age: z.number().int().min(10).max(100),
  gender: z.enum(["male", "female", "other", "prefer_not_to_say"]),
  weight_kg: z.number().min(20).max(300),
  height_cm: z.number().min(100).max(250),
  experience_level: z.enum(["beginner", "intermediate", "advanced"]),
  main_goal: z.enum(["weight_loss", "hypertrophy", "aerobic", "hybrid", "general_health"]),
  available_days: z.array(z.number().int().min(0).max(6)).min(1).max(7),
});

export const completeOnboarding = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => onboardingSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        display_name: data.display_name,
        phone: data.phone ?? null,
        age: data.age,
        gender: data.gender,
        weight_kg: data.weight_kg,
        height_cm: data.height_cm,
        experience_level: data.experience_level,
        main_goal: data.main_goal,
        available_days: data.available_days,
        onboarding_completed_at: new Date().toISOString(),
      })
      .eq("id", userId);
    if (updateErr) throw new Error(updateErr.message);

    // primeiro registro de peso
    await supabase.from("weight_history").insert({
      user_id: userId,
      weight_kg: data.weight_kg,
    });

    return { ok: true };
  });
