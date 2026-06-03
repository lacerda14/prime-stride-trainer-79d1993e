import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  computeReadiness,
  type SessionForEngine,
  type SessionFeedback,
  type ReadinessResult,
} from "./autoregulation.server";

// Calcula o readiness da sessão e persiste em readiness_scores.
// Idempotente: se já houver score para a sessão, atualiza.
export const computeReadinessForSession = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ session_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<ReadinessResult> => {
    const { supabase, userId } = context;

    // sessão atual + sets
    const { data: sess } = await supabase
      .from("workout_sessions")
      .select("id, created_at, completed_summary")
      .eq("id", data.session_id)
      .eq("user_id", userId)
      .single();
    if (!sess) throw new Error("Sessão não encontrada");

    const { data: setRows } = await supabase
      .from("workout_set_logs")
      .select("planned_reps, actual_reps, planned_load_kg, actual_load_kg, set_status")
      .eq("workout_session_id", data.session_id);

    const summary = (sess.completed_summary ?? {}) as { session_feedback?: SessionFeedback | null };
    const current: SessionForEngine = {
      id: sess.id,
      created_at: sess.created_at,
      feedback: summary.session_feedback ?? null,
      sets: (setRows ?? []) as SessionForEngine["sets"],
    };

    // histórico últimos 28 dias
    const since = new Date(Date.now() - 28 * 24 * 60 * 60 * 1000).toISOString();
    const { data: histSess } = await supabase
      .from("workout_sessions")
      .select("id, created_at, completed_summary")
      .eq("user_id", userId)
      .not("completed_at", "is", null)
      .gte("created_at", since)
      .neq("id", data.session_id);

    const history: SessionForEngine[] = [];
    for (const h of histSess ?? []) {
      const { data: hs } = await supabase
        .from("workout_set_logs")
        .select("planned_reps, actual_reps, planned_load_kg, actual_load_kg, set_status")
        .eq("workout_session_id", h.id);
      const sm = (h.completed_summary ?? {}) as { session_feedback?: SessionFeedback | null };
      history.push({
        id: h.id,
        created_at: h.created_at,
        feedback: sm.session_feedback ?? null,
        sets: (hs ?? []) as SessionForEngine["sets"],
      });
    }

    // assume 3 sessões/sem como baseline → 12 em 4 sem
    const result = computeReadiness(current, history, 12);

    // upsert (1 score por sessão)
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
          score: result.score,
          signals: result.signals as never,
          decision: result.decision as never,
        } as never)
        .eq("id", existing.id);
    } else {
      await supabase.from("readiness_scores").insert({
        user_id: userId,
        session_id: data.session_id,
        score: result.score,
        signals: result.signals as never,
        decision: result.decision as never,
      } as never);
    }

    return result;
  });

export const getLatestReadiness = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("readiness_scores")
      .select("id, session_id, score, signals, decision, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data ?? null;
  });
