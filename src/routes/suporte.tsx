import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  LifeBuoy,
  MessageCircle,
  Lock,
  Send,
  Mail,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/suporte")({
  head: () => ({
    meta: [
      { title: "Suporte · PM Hybrid" },
      {
        name: "description",
        content: "Central de ajuda PM Hybrid: FAQs e chat de suporte.",
      },
    ],
  }),
  component: SuportePage,
});

const FAQS: { q: string; a: string }[] = [
  {
    q: "Como o programa de treino é montado?",
    a: "Sua periodização é gerada a partir do seu objetivo, nível e disponibilidade definidos no onboarding. O motor combina força, condicionamento e corrida em ciclos, com descansos planejados entre macros.",
  },
  {
    q: "Posso trocar um exercício?",
    a: "Sim. Dentro da sessão de treino, toque no exercício e use a opção de troca para escolher uma variação equivalente do mesmo padrão de movimento.",
  },
  {
    q: "Como funcionam os PRs (Personal Records)?",
    a: "Os PRs são detectados automaticamente ao final de cada treino, com base em carga, repetições e estimativa de 1RM. Você também pode editar ou inserir manualmente na aba Performance do seu perfil.",
  },
  {
    q: "O que é o sistema de XP e nível?",
    a: "Cada treino concluído gera XP. O XP acumulado define seu nível e mantém sua sequência (streak). Conquistas adicionais desbloqueiam ao bater marcos de volume, frequência e PRs.",
  },
  {
    q: "O que acontece se eu perder um dia de treino?",
    a: "Nada grave. Seu streak quebra após o dia perdido, mas o programa continua de onde parou. Você pode revisar o histórico na aba Evolução para entender o impacto.",
  },
  {
    q: "Como cancelo ou pauso minha assinatura?",
    a: "Vá em Perfil → Configurações → Assinatura. Você pode pausar por até 30 dias ou cancelar a qualquer momento sem multa.",
  },
  {
    q: "Meus dados estão seguros?",
    a: "Sim. Usamos criptografia em trânsito e em repouso, e seus dados de performance nunca são compartilhados com terceiros sem seu consentimento explícito.",
  },
];

function SuportePage() {
  const [message, setMessage] = useState("");

  return (
    <AppShell eyebrow="Central de Ajuda" title="Suporte">
      <div className="mx-auto max-w-2xl space-y-8 p-4 pb-16">
        {/* Hero */}
        <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface px-6 py-8">
          <div className="pointer-events-none absolute -top-10 right-0 h-32 w-48 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-4">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15 shadow-glow">
              <LifeBuoy className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold tracking-tight">
                Como podemos ajudar?
              </h2>
              <p className="mt-1 text-[13px] text-muted-foreground leading-relaxed">
                Encontre respostas rápidas abaixo ou fale com nosso time pelo chat.
              </p>
            </div>
          </div>
        </div>

        {/* FAQs */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Perguntas frequentes
            </p>
            <span className="text-[10px] text-muted-foreground">
              {FAQS.length} tópicos
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border/60 bg-surface/50">
            <Accordion type="single" collapsible className="w-full">
              {FAQS.map((item, i) => (
                <AccordionItem
                  key={i}
                  value={`item-${i}`}
                  className="border-b border-border/40 last:border-b-0"
                >
                  <AccordionTrigger className="px-4 py-3.5 text-left text-[13.5px] font-medium hover:no-underline">
                    {item.q}
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4 pt-0 text-[12.5px] text-muted-foreground leading-relaxed">
                    {item.a}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </section>

        {/* Chat (inactive) */}
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <p className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Chat com suporte
            </p>
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
              <Lock className="h-2.5 w-2.5" /> Em breve
            </span>
          </div>

          <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-surface/50">
            {/* Fake transcript */}
            <div className="space-y-3 px-4 py-5">
              <div className="flex items-start gap-2.5">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-primary/10 text-primary">
                  <Sparkles className="h-4 w-4" />
                </div>
                <div className="max-w-[80%] rounded-2xl rounded-tl-sm border border-border/60 bg-surface-elevated/60 px-3.5 py-2.5 text-[12.5px] leading-relaxed">
                  Oi! Em breve você poderá conversar comigo aqui para tirar dúvidas
                  sobre seu treino, performance e assinatura.
                </div>
              </div>
            </div>

            {/* Disabled composer */}
            <div className="border-t border-border/60 bg-background/40 p-3">
              <div className="flex items-center gap-2 opacity-60">
                <Input
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  disabled
                  placeholder="Chat indisponível no momento…"
                  className="h-10 flex-1 rounded-xl bg-surface/60 text-[13px]"
                />
                <Button
                  size="icon"
                  disabled
                  className="h-10 w-10 shrink-0 rounded-xl"
                  aria-label="Enviar"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              <p className="mt-2 text-center text-[10.5px] text-muted-foreground">
                Estamos preparando o agente de IA do PM Hybrid. Aguarde novidades em
                breve.
              </p>
            </div>
          </div>
        </section>

        {/* Email fallback */}
        <section>
          <a
            href="mailto:suporte@pmhybrid.com"
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 px-4 py-3.5 transition active:scale-[0.99]"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated/60">
              <Mail className="h-4.5 w-4.5 text-muted-foreground" />
            </div>
            <div className="flex-1">
              <div className="text-[13px] font-semibold">Prefere e-mail?</div>
              <div className="text-[11.5px] text-muted-foreground">
                Escreva para suporte@pmhybrid.com — respondemos em até 24h.
              </div>
            </div>
            <MessageCircle className="h-4 w-4 text-muted-foreground" />
          </a>
        </section>
      </div>
    </AppShell>
  );
}
