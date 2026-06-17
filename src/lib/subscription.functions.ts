import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner";

const TRIAL_DAYS = 14;

// Premium "vitalício" sintético — usado pro owner (sempre premium) e comps.
const LIFETIME_PREMIUM = {
  plan: "premium_ai" as const,
  billing_status: "active" as const,
  trial_used: false,
  trial_ends_at: null as string | null,
  current_period_end: null as string | null,
  cancelled_at: null as string | null,
  external_subscription_id: null as string | null,
  payment_provider: "owner" as string | null,
};

export const getMySubscription = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    // Owner (pedrolacerda.m@gmail.com) é SEMPRE premium, independente do banco.
    const { data: userData } = await supabase.auth.getUser();
    if (isOwnerEmail(userData.user?.email)) return LIFETIME_PREMIUM;

    const { data, error } = await supabase
      .from("subscriptions")
      .select("plan,billing_status,trial_used,trial_ends_at,current_period_end,cancelled_at,external_subscription_id,payment_provider")
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
        cancelled_at: null as string | null,
        external_subscription_id: null as string | null,
        payment_provider: null as string | null,
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

// ── Stripe (provedor principal) ───────────────────────────────
// Cria uma Checkout Session de assinatura. client_reference_id = userId é o
// que o stripe-webhook usa pra ativar premium_ai. Secrets no worker:
// STRIPE_SECRET_KEY (sk_...) e STRIPE_PRICE_ID (price_... do premium_ai).
export const createStripeCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const key = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!key) throw new Error("missing_stripe_key");
    if (!priceId) throw new Error("missing_stripe_price");

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? undefined;
    const siteUrl = process.env.PUBLIC_SITE_URL ?? "https://pm-hybrid.pedrolacerda-m.workers.dev";

    // Reusa o customer Stripe se já existir (evita duplicar cliente)
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("external_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const form = new URLSearchParams();
    form.set("mode", "subscription");
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set("client_reference_id", userId);
    form.set("subscription_data[metadata][user_id]", userId);
    form.set("success_url", `${siteUrl}/assinaturas?status=success`);
    form.set("cancel_url", `${siteUrl}/assinaturas?status=cancel`);
    form.set("allow_promotion_codes", "true");
    if (sub?.external_customer_id) form.set("customer", sub.external_customer_id as string);
    else if (email) form.set("customer_email", email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[stripe] checkout failed", res.status, txt);
      throw new Error("stripe_checkout_failed");
    }
    const json = (await res.json()) as { url?: string };
    if (!json.url) throw new Error("stripe_checkout_no_url");
    return { checkout_url: json.url };
  });

// Preço do Premium direto da Stripe (fonte única) — evita divergência entre o
// que o site mostra e o que é cobrado. Retorna valor em reais + intervalo.
export const getPremiumPrice = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async (): Promise<{ amount: number | null; currency: string; interval: string }> => {
    const key = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!key || !priceId) return { amount: null, currency: "brl", interval: "month" };
    try {
      const res = await fetch(`https://api.stripe.com/v1/prices/${priceId}`, {
        headers: { Authorization: `Bearer ${key}` },
      });
      if (!res.ok) return { amount: null, currency: "brl", interval: "month" };
      const p = (await res.json()) as {
        unit_amount?: number;
        currency?: string;
        recurring?: { interval?: string };
      };
      return {
        amount: p.unit_amount != null ? p.unit_amount / 100 : null,
        currency: p.currency ?? "brl",
        interval: p.recurring?.interval ?? "month",
      };
    } catch {
      return { amount: null, currency: "brl", interval: "month" };
    }
  });

// Checkout EMBUTIDO (ui_mode=embedded) — o formulário de cartão aparece dentro
// do site, sem redirecionar. Retorna client_secret pro EmbeddedCheckout do front.
export const createStripeEmbeddedCheckout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId, supabase } = context;
    const key = process.env.STRIPE_SECRET_KEY;
    const priceId = process.env.STRIPE_PRICE_ID;
    if (!key) throw new Error("missing_stripe_key");
    if (!priceId) throw new Error("missing_stripe_price");

    const { data: userData } = await supabase.auth.getUser();
    const email = userData.user?.email ?? undefined;
    const siteUrl = process.env.PUBLIC_SITE_URL ?? "https://pm-hybrid.pedrolacerda-m.workers.dev";

    // Garante que existe uma linha em subscriptions ANTES do checkout — o webhook
    // (activatePlan) lança erro se não houver linha, e o premium nunca ativa.
    // ignoreDuplicates: não sobrescreve um plano já existente.
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin
      .from("subscriptions")
      .upsert({ user_id: userId, plan: "free", billing_status: "active" }, { onConflict: "user_id", ignoreDuplicates: true });

    const { data: sub } = await supabase
      .from("subscriptions")
      .select("external_customer_id")
      .eq("user_id", userId)
      .maybeSingle();

    const form = new URLSearchParams();
    // API nova (2026 dahlia) renomeou "embedded" → "embedded_page".
    form.set("ui_mode", "embedded_page");
    form.set("mode", "subscription");
    form.set("line_items[0][price]", priceId);
    form.set("line_items[0][quantity]", "1");
    form.set("client_reference_id", userId);
    form.set("subscription_data[metadata][user_id]", userId);
    form.set("return_url", `${siteUrl}/assinaturas?status=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("allow_promotion_codes", "true");
    if (sub?.external_customer_id) form.set("customer", sub.external_customer_id as string);
    else if (email) form.set("customer_email", email);

    const res = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[stripe] embedded checkout failed", res.status, txt);
      throw new Error("stripe_checkout_failed");
    }
    const json = (await res.json()) as { client_secret?: string };
    if (!json.client_secret) throw new Error("stripe_checkout_no_secret");
    return { client_secret: json.client_secret };
  });

// Cancela a assinatura no FIM DO CICLO (cancel_at_period_end). O acesso premium
// continua até current_period_end; o webhook customer.subscription.deleted
// reverte pra free quando o ciclo termina. Marca cancelled_at pra UI saber.
export const cancelStripeSubscription = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("missing_stripe_key");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: sub } = await supabaseAdmin
      .from("subscriptions")
      .select("external_subscription_id,current_period_end")
      .eq("user_id", userId)
      .maybeSingle();

    const subId = sub?.external_subscription_id as string | undefined;
    if (!subId) throw new Error("no_active_subscription");

    const form = new URLSearchParams();
    form.set("cancel_at_period_end", "true");
    const res = await fetch(`https://api.stripe.com/v1/subscriptions/${subId}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      console.error("[stripe] cancel failed", res.status, txt);
      throw new Error("stripe_cancel_failed");
    }
    const json = (await res.json()) as { current_period_end?: number; cancel_at_period_end?: boolean };
    const periodEnd = json.current_period_end
      ? new Date(json.current_period_end * 1000).toISOString()
      : (sub?.current_period_end as string | null) ?? null;

    // Marca o agendamento de cancelamento (acesso segue até o fim do ciclo).
    await supabaseAdmin
      .from("subscriptions")
      .update({ cancelled_at: new Date().toISOString(), current_period_end: periodEnd, updated_at: new Date().toISOString() })
      .eq("user_id", userId);

    return { cancel_at_period_end: true, access_until: periodEnd };
  });
