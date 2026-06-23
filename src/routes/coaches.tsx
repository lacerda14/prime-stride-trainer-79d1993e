import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Sparkles, Loader2, ChevronRight } from "lucide-react";
import { listCoaches, type CoachDTO } from "@/lib/coach.functions";
import { getMySubscription } from "@/lib/subscription.functions";
import { CoachAvatar } from "@/components/coach-avatar";
import { TierCrown } from "@/components/tier-crown";
import { isProAccess } from "@/lib/tiers";
import { domainFor } from "@/lib/domains";
import { track } from "@/lib/analytics.functions";

export const Route = createFileRoute("/coaches")({
  head: () => ({ meta: [{ title: "Coaches · PM Hybrid" }] }),
  component: CoachesPage,
});

// Cor de destaque por persona (identidade visual). Classes completas p/ o Tailwind.
const ACCENT: Record<string, { color: string; border: string; text: string }> = {
  general: {
    color: "from-primary/20 to-primary/5",
    border: "border-primary/30",
    text: "text-primary",
  },
  strength: {
    color: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/20",
    text: "text-amber-400",
  },
  cardio: {
    color: "from-rose-500/20 to-rose-600/5",
    border: "border-rose-500/20",
    text: "text-rose-400",
  },
  corrida: {
    color: "from-sky-500/20 to-sky-600/5",
    border: "border-sky-500/20",
    text: "text-sky-400",
  },
  nutrition: {
    color: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/20",
    text: "text-emerald-400",
  },
  recovery: {
    color: "from-violet-500/20 to-violet-600/5",
    border: "border-violet-500/20",
    text: "text-violet-400",
  },
  mindset: {
    color: "from-indigo-500/20 to-indigo-600/5",
    border: "border-indigo-500/20",
    text: "text-indigo-400",
  },
  lpo: { color: "from-red-500/20 to-red-600/5", border: "border-red-500/20", text: "text-red-400" },
  calistenia: {
    color: "from-lime-500/20 to-lime-600/5",
    border: "border-lime-500/20",
    text: "text-lime-400",
  },
  crossfit: {
    color: "from-orange-500/20 to-orange-600/5",
    border: "border-orange-500/20",
    text: "text-orange-400",
  },
  casa: {
    color: "from-teal-500/20 to-teal-600/5",
    border: "border-teal-500/20",
    text: "text-teal-400",
  },
};
const FALLBACK_ACCENT = {
  color: "from-border/20 to-surface",
  border: "border-border/40",
  text: "text-primary",
};

// Pedro à prova de falha: se listCoaches vier vazia/errar, o coach principal
// ainda aparece (ele é sempre free e sempre disponível).
const PEDRO_FALLBACK: CoachDTO = {
  id: "pedro-fallback",
  persona: "general",
  name: "Pedro",
  specialty: "Coach híbrido principal",
  tone: "",
  description: null,
  emoji: "🧭",
  avatar_url:
    "https://tkpnghmpylkptkrsywkh.supabase.co/storage/v1/object/public/coach-avatars/general.png",
  is_premium: false,
  sort_order: 0,
  domain_slug: null,
};

