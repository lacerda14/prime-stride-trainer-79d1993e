import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState, useEffect } from "react";
import { Loader2, Check, Sparkles, X } from "lucide-react";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { TierCrown } from "@/components/tier-crown";
import { TIERS, TIER_ORDER, tierFromPlan, formatBRL, type TierId } from "@/lib/tiers";
import {
  getMySubscription,
  startFreeTrial,
  createStripeEmbeddedCheckout,
  cancelStripeSubscription,
} from "@/lib/subscription.functions";
import { useAuth } from "@/hooks/use-auth";
import { revenueCatAvailable, purchasePremium, restorePurchases } from "@/lib/revenuecat";
import { track } from "@/lib/analytics.functions";

const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

export const Route = createFileRoute("/assinaturas")({
  component: AssinaturasPage,
  head: () => ({ meta: [{ title: "Planos · PM Hybrid" }] }),
});

// Copy outcome-first por tier (vende transformação, não feature). Pro lista
// DOMÍNIOS, nunca nomes de coach.
const TIER_COPY: Record<TierId, { bullets: string[]; cta: string }> = {
  free: {
    bullets: [
      "Treine com o Coach Pedro (5 conversas/dia)",
      "Plano adaptativo que evolui com você",
      "Registro e histórico de treinos",
    ],
    cta: "Começar grátis",
  },
  plus: {
    bullets: [
      "Coach Pedro liberado — 100 conversas/dia",
      "Seu plano se adapta conforme seu corpo responde",
      "Análises avançadas + histórico completo",
      "Sem anúncios",
    ],
    cta: "Destravar o Pedro",
  },
  pro: {
    bullets: [
      "Tudo do Plus",
      "Time completo de especialistas — Força, Corrida, Nutrição, Recuperação, Mentalidade e mais",
      "Conversas com a IA ilimitadas",
      "Comunidade: feed, ranking, grupos e desafios",
    ],
    cta: "Destravar time completo",
  },
};

function formatDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("pt-BR");
}

