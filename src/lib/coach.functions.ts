import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Coach AI Reasoning (camada 3) — ponte do app para a edge function
// `coach-refine-session`. Invoca via supabase client autenticado do contexto;
// a edge fn faz RAG + Claude e devolve cues/técnica/estratégia por sessão.
// É OPCIONAL: qualquer falha degrada para "refined:false" (treino segue normal).
// ============================================================

export type CoachTechnique =
  | "straight" | "superset" | "rest_pause" | "drop_set" | "tempo" | "cluster" | "myo_reps";

export interface CoachRefinementExercise {
  slot: number;
  cue: string;
  technique: CoachTechnique;
  focus: string;
}

export interface CoachRefinement {
  session_strategy: string;
  exercises: CoachRefinementExercise[];
  sources_used: string[];
  confidence: number;
}

export interface CoachRefinementResult {
  refined: boolean;
  coach?: string;
  cached?: boolean;
  refinement?: CoachRefinement;
  reason?: string;
}

// ============================================================
// listCoaches — lista os coaches AI (ai_coaches) para a tela /coaches.
// PM Geral (persona 'general') é free; os demais exigem premium.
// ============================================================
export interface CoachDTO {
  id: string;
  persona: string;
  name: string;
  specialty: string;
  tone: string;
  description: string | null;
  emoji: string | null;
  avatar_url: string | null;
  is_premium: boolean;
  sort_order: number;
}

export const listCoaches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<CoachDTO[]> => {
    const { data, error } = await context.supabase
      .from("ai_coaches")
      .select("id, persona, name, specialty, tone, description, emoji, avatar_url, is_premium, sort_order")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error || !data) return [];
    return data as CoachDTO[];
  });

// ============================================================
// sendCoachMessage — chat com o coach (ponte p/ edge fn ai-coach-chat).
// Coach Geral é free (cota própria); específicos exigem premium.
// ============================================================
export interface CoachChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachChatResult {
  ok: boolean;
  message?: string;
  coach_name?: string;
  coach_persona?: string;
  remaining?: number;
  limit?: number;
  error?: string;
  code?: string;
}

export const sendCoachMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        message: z.string().min(1).max(4000),
        coach_persona: z.string().optional(),
        conversation_history: z
          .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string() }))
          .max(40)
          .optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<CoachChatResult> => {
    try {
      const { data: res, error } = await context.supabase.functions.invoke("ai-coach-chat", {
        body: {
          message: data.message,
          coach_persona: data.coach_persona,
          conversation_history: data.conversation_history ?? [],
        },
      });
      if (error) {
        // FunctionsHttpError expõe o Response em .context — extrai code/error do corpo
        let code: string | undefined;
        let msg: string | undefined;
        try {
          const body = await (error as { context?: Response }).context?.json?.();
          code = (body as { code?: string })?.code;
          msg = (body as { error?: string })?.error;
        } catch {
          /* noop */
        }
        return { ok: false, error: msg ?? "Não foi possível falar com o coach agora.", code };
      }
      const r = (res ?? {}) as Record<string, unknown>;
      return {
        ok: true,
        message: r.message as string,
        coach_name: r.coach_name as string,
        coach_persona: r.coach_persona as string,
        remaining: r.ai_requests_remaining as number,
        limit: r.ai_requests_limit as number,
      };
    } catch {
      return { ok: false, error: "Não foi possível falar com o coach agora." };
    }
  });

export const getCoachRefinement = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ training_day_id: z.string().uuid() }).parse(input),
  )
  .handler(async ({ data, context }): Promise<CoachRefinementResult> => {
    try {
      const { data: res, error } = await context.supabase.functions.invoke(
        "coach-refine-session",
        { body: { training_day_id: data.training_day_id } },
      );
      if (error) return { refined: false, reason: "invoke_error" };
      return (res ?? { refined: false }) as CoachRefinementResult;
    } catch {
      return { refined: false, reason: "exception" };
    }
  });
