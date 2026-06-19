// src/lib/analytics.functions.ts
// =============================================================================
// Funil de conversão. `track()` (cliente, fire-and-forget) → server fn que grava
// em analytics_events com o plano atual (plan_at_event). Nunca quebra a UX.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Json } from "@/integrations/supabase/types";

export type AnalyticsEvent =
  | "paywall_viewed"
  | "plan_selected"
  | "checkout_started"
  | "checkout_completed"
  | "checkout_failed"
  | "trial_started"
  | "plan_upgraded"
  | "plan_downgraded"
  | "locked_feature_clicked"
  | "specialist_domain_viewed"
  | "specialist_domain_locked_clicked"
  | "coach_chat_started"
  | "ai_limit_reached"
  | "founder_offer_viewed"
  | "founder_offer_started"
  | "social_locked_clicked";

export const trackEvent = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => {
    const i = (input ?? {}) as { event_name?: string; properties?: Json };
    return { event_name: String(i.event_name ?? "unknown"), properties: i.properties ?? {} };
  })
  .handler(async ({ context, data }) => {
    const { userId } = context;
    try {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      const { data: sub } = await supabaseAdmin
        .from("subscriptions")
        .select("plan")
        .eq("user_id", userId)
        .maybeSingle();
      await supabaseAdmin.from("analytics_events").insert({
        user_id: userId,
        event_name: data.event_name,
        plan_at_event: sub?.plan ?? "free",
        properties: data.properties,
      });
    } catch {
      /* analytics nunca derruba o request */
    }
    return { ok: true };
  });

/** Fire-and-forget no cliente. Nunca lança. */
export function track(event_name: AnalyticsEvent, properties: Record<string, unknown> = {}): void {
  try {
    void trackEvent({ data: { event_name, properties } });
  } catch {
    /* noop */
  }
}
