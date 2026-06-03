import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { runPRDetectionForSession, type PRDetectedItem } from "./pr-detection.server";

// ============================================================
// Tipos
// ============================================================

export interface SetLogDTO {
  id: string;
  exercise_index: number;
  exercise_name: string;
  set_number: number;
  planned_reps: string | null;
  actual_reps: number | null;
  planned_load_kg: number | null;
  actual_load_kg: number | null;
  planned_rpe: number | null;
  actual_rpe: number | null;
  notes: string | null;
}

export interface RunningLogDTO {
  id: string;
  total_duration_seconds: number | null;
  total_running_seconds: number | null;
  total_rest_seconds: number | null;
  distance_km: number | null;
  average_speed_kmh: number | null;
  max_speed_kmh: number | null;
  perceived_effort: number | null;
  notes: string | null;
}

export interface CompletedSessionDTO {
  session: {
    id: string;
    week_number: number;
    day_key: string;
    status: string;
    started_at: string | null;
    finished_at: string | null;
    duration_seconds: number | null;
    estimated_calories: number | null;
    completed_summary: { perceived_effort?: number | null; general_notes?: string | null; duration_feedback?: string | null; saved_at?: string | null } | null;
  };
  set_logs: SetLogDTO[];
  running_log: RunningLogDTO | null;
  profile: {
    weight_kg: number | null;
    xp_total: number;
    level: number;
    streak_current: number;
    streak_longest: number;
  };
}

// ============================================================
// Buscar dados da sessão concluída + logs existentes
// ============================================================

export const getCompletedSession = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CompletedSessionDTO> => {
    const { supabase, userId } = context;

    const { data: sess, error: sErr } = await supabase
      .from("workout_sessions")
      .select(
        "id, week_number, day_key, status, started_at, finished_at, duration_seconds, duration_min, estimated_calories, completed_summary",
      )
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .single();
    if (sErr) throw new Error(sErr.message);

    const { data: setRows } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: unknown[] | null }>;
          };
        };
      };
    })
      .from("workout_set_logs")
      .select(
        "id, exercise_index, exercise_name, set_number, planned_reps, actual_reps, planned_load_kg, actual_load_kg, planned_rpe, actual_rpe, notes",
      )
      .eq("workout_session_id", data.session_id)
      .order("exercise_index", { ascending: true });

    const setRowsArr = (setRows ?? []) as unknown as SetLogDTO[];

    const { data: runRow } = await (supabase as unknown as {
      from: (t: string) => {
        select: (s: string) => {
          eq: (c: string, v: string) => {
            maybeSingle: () => Promise<{ data: unknown | null }>;
          };
        };
      };
    })
      .from("running_session_logs")
      .select(
        "id, total_duration_seconds, total_running_seconds, total_rest_seconds, distance_km, average_speed_kmh, max_speed_kmh, perceived_effort, notes",
      )
      .eq("workout_session_id", data.session_id)
      .maybeSingle();

    const { data: profile } = await supabase
      .from("profiles")
      .select("weight_kg, xp_total, level, streak_current, streak_longest")
      .eq("id", userId)
      .single();

    const durationSec =
      (sess as { duration_seconds?: number | null }).duration_seconds ??
      ((sess as { duration_min?: number | null }).duration_min
        ? ((sess as { duration_min: number }).duration_min) * 60
        : null);

    return {
      session: {
        id: sess.id,
        week_number: sess.week_number,
        day_key: sess.day_key,
        status: sess.status,
        started_at: sess.started_at,
        finished_at: sess.finished_at,
        duration_seconds: durationSec,
        estimated_calories: (sess as { estimated_calories?: number | null }).estimated_calories ?? null,
        completed_summary: ((sess as { completed_summary?: CompletedSessionDTO["session"]["completed_summary"] }).completed_summary ?? null),
      },
      set_logs: setRowsArr,
      running_log: (runRow ?? null) as RunningLogDTO | null,
      profile: {
        weight_kg: profile?.weight_kg ?? null,
        xp_total: profile?.xp_total ?? 0,
        level: profile?.level ?? 1,
        streak_current: profile?.streak_current ?? 0,
        streak_longest: profile?.streak_longest ?? 0,
      },
    };
  });

// ============================================================
// Salvar logs (idempotente — NÃO concede XP novamente)
// ============================================================

