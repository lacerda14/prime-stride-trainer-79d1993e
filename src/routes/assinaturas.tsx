import { createFileRoute } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Loader2, Check, Sparkles, Zap, Crown } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  getMySubscription,
  startFreeTrial,
  createMpPreference,
} from "@/lib/subscription.functions";

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

function openCheckout(url: string) {
  if (Capacitor.isNativePlatform()) {
    window.open(url, "_system");
  } else {
    window.open(url, "_blank");
  }
}

function AssinaturasPage() {
  const fetchSub = useServerFn(getMySubscription);
  const trialFn = useServerFn(startFreeTrial);
  const payFn = useServerFn(createMpPreference);
  const qc = useQueryClient();

  const [trialBusy, setTrialBusy] = useState(false);
  const [payBusy, setPayBusy] = useState(false);

  const { data: sub, isLoading } = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => fetchSub(),
  });

  const isPremium = sub?.plan === "premium_ai" && sub?.billing_status === "active";
  const isTrialing = sub?.billing_status === "trialing";
  const trialAvailable = !sub?.trial_used && !isPremium && !isTrialing;

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
    setPayBusy(true);
    try {
      const data = await payFn();
      if (!data?.checkout_url) {
        toast.error("Erro ao criar checkout.");
        return;
      }
      openCheckout(data.checkout_url);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.includes("missing_mp_token")) {
        toast.error("Pagamento ainda não está configurado.");
      } else {
        toast.error("Erro ao criar checkout. Tente novamente.");
      }
    } finally {
      setPayBusy(false);
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
        {isPremium && (
          <div className="glass flex items-center gap-3 rounded-2xl p-4 ring-1 ring-primary/20">
            <Crown className="h-5 w-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-semibold tracking-tight">Você é Premium AI</p>
              {sub?.current_period_end && (
                <p className="text-xs text-muted-foreground">
                  Renova em {formatDate(sub.current_period_end)}
                </p>
              )}
            </div>
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
        <div className="glass rounded-2xl p-5">
          <div className="mb-4 flex items-baseline justify-between">
            <div>
              <p className="text-[11px] uppercase tracking-widest text-muted-foreground">
                Plano Atual
              </p>
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
        <div className="glass relative overflow-hidden rounded-2xl p-5 ring-1 ring-primary/20">
          <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="mb-4">
            <div className="mb-2 flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <Zap className="h-3 w-3" />
                Premium
              </Badge>
            </div>
            <p className="text-lg font-semibold tracking-tight">Premium AI</p>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-semibold tracking-tight">R$ 49,90</span>
              <span className="text-sm text-muted-foreground">/mês</span>
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
                disabled={payBusy}
                variant={trialAvailable ? "outline" : "default"}
                className="w-full"
                size="lg"
              >
                {payBusy ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Crown className="h-4 w-4" />
                )}
                {isTrialing ? "Assinar após o trial" : "Assinar agora — R$ 49,90/mês"}
              </Button>
            </div>
          )}
        </div>

        <p className="px-2 text-center text-[11px] leading-relaxed text-muted-foreground">
          Pagamento seguro via Mercado Pago.
          <br />
          Cancele a qualquer momento.
        </p>
      </div>
    </AppShell>
  );
}
