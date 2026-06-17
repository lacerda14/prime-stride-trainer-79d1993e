import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Sparkles, MessageSquare, Brain, Zap, Lock, Loader2, ChevronRight } from "lucide-react";
import { listCoaches, type CoachDTO } from "@/lib/coach.functions";
import { getMySubscription } from "@/lib/subscription.functions";
import { CoachAvatar } from "@/components/coach-avatar";

export const Route = createFileRoute("/coaches")({
  head: () => ({
    meta: [{ title: "Coaches AI · PM Hybrid" }],
  }),
  component: CoachesPage,
});

// Cor de destaque por persona (DB não guarda cor).
// Cor distinta por coach (identidade visual). Classes completas p/ o Tailwind detectar.
const ACCENT: Record<string, { color: string; border: string; text: string }> = {
  general:    { color: "from-primary/20 to-primary/5",         border: "border-primary/30",     text: "text-primary" },
  strength:   { color: "from-amber-500/20 to-amber-600/5",     border: "border-amber-500/20",   text: "text-amber-400" },
  cardio:     { color: "from-rose-500/20 to-rose-600/5",       border: "border-rose-500/20",    text: "text-rose-400" },
  corrida:    { color: "from-sky-500/20 to-sky-600/5",         border: "border-sky-500/20",     text: "text-sky-400" },
  nutrition:  { color: "from-emerald-500/20 to-emerald-600/5", border: "border-emerald-500/20", text: "text-emerald-400" },
  recovery:   { color: "from-violet-500/20 to-violet-600/5",   border: "border-violet-500/20",  text: "text-violet-400" },
  mindset:    { color: "from-indigo-500/20 to-indigo-600/5",   border: "border-indigo-500/20",  text: "text-indigo-400" },
  lpo:        { color: "from-red-500/20 to-red-600/5",         border: "border-red-500/20",     text: "text-red-400" },
  calistenia: { color: "from-lime-500/20 to-lime-600/5",       border: "border-lime-500/20",    text: "text-lime-400" },
  crossfit:   { color: "from-orange-500/20 to-orange-600/5",   border: "border-orange-500/20",  text: "text-orange-400" },
  casa:       { color: "from-teal-500/20 to-teal-600/5",       border: "border-teal-500/20",    text: "text-teal-400" },
};
const FALLBACK_ACCENT = { color: "from-border/20 to-surface", border: "border-border/40", text: "text-primary" };

const FEATURES = [
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Chat em tempo real",
    description: "Converse com o coach sobre qualquer dúvida do seu treino, recuperação ou nutrição.",
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: "Base de conhecimento própria",
    description: "Cada coach consulta uma base científica do seu domínio; o PM Geral consulta tudo.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Análise do seu histórico",
    description: "O coach lê seus treinos, pesos, ACWR e sono para dar respostas personalizadas.",
  },
];

function CoachesPage() {
  const fetchCoaches = useServerFn(listCoaches);
  const fetchSub = useServerFn(getMySubscription);

  const { data: coaches, isLoading } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => fetchCoaches(),
  });
  const { data: subData } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
  });

  const isPremium =
    (subData?.plan === "premium_ai" && subData?.billing_status === "active") ||
    subData?.billing_status === "trialing";

  return (
    <AppShell eyebrow="Premium" title="Coaches AI">
      <div className="mx-auto max-w-2xl space-y-8 p-4 pb-16 sm:p-6">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface px-6 py-8 text-center">
          <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 shadow-glow">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <h1 className="mt-1 text-2xl font-semibold tracking-tight">Coaches AI personalizados</h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Especialistas treinados com seu histórico e uma base de conhecimento própria por domínio.
              Comece grátis com o <span className="font-medium text-foreground">PM Geral</span>.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            O que você tem acesso
          </p>
          {FEATURES.map((f) => (
            <div key={f.title} className="flex items-start gap-4 rounded-2xl border border-border/60 bg-surface/50 px-4 py-4">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                {f.icon}
              </div>
              <div>
                <div className="text-sm font-semibold">{f.title}</div>
                <div className="mt-0.5 text-xs text-muted-foreground">{f.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Coaches (DB-driven) */}
        <div className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Conheça os coaches
          </p>

          {isLoading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            (coaches ?? []).map((coach: CoachDTO) => {
              const accent = ACCENT[coach.persona] ?? FALLBACK_ACCENT;
              const locked = coach.is_premium && !isPremium;
              return (
                <Link
                  key={coach.id}
                  to="/coach-chat"
                  search={{ persona: coach.persona }}
                  className={`relative block overflow-hidden rounded-2xl border ${accent.border} bg-gradient-to-br ${accent.color} px-5 py-4 transition-colors hover:border-primary/40 active:scale-[0.99] ${locked ? "opacity-80" : ""}`}
                >
                  {/* Badge: Grátis / Premium / Disponível */}
                  <div className="absolute right-3 top-3">
                    {coach.is_premium ? (
                      locked ? (
                        <span className="flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
                          <Lock className="h-2.5 w-2.5" /> Premium
                        </span>
                      ) : (
                        <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                          Disponível
                        </span>
                      )
                    ) : (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-emerald-400">
                        Grátis
                      </span>
                    )}
                  </div>

                  <div className="flex items-start gap-3">
                    <CoachAvatar url={coach.avatar_url} emoji={coach.emoji} size="h-11 w-11" text="text-2xl" />
                    <div className="flex-1 pr-20">
                      <div className="font-semibold tracking-tight">{coach.name}</div>
                      <div className={`text-[11px] ${accent.text}/90`}>{coach.specialty}</div>
                      {coach.description && (
                        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                          {coach.description}
                        </p>
                      )}
                      <div className={`mt-2.5 inline-flex items-center gap-0.5 text-[11px] font-medium ${accent.text}`}>
                        {locked ? "Ver coach" : "Conversar"}
                        <ChevronRight className="h-3.5 w-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })
          )}
        </div>

        {/* CTA */}
        <Link
          to="/coach-chat"
          search={{ persona: "general" }}
          className="flex items-center justify-center gap-2 rounded-2xl border border-primary/30 bg-primary/10 px-5 py-4 text-sm font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          <MessageSquare className="h-4 w-4" />
          Conversar com o PM Geral (grátis)
        </Link>
      </div>
    </AppShell>
  );
}
