import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { Loader2, Check, Sparkles, Zap, Crown, X } from "lucide-react";
import { toast } from "sonner";
import { loadStripe } from "@stripe/stripe-js";
import { EmbeddedCheckoutProvider, EmbeddedCheckout } from "@stripe/react-stripe-js";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getMySubscription,
  startFreeTrial,
  createStripeEmbeddedCheckout,
  cancelStripeSubscription,
  getPremiumPrice,
} from "@/lib/subscription.functions";
import { useAuth } from "@/hooks/use-auth";
import { revenueCatAvailable, purchasePremium, restorePurchases } from "@/lib/revenuecat";

// "R$ 39,90" a partir do valor numérico.
function formatBRL(amount: number): string {
  return `R$ ${amount.toFixed(2).replace(".", ",")}`;
}
function intervalLabel(interval: string): string {
  return interval === "year" ? "ano" : "mês";
}

// Chave pública da Stripe (pode ir no bundle — é pública por design).
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string);

export const Route = createFileRoute("/assinaturas")({
  component: AssinaturasPage,
  head: () => ({ meta: [{ title: "Planos · PM Hybrid" }] }),
});

const FREE_FEATURES = [
  "Programa de 48 semanas",
  "Treinos diários personalizados",
  "Registro de séries e cargas",
  "Histórico de treinos",
  "Evolução básica",
];

