import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import {
  Users,
  Activity,
  Medal,
  Swords,
  Loader2,
  Dumbbell,
  Send,
  Trash2,
  MessageCircle,
} from "lucide-react";
import { getMySubscription } from "@/lib/subscription.functions";
import { accessTier } from "@/lib/tiers";
import { TierCrown } from "@/components/tier-crown";
import { CoachAvatar } from "@/components/coach-avatar";
import { track } from "@/lib/analytics.functions";
import {
  listFeed,
  createPost,
  toggleReaction,
  deletePost,
  REACTION_EMOJIS,
  type FeedPostDTO,
} from "@/lib/feed.functions";

export const Route = createFileRoute("/social")({
  head: () => ({ meta: [{ title: "Social · PM Hybrid" }] }),
  component: SocialPage,
});

const EMOJI: Record<string, string> = {
  fire: "🔥",
  muscle: "💪",
  clap: "👏",
  rocket: "🚀",
  heart: "❤️",
};

const FEATURES = [
  {
    icon: <Activity className="h-5 w-5" />,
    title: "Feed de atividades",
    description: "Acompanhe os treinos da sua rede e comemore PRs e conquistas juntos.",
  },
  {
    icon: <Medal className="h-5 w-5" />,
    title: "Ranking",
    description:
      "Compare XP, sequências e volume com seus amigos. Competição saudável gera resultado.",
  },
  {
    icon: <Swords className="h-5 w-5" />,
    title: "Desafios",
    description: "Entre em desafios coletivos — mais séries, mais km, maior volume. Juntos é mais.",
  },
  {
    icon: <Users className="h-5 w-5" />,
    title: "Grupos de treino",
    description: "Crie ou entre em grupos — força, corrida, híbrido. Accountability de verdade.",
  },
];

function SocialPage() {
  const fetchSub = useServerFn(getMySubscription);
  const { data: subData, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
  });

  const isPro = accessTier(subData?.plan, subData?.billing_status) === "pro";

  if (isLoading) {
    return (
      <AppShell eyebrow="Comunidade" title="Social">
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }

  if (isPro) {
    return (
      <AppShell eyebrow="Comunidade" title="Social">
        <Feed />
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Comunidade" title="Social">
      <div className="mx-auto max-w-2xl space-y-7 p-4 pb-16 sm:p-6">
        <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-surface to-surface px-6 py-9 text-center">
          <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />
          <div className="relative">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-glow">
              <Users className="h-8 w-8 text-amber-400" />
            </div>
            <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">
              <TierCrown tier="pro" className="h-3 w-3" /> Pro
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">Treine com a comunidade</h1>
            <p className="mx-auto mt-2.5 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
              Accountability, competição saudável e consistência — a comunidade faz parte do Pro.
            </p>
          </div>
        </div>

        <div className="space-y-3">
          <p className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Incluído no Pro
          </p>
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="flex items-start gap-4 rounded-2xl border border-border/60 bg-surface/50 px-4 py-4"
            >
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/20 bg-amber-400/10 text-amber-400">
                {f.icon}
              </div>
              <div>
                <div className="text-[13px] font-semibold">{f.title}</div>
                <div className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                  {f.description}
                </div>
              </div>
            </div>
          ))}
        </div>

        <Link
          to="/assinaturas"
          onClick={() =>
            track("social_locked_clicked", { source_screen: "social", target_plan: "pro" })
          }
          className="flex items-center justify-center gap-2 rounded-2xl border border-amber-400/30 bg-amber-400/10 px-5 py-4 text-sm font-semibold text-amber-400 transition-colors hover:bg-amber-400/15"
        >
          <TierCrown tier="pro" className="h-4 w-4" />
          Destravar a comunidade no Pro
        </Link>
      </div>
    </AppShell>
  );
}