function AssinaturasPage() {
  const { user } = useAuth();
  const fetchSub = useServerFn(getMySubscription);
  const trialFn = useServerFn(startFreeTrial);
  const embedFn = useServerFn(createStripeEmbeddedCheckout);
  const cancelFn = useServerFn(cancelStripeSubscription);
  const qc = useQueryClient();
  const onIOS = revenueCatAvailable();

  const [trialBusy, setTrialBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [iosBusy, setIosBusy] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<"plus" | "pro" | null>(null);

  useEffect(() => track("paywall_viewed", { source_screen: "paywall" }), []);

  const fetchClientSecret = useCallback(
    () => embedFn({ data: { plan: checkoutPlan ?? "pro" } }).then((d) => d.client_secret),
    [embedFn, checkoutPlan],
  );

  const justPaid =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("status") === "success";

  const { data: sub, isLoading } = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => fetchSub(),
    refetchInterval: (query) => {
      if (!justPaid) return false;
      const d = query.state.data as { plan?: string; billing_status?: string } | undefined;
      const paid = d?.plan && d.plan !== "free" && d.billing_status === "active";
      if (paid) return false;
      if (query.state.dataUpdateCount > 8) return false;
      return 2000;
    },
  });

  const currentTier: TierId = tierFromPlan(sub?.plan);
  const isPaid = currentTier !== "free" && sub?.billing_status === "active";
  const confirmingPayment = justPaid && !isPaid;
  const isTrialing = sub?.billing_status === "trialing";
  const trialAvailable = !sub?.trial_used && !isPaid && !isTrialing;
  const cancelScheduled = !!sub?.cancelled_at && isPaid;

  // Conversão concluída (voltou do checkout e o premium ativou).
  useEffect(() => {
    if (justPaid && isPaid) track("checkout_completed", { plan: sub?.plan });
  }, [justPaid, isPaid, sub?.plan]);

  async function onCancel() {
    if (!confirm("Cancelar a assinatura? Você mantém o acesso até o fim do ciclo atual.")) return;
    setCancelBusy(true);
    try {
      const data = await cancelFn();
      toast.success(`Assinatura cancelada. Acesso até ${formatDate(data.access_until)}.`);
      qc.invalidateQueries({ queryKey: ["subscription", "me"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("no_active_subscription"))
        toast.error("Nenhuma assinatura ativa encontrada.");
      else toast.error("Não foi possível cancelar. Tente novamente.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function onStartTrial() {
    track("trial_started", { source_screen: "paywall" });
    setTrialBusy(true);
    try {
      const data = await trialFn();
      toast.success(`Trial de 14 dias ativado! Expira em ${formatDate(data.trial_ends_at)}`);
      qc.invalidateQueries({ queryKey: ["subscription", "me"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("trial_already_used")) toast.error("Você já usou o período de trial.");
      else if (msg.includes("already_premium")) toast.info("Você já tem acesso premium.");
      else toast.error("Não foi possível ativar o trial. Tente novamente.");
    } finally {
      setTrialBusy(false);
    }
  }

  async function onSubscribe(plan: "plus" | "pro") {
    track("checkout_started", {
      target_plan: plan,
      source_screen: "paywall",
      billing_period: "monthly",
    });
    if (onIOS) {
      if (!user) return;
      setIosBusy(true);
      try {
        const r = await purchasePremium(user.id, plan);
        if (r.success) {
          toast.success("Assinatura ativada! 👑");
          qc.invalidateQueries({ queryKey: ["subscription", "me"] });
        } else if (!r.cancelled) {
          toast.error(r.error ? `Erro: ${r.error}` : "Não foi possível concluir a compra.");
        }
      } finally {
        setIosBusy(false);
      }
      return;
    }
    setCheckoutPlan(plan); // Web: abre o checkout embutido da Stripe p/ o plano.
  }

  async function onRestore() {
    if (!user) return;
    setIosBusy(true);
    try {
      const ok = await restorePurchases(user.id);
      if (ok) {
        toast.success("Compras restauradas!");
        qc.invalidateQueries({ queryKey: ["subscription", "me"] });
      } else {
        toast.info("Nenhuma assinatura encontrada para restaurar.");
      }
    } finally {
      setIosBusy(false);
    }
  }

  if (isLoading) {
    return (
      <AppShell title="Planos" eyebrow="Assinatura">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Planos" eyebrow="Assinatura">
      <div className="space-y-4 pb-6">
        {/* Headline (outcome) */}
        <div className="px-1 pt-1 text-center">
          <h1 className="text-xl font-semibold tracking-tight">Seu coach híbrido, no seu bolso</h1>
          <p className="mx-auto mt-1 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
            Treine com orientação que se adapta a você — e evolua mais rápido.
          </p>
        </div>

        {confirmingPayment && (
          <div className="glass flex items-center gap-3 rounded-2xl p-4 ring-1 ring-primary/20">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold tracking-tight">Confirmando pagamento…</p>
              <p className="text-xs text-muted-foreground">Pode levar alguns segundos.</p>
            </div>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["subscription", "me"] })}
              className="shrink-0 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium hover:bg-surface"
            >
              Atualizar
            </button>
          </div>
        )}

        {isTrialing && !isPaid && (
          <div className="glass flex items-center gap-3 rounded-2xl p-4 ring-1 ring-white/10">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold tracking-tight">Trial ativo</p>
              {sub?.trial_ends_at && (
                <p className="text-xs text-muted-foreground">
                  Expira em {formatDate(sub.trial_ends_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Cards dos 3 tiers */}
        {TIER_ORDER.map((tier) => {
          const meta = TIERS[tier];
          const copy = TIER_COPY[tier];
          const isCurrent =
            currentTier === tier && (tier === "free" ? !isPaid && !isTrialing : isPaid);
          const highlight = tier === "pro";
          return (
            <div
              key={tier}
              className={`glass relative overflow-hidden rounded-2xl p-5 ring-2 ${
                isCurrent ? "ring-primary/60" : highlight ? "ring-amber-400/30" : "ring-white/5"
              }`}
            >
              {highlight && (
                <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-amber-400/10 blur-3xl" />
              )}

              {/* Header: coroa + nome + preço */}
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <TierCrown tier={tier} className="h-6 w-6" />
                  <div>
                    <p className="text-lg font-semibold leading-none tracking-tight">{meta.name}</p>
                    <p className="mt-1 text-[11px] text-muted-foreground">{meta.tagline}</p>
                  </div>
                </div>
                <div className="text-right">
                  {tier === "free" ? (
                    <p className="text-sm font-semibold">Grátis</p>
                  ) : (
                    <>
                      <p className="text-xl font-semibold leading-none tracking-tight">
                        {formatBRL(meta.priceMonthly!)}
                      </p>
                      <p className="text-[10px] text-muted-foreground">/mês</p>
                      {meta.priceAnnual && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          ou {formatBRL(meta.priceAnnual)}/ano
                        </p>
                      )}
                    </>
                  )}
                </div>
              </div>

              {isCurrent && (
                <div className="mb-3 inline-flex items-center gap-1 rounded-full border border-primary/40 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                  <Check className="h-3 w-3" /> Seu plano atual
                </div>
              )}

              {/* Bullets (outcome) */}
              <ul className="mb-4 space-y-2">
                {copy.bullets.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-[13px]">
                    <Check
                      className={`mt-0.5 h-4 w-4 shrink-0 ${highlight ? "text-amber-400" : "text-primary"}`}
                    />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {tier !== "free" && !isCurrent && (
                <div className="space-y-2">
                  {tier === "pro" && trialAvailable && (
                    <Button
                      onClick={onStartTrial}
                      disabled={trialBusy}
                      className="w-full"
                      size="lg"
                    >
                      {trialBusy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4" />
                      )}
                      Experimentar grátis por 14 dias
                    </Button>
                  )}
                  <Button
                    onClick={() => onSubscribe(tier)}
                    disabled={iosBusy}
                    variant={tier === "pro" && trialAvailable ? "outline" : "default"}
                    className="w-full"
                    size="lg"
                  >
                    {iosBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <TierCrown tier={tier} className="h-4 w-4" />
                    )}
                    {copy.cta}
                  </Button>
                </div>
              )}

              {/* Gestão da assinatura ativa (no card do tier atual pago) */}
              {isCurrent && isPaid && tier !== "free" && (
                <>
                  {cancelScheduled ? (
                    <p className="rounded-xl bg-surface/40 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                      Não será renovada. Acesso até{" "}
                      <span className="text-foreground">
                        {formatDate(sub?.current_period_end ?? null)}
                      </span>
                      .
                    </p>
                  ) : (
                    <>
                      {sub?.current_period_end && (
                        <p className="mb-2 text-center text-[11px] text-muted-foreground">
                          Renova em {formatDate(sub.current_period_end)}
                        </p>
                      )}
                      <button
                        onClick={onCancel}
                        disabled={cancelBusy}
                        className="w-full rounded-xl border border-border/60 py-2.5 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                      >
                        {cancelBusy ? "Cancelando…" : "Cancelar assinatura"}
                      </button>
                    </>
                  )}
                </>
              )}
            </div>
          );
        })}

        {onIOS && !isPaid && (
          <button
            onClick={onRestore}
            disabled={iosBusy}
            className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
          >
            Restaurar compras
          </button>
        )}

        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          🔒 {onIOS ? "Pagamento seguro via App Store." : "Pagamento seguro via Stripe."}
          <br />
          Cancele a qualquer momento.
        </p>
      </div>

      {/* Checkout embutido (web) */}
      {checkoutPlan && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background safe-pad">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <p className="text-sm font-semibold tracking-tight">
              Assinar {TIERS[checkoutPlan].name}
            </p>
            <button
              onClick={() => setCheckoutPlan(null)}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 hover:bg-surface"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto">
            <EmbeddedCheckoutProvider stripe={stripePromise} options={{ fetchClientSecret }}>
              <EmbeddedCheckout />
            </EmbeddedCheckoutProvider>
          </div>
        </div>
      )}
    </AppShell>
  );
}