function CoachesPage() {
  const fetchCoaches = useServerFn(listCoaches);
  const fetchSub = useServerFn(getMySubscription);

  const { data: coaches, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => fetchCoaches(),
  });
  const { data: subData } = useQuery({ queryKey: ["my-subscription"], queryFn: () => fetchSub() });

  const isPro = isProAccess(subData);

  const all = coaches ?? [];
  // Pedro (general / sem domínio) é o coach principal e SEMPRE deve aparecer —
  // se a lista vier vazia por qualquer motivo, cai no fallback abaixo.
  const pedro = all.find((c) => c.persona === "general" || !c.domain_slug) ?? PEDRO_FALLBACK;
  const specialists = all.filter((c) => c.domain_slug);

  return (
    <AppShell eyebrow="Time de coaches" title="Coaches">
      <div className="mx-auto max-w-2xl space-y-7 p-4 pb-16 sm:p-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface px-6 py-8 text-center">
          <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 shadow-glow">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Seu time de coaches</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              O <span className="font-medium text-foreground">Pedro</span> coordena toda a sua
              jornada. No <span className="font-medium text-foreground">Pro</span>, você destrava
              especialistas para cada objetivo.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            {/* Coach principal — Pedro */}
            {pedro && (
              <div className="space-y-3">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Seu coach principal
                </p>
                <Link
                  to="/coach-chat"
                  search={{ persona: "general" }}
                  className="relative block overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/15 to-primary/5 px-5 py-4 transition-colors hover:border-primary/40 active:scale-[0.99]"
                >
                  <div className="absolute right-3 top-3">
                    <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                      Incluído
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <CoachAvatar
                      url={pedro.avatar_url}
                      emoji={pedro.emoji}
                      size="h-12 w-12"
                      text="text-2xl"
                    />
                    <div className="flex-1 pr-16">
                      <div className="font-semibold tracking-tight">{pedro.name}</div>
                      <div className="text-[11px] text-primary/90">Coach híbrido principal</div>
                      <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                        Planeja, adapta e coordena todo o seu treino. Comece grátis e fale com ele
                        todo dia.
                      </p>
                      <div className="mt-2.5 inline-flex items-center gap-0.5 text-[11px] font-medium text-primary">
                        Conversar <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              </div>
            )}

            {/* Especialistas por DOMÍNIO (Pro) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Especialistas por objetivo
                </p>
                {!isPro && (
                  <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-400">
                    <TierCrown tier="pro" className="h-3 w-3" /> Pro
                  </span>
                )}
              </div>

              {specialists.map((coach: CoachDTO) => {
                const accent = ACCENT[coach.persona] ?? FALLBACK_ACCENT;
                const domain = domainFor(coach.domain_slug);
                const title = domain?.name ?? coach.specialty; // vende o DOMÍNIO (outcome)
                const outcome = domain?.outcome ?? coach.description ?? "";
                const locked = !isPro;
                return (
                  <Link
                    key={coach.id}
                    to={locked ? "/assinaturas" : "/coach-chat"}
                    search={locked ? undefined : { persona: coach.persona }}
                    onClick={() =>
                      locked &&
                      track("specialist_domain_locked_clicked", {
                        domain_slug: coach.domain_slug,
                        source_screen: "coaches",
                        target_plan: "pro",
                      })
                    }
                    className={`relative block overflow-hidden rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.color} px-5 py-4 transition-colors hover:border-primary/40 active:scale-[0.99] ${locked ? "opacity-90" : ""}`}
                  >
                    <div className="absolute right-3 top-3">
                      {locked ? (
                        <span className="flex items-center gap-1 rounded-full border border-amber-400/30 bg-amber-400/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-amber-400">
                          <TierCrown tier="pro" className="h-2.5 w-2.5" /> Pro
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                          Disponível
                        </span>
                      )}
                    </div>
                    <div className="flex items-start gap-3">
                      <CoachAvatar
                        url={coach.avatar_url}
                        emoji={coach.emoji}
                        size="h-11 w-11"
                        text="text-2xl"
                      />
                      <div className="flex-1 pr-16">
                        {/* O DOMÍNIO é o título (outcome); o nome do coach é a identidade interna. */}
                        <div className="font-semibold tracking-tight">{title}</div>
                        <div className={`text-[11px] ${accent.text}/90`}>com {coach.name}</div>
                        {outcome && (
                          <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                            {outcome}
                          </p>
                        )}
                        <div
                          className={`mt-2.5 inline-flex items-center gap-0.5 text-[11px] font-medium ${locked ? "text-amber-400" : accent.text}`}
                        >
                          {locked ? "Destravar no Pro" : "Conversar"}
                          <ChevronRight className="h-3.5 w-3.5" />
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>

            {/* CTA upgrade (só p/ quem não é Pro) */}
            {!isPro && (
              <Link
                to="/assinaturas"
                className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400/15"
              >
                <TierCrown tier="pro" className="h-4 w-4" />
                Destravar seu time completo
              </Link>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
