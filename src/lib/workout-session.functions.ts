import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { levelFromXp, XP_REWARDS } from "@/lib/gamification";
import type { Json } from "@/integrations/supabase/types";

type JsonObject = { [k: string]: Json | undefined };

// ============================================================
// Tipos públicos
// ============================================================

export interface SessionStateDTO {
  current_step: number;
  current_exercise_index: number;
  current_set: number;
  current_block: number | null;
  current_interval: number | null;
  elapsed_seconds: number;
  total_elapsed_seconds: number;
  phase?: "work" | "rest" | null;
  // tempo real em que a fase atual começou (epoch ms) — usado para timer baseado em timestamp
  phase_started_at_ms?: number | null;
  session_data?: JsonObject;
}

export interface ActiveSessionDTO {
  id: string;
  week_number: number;
  day_key: string;
  status: "active" | "paused" | "completed" | "abandoned" | "not_started";
  started_at: string | null;
  finished_at: string | null;
  current_step: number;
  current_exercise_index: number;
  current_set: number;
  current_block: number | null;
  current_interval: number | null;
  elapsed_seconds: number;
  total_elapsed_seconds: number;
  duration_seconds: number | null;
  session_data: JsonObject;
}

// ============================================================
// Buscar sessão ativa (para modal de recuperação)
// ============================================================

export const getActiveWorkoutSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ActiveSessionDTO | null> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .order("started_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return data as unknown as ActiveSessionDTO;
  });

// ============================================================
// Iniciar (ou recuperar) sessão para o treino do dia
// ============================================================

export const startWorkoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        week_number: z.number().int().min(1).max(120),
        day_key: z.string().min(1).max(8),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<ActiveSessionDTO> => {
    const { supabase, userId } = context;

    // já existe ativa para este mesmo treino? retorna ela
    const { data: existing } = await supabase
      .from("workout_sessions")
      .select("*")
      .eq("user_id", userId)
      .in("status", ["active", "paused"])
      .eq("week_number", data.week_number)
      .eq("day_key", data.day_key)
      .maybeSingle();
    if (existing) return existing as unknown as ActiveSessionDTO;

    // existe ativa para OUTRO treino? abandona
    await supabase
      .from("workout_sessions")
      .update({ status: "abandoned", updated_at: new Date().toISOString() })
      .eq("user_id", userId)
      .in("status", ["active", "paused"]);

    const nowIso = new Date().toISOString();
    const { data: created, error } = await supabase
      .from("workout_sessions")
      .insert({
        user_id: userId,
        week_number: data.week_number,
        day_key: data.day_key,
        status: "active",
        started_at: nowIso,
        current_step: 0,
        current_exercise_index: 0,
        current_set: 1,
        elapsed_seconds: 0,
        total_elapsed_seconds: 0,
        session_data: {},
      })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return created as unknown as ActiveSessionDTO;
  });

// ============================================================
// Salvar estado parcial (debounced no client)
// ============================================================

