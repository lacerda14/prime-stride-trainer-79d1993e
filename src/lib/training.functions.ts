import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { levelFromXp, XP_REWARDS } from "@/lib/gamification";

// ============================================================
// Week plan (distribuição dos treinos da semana)
// ============================================================

export const getWeekPlan = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ week_number: z.number().int().min(1).max(60) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: plan, error } = await supabase
      .from("week_plans")
      .select("*")
      .eq("user_id", userId)
      .eq("week_number", data.week_number)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return plan;
  });

export const saveWeekPlan = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z
      .object({
        week_number: z.number().int().min(1).max(60),
        days_distribution: z.record(z.string(), z.number().int().min(0).max(6)),
      })
      .parse(i),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: existing } = await supabase
      .from("week_plans")
      .select("id")
      .eq("user_id", userId)
      .eq("week_number", data.week_number)
      .maybeSingle();
    if (existing) {
      const { error } = await supabase
        .from("week_plans")
        .update({ days_distribution: data.days_distribution })
        .eq("id", existing.id);
      if (error) throw new Error(error.message);
    } else {
      const { error } = await supabase.from("week_plans").insert({
        user_id: userId,
        week_number: data.week_number,
        days_distribution: data.days_distribution,
      });
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ============================================================
// Helper: server-side dia em ISO (UTC) — usuário usa a data local no front,
// mas no banco gravamos UTC e comparamos por proximidade.
// ============================================================
function diffDaysUTC(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const aD = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bD = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aD - bD) / ms);
}

interface AwardResult {
  xpGained: number;
  newXpTotal: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  streakCurrent: number;
  streakLongest: number;
  newAchievements: { code: string; title: string; xp_reward: number }[];
}

// ============================================================
// Concluir treino → grava sessão + XP + streak + achievements
// ============================================================

export const recordWorkoutComplete = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        week_number: z.number().int().min(1).max(60),
        day_key: z.string().min(1).max(8),
        duration_min: z.number().int().min(1).max(600).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<AwardResult> => {
    const { supabase, userId } = context;

    // 1) cria sessão concluída
    const { data: session, error: sErr } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        week_number: data.week_number,
        day_key: data.day_key,
        completed_at: new Date().toISOString(),
        duration_min: data.duration_min ?? null,
      })
      .select("id")
      .single();
    if (sErr) throw new Error(sErr.message);

    // 2) registra XP
    const xpGain = XP_REWARDS.workout;
    await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: "workout_complete",
      xp_amount: xpGain,
      source_id: session.id,
    });

    // 3) carrega profile e atualiza streak/xp/level
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("xp_total, streak_current, streak_longest, streak_last_date")
      .eq("id", userId)
      .single();
    if (pErr) throw new Error(pErr.message);

    const newXp = (profile.xp_total ?? 0) + xpGain;
    const oldLevel = levelFromXp(profile.xp_total ?? 0);
    const newLevel = levelFromXp(newXp);

    const today = new Date();
    let streakCurrent = profile.streak_current ?? 0;
    if (profile.streak_last_date) {
      const last = new Date(profile.streak_last_date as string);
      const diff = diffDaysUTC(today, last);
      if (diff === 0) {
        // já treinou hoje, mantém
      } else if (diff === 1) {
        streakCurrent += 1;
      } else {
        streakCurrent = 1;
      }
    } else {
      streakCurrent = 1;
    }
    const streakLongest = Math.max(profile.streak_longest ?? 0, streakCurrent);

    await supabase
      .from("profiles")
      .update({
        xp_total: newXp,
        level: newLevel,
        streak_current: streakCurrent,
        streak_longest: streakLongest,
        streak_last_date: today.toISOString().slice(0, 10),
      })
      .eq("id", userId);

    // 4) checa achievements
    const newAchievements: { code: string; title: string; xp_reward: number }[] = [];

    const { count: workoutCount } = await supabase
      .from("workout_sessions")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .not("completed_at", "is", null);

    const candidates: { code: string; condition: boolean }[] = [
      { code: "first_workout", condition: (workoutCount ?? 0) >= 1 },
      { code: "workouts_100", condition: (workoutCount ?? 0) >= 100 },
      { code: "streak_7", condition: streakCurrent >= 7 },
      { code: "streak_30", condition: streakCurrent >= 30 },
      { code: "streak_100", condition: streakCurrent >= 100 },
    ];

    for (const c of candidates) {
      if (!c.condition) continue;
      const { data: already } = await supabase
        .from("user_achievements")
        .select("achievement_code")
        .eq("user_id", userId)
        .eq("achievement_code", c.code)
        .maybeSingle();
      if (already) continue;

      await supabase
        .from("user_achievements")
        .insert({ user_id: userId, achievement_code: c.code });

      const { data: ach } = await supabase
        .from("achievements")
        .select("code, title, xp_reward")
        .eq("code", c.code)
        .single();
      if (ach) {
        newAchievements.push({ code: ach.code, title: ach.title, xp_reward: ach.xp_reward });
        // bonus XP
        if (ach.xp_reward > 0) {
          await supabase.from("xp_events").insert({
            user_id: userId,
            event_type: "achievement",
            xp_amount: ach.xp_reward,
            source_id: null,
          });
          await supabase
            .from("profiles")
            .update({ xp_total: newXp + ach.xp_reward, level: levelFromXp(newXp + ach.xp_reward) })
            .eq("id", userId);
        }
      }
    }

    return {
      xpGained: xpGain,
      newXpTotal: newXp,
      oldLevel,
      newLevel,
      leveledUp: newLevel > oldLevel,
      streakCurrent,
      streakLongest,
      newAchievements,
    };
  });
