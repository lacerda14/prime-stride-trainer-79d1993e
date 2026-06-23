import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  PR_EXERCISE_CODES,
  improvementPct,
  runPRDetectionForSession,
  type PRExerciseCode,
  type PRDetectionRunResult,
} from "./pr-detection.server";
import { serverError } from "@/lib/server-errors";

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

export const getPersonalRecords = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<PersonalRecordDTO[]> => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("personal_records")
      .select(
        "exercise_code, category, metric_type, value, secondary_value, estimated_1rm, previous_value, achieved_at",
      )
      .eq("user_id", userId);
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);

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

export const getRecentPRs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ limit: z.number().int().min(1).max(20).default(5) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<RecentPRDTO[]> => {
    const { supabase, userId } = context;
    const { data: rows, error } = await supabase
      .from("pr_history")
      .select(
        "exercise_code, category, metric_type, value, estimated_1rm, improvement_pct, achieved_at",
      )
      .eq("user_id", userId)
      .order("achieved_at", { ascending: false })
      .limit(data.limit);
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
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

export const detectAndUpsertPRs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ session_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PRDetectionRunResult> => {
    return runPRDetectionForSession(context.supabase, context.userId, data.session_id);
  });

// ============================================================
// Manual PR entry — usuário pode inserir/editar PRs
// ============================================================
const manualPRSchema = z.object({
  exercise_code: z.string().min(1).max(64),
  value: z.number().positive().max(100000),
  secondary_value: z.number().positive().max(100000).nullable().optional(),
  achieved_at: z.string().datetime().optional(),
});

export const upsertManualPR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => manualPRSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const code = data.exercise_code as keyof typeof PR_EXERCISE_CODES;
    const meta = PR_EXERCISE_CODES[code];
    if (!meta) throw new Error("Exercício inválido para PR.");

    // 1RM Epley quando weight_load + reps > 1. Em 1RM a própria carga É o recorde
    // (sem estimar). Em 2RM..12RM estima o 1RM a partir do peso e das reps.
    let estimated_1rm: number | null = null;
    if (meta.metric === "weight_load" && data.secondary_value && data.secondary_value > 1) {
      const reps = data.secondary_value;
      estimated_1rm = Math.round(data.value * (1 + reps / 30) * 10) / 10;
    }

    // valor atual para previous_value + history
    const { data: current } = await supabase
      .from("personal_records")
      .select("value, estimated_1rm")
      .eq("user_id", userId)
      .eq("exercise_code", code)
      .maybeSingle();

    const previousValue = current ? Number(current.value) : null;
    const achievedAt = data.achieved_at ?? new Date().toISOString();

    const { error: upErr } = await supabase.from("personal_records").upsert(
      {
        user_id: userId,
        exercise_code: code,
        category: meta.category,
        metric_type: meta.metric,
        value: data.value,
        secondary_value: data.secondary_value ?? null,
        estimated_1rm,
        previous_value: previousValue,
        source_session_id: null,
        achieved_at: achievedAt,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id,exercise_code" },
    );
    if (upErr) serverError("Não foi possível concluir a operação. Tente novamente.", upErr);

    // History (sempre registra a edição manual)
    const improvement =
      previousValue != null && previousValue > 0
        ? Math.round(((data.value - previousValue) / previousValue) * 1000) / 10
        : null;
    await supabase.from("pr_history").insert({
      user_id: userId,
      exercise_code: code,
      category: meta.category,
      metric_type: meta.metric,
      value: data.value,
      secondary_value: data.secondary_value ?? null,
      estimated_1rm,
      previous_value: previousValue,
      improvement_pct: improvement,
      source_session_id: null,
    });

    return { ok: true };
  });

export const deletePR = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ exercise_code: z.string().min(1).max(64) }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("personal_records")
      .delete()
      .eq("user_id", userId)
      .eq("exercise_code", data.exercise_code);
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
    return { ok: true };
  });