export const updateWorkoutSessionState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        current_step: z.number().int().min(0),
        current_exercise_index: z.number().int().min(0),
        current_set: z.number().int().min(1),
        current_block: z.number().int().nullable().optional(),
        current_interval: z.number().int().nullable().optional(),
        elapsed_seconds: z.number().int().min(0),
        total_elapsed_seconds: z.number().int().min(0),
        session_data: z.record(z.string(), z.any()).optional(),
        status: z.enum(["active", "paused"]).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("workout_sessions")
      .update({
        current_step: data.current_step,
        current_exercise_index: data.current_exercise_index,
        current_set: data.current_set,
        current_block: data.current_block ?? null,
        current_interval: data.current_interval ?? null,
        elapsed_seconds: data.elapsed_seconds,
        total_elapsed_seconds: data.total_elapsed_seconds,
        session_data: data.session_data ?? {},
        status: data.status ?? "active",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.session_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Abandonar
// ============================================================

export const abandonWorkoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("workout_sessions")
      .update({
        status: "abandoned",
        finished_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.session_id)
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ============================================================
// Concluir → grava XP, streak, achievements (mesma lógica do recordWorkoutComplete)
// ============================================================

interface CompleteResult {
  xpGained: number;
  newXpTotal: number;
  oldLevel: number;
  newLevel: number;
  leveledUp: boolean;
  streakCurrent: number;
  streakLongest: number;
  durationSeconds: number;
  newAchievements: { code: string; title: string; xp_reward: number }[];
}

function diffDaysUTC(a: Date, b: Date): number {
  const ms = 24 * 60 * 60 * 1000;
  const aD = Date.UTC(a.getFullYear(), a.getMonth(), a.getDate());
  const bD = Date.UTC(b.getFullYear(), b.getMonth(), b.getDate());
  return Math.round((aD - bD) / ms);
}

export const completeWorkoutSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        total_elapsed_seconds: z.number().int().min(0),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CompleteResult> => {
    const { supabase, userId } = context;

    // 1) finaliza a sessão
    const finishedAtIso = new Date().toISOString();
    const { data: sess, error: uErr } = await supabase
      .from("workout_sessions")
      .update({
        status: "completed",
        finished_at: finishedAtIso,
        completed_at: finishedAtIso,
        duration_seconds: data.total_elapsed_seconds,
        duration_min: Math.max(1, Math.round(data.total_elapsed_seconds / 60)),
        total_elapsed_seconds: data.total_elapsed_seconds,
        updated_at: finishedAtIso,
      })
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .select("id")
      .single();
    if (uErr) throw new Error(uErr.message);

    // 2) XP
    const xpGain = XP_REWARDS.workout;
    await supabase.from("xp_events").insert({
      user_id: userId,
      event_type: "workout_complete",
      xp_amount: xpGain,
      source_id: sess.id,
    });

    // 3) profile / streak
    const { data: profile, error: pErr } = await supabase
      .from("profiles")
      .select("xp_total, streak_current, streak_longest, streak_last_date")
      .eq("id", userId)
      .single();
    if (pErr) throw new Error(pErr.message);

    let newXp = (profile.xp_total ?? 0) + xpGain;
    const oldLevel = levelFromXp(profile.xp_total ?? 0);

    const today = new Date();
    let streakCurrent = profile.streak_current ?? 0;
    if (profile.streak_last_date) {
      const last = new Date(profile.streak_last_date as string);
      const diff = diffDaysUTC(today, last);
      if (diff === 0) {
        /* mantém */
      } else if (diff === 1) {
        streakCurrent += 1;
      } else {
        streakCurrent = 1;
      }
    } else {
      streakCurrent = 1;
    }
    const streakLongest = Math.max(profile.streak_longest ?? 0, streakCurrent);

    // 4) achievements
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
    const newAchievements: CompleteResult["newAchievements"] = [];
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
        if (ach.xp_reward > 0) {
          await supabase.from("xp_events").insert({
            user_id: userId,
            event_type: "achievement",
            xp_amount: ach.xp_reward,
            source_id: null,
          });
          newXp += ach.xp_reward;
        }
      }
    }

    const newLevel = levelFromXp(newXp);
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

    return {
      xpGained: xpGain,
      newXpTotal: newXp,
      oldLevel,
      newLevel,
      leveledUp: newLevel > oldLevel,
      streakCurrent,
      streakLongest,
      durationSeconds: data.total_elapsed_seconds,
      newAchievements,
    };
  });

// ============================================================
// Listagem para o histórico
// ============================================================

export interface HistoryItemDTO {
  id: string;
  week_number: number;
  day_key: string;
  started_at: string | null;
  finished_at: string | null;
  duration_seconds: number | null;
  status: string;
}

export const listWorkoutHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<HistoryItemDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("workout_sessions")
      .select("id, week_number, day_key, started_at, finished_at, duration_seconds, duration_min, status, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("finished_at", { ascending: false, nullsFirst: false })
      .limit(50);
    if (error) throw new Error(error.message);
    return (data ?? []).map((r) => ({
      id: r.id,
      week_number: r.week_number,
      day_key: r.day_key,
      started_at: r.started_at,
      finished_at: r.finished_at ?? r.completed_at ?? null,
      duration_seconds: r.duration_seconds ?? (r.duration_min ? r.duration_min * 60 : null),
      status: r.status,
    }));
  });
