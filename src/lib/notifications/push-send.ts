// src/lib/notifications/push-send.ts
// =============================================================================
// SERVER-ONLY. Envia um push pra um usuário: checa preferências (gating por
// categoria), lê os device tokens e despacha por plataforma (APNs/FCM).
// Sem credenciais configuradas, os providers viram no-op logado (scaffold).
// Importar sempre de forma lazy dentro de handlers (server-only).
// =============================================================================

import { isCategoryAllowed, mergePrefs, type PushCategory } from "./schedule";

export interface PushPayload {
  category: PushCategory;
  title: string;
  body: string;
  route?: string; // deep link ao tocar
  data?: Record<string, string>;
}

export interface PushResult {
  sent: number;
  skipped: "prefs" | "no_tokens" | null;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<PushResult> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

  // 1) Preferências (gating). billing é transacional → sempre passa.
  const { data: prof } = await supabaseAdmin
    .from("profiles")
    .select("notification_prefs")
    .eq("id", userId)
    .maybeSingle();
  const prefs = mergePrefs(prof?.notification_prefs);
  if (!isCategoryAllowed(prefs, payload.category)) return { sent: 0, skipped: "prefs" };

  // 2) Tokens do usuário.
  const { data: tokens } = await supabaseAdmin
    .from("device_tokens")
    .select("token, platform")
    .eq("user_id", userId);
  const list = (tokens ?? []) as { token: string; platform: string }[];
  if (list.length === 0) return { sent: 0, skipped: "no_tokens" };

  // 3) Despacha por plataforma.
  const { sendApns, sendFcm } = await import("./push-providers.server");
  const data = { ...(payload.data ?? {}), ...(payload.route ? { route: payload.route } : {}) };
  const msg = { title: payload.title, body: payload.body, data };

  let sent = 0;
  await Promise.all(
    list.map(async (t) => {
      const ok =
        t.platform === "ios"
          ? await sendApns(t.token, msg)
          : t.platform === "android"
            ? await sendFcm(t.token, msg)
            : false;
      if (ok) sent++;
    }),
  );
  return { sent, skipped: null };
}
