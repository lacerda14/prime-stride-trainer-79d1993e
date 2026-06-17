import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import {
  ArrowRight,
  Flame,
  Trophy,
  Zap,
  Sparkles,
  Dumbbell,
  TrendingUp,
  Play,
  Crown,
} from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { firstName, inferGender, timeOfDayGreeting, type Gender } from "@/lib/greeting";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/profile.functions";
import { getMySubscription } from "@/lib/subscription.functions";
import { CoachAvatar } from "@/components/coach-avatar";
import { getTodayTraining } from "@/lib/program.queries";
import { levelProgress, getTitleForLevel } from "@/lib/gamification";
import { useLocalToday } from "@/hooks/use-local-today";
import { buildWatchWorkout, sendWorkoutToWatch, WatchBridge } from "@/lib/watch-bridge";
import { Capacitor } from "@capacitor/core";
import { useEffect } from "react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PM Hybrid Performance System" },
      { name: "description", content: "Sistema Operacional de Evolução Física." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell eyebrow="Sistema Operacional" title="PM Hybrid">
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const { user } = useAuth();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchToday = useServerFn(getTodayTraining);
  const localToday = useLocalToday();

  const { data: dash } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboard(),
    enabled: !!user,
  });

  const { data: programData } = useQuery({
    queryKey: ["today-training", user?.id, localToday.local_date, localToday.timezone],
    queryFn: () => fetchToday({ data: localToday }),
    enabled: !!user,
  });

  const fetchSub = useServerFn(getMySubscription);
  const { data: subData } = useQuery({
    queryKey: ["subscription", "me"],
    queryFn: () => fetchSub(),
    enabled: !!user,
    staleTime: 5 * 60_000,
  });
  const isPremium =
    (subData?.plan === "premium_ai" && subData?.billing_status === "active") ||
    subData?.billing_status === "trialing";

  const profile = dash?.profile;
  const xp = profile?.xp_total ?? 0;
  const prog = levelProgress(xp);
  const level = prog.level;
  const title = getTitleForLevel(level);
  const streak = profile?.streak_current ?? 0;
  const streakLongest = profile?.streak_longest ?? 0;
  const totalCompleted = dash?.totalCompletedWorkouts ?? 0;

  const summary = programData?.program ?? null;
  const today = programData?.today ?? null;

  // Sincroniza o treino do dia com o Apple Watch assim que o app abre (sem
  // precisar iniciar o treino). Durante a execução, a tela de treino reenvia
  // a versão com trocas/cargas ao vivo.
  useEffect(() => {
    if (!today) return;
    void sendWorkoutToWatch(buildWatchWorkout(today));
  }, [today]);

  // Reenvia quando o relógio pede (botão "Recarregar" / abertura do app no pulso).
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let remove: (() => void) | undefined;
    WatchBridge.addListener("watchEvent", (d) => {
      if (d.event === "requestWorkout" && today) {
        void sendWorkoutToWatch(buildWatchWorkout(today));
      }
    }).then((h) => { remove = () => { void h.remove(); }; });
    return () => remove?.();
  }, [today]);
  const activeWeek = summary?.active_week ?? 1;
  const totalWeeks = summary?.total_weeks ?? 48;

  const rawName =
    (user?.user_metadata?.name as string | undefined) ||
    profile?.name ||
    user?.email?.split("@")[0] ||
    "";
  const name = firstName(rawName);
  const gender = inferGender(rawName);

  // Coach AI insight calculado no servidor (não exibido — feature em breve)
  void dash?.coachInsight;

  const topPRs = dash?.topPRs ?? [];
  const recentAchievements = dash?.recentAchievements ?? [];

  // Conquistas próximas — milestones de treinos/streak
  const nextMilestones = buildNextMilestones(totalCompleted, streak);

  return (
    <div className="space-y-5 p-4 pb-6">

      {/* ── 1. Header pessoal ── */}
      <section className="animate-fade-in pt-1">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {greetWord(gender)}
        </div>
        <h2 className="mt-0.5 flex items-center gap-2 text-[24px] font-semibold leading-tight tracking-tight">
          <span>{timeOfDayGreeting()}, {name || "atleta"}</span>
          <Crown
            className={`h-5 w-5 shrink-0 ${
              isPremium ? "fill-amber-400/30 text-amber-400" : "fill-white/10 text-white/70"
            }`}
          />
        </h2>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary">
            <Trophy className="h-3 w-3" />
            Nível {level} · {title}
          </span>
          {streak > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 text-[11px] font-semibold text-orange-400">
              <Flame className="h-3 w-3" />
              {streak} {streak === 1 ? "dia seguido" : "dias seguidos"}
            </span>
          )}
        </div>
      </section>

      {/* ── 1.5. CTA Premium (só free — conversão) ── */}
      {subData && !isPremium && (
        <section className="animate-fade-in">
          <Link
            to="/assinaturas"
            className="relative flex items-center gap-3 overflow-hidden rounded-2xl border border-amber-400/30 bg-gradient-to-r from-amber-400/20 via-amber-500/8 to-surface px-4 py-3.5 transition active:scale-[0.99]"
          >
            <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-amber-400/20 blur-2xl" />
            <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-amber-400/30 bg-amber-400/15">
              <Crown className="h-5 w-5 fill-amber-400/30 text-amber-400" />
            </div>
            <div className="relative min-w-0 flex-1">
              <div className="text-[14px] font-semibold tracking-tight">Seja Premium</div>
              <div className="text-[12px] leading-tight text-muted-foreground">
                Coaches IA, treinos por IA e tudo liberado.
              </div>
            </div>
            <span className="relative shrink-0 rounded-full bg-amber-400 px-3.5 py-1.5 text-[12px] font-bold text-black">
              Assinar
            </span>
          </Link>
        </section>
      )}

      {/* ── 2. Card TREINO DO DIA (hero) ── */}
      <section className="animate-fade-in">
        {today ? (
          <div className="relative overflow-hidden rounded-3xl border border-primary/25 bg-gradient-to-br from-primary/15 via-surface to-surface p-5 shadow-glow/20">
            <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.2em] text-primary/80">
                    Treino de hoje · Semana {String(activeWeek).padStart(2, "0")}
                  </div>
                  <h3 className="mt-1 text-[20px] font-semibold leading-tight tracking-tight">
                    {programData?.calendar.day_name ?? today.day_name}
                  </h3>
                  <p className="mt-1 line-clamp-1 text-[12px] text-muted-foreground">
                    {today.objective ?? sessionLabel(today.session_type)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {today.exercises.filter((e) => e.exercise.category !== "core").length > 0 && (
                      <span className="rounded-full border border-border/60 bg-surface/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {today.exercises.filter((e) => e.exercise.category !== "core").length} força
                      </span>
                    )}
                    {today.exercises.filter((e) => e.exercise.category === "core").length > 0 && (
                      <span className="rounded-full border border-border/60 bg-surface/40 px-2 py-0.5 text-[10px] text-muted-foreground">
                        {today.exercises.filter((e) => e.exercise.category === "core").length} core
                      </span>
                    )}
                    {today.running?.total_duration_minutes && (
                      <span className="rounded-full border border-border/60 bg-surface/40 px-2 py-0.5 text-[10px] text-muted-foreground num">
                        {today.running.total_duration_minutes} min corrida
                      </span>
                    )}
                    {today.duration_minutes && (
                      <span className="rounded-full border border-border/60 bg-surface/40 px-2 py-0.5 text-[10px] text-muted-foreground num">
                        ~{today.duration_minutes} min
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/20">
                  <Dumbbell className="h-5 w-5 text-primary" />
                </div>
              </div>
              <Link
                to="/hoje"
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.99]"
              >
                <Play className="h-4 w-4 fill-current" />
                Iniciar treino
              </Link>
            </div>
          </div>
        ) : (
          <div className="rounded-3xl border border-border/60 bg-surface/40 p-5 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
              <span className="text-xl">☕</span>
            </div>
            <div className="text-[15px] font-semibold tracking-tight">Dia de descanso</div>
            <p className="mt-1 text-[12px] text-muted-foreground">
              Aproveite para recuperar. O descanso também faz parte do treino.
            </p>
            <Link
              to="/treinos"
              className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-medium text-primary"
            >
              Ver próximos treinos <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </section>

      {/* ── 3. Card COACH IA — teaser premium ── */}
      <section className="animate-fade-in">
        <Link
          to="/coaches"
          className="relative block overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface p-4 transition hover:border-primary/40"
        >
          <div className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex items-start gap-3">
            <CoachAvatar
              url="https://tkpnghmpylkptkrsywkh.supabase.co/storage/v1/object/public/coach-avatars/general.png"
              emoji="🧭"
              size="h-12 w-12"
              text="text-2xl"
              className="shadow-glow"
            />
            <div className="min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-emerald-400">
                Disponível · Grátis
              </div>
              <div className="mt-1.5 text-[14px] font-semibold tracking-tight">
                Coach IA Pessoal
              </div>
              <p className="mt-0.5 text-[12px] leading-relaxed text-muted-foreground">
                Já conhece seu treino, recuperação e evolução. Converse agora com o PM Geral.
              </p>
            </div>
            <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
          </div>
        </Link>
      </section>

      {/* ── 4. Card STREAK + XP ── */}
      <section className="animate-fade-in glass-strong relative overflow-hidden rounded-3xl p-5">
        <div className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-primary/15 blur-3xl" />
        <div className="relative">
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="rounded-2xl border border-border/60 bg-surface/40 px-4 py-3 text-center">
              <div className="flex items-center justify-center gap-1 text-orange-400">
                <Flame className="h-4 w-4" />
                <span className="num text-[22px] font-semibold leading-none">{streak}</span>
              </div>
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Sequência atual
              </div>
            </div>
            <div className="rounded-2xl border border-border/60 bg-surface/40 px-4 py-3 text-center">
              <div className="num text-[22px] font-semibold leading-none text-primary">
                {streakLongest}
              </div>
              <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
                Maior sequência
              </div>
            </div>
          </div>
          <div className="flex items-baseline justify-between gap-2 mb-2">
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              <span className="num text-[18px] font-semibold tracking-tight">{xp.toLocaleString("pt-BR")}</span>
              <span className="text-[12px] text-muted-foreground">XP</span>
            </div>
            <span className="text-[10px] text-muted-foreground">
              Faltam {prog.xpToNext.toLocaleString("pt-BR")} p/ nv. {level + 1}
            </span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
              style={{ width: `${prog.pct * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{prog.intoLevel.toLocaleString("pt-BR")} / {prog.levelSpan.toLocaleString("pt-BR")} XP no nível</span>
            <span>{Math.round(prog.pct * 100)}%</span>
          </div>
        </div>
      </section>

      {/* ── 5. Card PRÓXIMAS CONQUISTAS ── */}
      {nextMilestones.length > 0 && (
        <section className="animate-fade-in">
          <div className="mb-2.5 flex items-center justify-between px-1">
            <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
              Próximas conquistas
            </div>
          </div>
          <div className="space-y-2">
            {nextMilestones.map((m) => (
              <div key={m.label} className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3.5">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated text-xl">
                  {m.emoji}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold">{m.label}</div>
                  <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-primary/70 transition-all"
                      style={{ width: `${Math.min(100, m.pct * 100)}%` }}
                    />
                  </div>
                </div>
                <div className="shrink-0 text-[10px] font-medium text-muted-foreground num">
                  {m.current}/{m.target}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 6. PRs Recentes (recordes pessoais reais) ── */}
      <section className="animate-fade-in">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            PRs recentes
          </div>
          {topPRs.length > 0 && (
            <Link to="/evolucao" className="text-[10px] font-medium text-primary">
              Ver todos →
            </Link>
          )}
        </div>
        {topPRs.length > 0 ? (
          <div className="space-y-2">
            {topPRs.map((pr) => (
              <div
                key={pr.exercise_name}
                className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                  <Trophy className="h-5 w-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-semibold">{pr.exercise_name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {new Date(pr.achieved_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
                    {pr.reps ? ` · ${pr.reps} reps` : ""}
                  </div>
                </div>
                <div className="num shrink-0 text-[14px] font-semibold text-primary">
                  {pr.load_kg.toLocaleString("pt-BR")}
                  <span className="ml-1 text-[10px] text-muted-foreground">kg</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 p-5 text-center">
            <Trophy className="mx-auto h-6 w-6 text-muted-foreground/50" />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Registre cargas nos seus treinos para começar a contabilizar PRs.
            </p>
          </div>
        )}
      </section>

      {/* ── 7. Conquistas desbloqueadas ── */}
      {recentAchievements.length > 0 && (
        <section className="animate-fade-in">
          <div className="mb-2.5 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Conquistas recentes
          </div>
          <div className="space-y-2">
            {recentAchievements.map((a) => {
              const ach = a.achievements as { title: string; description: string; xp_reward: number } | null;
              return (
                <div key={a.achievement_code} className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{ach?.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{ach?.description}</div>
                  </div>
                  <div className="shrink-0 text-[12px] font-semibold text-primary">+{ach?.xp_reward}</div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Quick links ── */}
      <section className="animate-fade-in">
        <div className="mb-2.5 px-1 text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          Acesso rápido
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Link
            to="/evolucao"
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 px-4 py-3.5 text-[13px] font-medium transition-colors hover:bg-surface/60"
          >
            <TrendingUp className="h-4 w-4 text-primary" />
            Ver evolução
          </Link>
          <Link
            to="/semanas"
            className="flex items-center gap-3 rounded-2xl border border-border/60 bg-surface/40 px-4 py-3.5 text-[13px] font-medium transition-colors hover:bg-surface/60"
          >
            <Sparkles className="h-4 w-4 text-primary" />
            Ver semanas
          </Link>
        </div>
      </section>

    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function greetWord(gender: Gender): string {
  if (gender === "f") return "Bem-vinda de volta";
  if (gender === "m") return "Bem-vindo de volta";
  return "Bem-vindo(a) de volta";
}

function sessionLabel(type: string): string {
  switch (type) {
    case "full_body": return "Full Body";
    case "run_upper": return "Corrida + Superior";
    case "run": return "Corrida";
    case "rest": return "Descanso";
    default: return type;
  }
}


interface Milestone {
  label: string;
  emoji: string;
  current: number;
  target: number;
  pct: number;
}

function buildNextMilestones(totalCompleted: number, streak: number): Milestone[] {
  const milestones: Milestone[] = [];

  // Treinos milestone
  const workoutTargets = [1, 5, 10, 25, 50, 100, 200, 500];
  const nextWorkout = workoutTargets.find((t) => t > totalCompleted);
  if (nextWorkout) {
    milestones.push({
      label: `${nextWorkout} Treinos`,
      emoji: "💪",
      current: totalCompleted,
      target: nextWorkout,
      pct: totalCompleted / nextWorkout,
    });
  }

  // Streak milestone
  const streakTargets = [3, 7, 14, 30, 60, 100];
  const nextStreak = streakTargets.find((t) => t > streak);
  if (nextStreak) {
    milestones.push({
      label: `Sequência de ${nextStreak} dias`,
      emoji: "🔥",
      current: streak,
      target: nextStreak,
      pct: streak / nextStreak,
    });
  }

  return milestones.slice(0, 2);
}
