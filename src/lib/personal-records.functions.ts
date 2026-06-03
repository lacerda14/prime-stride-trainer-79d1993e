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

export const detectAndUpsertPRs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ session_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PRDetectionRunResult> => {
    return runPRDetectionForSession(context.supabase, context.userId, data.session_id);
  });
