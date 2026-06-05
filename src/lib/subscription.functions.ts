import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PREMIUM_PRICE_BRL = 49.9;
const TRIAL_DAYS = 14;

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan,billing_status,trial_used,trial_ends_at,current_period_end")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    return (
      data ?? {
        plan: "free",
        billing_status: "active",
        trial_used: false,
        trial_ends_at: null as string | null,
        current_period_end: null as string | null,
      }
    );
  });

export const startFreeTrial = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: readErr } = await supabaseAdmin
      .from("subscriptions")
      .select("plan,billing_status,trial_used")
      .eq("user_id", userId)
      .maybeSingle();
    if (readErr) throw new Error(readErr.message);

    if (existing?.plan === "premium_ai" && existing?.billing_status === "active") {
      throw new Error("already_premium");
    }
    if (existing?.trial_used) {
      throw new Error("trial_already_used");
    }

    const trialEndsAt = new Date(Date.now() + TRIAL_DAYS * 86400 * 1000).toISOString();

    const { error: upErr } = await supabaseAdmin
      .from("subscriptions")
      .upsert(
        {
          user_id: userId,
          plan: "premium_ai",
          billing_status: "trialing",
          trial_used: true,
          trial_ends_at: trialEndsAt,
        },
        { onConflict: "user_id" },
      );
    if (upErr) throw new Error(upErr.message);

    return { trial_ends_at: trialEndsAt };
  });

export const createMpPreference = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const token = process.env.MP_ACCESS_TOKEN;
    if (!token) throw new Error("missing_mp_token");

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? undefined;

    const siteUrl =
      process.env.PUBLIC_SITE_URL ?? "https://prime-stride-trainer.lovable.app";

    const body = {
      reason: "PM Hybrid — Premium AI",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PREMIUM_PRICE_BRL,
        currency_id: "BRL",
      },
      back_url: `${siteUrl}/assinaturas?mp=ok`,
      external_reference: userId,
      payer_email: email,
    };

    const res = await fetch("https://api.mercadopago.com/preapproval", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[mp] preapproval failed", res.status, txt);
      throw new Error("mp_preapproval_failed");
    }

    const json = (await res.json()) as { id?: string; init_point?: string };
    if (!json.init_point) throw new Error("mp_preapproval_no_init_point");

    // Stash preapproval id for webhook reconciliation
    if (json.id) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin
        .from("subscriptions")
        .update({ mp_preapproval_id: json.id })
        .eq("user_id", userId);
    }

    return { checkout_url: json.init_point };
  });
