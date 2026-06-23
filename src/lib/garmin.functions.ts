import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Garmin — pontes do app para as edge functions de integração Garmin.
// Pull (Health API) conecta via OAuth; push (Training API) envia o treino.
// Enquanto os secrets GARMIN_* não estiverem setados no backend, o connect
// responde "garmin_not_configured" (botão mostra "Em breve").
// ============================================================

export interface GarminStatus {
  connected: boolean;
  connected_at: string | null;
}

export const getGarminStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<GarminStatus> => {
    const { data } = await context.supabase
      .from("garmin_connections")
      .select("connected_at")
      .maybeSingle();
    return {
      connected: !!data,
      connected_at: (data as { connected_at: string } | null)?.connected_at ?? null,
    };
  });

export interface StartGarminResult {
  ok: boolean;
  url?: string;
  code?: string;
  error?: string;
}

export const startGarminConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ redirect_to: z.string().url().optional() }).parse(input ?? {}),
  )
  .handler(async ({ data, context }): Promise<StartGarminResult> => {
    try {
      const { data: res, error } = await context.supabase.functions.invoke("garmin-connect-start", {
        body: { redirect_to: data.redirect_to },
      });
      if (error) {
        // tenta extrair code do corpo (ex.: garmin_not_configured → 503)
        let code: string | undefined;
        try {
          const body = await (error as { context?: Response }).context?.json?.();
          code = (body as { code?: string })?.code;
        } catch {
          /* noop */
        }
        return { ok: false, code, error: "Não foi possível iniciar a conexão com o Garmin." };
      }
      const r = (res ?? {}) as { url?: string; code?: string };
      if (r.code)
        return { ok: false, code: r.code, error: "Integração Garmin ainda não disponível." };
      return { ok: !!r.url, url: r.url };
    } catch {
      return { ok: false, error: "Não foi possível iniciar a conexão com o Garmin." };
    }
  });

export const disconnectGarmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ ok: boolean }> => {
    // RLS já restringe à própria linha; filtra por user_id explicitamente.
    await context.supabase.from("garmin_connections").delete().eq("user_id", context.userId);
    await context.supabase
      .from("health_integrations")
      .update({ is_active: false })
      .eq("user_id", context.userId)
      .eq("platform", "garmin");
    return { ok: true };
  });

export interface PushWorkoutResult {
  ok: boolean;
  code?: string;
  error?: string;
}

export const pushWorkoutToGarmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ training_day_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<PushWorkoutResult> => {
    try {
      const { data: res, error } = await context.supabase.functions.invoke("garmin-push-workout", {
        body: { training_day_id: data.training_day_id },
      });
      if (error) {
        let code: string | undefined;
        try {
          const body = await (error as { context?: Response }).context?.json?.();
          code = (body as { code?: string })?.code;
        } catch {
          /* noop */
        }
        return { ok: false, code, error: "Não consegui enviar o treino pro Garmin." };
      }
      const r = (res ?? {}) as { pushed?: boolean; code?: string };
      if (r.code) return { ok: false, code: r.code };
      return { ok: !!r.pushed };
    } catch {
      return { ok: false, error: "Não consegui enviar o treino pro Garmin." };
    }
  });
