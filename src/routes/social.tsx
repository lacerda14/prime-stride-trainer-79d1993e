import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Users, Activity, Medal, Swords, Lock } from "lucide-react";

export const Route = createFileRoute("/social")({
  head: () => ({
    meta: [{ title: "Social · PM Hybrid" }],
  }),
  component: SocialPage,
});

const FEATURES = [
  {
    icon: <Activity className="h-5 w-5" />,
    title: "Feed de atividades",
    description: "Veja o que seus amigos estão treinando em tempo real. Comemore PRs e conquistas juntos.",
  },
  {
    icon: <Medal className="h-5 w-5" />,
    title: "Ranking de amigos",
    description: "Compareça XP, sequências e volume com a sua rede. Competição saudável gera resultados.",
  },
  {
    icon: <Swords className="h-5 w-5" />,
    title: "Desafios semanais",
    description: "Participe de desafios coletivos — mais séries, mais km corridos, maior volume. Juntos é mais.",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Grupos de treino",
    description: "Crie ou entre em grupos temáticos — força, corrida, híbrido. Programas compartilhados em breve.",
  },
];

function SocialPage() {
  return (
    <AppShell eyebrow="Comunidade" title="Social">
      <div className="mx-auto max-w-2xl space-y-8 p-4 pb-16">

        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface px-6 py-10 text-center">
          <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />

          <div className="relative">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 shadow-glow">
              <Users className="h-8 w-8 text-primary" />
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary">
              <Lock className="h-3 w-3" /> Em breve
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              Social PM Hybrid
            </h1>
            <p className="mx-auto mt-2.5 max-w-[300px] text-[13px] text-muted-foreground leading-relaxed">
              Conecte-se com outros atletas. Compartilhe treinos, compita, se inspire.
              A evolução é mais rápida quando você não treina sozinho.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="space-y-3">
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            O que está vindo
          </p>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-2xl border border-border/60 bg-surface/50 px-4 py-4 opacity-80"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
                {f.icon}
              </div>
              <div>
                <div className="text-[13px] font-semibold">{f.title}</div>
                <div className="mt-0.5 text-[12px] text-muted-foreground leading-relaxed">{f.description}</div>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="rounded-2xl border border-primary/20 bg-primary/5 px-5 py-5 text-center">
          <p className="text-[14px] font-semibold">Lançamento em breve</p>
          <p className="mt-1 text-[12px] text-muted-foreground">
            Estamos construindo a melhor comunidade de atletas híbridos.<br />
            Continue treinando — você será um dos primeiros a ter acesso.
          </p>
          <div className="mt-4 flex items-center justify-center gap-2">
            <div className="flex -space-x-2">
              {["💪", "🏃", "🔥", "⚡"].map((e, i) => (
                <div
                  key={i}
                  className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-background bg-surface-elevated text-sm"
                >
                  {e}
                </div>
              ))}
            </div>
            <span className="text-[12px] text-muted-foreground">Junte-se à comunidade</span>
          </div>
        </div>

      </div>
    </AppShell>
  );
}
