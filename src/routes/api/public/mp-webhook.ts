import { createFileRoute } from "@tanstack/react-router";

/**
 * Mercado Pago preapproval / payment webhook.
 * Re-fetches the resource from MP API to avoid trusting the raw payload,
 * then updates the matching subscription by external_reference (user_id).
 *
 * Configure on MP dashboard:
 *   https://project--{project-id}.lovable.app/api/public/mp-webhook
 */
export const Route = createFileRoute("/api/public/mp-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const token = process.env.MP_ACCESS_TOKEN;
        if (!token) return new Response("missing_token", { status: 500 });

        let payload: { type?: string; action?: string; data?: { id?: string } };
        try {
          payload = await request.json();
        } catch {
          return new Response("bad_json", { status: 400 });
        }

        const resourceId = payload?.data?.id;
        const kind = payload?.type ?? payload?.action ?? "";
        if (!resourceId) return new Response("ok");

        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

        try {
          if (kind.includes("preapproval")) {
            const res = await fetch(`https://api.mercadopago.com/preapproval/${resourceId}`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            if (!res.ok) return new Response("mp_fetch_failed", { status: 502 });
            const pa = (await res.json()) as {
              id: string;
              status: string;
              external_reference?: string;
              next_payment_date?: string;
              payer_id?: number;
            };
            const userId = pa.external_reference;
            if (!userId) return new Response("ok");

            const isActive = pa.status === "authorized";
            await supabaseAdmin
              .from("subscriptions")
              .update({
                plan: isActive ? "premium_ai" : "free",
                billing_status: isActive ? "active" : pa.status,
                current_period_end: pa.next_payment_date ?? null,
                mp_preapproval_id: pa.id,
                mp_customer_id: pa.payer_id ? String(pa.payer_id) : null,
              })
              .eq("user_id", userId);
          }
          return new Response("ok");
        } catch (e) {
          console.error("[mp-webhook] error", e);
          return new Response("error", { status: 500 });
        }
      },
    },
  },
});
