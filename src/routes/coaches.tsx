import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Sparkles, MessageSquare, Brain, Zap, Lock, ChevronRight } from "lucide-react";

export const Route = createFileRoute("/coaches")({
  head: () => ({
    meta: [{ title: "Coaches AI · PM Hybrid" }],
  }),
  component: CoachesPage,
});

const COACHES = [
  {
    id: "pm-strength",
    name: "PM Strength",
    role: "Especialista em Força & Hipertrofia",
    description:
      "Análise de periodização, ajuste de cargas e recomendações de exercícios baseados no seu histórico de treino.",
    tags: ["Força", "Hipertrofia", "Progressão"],
    avatar: "💪",
    color: "from-amber-500/20 to-amber-600/5",
    border: "border-amber-500/20",
  },
  {
    id: "pm-run",
    name: "PM Run",
    role: "Especialista em Corrida & Cardio",
    description:
      "Planejamento de pace, análise de ACWR e adaptação do volume de corrida à sua recuperação semanal.",
    tags: ["Corrida", "Cardio", "ACWR"],
    avatar: "🏃",
    color: "from-sky-500/20 to-sky-600/5",
    border: "border-sky-500/20",
  },
  {
    id: "pm-recovery",
    name: "PM Recovery",
    role: "Especialista em Recuperação",
    description:
      "Leitura de HRV, sono e frequência cardíaca em repouso para recomendar a intensidade ideal do dia.",
    tags: ["HRV", "Sono", "Readiness"],
    avatar: "🔋",
    color: "from-emerald-500/20 to-emerald-600/5",
    border: "border-emerald-500/20",
  },
  {
    id: "pm-nutrition",
    name: "PM Nutrition",
    role: "Especialista em Nutrição Esportiva",
    description:
      "Orientações nutricionais alinhadas ao seu volume de treino, objetivos e fase de periodização.",
    tags: ["Nutrição", "Dieta", "Suplementação"],
    avatar: "🥗",
    color: "from-violet-500/20 to-violet-600/5",
    border: "border-violet-500/20",
  },
];

const FEATURES = [
  {
    icon: <MessageSquare className="h-5 w-5" />,
    title: "Chat em tempo real",
    description: "Converse com o coach sobre qualquer dúvida do seu treino, recuperação ou nutrição.",
  },
  {
    icon: <Brain className="h-5 w-5" />,
    title: "Análise do seu histórico",
    description: "O coach lê seus treinos, pesos, ACWR e sono para dar respostas personalizadas.",
  },
  {
    icon: <Zap className="h-5 w-5" />,
    title: "Ajustes automáticos",
    description: "O coach sugere mudanças no programa com base na sua evolução semana a semana.",
  },
];

function CoachesPage() {
  return (
    <AppShell eyebrow="Premium" title="Coaches AI">
      <div className="mx-auto max-w-2xl space-y-8 p-4 pb-16 sm:p-6">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface px-6 py-8 text-center">
          {/* Glow */}
          <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

          <div className="relative">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 shadow-glow">
              <Sparkles className="h-7 w-7 text-primary" />
            </div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <Lock className="h-3 w-3" /> Em breve · Área Premium
            </div>
            <h1 className="mt-3 text-2xl font-semibold tracking-tight">
              Coaches AI personalizados
            </h1>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              Especialistas treinados com seu histórico de treino, recuperação e objetivos.
              Disponíveis 24h para responder, ajustar e evoluir com você.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            O que você vai ter acesso
          </p>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-2xl border border-border/60 bg-surface/50 px-4 py-4"
            >
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

        {/* Coach cards — locked */}
        <div className="space-y-3">
          <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Conheça os coaches
          </p>
          {COACHES.map((coach) => (
            <div
              key={coach.id}
              className={`relative overflow-hidden rounded-2xl border ${coach.border} bg-gradient-to-br ${coach.color} px-5 py-4 opacity-80`}
            >
              {/* Lock badge */}
              <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
                <Lock className="h-2.5 w-2.5" /> Premium
              </div>

              <div className="flex items-start gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border/40 bg-surface/60 text-2xl">
                  {coach.avatar}
                </div>
                <div className="flex-1 pr-16">
                  <div className="font-semibold tracking-tight">{coach.name}</div>
                  <div className="text-[11px] text-primary/80">{coach.role}</div>
                  <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
                    {coach.description}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {coach.tags.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-md border border-border/40 bg-surface/50 px-2 py-0.5 text-[10px] text-muted-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-5 text-center">
          <p className="text-sm font-semibold">Lançamento em breve</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Os Coaches AI fazem parte do plano PM Hybrid Premium.<br />
            Continue treinando — você será avisado quando estiver disponível.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2 text-xs text-primary font-medium">
            <Sparkles className="h-3.5 w-3.5" />
            Continue evoluindo com o programa atual
            <ChevronRight className="h-3.5 w-3.5" />
          </div>
        </div>

      </div>
    </AppShell>
  );
}