// ── Feed (Pro) ───────────────────────────────────────────────────────────────
function Feed() {
  const qc = useQueryClient();
  const fetchFeed = useServerFn(listFeed);
  const {
    data: posts,
    isLoading,
    isError,
  } = useQuery({ queryKey: ["feed"], queryFn: () => fetchFeed() });

  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 pb-20 sm:p-6">
      <Composer onPosted={() => qc.invalidateQueries({ queryKey: ["feed"] })} />

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : isError ? (
        <EmptyState
          icon={<Activity className="h-7 w-7" />}
          title="Não foi possível carregar o feed"
          subtitle="Tente novamente em instantes."
        />
      ) : (posts ?? []).length === 0 ? (
        <EmptyState
          icon={<Users className="h-7 w-7" />}
          title="Seu feed está quieto"
          subtitle="Publique seu primeiro check-in e adicione amigos pra ver os treinos da sua rede."
        />
      ) : (
        <div className="space-y-3">
          {posts!.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 px-6 py-12 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-border/60 bg-surface text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-sm font-semibold">{title}</div>
        <p className="mx-auto mt-1 max-w-[280px] text-[12px] leading-relaxed text-muted-foreground">
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function Composer({ onPosted }: { onPosted: () => void }) {
  const [caption, setCaption] = useState("");
  const postFn = useServerFn(createPost);
  const mutation = useMutation({
    mutationFn: (text: string) => postFn({ data: { caption: text } }),
    onSuccess: () => {
      setCaption("");
      onPosted();
    },
    onError: (e: Error) =>
      toast.error(e.message === "pro_required" ? "Recurso do Pro." : "Não foi possível publicar."),
  });

  const text = caption.trim();
  const remaining = 500 - caption.length;

  return (
    <div className="rounded-2xl border border-border/60 bg-surface/50 p-3">
      <label htmlFor="composer" className="sr-only">
        Compartilhar um check-in
      </label>
      <textarea
        id="composer"
        value={caption}
        onChange={(e) => setCaption(e.target.value.slice(0, 500))}
        placeholder="Como foi o treino hoje? Compartilhe com sua rede…"
        rows={2}
        className="w-full resize-none rounded-xl border border-transparent bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted-foreground focus:border-border/60"
      />
      <div className="mt-1 flex items-center justify-between px-1">
        <span
          className={`text-[11px] ${remaining < 40 ? "text-amber-400" : "text-muted-foreground"}`}
        >
          {remaining}
        </span>
        <button
          type="button"
          disabled={!text || mutation.isPending}
          onClick={() => mutation.mutate(text)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
        >
          {mutation.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          Publicar
        </button>
      </div>
    </div>
  );
}

const DAY_LABEL: Record<string, string> = {
  full_body: "Full body",
  run_upper: "Corrida + superior",
  run: "Corrida",
  upper: "Superior",
  lower: "Inferior",
};

function PostCard({ post }: { post: FeedPostDTO }) {
  const qc = useQueryClient();
  const reactFn = useServerFn(toggleReaction);
  const deleteFn = useServerFn(deletePost);
  const [pickerOpen, setPickerOpen] = useState(false);

  const react = useMutation({
    mutationFn: (emoji: (typeof REACTION_EMOJIS)[number]) =>
      reactFn({ data: { post_id: post.id, emoji } }),
    onSuccess: () => {
      setPickerOpen(false);
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error("Não foi possível reagir."),
  });

  const del = useMutation({
    mutationFn: () => deleteFn({ data: { post_id: post.id } }),
    onSuccess: () => {
      toast.success("Post removido");
      qc.invalidateQueries({ queryKey: ["feed"] });
    },
    onError: () => toast.error("Não foi possível apagar."),
  });

  const when = formatDistanceToNow(new Date(post.created_at), { addSuffix: true, locale: ptBR });

  return (
    <article className="rounded-2xl border border-border/60 bg-surface/50 p-4">
      <header className="flex items-center gap-3">
        <CoachAvatar url={post.author.avatar_url} emoji="🧑" size="h-9 w-9" text="text-lg" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold">{post.author.name}</div>
          <div className="text-[11px] text-muted-foreground">{when}</div>
        </div>
        {post.is_mine && (
          <button
            type="button"
            aria-label="Apagar post"
            disabled={del.isPending}
            onClick={() => {
              if (confirm("Apagar este post?")) del.mutate();
            }}
            className="rounded-full p-1.5 text-muted-foreground transition hover:bg-surface hover:text-destructive"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </header>

      {post.workout && (
        <div className="mt-3 inline-flex items-center gap-2 rounded-xl border border-primary/25 bg-primary/10 px-3 py-1.5 text-[12px] font-medium text-primary">
          <Dumbbell className="h-3.5 w-3.5" />
          {DAY_LABEL[post.workout.day_key] ?? "Treino"} · Semana {post.workout.week_number}
          {post.workout.duration_min ? ` · ${post.workout.duration_min}min` : ""}
        </div>
      )}

      {post.caption && (
        <p className="mt-3 whitespace-pre-wrap text-[14px] leading-relaxed">{post.caption}</p>
      )}

      {post.photo_url && (
        <img
          src={post.photo_url}
          alt="Foto do treino"
          className="mt-3 max-h-96 w-full rounded-xl object-cover"
          loading="lazy"
        />
      )}

      <footer className="mt-3 flex items-center gap-2 border-t border-border/40 pt-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setPickerOpen((o) => !o)}
            disabled={react.isPending}
            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium transition active:scale-[0.98] ${
              post.my_reaction
                ? "border-primary/40 bg-primary/10 text-primary"
                : "border-border/60 text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{post.my_reaction ? EMOJI[post.my_reaction] : "🔥"}</span>
            {post.reaction_total > 0 ? post.reaction_total : "Reagir"}
          </button>
          {pickerOpen && (
            <div className="absolute bottom-full left-0 z-10 mb-1.5 flex gap-1 rounded-full border border-border/60 bg-background p-1 shadow-lg">
              {REACTION_EMOJIS.map((e) => (
                <button
                  key={e}
                  type="button"
                  aria-label={`Reagir com ${e}`}
                  onClick={() => react.mutate(e)}
                  className={`rounded-full px-2 py-1 text-lg transition hover:bg-surface ${
                    post.my_reaction === e ? "bg-primary/10" : ""
                  }`}
                >
                  {EMOJI[e]}
                </button>
              ))}
            </div>
          )}
        </div>

        {post.reactions.length > 0 && (
          <div className="flex items-center gap-1 text-[12px] text-muted-foreground">
            {post.reactions.map((r) => (
              <span key={r.emoji}>
                {EMOJI[r.emoji]}
                {r.count}
              </span>
            ))}
          </div>
        )}

        <span className="ml-auto inline-flex items-center gap-1 text-[12px] text-muted-foreground">
          <MessageCircle className="h-3.5 w-3.5" />
          {post.comment_count}
        </span>
      </footer>
    </article>
  );
}
