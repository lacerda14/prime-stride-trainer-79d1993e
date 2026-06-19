import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowLeft,
  Send,
  Loader2,
  Crown,
  Sparkles,
  Pencil,
  Plus,
  Trash2,
  Footprints,
  Check,
} from "lucide-react";
import { RequireAuth } from "@/components/require-auth";
import { Button } from "@/components/ui/button";
import { CoachAvatar } from "@/components/coach-avatar";
import {
  listCoaches,
  sendCoachMessage,
  applyWorkoutChange,
  type CoachDTO,
  type CoachChatMessage,
  type WorkoutChange,
} from "@/lib/coach.functions";
import { getMySubscription } from "@/lib/subscription.functions";

export const Route = createFileRoute("/coach-chat")({
  validateSearch: (s: Record<string, unknown>) => ({
    persona: typeof s.persona === "string" ? s.persona : "general",
  }),
  head: () => ({ meta: [{ title: "Chat · Coaches · PM Hybrid" }] }),
  component: () => (
    <RequireAuth>
      <CoachChatPage />
    </RequireAuth>
  ),
});

// Markdown-lite: negrito **x**, títulos #/##, bullets - / *.
function CoachText({ text }: { text: string }) {
  const lines = text.split("\n");
  const renderInline = (s: string, key: number) => {
    const parts = s.split(/(\*\*[^*]+\*\*)/g).filter(Boolean);
    return (
      <span key={key}>
        {parts.map((p, i) =>
          p.startsWith("**") && p.endsWith("**") ? (
            <strong key={i}>{p.slice(2, -2)}</strong>
          ) : (
            <span key={i}>{p}</span>
          ),
        )}
      </span>
    );
  };
  return (
    <div className="space-y-1.5 text-[13.5px] leading-relaxed">
      {lines.map((raw, i) => {
        const line = raw.trimEnd();
        if (!line.trim()) return <div key={i} className="h-1" />;
        if (/^#{1,6}\s/.test(line)) {
          return (
            <div key={i} className="pt-0.5 text-[14px] font-semibold">
              {renderInline(line.replace(/^#{1,6}\s/, ""), i)}
            </div>
          );
        }
        if (/^\s*[-*]\s/.test(line)) {
          return (
            <div key={i} className="flex gap-2 pl-1">
              <span className="text-primary">•</span>
              <span>{renderInline(line.replace(/^\s*[-*]\s/, ""), i)}</span>
            </div>
          );
        }
        return <div key={i}>{renderInline(line, i)}</div>;
      })}
    </div>
  );
}

const STARTERS = [
  "Como está minha recuperação para treinar hoje?",
  "Monte uma orientação rápida pro meu objetivo.",
  "O que priorizar no treino desta semana?",
];

// Card de PRÉVIA de alteração de treino proposta pelo coach.
function WorkoutChangeCard({
  change,
  applied,
  pending,
  onApply,
  onDismiss,
}: {
  change: WorkoutChange;
  applied: boolean;
  pending: boolean;
  onApply: () => void;
  onDismiss: () => void;
}) {
  const iconFor = (verb: string, block: string) => {
    if (verb === "Adicionar") return <Plus className="h-3.5 w-3.5" />;
    if (verb === "Remover") return <Trash2 className="h-3.5 w-3.5" />;
    if (block === "running") return <Footprints className="h-3.5 w-3.5" />;
    return <Pencil className="h-3.5 w-3.5" />;
  };
  return (
    <div className="max-w-[88%] overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.06]">
      <div className="flex items-center gap-2 border-b border-primary/20 px-3.5 py-2">
        <Sparkles className="h-3.5 w-3.5 text-primary" />
        <span className="text-[12px] font-semibold text-primary">
          Proposta de alteração no treino
        </span>
      </div>

      <div className="space-y-2.5 px-3.5 py-3">
        {change.preview.map((p, i) => (
          <div key={i} className="text-[13px]">
            <div className="flex items-center gap-1.5 font-medium text-foreground">
              <span className="text-primary">{iconFor(p.verb, p.block)}</span>
              <span>{p.verb}</span>
              {p.day && <span className="text-muted-foreground">· {p.day}</span>}
            </div>
            <div className="mt-0.5 pl-5 leading-snug">
              {p.before !== "—" && (
                <span className="text-muted-foreground line-through decoration-muted-foreground/50">
                  {p.before}
                </span>
              )}
              {p.before !== "—" && <span className="px-1 text-muted-foreground">→</span>}
              <span
                className={
                  p.after === "—" ? "text-muted-foreground" : "font-medium text-foreground"
                }
              >
                {p.after === "—" ? "remover" : p.after}
              </span>
            </div>
            {p.reason && (
              <div className="mt-0.5 pl-5 text-[11.5px] text-muted-foreground">{p.reason}</div>
            )}
          </div>
        ))}

        {change.rejected_notes && change.rejected_notes.length > 0 && (
          <div className="rounded-lg bg-amber-400/10 px-2.5 py-1.5 text-[11px] text-amber-500">
            {change.rejected_notes.join(" ")}
          </div>
        )}
      </div>

      {applied ? (
        <div className="flex items-center justify-center gap-1.5 border-t border-primary/20 bg-primary/10 py-2 text-[12.5px] font-medium text-primary">
          <Check className="h-4 w-4" /> Aplicado ao seu treino
        </div>
      ) : (
        <div className="flex gap-2 border-t border-primary/20 px-3 py-2.5">
          <Button size="sm" className="h-9 flex-1 text-[13px]" onClick={onApply} disabled={pending}>
            {pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <Check className="mr-1 h-4 w-4" /> Aplicar
              </>
            )}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 flex-1 text-[13px]"
            onClick={onDismiss}
            disabled={pending}
          >
            Agora não
          </Button>
        </div>
      )}
    </div>
  );
}

function CoachChatPage() {
  const { persona } = Route.useSearch();
  const navigate = useNavigate();
  const fetchCoaches = useServerFn(listCoaches);
  const fetchSub = useServerFn(getMySubscription);
  const send = useServerFn(sendCoachMessage);
  const applyChange = useServerFn(applyWorkoutChange);
  const queryClient = useQueryClient();

  const { data: coaches, isLoading: loadingCoaches } = useQuery({
    queryKey: ["coaches"],
    queryFn: () => fetchCoaches(),
  });
  const { data: subData } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
  });

  const coach: CoachDTO | undefined = useMemo(
    () => (coaches ?? []).find((c) => c.persona === persona),
    [coaches, persona],
  );
  const isPremium =
    (subData?.plan === "premium_ai" && subData?.billing_status === "active") ||
    subData?.billing_status === "trialing";
  const locked = !!coach?.is_premium && !isPremium;

  const [messages, setMessages] = useState<CoachChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [quickReplies, setQuickReplies] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, quickReplies]);

  const mutation = useMutation({
    mutationFn: (text: string) =>
      send({
        data: {
          message: text,
          coach_persona: persona,
          conversation_history: messages
            .slice(-20)
            .map((m) => ({ role: m.role, content: m.content })),
        },
      }),
    onSuccess: (res) => {
      if (res.ok && res.message) {
        setMessages((m) => [
          ...m,
          { role: "assistant", content: res.message!, workoutChange: res.workout_change ?? null },
        ]);
        setQuickReplies(res.quick_replies ?? []);
      } else {
        // remove a última msg do usuário falhada? mantém e mostra erro como bolha do coach
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content:
              res.code === "rate_limit_exceeded"
                ? "Você atingiu o limite de mensagens de hoje. Assine o Premium para conversas ilimitadas. 💪"
                : (res.error ?? "Não consegui responder agora. Tenta de novo?"),
          },
        ]);
      }
    },
    onError: () => {
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Tive um problema de conexão. Tenta de novo?" },
      ]);
    },
  });

  function submit(text: string) {
    const t = text.trim();
    if (!t || mutation.isPending) return;
    setMessages((m) => [...m, { role: "user", content: t }]);
    setInput("");
    setQuickReplies([]);
    mutation.mutate(t);
  }

  // Mensagem pré-preenchida via sessionStorage — ex.: "Ajustar semana →
  // Reorganizar com o Pedro" envia o pedido automaticamente uma vez.
  const autoSentRef = useRef(false);
  useEffect(() => {
    if (autoSentRef.current || typeof window === "undefined") return;
    if (loadingCoaches || locked || !coach) return;
    if (messages.length > 0 || mutation.isPending) return;
    let prefill: string | null = null;
    try {
      prefill = sessionStorage.getItem("pm_coach_prefill");
    } catch {
      /* ignore */
    }
    if (!prefill) return;
    autoSentRef.current = true;
    try {
      sessionStorage.removeItem("pm_coach_prefill");
    } catch {
      /* ignore */
    }
    submit(prefill);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadingCoaches, locked, coach]);

  // ── Aplicar alteração de treino (após confirmar a prévia) ─────
  const [applyingIdx, setApplyingIdx] = useState<number | null>(null);
  const applyMut = useMutation({
    mutationFn: (vars: { idx: number; change: WorkoutChange }) =>
      applyChange({
        data: {
          coach_persona: vars.change.coach_persona,
          operations: vars.change.operations as unknown as Array<Record<string, unknown>>,
        },
      }),
    onMutate: (vars) => setApplyingIdx(vars.idx),
    onSuccess: (res, vars) => {
      if (res.ok) {
        // marca o card como aplicado e confirma numa bolha
        setMessages((m) => m.map((msg, i) => (i === vars.idx ? { ...msg, applied: true } : msg)));
        setMessages((m) => [...m, { role: "assistant", content: `✅ ${res.summary}` }]);
        // invalida caches do programa pra refletir a alteração
        queryClient.invalidateQueries({ queryKey: ["program"] });
        queryClient.invalidateQueries({ queryKey: ["training-program"] });
        queryClient.invalidateQueries({ queryKey: ["today-workout"] });
        queryClient.invalidateQueries({ queryKey: ["home"] });
      } else {
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            content: res.error ?? "Não consegui aplicar a alteração. Tenta de novo?",
          },
        ]);
      }
    },
    onError: () =>
      setMessages((m) => [
        ...m,
        { role: "assistant", content: "Tive um problema ao aplicar. Tenta de novo?" },
      ]),
    onSettled: () => setApplyingIdx(null),
  });

  function dismissChange(idx: number) {
    setMessages((m) => m.map((msg, i) => (i === idx ? { ...msg, workoutChange: null } : msg)));
  }

  // ── Gate premium ──────────────────────────────────────────────
  if (!loadingCoaches && locked) {
    return (
      <div className="mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
        <ChatHeader coach={coach} onBack={() => navigate({ to: "/coaches" })} subtitle="Premium" />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-8 text-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10">
            <Crown className="h-8 w-8 text-amber-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">{coach?.name} é Premium</h2>
            <p className="mt-1.5 text-sm text-muted-foreground">
              Os coaches especialistas fazem parte do PM Hybrid Premium. O{" "}
              <span className="font-medium text-foreground">Pedro</span> é grátis pra começar.
            </p>
          </div>
          <div className="flex w-full max-w-xs flex-col gap-2">
            <Button onClick={() => navigate({ to: "/assinaturas" })} className="w-full">
              <Crown className="mr-1.5 h-4 w-4" /> Ver planos
            </Button>
            <Button
              variant="outline"
              onClick={() => navigate({ to: "/coach-chat", search: { persona: "general" } })}
              className="w-full"
            >
              Falar com o Pedro (grátis)
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // ── Chat ──────────────────────────────────────────────────────
  return (
    <div className="mx-auto flex h-[100dvh] w-full max-w-[480px] flex-col bg-background">
      <ChatHeader
        coach={coach}
        onBack={() => navigate({ to: "/coaches" })}
        subtitle={coach?.specialty ?? (coach?.is_premium ? "Premium" : "Grátis")}
      />

      <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center gap-4 px-4 pt-8 text-center">
            <CoachAvatar
              url={coach?.avatar_url}
              emoji={coach?.emoji}
              size="h-14 w-14"
              text="text-3xl"
              className="rounded-2xl"
            />
            <div>
              <div className="font-semibold">{coach?.name ?? "Coach"}</div>
              <p className="mx-auto mt-1 max-w-xs text-xs text-muted-foreground">
                {coach?.description ??
                  "Pergunte qualquer coisa sobre treino, recuperação ou nutrição."}
              </p>
            </div>
            <div className="flex w-full flex-col gap-2 pt-2">
              {STARTERS.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5 text-left text-[13px] text-foreground/90 transition-colors hover:bg-surface"
                >
                  <Sparkles className="mr-1.5 inline h-3.5 w-3.5 text-primary" />
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => {
          const isAssistant = m.role === "assistant";
          // foto aparece 1x por grupo (na última fala do coach), estilo WhatsApp
          const showAvatar =
            isAssistant && (i === messages.length - 1 || messages[i + 1].role !== "assistant");
          return (
            <div key={i} className="space-y-2">
              <div
                className={`flex items-end gap-2 ${isAssistant ? "justify-start" : "justify-end"}`}
              >
                {isAssistant &&
                  (showAvatar ? (
                    <CoachAvatar
                      url={coach?.avatar_url}
                      emoji={coach?.emoji}
                      size="h-7 w-7"
                      text="text-sm"
                      round
                      className="mb-0.5"
                    />
                  ) : (
                    <div className="h-7 w-7 shrink-0" />
                  ))}
                <div
                  className={
                    isAssistant
                      ? "max-w-[80%] rounded-2xl rounded-bl-md border border-border/50 bg-surface/60 px-3.5 py-2.5 text-foreground"
                      : "max-w-[82%] rounded-2xl rounded-br-md bg-primary px-3.5 py-2.5 text-[13.5px] leading-relaxed text-primary-foreground"
                  }
                >
                  {isAssistant ? <CoachText text={m.content} /> : m.content}
                </div>
              </div>

              {isAssistant && m.workoutChange && m.workoutChange.preview.length > 0 && (
                <div className="ml-9">
                  <WorkoutChangeCard
                    change={m.workoutChange}
                    applied={!!m.applied}
                    pending={applyMut.isPending && applyingIdx === i}
                    onApply={() => applyMut.mutate({ idx: i, change: m.workoutChange! })}
                    onDismiss={() => dismissChange(i)}
                  />
                </div>
              )}
            </div>
          );
        })}

        {mutation.isPending && (
          <div className="flex items-end gap-2 justify-start">
            <CoachAvatar
              url={coach?.avatar_url}
              emoji={coach?.emoji}
              size="h-7 w-7"
              text="text-sm"
              round
              className="mb-0.5"
            />
            <div className="flex items-center gap-1.5 rounded-2xl rounded-bl-md border border-border/50 bg-surface/60 px-4 py-3">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
            </div>
          </div>
        )}
      </div>

      {/* Quick-replies (chips de escolha sugeridos pelo coach) */}
      {quickReplies.length > 0 && !mutation.isPending && (
        <div className="flex flex-wrap gap-2 px-4 pb-1 pt-1">
          {quickReplies.map((q) => (
            <button
              key={q}
              onClick={() => submit(q)}
              className="rounded-full border border-primary/40 bg-primary/10 px-3.5 py-1.5 text-[13px] font-medium text-primary transition-colors hover:bg-primary/20 active:scale-95"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="border-t border-border/60 bg-background/80 px-3 py-2.5 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] backdrop-blur-xl">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit(input);
              }
            }}
            rows={1}
            placeholder={`Mensagem para ${coach?.name ?? "o coach"}…`}
            className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border border-border/60 bg-surface/50 px-3.5 py-2.5 text-[14px] outline-none placeholder:text-muted-foreground focus:border-primary/40"
          />
          <Button
            size="icon"
            className="h-11 w-11 shrink-0 rounded-full"
            disabled={!input.trim() || mutation.isPending}
            onClick={() => submit(input)}
          >
            {mutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function ChatHeader({
  coach,
  onBack,
  subtitle,
}: {
  coach?: CoachDTO;
  onBack: () => void;
  subtitle: string;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border/60 bg-background/80 px-3 backdrop-blur-xl pt-[env(safe-area-inset-top,0px)] [box-sizing:content-box]">
      <button
        onClick={onBack}
        className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-surface"
      >
        <ArrowLeft className="h-5 w-5" />
      </button>
      <CoachAvatar url={coach?.avatar_url} emoji={coach?.emoji} size="h-9 w-9" text="text-xl" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold leading-tight">{coach?.name ?? "Coach"}</div>
        <div className="text-[11px] text-muted-foreground">{subtitle}</div>
      </div>
    </header>
  );
}