const PREMIUM_FEATURES = [
  "Tudo do plano Grátis",
  "Chat com IA Coach",
  "Geração de treinos por IA",
  "5 coaches especializados",
  "Análise de recuperação",
  "Periodização inteligente",
  "Insights avançados",
  "Histórico completo",
  "Suporte prioritário",
  "Sem anúncios",
];

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
  const priceFn = useServerFn(getPremiumPrice);
  const qc = useQueryClient();
  const onIOS = revenueCatAvailable();

  // Preço vem da Stripe (fonte única) — nunca diverge do que é cobrado.
  const { data: price } = useQuery({
    queryKey: ["premium-price"],
    queryFn: () => priceFn(),
    staleTime: 60 * 60_000,
  });
  const priceText = price?.amount != null ? formatBRL(price.amount) : null;
  const intervalText = intervalLabel(price?.interval ?? "month");

  const [trialBusy, setTrialBusy] = useState(false);
  const [cancelBusy, setCancelBusy] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [iosBusy, setIosBusy] = useState(false);

  // Busca o client_secret da sessão embutida (chamado pelo EmbeddedCheckout).
  const fetchClientSecret = useCallback(
    () => embedFn().then((d) => d.client_secret),
    [embedFn],
  );

  // Voltou do checkout? O webhook é assíncrono — fazemos polling até o premium
  // aparecer (com teto de ~16s para não girar pra sempre).
  const justPaid =
    typeof window !== "undefined" &&
    new URLSearchParams(window.location.search).get("status") === "success";

  const { data: sub, isLoading } = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => fetchSub(),
    refetchInterval: (query) => {
      if (!justPaid) return false;
      const d = query.state.data as { plan?: string; billing_status?: string } | undefined;
      const prem = d?.plan === "premium_ai" && d?.billing_status === "active";
      if (prem) return false;
      if (query.state.dataUpdateCount > 8) return false; // desiste após ~16s
      return 2000;
    },
  });

  const isPremium = sub?.plan === "premium_ai" && sub?.billing_status === "active";
  const confirmingPayment = justPaid && !isPremium;
  const isTrialing = sub?.billing_status === "trialing";
  const trialAvailable = !sub?.trial_used && !isPremium && !isTrialing;
  const cancelScheduled = !!sub?.cancelled_at && isPremium;

  async function onCancel() {
    if (!confirm("Cancelar a assinatura? Você continua com acesso Premium até o fim do ciclo atual.")) return;
    setCancelBusy(true);
    try {
      const data = await cancelFn();
      toast.success(`Assinatura cancelada. Acesso Premium até ${formatDate(data.access_until)}.`);
      qc.invalidateQueries({ queryKey: ["subscription", "me"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("no_active_subscription")) toast.error("Nenhuma assinatura ativa encontrada.");
      else toast.error("Não foi possível cancelar. Tente novamente.");
    } finally {
      setCancelBusy(false);
    }
  }

  async function onStartTrial() {
    setTrialBusy(true);
    try {
      const data = await trialFn();
      toast.success(`Trial de 14 dias ativado! Expira em ${formatDate(data.trial_ends_at)}`);
      qc.invalidateQueries({ queryKey: ["subscription", "me"] });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("trial_already_used")) toast.error("Você já usou o período de trial.");
      else if (msg.includes("already_premium")) toast.info("Você já tem acesso Premium.");
      else toast.error("Não foi possível ativar o trial. Tente novamente.");
    } finally {
      setTrialBusy(false);
    }
  }

  async function onSubscribe() {
    // iOS: compra nativa da Apple (RevenueCat) — exigência da Apple.
    if (onIOS) {
      if (!user) return;
      setIosBusy(true);
      try {
        const r = await purchasePremium(user.id);
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
    // Web: checkout embutido da Stripe.
    setShowCheckout(true);
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
      <AppShell title="Assinatura" eyebrow="Plano">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell title="Assinatura" eyebrow="Plano">
      <div className="space-y-4 pb-4">
        {confirmingPayment && (
          <div className="glass flex items-center gap-3 rounded-2xl p-4 ring-1 ring-primary/20">
            <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold tracking-tight">Confirmando pagamento…</p>
              <p className="text-xs text-muted-foreground">
                Pode levar alguns segundos. Se demorar, toque em atualizar.
              </p>
            </div>
            <button
              onClick={() => qc.invalidateQueries({ queryKey: ["subscription", "me"] })}
              className="shrink-0 rounded-full border border-border/60 px-3 py-1.5 text-xs font-medium text-foreground hover:bg-surface"
            >
              Atualizar
            </button>
          </div>
        )}

        {isPremium && (
          <div className="glass rounded-2xl p-4 ring-1 ring-primary/20">
            <div className="flex items-center gap-3">
              <Crown className="h-5 w-5 shrink-0 text-primary" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold tracking-tight">Assinatura ativa</p>
                  <Badge variant="secondary" className="gap-1">
                    <Zap className="h-3 w-3" /> Premium AI
                  </Badge>
                </div>
                {cancelScheduled ? (
                  <p className="text-xs text-amber-400/90">
                    Cancelada · acesso até {formatDate(sub?.current_period_end ?? null)}
                  </p>
                ) : (
                  sub?.current_period_end && (
                    <p className="text-xs text-muted-foreground">
                      Renova em {formatDate(sub.current_period_end)}
                    </p>
                  )
                )}
              </div>
            </div>

            {!cancelScheduled && (
              <button
                onClick={onCancel}
                disabled={cancelBusy}
                className="mt-3 w-full rounded-xl border border-border/60 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
              >
                {cancelBusy ? "Cancelando…" : "Cancelar assinatura"}
              </button>
            )}
            {cancelScheduled && (
              <p className="mt-3 rounded-xl bg-surface/40 px-3 py-2 text-center text-[11px] leading-relaxed text-muted-foreground">
                Sua assinatura não será renovada. Você mantém o Premium até{" "}
                <span className="text-foreground">{formatDate(sub?.current_period_end ?? null)}</span>.
              </p>
            )}
          </div>
        )}

        {isTrialing && !isPremium && (
          <div className="glass flex items-center gap-3 rounded-2xl p-4 ring-1 ring-white/10">
            <Sparkles className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <p className="text-sm font-semibold tracking-tight">Trial Premium ativo</p>
              {sub?.trial_ends_at && (
                <p className="text-xs text-muted-foreground">
                  Expira em {formatDate(sub.trial_ends_at)}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Free plan card */}
        <div className={`glass rounded-2xl p-5 ${!isPremium && !isTrialing ? "ring-2 ring-primary/50" : ""}`}>
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              {!isPremium && !isTrialing && (
                <Badge className="mb-1 gap-1">
                  <Check className="h-3 w-3" /> Seu plano atual
                </Badge>
              )}
              <p className="mt-1 text-lg font-semibold tracking-tight">Grátis</p>
            </div>
            <p className="text-sm text-muted-foreground">R$ 0/mês</p>
          </div>
          <ul className="space-y-2">
            {FREE_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Premium card */}
        <div className={`glass relative overflow-hidden rounded-2xl p-5 ring-2 ${isPremium || isTrialing ? "ring-primary/60" : "ring-primary/20"}`}>
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                Premium
              </Badge>
              {(isPremium || isTrialing) && (
                <Badge className="gap-1">
                  <Check className="h-3 w-3" /> Seu plano atual
                </Badge>
              )}
            </div>
            <p className="text-lg font-semibold tracking-tight">Premium AI</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">{priceText ?? "—"}</span>
              <span className="text-sm text-muted-foreground">/{intervalText}</span>
            </div>
          </div>

          <ul className="mb-5 space-y-2">
            {PREMIUM_FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>

          {!isPremium && (
            <div className="space-y-2">
              {trialAvailable && (
                <Button onClick={onStartTrial} disabled={trialBusy} className="w-full" size="lg">
                  {trialBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Sparkles className="h-4 w-4" />
                  )}
                  Experimentar grátis por 14 dias
                </Button>
              )}
              <Button
                onClick={onSubscribe}
                disabled={iosBusy}
                variant={trialAvailable ? "outline" : "default"}
                className="w-full"
                size="lg"
              >
                {iosBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crown className="h-4 w-4" />}
                {isTrialing
                  ? "Assinar após o trial"
                  : priceText
                    ? `Assinar agora — ${priceText}/${intervalText}`
                    : "Assinar agora"}
              </Button>
              {onIOS && (
                <button
                  onClick={onRestore}
                  disabled={iosBusy}
                  className="w-full py-2 text-xs font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                >
                  Restaurar compras
                </button>
              )}
            </div>
          )}
        </div>

        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          🔒 {onIOS ? "Pagamento seguro via App Store." : "Pagamento seguro via Stripe."}
          <br />
          Cancele a qualquer momento.
        </p>
      </div>

      {/* Checkout embutido — formulário de cartão dentro do app, sem redirecionar */}
      {showCheckout && (
        <div className="fixed inset-0 z-50 flex flex-col bg-background safe-pad">
          <div className="flex items-center justify-between border-b border-border/40 px-4 py-3">
            <p className="text-sm font-semibold tracking-tight">Finalizar assinatura</p>
            <button
              onClick={() => setShowCheckout(false)}
              aria-label="Fechar"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-surface/70 text-foreground transition-colors hover:bg-surface"
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
