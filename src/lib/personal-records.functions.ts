import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  STRENGTH_PR_LIFTS,
  PR_EXERCISE_CODES,
  epley1RM,
  isImprovement,
  improvementPct,
  type CandidatePR,
  type PRExerciseCode,
} from "./pr-detection.server";

// ============================================================
// DTOs
// ============================================================

export interface PersonalRecordDTO {
  exercise_code: PRExerciseCode;
  label: string;
  category: "strength" | "running";
  metric_type: string;
  value: number;
  secondary_value: number | null;
  estimated_1rm: number | null;
  previous_value: number | null;
  achieved_at: string;
  improvement_pct: number | null;
}

export interface PRHistoryPointDTO {
  value: number;
  estimated_1rm: number | null;
  improvement_pct: number | null;
  achieved_at: string;
}

export interface RecentPRDTO {
  exercise_code: PRExerciseCode;
  label: string;
  category: "strength" | "running";
  metric_type: string;
  value: number;
  estimated_1rm: number | null;
  improvement_pct: number | null;
  achieved_at: string;
}

// ============================================================
// getPersonalRecords — lê personal_records (PR atual de cada exercício)
// ============================================================

export const getPersonalRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonalRecordDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("personal_records")
      .select("exercise_code, category, metric_type, value, secondary_value, estimated_1rm, previous_value, achieved_at")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    return (data ?? []).map((r) => {
      const code = r.exercise_code as PRExerciseCode;
      const meta = PR_EXERCISE_CODES[code];
      const prev = r.previous_value != null ? Number(r.previous_value) : null;
      const cur = Number(r.value);
      return {
        exercise_code: code,
        label: meta?.label ?? r.exercise_code,
        category: r.category as "strength" | "running",
        metric_type: r.metric_type,
        value: cur,
        secondary_value: r.secondary_value != null ? Number(r.secondary_value) : null,
        estimated_1rm: r.estimated_1rm != null ? Number(r.estimated_1rm) : null,
        previous_value: prev,
        achieved_at: r.achieved_at,
        improvement_pct: prev != null ? improvementPct(cur, prev) : null,
      };
    });
  });

// ============================================================
// getRecentPRs — lê pr_history ordenado por data
// ============================================================

export const getRecentPRs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ limit: z.number().int().min(1).max(20).default(5) }).parse(input))
  .handler(async ({ data, context }): Promise<RecentPRDTO[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("pr_history")
      .select("exercise_code, category, metric_type, value, estimated_1rm, improvement_pct, achieved_at")
      .eq("user_id", userId)
      .order("achieved_at", { ascending: false })
      .limit(data.limit);
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => {
      const code = r.exercise_code as PRExerciseCode;
      const meta = PR_EXERCISE_CODES[code];
      return {
        exercise_code: code,
        label: meta?.label ?? r.exercise_code,
        category: r.category as "strength" | "running",
        metric_type: r.metric_type,
        value: Number(r.value),
        estimated_1rm: r.estimated_1rm != null ? Number(r.estimated_1rm) : null,
        improvement_pct: r.improvement_pct != null ? Number(r.improvement_pct) : null,
        achieved_at: r.achieved_at,
      };
    });
  });

// ============================================================
// getPRHistory — histórico de um exercício específico
// ============================================================

export const getPRHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        exercise_code: z.string(),
        range_days: z.number().int().min(1).max(3650).default(365),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<PRHistoryPointDTO[]> => {
    const { supabase, userId } = context;
    const since = new Date(Date.now() - data.range_days * 86400_000).toISOString();
    const { data: rows, error } = await supabase
      .from("pr_history")
      .select("value, estimated_1rm, improvement_pct, achieved_at")
      .eq("user_id", userId)
      .eq("exercise_code", data.exercise_code)
      .gte("achieved_at", since)
      .order("achieved_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (rows ?? []).map((r) => ({
      value: Number(r.value),
      estimated_1rm: r.estimated_1rm != null ? Number(r.estimated_1rm) : null,
      improvement_pct: r.improvement_pct != null ? Number(r.improvement_pct) : null,
      achieved_at: r.achieved_at,
    }));
  });

// ============================================================
// detectAndUpsertPRs — varre set logs da sessão, grava novos PRs
// ============================================================

export interface PRDetectionResult {
  newPRs: {
    exercise_code: PRExerciseCode;
    label: string;
    value: number;
    estimated_1rm: number | null;
    previous_value: number | null;
    improvement_pct: number | null;
  }[];
  xpGained: number;
}

export const detectAndUpsertPRs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ session_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PRDetectionResult> => {
    const { supabase, userId } = context;

    // 1) Carrega set logs com info do exercício
    const { data: logs, error: logsErr } = await supabase
      .from("workout_set_logs")
      .select("exercise_id, exercise_name, actual_load_kg, actual_reps")
      .eq("user_id", userId)
      .eq("workout_session_id", data.session_id)
      .not("actual_reps", "is", null);
    if (logsErr) throw new Error(logsErr.message);
    if (!logs || logs.length === 0) return { newPRs: [], xpGained: 0 };

    // 2) Resolve exercise_pool.code dos exercise_ids únicos
    const exerciseIds = [...new Set(logs.map((l) => l.exercise_id).filter(Boolean) as string[])];
    let poolMap = new Map<string, string>(); // id -> code
    if (exerciseIds.length > 0) {
      const { data: pool } = await supabase
        .from("exercise_pool")
        .select("id, code")
        .in("id", exerciseIds);
      poolMap = new Map((pool ?? []).map((p) => [p.id as string, p.code as string]));
    }

    // 3) Para cada set, computa candidato a PR se mapear para um lift oficial
    const candidates = new Map<PRExerciseCode, CandidatePR>();
    for (const log of logs) {
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
            source_session_id: data.session_id,
          });
        }
      } else {
        // reps (strict pull-up)
        const existing = candidates.get(code);
        if (!existing || existing.value < reps) {
          candidates.set(code, {
            exercise_code: code,
            category: "strength",
            metric_type: "reps",
            value: reps,
            secondary_value: null,
            estimated_1rm: null,
            source_session_id: data.session_id,
          });
        }
      }
    }

    if (candidates.size === 0) return { newPRs: [], xpGained: 0 };

    // 4) Compara com PRs atuais
    const codes = [...candidates.keys()];
    const { data: currentRows } = await supabase
      .from("personal_records")
      .select("exercise_code, value, estimated_1rm")
      .eq("user_id", userId)
      .in("exercise_code", codes);
    const currentMap = new Map(
      (currentRows ?? []).map((r) => [
        r.exercise_code as PRExerciseCode,
        { value: Number(r.value), estimated_1rm: r.estimated_1rm != null ? Number(r.estimated_1rm) : null },
      ]),
    );

    const newPRs: PRDetectionResult["newPRs"] = [];
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

      // Upsert personal_records
      await supabase
        .from("personal_records")
        .upsert(
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

      // Insert into pr_history
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

      // XP: 100 base + bônus por % melhora (cap 300)
      const xp = Math.min(300, 100 + Math.max(0, Math.round(improvement ?? 0)) * 5);
      await supabase.from("xp_events").insert({
        user_id: userId,
        event_type: "pr_strength",
        xp_amount: xp,
        source_id: data.session_id,
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

    // 5) Atualiza XP total do perfil
    if (totalXp > 0) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("xp_total")
        .eq("id", userId)
        .single();
      const newXp = (prof?.xp_total ?? 0) + totalXp;
      await supabase.from("profiles").update({ xp_total: newXp }).eq("id", userId);
    }

    return { newPRs, xpGained: totalXp };
  });
