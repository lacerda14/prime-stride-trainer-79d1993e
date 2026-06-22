// src/lib/push.functions.ts
// =============================================================================
// Registro de device tokens pra push remoto (Fase 2). O envio em si fica no
// pipeline server (Edge Function) — aqui só guardamos/limpamos o token.
//
// registerDeviceToken usa SERVICE ROLE: um token pode migrar de usuário (device
// compartilhado / re-login), e a RLS não deixaria o usuário atual "tomar" um
// token que está atrelado a outro. Como o token vem do registro autenticado do
// próprio device, reatribuir pro usuário logado é seguro.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverError } from "@/lib/server-errors";

export const registerDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        token: z.string().trim().min(10).max(500),
        platform: z.enum(["ios", "android", "web"]),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("device_tokens").upsert(
      {
        token: data.token,
        user_id: userId,
        platform: data.platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: "token" },
    );
    if (error) serverError("Não foi possível registrar o dispositivo.", error);
    return { ok: true };
  });

export const removeDeviceToken = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ token: z.string().trim().min(10).max(500) }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    // User-scoped: a RLS (delete own) já garante que só apaga o próprio.
    const { error } = await supabase
      .from("device_tokens")
      .delete()
      .eq("token", data.token)
      .eq("user_id", userId);
    if (error) serverError("Não foi possível remover o dispositivo.", error);
    return { ok: true };
  });
