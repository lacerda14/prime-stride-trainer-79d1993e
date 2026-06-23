import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { FEATURES as APP_FEATURES } from "@/lib/features";
import { useEffect, useState } from "react";
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
  UserPlus,
  UserCheck,
  UserMinus,
  Check,
  X,
  Clock,
  Copy,
  Search,
} from "lucide-react";
import { getMySubscription } from "@/lib/subscription.functions";
import { isProAccess } from "@/lib/tiers";
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
import {
  getFriendsOverview,
  searchUsers,
  sendFriendRequest,
  respondToRequest,
  removeFriend,
  type FriendUser,
  type RelationshipStatus,
} from "@/lib/friends.functions";

export const Route = createFileRoute("/social")({
  // Feature escondida na Fase 1 (foco no motor). Deep-link cai na home.
  beforeLoad: () => {
    if (!APP_FEATURES.social) throw redirect({ to: "/" });
  },
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

type Tab = "feed" | "friends";

function SocialPage() {
  const fetchSub = useServerFn(getMySubscription);
  const { data: subData, isLoading } = useQuery({
    queryKey: ["my-subscription"],
    queryFn: () => fetchSub(),
  });
  const [tab, setTab] = useState<Tab>("feed");

  const isPro = isProAccess(subData);

  return (
    <AppShell eyebrow="Comunidade" title="Social">
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="mx-auto max-w-2xl p-4 pb-20 sm:p-6">
          <TabBar tab={tab} setTab={setTab} />
          <div className="mt-5">
            {tab === "feed" ? isPro ? <Feed /> : <FeedLocked /> : <Friends />}
          </div>
        </div>
      )}
    </AppShell>
  );
}