const setLogInputSchema = z.object({
  exercise_index: z.number().int().min(0),
  exercise_name: z.string().min(1).max(255),
  exercise_id: z.string().uuid().nullable().optional(),
  set_number: z.number().int().min(1),
  planned_reps: z.string().max(80).nullable().optional(),
  actual_reps: z.number().int().min(0).max(1000).nullable().optional(),
  planned_load_kg: z.number().min(0).max(1000).nullable().optional(),
  actual_load_kg: z.number().min(0).max(1000).nullable().optional(),
  planned_rpe: z.number().min(0).max(10).nullable().optional(),
  actual_rpe: z.number().min(0).max(10).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
  set_status: z.enum(["completed", "failed", "skipped"]).nullable().optional(),
});

const runningInputSchema = z.object({
  total_duration_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  total_running_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  total_rest_seconds: z.number().int().min(0).max(36000).nullable().optional(),
  distance_km: z.number().min(0).max(300).nullable().optional(),
  average_speed_kmh: z.number().min(0).max(50).nullable().optional(),
  max_speed_kmh: z.number().min(0).max(60).nullable().optional(),
  perceived_effort: z.number().int().min(1).max(10).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const saveWorkoutLogs = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        session_id: z.string().uuid(),
        estimated_calories: z.number().int().min(0).max(20000).nullable().optional(),
        set_logs: z.array(setLogInputSchema).max(200),
        running_log: runningInputSchema.nullable().optional(),
        general_notes: z.string().max(1000).nullable().optional(),
        perceived_effort: z.number().int().min(1).max(10).nullable().optional(),
        duration_feedback: z.enum(["too_short", "ok", "too_long"]).nullable().optional(),
        session_feedback: z
          .enum(["muito_leve", "leve", "ideal", "pesado", "muito_pesado"])
          .nullable()
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // garante que a sessão pertence ao usuário
    const { data: sess, error: sErr } = await supabase
      .from("workout_sessions")
      .select("id, user_id, status")
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .single();
    if (sErr || !sess) throw new Error("Sessão não encontrada.");

    // upsert dos sets — chave (workout_session_id, exercise_index, set_number)
    if (data.set_logs.length > 0) {
      const rows = data.set_logs.map((s) => ({
        user_id: userId,
        workout_session_id: data.session_id,
        exercise_id: s.exercise_id ?? null,
        exercise_index: s.exercise_index,
        exercise_name: s.exercise_name,
        set_number: s.set_number,
        planned_reps: s.planned_reps ?? null,
        actual_reps: s.actual_reps ?? null,
        planned_load_kg: s.planned_load_kg ?? null,
        actual_load_kg: s.actual_load_kg ?? null,
        planned_rpe: s.planned_rpe ?? null,
        actual_rpe: s.actual_rpe ?? null,
        notes: s.notes ?? null,
        set_status: s.set_status ?? "completed",
      }));
      const { error: uErr } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (rows: unknown[], opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("workout_set_logs")
        .upsert(rows, { onConflict: "workout_session_id,exercise_index,set_number" });
      if (uErr) throw new Error(uErr.message);
    }

    // running log: upsert único por sessão
    if (data.running_log) {
      const runRow = {
        user_id: userId,
        workout_session_id: data.session_id,
        total_duration_seconds: data.running_log.total_duration_seconds ?? null,
        total_running_seconds: data.running_log.total_running_seconds ?? null,
        total_rest_seconds: data.running_log.total_rest_seconds ?? null,
        distance_km: data.running_log.distance_km ?? null,
        average_speed_kmh: data.running_log.average_speed_kmh ?? null,
        max_speed_kmh: data.running_log.max_speed_kmh ?? null,
        perceived_effort: data.running_log.perceived_effort ?? null,
        notes: data.running_log.notes ?? null,
      };
      const { error: rErr } = await (supabase as unknown as {
        from: (t: string) => {
          upsert: (row: unknown, opts: { onConflict: string }) => Promise<{ error: { message: string } | null }>;
        };
      })
        .from("running_session_logs")
        .upsert(runRow, { onConflict: "workout_session_id" });
      if (rErr) throw new Error(rErr.message);
    }

    // calorias + resumo + nota geral na sessão
    const { error: upErr } = await supabase
      .from("workout_sessions")
      .update({
        estimated_calories: data.estimated_calories ?? null,
        notes: data.general_notes ?? null,
        completed_summary: {
          perceived_effort: data.perceived_effort ?? null,
          general_notes: data.general_notes ?? null,
          duration_feedback: data.duration_feedback ?? null,
          session_feedback: data.session_feedback ?? null,
          saved_at: new Date().toISOString(),
        },
        updated_at: new Date().toISOString(),
      } as never)
      .eq("id", data.session_id)
      .eq("user_id", userId);
    if (upErr) throw new Error(upErr.message);

    // Detecta PRs após salvar logs (idempotente)
    let newPRs: PRDetectedItem[] = [];
    try {
      const r = await runPRDetectionForSession(supabase, userId, data.session_id);
      newPRs = r.newPRs;
    } catch {
      // PR detection nunca deve quebrar o save
    }

    // Calcula Readiness Score (não quebra o save em caso de erro)
    let readiness: Awaited<ReturnType<typeof import("./engine/autoregulation.server").computeReadiness>> | null = null;
    try {
      const { computeReadiness } = await import("./engine/autoregulation.server");
      const { data: setRowsRaw } = await supabase
        .from("workout_set_logs")
        .select("planned_reps, actual_reps, planned_load_kg, actual_load_kg, set_status, created_at")
        .eq("workout_session_id", data.session_id);

      const sinceIso = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
      const { data: histSess } = await supabase
        .from("workout_sessions")
        .select("id, created_at, completed_summary")
        .eq("user_id", userId)
        .not("completed_at", "is", null)
        .gte("created_at", sinceIso)
        .neq("id", data.session_id);

      const historyArr: import("./engine/autoregulation.server").SessionForEngine[] = [];
      for (const h of histSess ?? []) {
        const { data: hs } = await supabase
          .from("workout_set_logs")
          .select("planned_reps, actual_reps, planned_load_kg, actual_load_kg, set_status")
          .eq("workout_session_id", h.id);
        const sm = (h.completed_summary ?? {}) as { session_feedback?: import("./engine/autoregulation.server").SessionFeedback | null };
        historyArr.push({
          id: h.id,
          created_at: h.created_at,
          feedback: sm.session_feedback ?? null,
          sets: (hs ?? []) as import("./engine/autoregulation.server").SetLogForEngine[],
        });
      }

      readiness = computeReadiness(
        {
          id: data.session_id,
          created_at: new Date().toISOString(),
          feedback: data.session_feedback ?? null,
          sets: (setRowsRaw ?? []) as import("./engine/autoregulation.server").SetLogForEngine[],
          pr_count: newPRs.length,
        },
        historyArr,
        12,
      );

      // upsert score
      const { data: existing } = await supabase
        .from("readiness_scores")
        .select("id")
        .eq("session_id", data.session_id)
        .eq("user_id", userId)
        .maybeSingle();
      if (existing) {
        await supabase
          .from("readiness_scores")
          .update({
            score: readiness.score,
            signals: readiness.signals as never,
            decision: readiness.decision as never,
          } as never)
          .eq("id", existing.id);
      } else {
        await supabase.from("readiness_scores").insert({
          user_id: userId,
          session_id: data.session_id,
          score: readiness.score,
          signals: readiness.signals as never,
          decision: readiness.decision as never,
        } as never);
      }
    } catch (e) {
      console.warn("Readiness compute failed", e);
    }

    return { ok: true, newPRs, readiness };
  });

// ============================================================
// Último peso por exercício — usado como sugestão no planejamento
// ============================================================

export const getLastWeightsForExercises = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ exercise_ids: z.array(z.string().uuid()) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<Record<string, number | null>> => {
    const { supabase, userId } = context;
    if (data.exercise_ids.length === 0) return {};

    const { data: rows } = await supabase
      .from("workout_set_logs")
      .select("exercise_id, actual_load_kg")
      .eq("user_id", userId)
      .in("exercise_id", data.exercise_ids)
      .not("actual_load_kg", "is", null)
      .order("created_at", { ascending: false });

    // Para cada exercise_id, pega o weight mais recente
    const result: Record<string, number | null> = {};
    for (const row of rows ?? []) {
      if (row.exercise_id && !(row.exercise_id in result)) {
        result[row.exercise_id] = row.actual_load_kg;
      }
    }
    return result;
  });