function TabBar({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  return (
    <div className="flex rounded-full border border-border/60 bg-surface/50 p-1 text-[13px] font-semibold">
      {(["feed", "friends"] as const).map((t) => (
        <button
          key={t}
          type="button"
          onClick={() => setTab(t)}
          className={`flex-1 rounded-full px-4 py-2 transition active:scale-[0.99] ${
            tab === t
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t === "feed" ? "Feed" : "Amigos"}
        </button>
      ))}
    </div>
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
    <div className="space-y-4">
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

function FeedLocked() {
  return (
    <div className="space-y-7">
      <div className="relative overflow-hidden rounded-3xl border border-amber-400/20 bg-gradient-to-br from-amber-400/10 via-surface to-surface px-6 py-9 text-center">
        <div className="pointer-events-none absolute -top-10 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-amber-400/15 blur-3xl" />
        <div className="relative">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border border-amber-400/30 bg-amber-400/10 shadow-glow">
            <Activity className="h-8 w-8 text-amber-400" />
          </div>
          <div className="mb-3 inline-flex items-center gap-1.5 rounded-full border border-amber-400/30 bg-amber-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-amber-400">
            <TierCrown tier="pro" className="h-3 w-3" /> Pro
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">O feed é do Pro</h1>
          <p className="mx-auto mt-2.5 max-w-[300px] text-[13px] leading-relaxed text-muted-foreground">
            Adicione amigos agora (é livre) e destrave o Pro pra ver os treinos da sua rede, reagir
            e competir.
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
        Destravar o feed no Pro
      </Link>
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

// ── Amigos (aberto a todos) ──────────────────────────────────────────────────
function friendErr(e: Error): string {
  switch (e.message) {
    case "already_friends":
      return "Vocês já são amigos.";
    case "already_sent":
      return "Pedido já enviado.";
    case "cannot_friend_self":
      return "Esse código é o seu 🙂";
    case "user_not_found":
      return "Usuário não encontrado.";
    default:
      return "Algo deu errado. Tente de novo.";
  }
}

function Friends() {
  const qc = useQueryClient();
  const fetchOverview = useServerFn(getFriendsOverview);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["friends-overview"],
    queryFn: () => fetchOverview(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["friends-overview"] });
    qc.invalidateQueries({ queryKey: ["user-search"] });
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isError || !data) {
    return (
      <EmptyState
        icon={<Users className="h-7 w-7" />}
        title="Não foi possível carregar"
        subtitle="Tente novamente em instantes."
      />
    );
  }

  return (
    <div className="space-y-5">
      <MyFriendCode code={data.me.friend_code} username={data.me.username} />
      <AddFriend onChanged={invalidate} />

      {data.incoming.length > 0 && (
        <Section title={`Pedidos recebidos (${data.incoming.length})`}>
          {data.incoming.map((r) => (
            <IncomingRow key={r.friendship_id} req={r} onChanged={invalidate} />
          ))}
        </Section>
      )}

      {data.outgoing.length > 0 && (
        <Section title={`Pedidos enviados (${data.outgoing.length})`}>
          {data.outgoing.map((r) => (
            <OutgoingRow key={r.friendship_id} req={r} onChanged={invalidate} />
          ))}
        </Section>
      )}

      <Section title={`Amigos (${data.friends.length})`}>
        {data.friends.length === 0 ? (
          <p className="px-1 py-3 text-[12px] text-muted-foreground">
            Você ainda não tem amigos por aqui. Compartilhe seu código ou busque por @username.
          </p>
        ) : (
          data.friends.map((f) => (
            <FriendRow
              key={f.friendship_id}
              friendshipId={f.friendship_id}
              user={f.user}
              onChanged={invalidate}
            />
          ))
        )}
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

function MyFriendCode({ code, username }: { code: string | null; username: string | null }) {
  const copy = async () => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Código copiado!");
    } catch {
      toast.error("Não foi possível copiar.");
    }
  };

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/50 p-4">
      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <UserPlus className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] text-muted-foreground">Seu código de amigo</div>
        <div className="flex items-center gap-2">
          <span className="font-mono text-lg font-semibold tracking-[0.2em]">{code ?? "—"}</span>
          {username && (
            <span className="truncate text-[12px] text-muted-foreground">@{username}</span>
          )}
        </div>
      </div>
      <button
        type="button"
        onClick={copy}
        disabled={!code}
        aria-label="Copiar código"
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-[12px] font-semibold text-muted-foreground transition hover:text-foreground disabled:opacity-40"
      >
        <Copy className="h-3.5 w-3.5" />
        Copiar
      </button>
    </div>
  );
}

function AddFriend({ onChanged }: { onChanged: () => void }) {
  const [q, setQ] = useState("");
  const [debouncedQ, setDebouncedQ] = useState("");
  const search = useServerFn(searchUsers);
  const sendFn = useServerFn(sendFriendRequest);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(id);
  }, [q]);

  const { data: results, isFetching } = useQuery({
    queryKey: ["user-search", debouncedQ],
    queryFn: () => search({ data: { q: debouncedQ } }),
    enabled: debouncedQ.length >= 2,
  });

  const send = useMutation({
    mutationFn: (target: { addressee_id?: string; friend_code?: string }) =>
      sendFn({ data: target }),
    onSuccess: (res) => {
      toast.success(res.status === "accepted" ? "Vocês agora são amigos! 🤝" : "Pedido enviado!");
      onChanged();
    },
    onError: (e: Error) => toast.error(friendErr(e)),
  });

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 rounded-2xl border border-border/60 bg-surface/50 px-3.5 py-2.5">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar por @username ou código"
          className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          autoCapitalize="none"
          autoCorrect="off"
        />
        {isFetching && <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />}
      </div>

      {debouncedQ.length >= 2 && (
        <div className="space-y-2">
          {(results ?? []).length === 0 && !isFetching ? (
            <p className="px-1 py-2 text-[12px] text-muted-foreground">Nenhum atleta encontrado.</p>
          ) : (
            (results ?? []).map((r) => (
              <SearchResultRow
                key={r.user.id}
                user={r.user}
                status={r.status}
                pending={send.isPending}
                onAdd={() => send.mutate({ addressee_id: r.user.id })}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function SearchResultRow({
  user,
  status,
  pending,
  onAdd,
}: {
  user: FriendUser;
  status: RelationshipStatus;
  pending: boolean;
  onAdd: () => void;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/50 px-3.5 py-3">
      <PersonInfo user={user} />
      {status === "friends" ? (
        <StatusBadge icon={<UserCheck className="h-3.5 w-3.5" />} label="Amigos" />
      ) : status === "outgoing" ? (
        <StatusBadge icon={<Clock className="h-3.5 w-3.5" />} label="Enviado" />
      ) : (
        <button
          type="button"
          disabled={pending}
          onClick={onAdd}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3.5 py-1.5 text-[12px] font-semibold text-primary-foreground transition active:scale-[0.98] disabled:opacity-40"
        >
          <UserPlus className="h-3.5 w-3.5" />
          {status === "incoming" ? "Aceitar" : "Adicionar"}
        </button>
      )}
    </div>
  );
}

function PersonInfo({ user }: { user: FriendUser }) {
  return (
    <>
      <CoachAvatar url={user.avatar_url} emoji="🧑" size="h-9 w-9" text="text-lg" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold">{user.name}</div>
        <div className="truncate text-[11px] text-muted-foreground">
          {user.username ? `@${user.username} · ` : ""}Nível {user.level}
        </div>
      </div>
    </>
  );
}

function IncomingRow({
  req,
  onChanged,
}: {
  req: { friendship_id: string; user: FriendUser };
  onChanged: () => void;
}) {
  const respondFn = useServerFn(respondToRequest);
  const m = useMutation({
    mutationFn: (action: "accept" | "decline") =>
      respondFn({ data: { friendship_id: req.friendship_id, action } }),
    onSuccess: (_d, action) => {
      toast.success(action === "accept" ? "Amizade aceita! 🤝" : "Pedido recusado");
      onChanged();
    },
    onError: () => toast.error("Algo deu errado."),
  });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/50 px-3.5 py-3">
      <PersonInfo user={req.user} />
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label="Aceitar"
          disabled={m.isPending}
          onClick={() => m.mutate("accept")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground transition active:scale-95 disabled:opacity-40"
        >
          <Check className="h-4 w-4" />
        </button>
        <button
          type="button"
          aria-label="Recusar"
          disabled={m.isPending}
          onClick={() => m.mutate("decline")}
          className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-border/60 text-muted-foreground transition hover:text-destructive active:scale-95 disabled:opacity-40"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function OutgoingRow({
  req,
  onChanged,
}: {
  req: { friendship_id: string; user: FriendUser };
  onChanged: () => void;
}) {
  const respondFn = useServerFn(respondToRequest);
  const m = useMutation({
    mutationFn: () => respondFn({ data: { friendship_id: req.friendship_id, action: "decline" } }),
    onSuccess: () => {
      toast.success("Pedido cancelado");
      onChanged();
    },
    onError: () => toast.error("Algo deu errado."),
  });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/50 px-3.5 py-3">
      <PersonInfo user={req.user} />
      <button
        type="button"
        disabled={m.isPending}
        onClick={() => m.mutate()}
        className="inline-flex items-center gap-1.5 rounded-full border border-border/60 px-3 py-1.5 text-[12px] font-medium text-muted-foreground transition hover:text-destructive disabled:opacity-40"
      >
        <Clock className="h-3.5 w-3.5" />
        Cancelar
      </button>
    </div>
  );
}

function FriendRow({
  friendshipId,
  user,
  onChanged,
}: {
  friendshipId: string;
  user: FriendUser;
  onChanged: () => void;
}) {
  const removeFn = useServerFn(removeFriend);
  const m = useMutation({
    mutationFn: () => removeFn({ data: { friendship_id: friendshipId } }),
    onSuccess: () => {
      toast.success("Amizade removida");
      onChanged();
    },
    onError: () => toast.error("Algo deu errado."),
  });

  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/50 px-3.5 py-3">
      <PersonInfo user={user} />
      <button
        type="button"
        aria-label="Remover amizade"
        disabled={m.isPending}
        onClick={() => {
          if (confirm(`Remover ${user.name} dos seus amigos?`)) m.mutate();
        }}
        className="rounded-full p-2 text-muted-foreground transition hover:text-destructive disabled:opacity-40"
      >
        <UserMinus className="h-4 w-4" />
      </button>
    </div>
  );
}
