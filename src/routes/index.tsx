import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { getCurrentWeek, getTodayWorkout, PROGRAM_STATS, getMacroForWeek, CURRENT_WEEK_NUMBER, MACROS } from "@/lib/mock-data";
import { ArrowUpRight, Calendar, Flame, Trophy, Zap, Footprints } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { firstName, inferGender, welcomeWord, timeOfDayGreeting } from "@/lib/greeting";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/profile.functions";
import { levelProgress } from "@/lib/gamification";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PM Hybrid Performance System" },
      { name: "description", content: "Sua jornada de treino híbrido — força, corrida e progressão." },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  return (
    <AppShell eyebrow="Visão geral" title="Início">
      <DashboardContent />
    </AppShell>
  );
}

function DashboardContent() {
  const week = getCurrentWeek();
  const today = getTodayWorkout();
  const { user } = useAuth();
  const fetchDashboard = useServerFn(getDashboard);

  const { data } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboard(),
    enabled: !!user,
  });

  const profile = data?.profile;
  const xp = profile?.xp_total ?? 0;
  const prog = levelProgress(xp);
  const streak = profile?.streak_current ?? 0;
  const totalCompleted = data?.totalCompletedWorkouts ?? 0;

  // Progresso semana / meso / macro
  const weekDays = week.days.filter((d) => !d.isOff).length;
  const weekProgress = 0; // TODO: contar sessões dessa semana
  const mesoTotal = 4; // semanas por mesociclo (aprox)
  const mesoCurrent = ((CURRENT_WEEK_NUMBER - 1) % mesoTotal) + 1;
  const macro = getMacroForWeek(CURRENT_WEEK_NUMBER);
  const macroRange = macro?.weeks.includes("-")
    ? macro.weeks.split("-").map(Number)
    : macro
      ? [Number(macro.weeks), Number(macro.weeks)]
      : [1, 48];
  const macroWeeks = macroRange[1] - macroRange[0] + 1;
  const macroCurrent = CURRENT_WEEK_NUMBER - macroRange[0] + 1;
  const programPct = Math.round(((CURRENT_WEEK_NUMBER - 1) / PROGRAM_STATS.totalWeeks) * 100);

  const rawName =
    (user?.user_metadata?.display_name as string | undefined) ||
    profile?.display_name ||
    user?.email?.split("@")[0] ||
    "";
  const name = firstName(rawName);
  const gender = inferGender(rawName);

  return (
    <div className="space-y-5 p-4">
      <WeekDistributionModal weekNumber={CURRENT_WEEK_NUMBER} />
      {/* Saudação */}
      <section className="animate-fade-in">
        <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          {welcomeWord(gender)}
        </div>
        <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">
          {timeOfDayGreeting()}, {name || "atleta"}
        </h2>
      </section>

      {/* Card de Nível + XP + Streak */}
      <section className="animate-fade-in glass-strong relative overflow-hidden rounded-3xl p-5">
        <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <Trophy className="h-3.5 w-3.5" strokeWidth={2} />
              Nível {prog.level}
            </div>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="num text-[32px] font-semibold leading-none tracking-tight text-gradient-primary">
                {xp.toLocaleString("pt-BR")}
              </span>
              <span className="text-[12px] text-muted-foreground">XP</span>
            </div>
          </div>
          <div className="shrink-0 rounded-2xl border border-primary/20 bg-primary/10 px-3 py-2 text-center">
            <div className="flex items-center justify-center gap-1 text-primary">
              <Flame className="h-4 w-4" />
              <span className="num text-[20px] font-semibold leading-none">{streak}</span>
            </div>
            <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
              {streak === 1 ? "dia" : "dias"}
            </div>
          </div>
        </div>

        {/* Barra para próximo nível */}
        <div className="relative mt-4">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
              style={{ width: `${prog.pct * 100}%` }}
            />
          </div>
          <div className="mt-1.5 flex items-center justify-between text-[10px] text-muted-foreground">
            <span>{prog.intoLevel} / {prog.levelSpan} XP</span>
            <span>Faltam {prog.xpToNext.toLocaleString("pt-BR")} XP p/ nv. {prog.level + 1}</span>
          </div>
        </div>
      </section>

      {/* Progresso triplo */}
      <section className="space-y-2.5">
        <ProgressRow label="Semana atual" detail={`${weekProgress}/${weekDays} treinos`} pct={weekDays ? weekProgress / weekDays : 0} />
        <ProgressRow label="Mesociclo" detail={`Semana ${mesoCurrent}/${mesoTotal}`} pct={mesoCurrent / mesoTotal} />
        <ProgressRow label="Macrociclo" detail={`${macroCurrent}/${macroWeeks} semanas · ${macro?.macro ?? ""}`} pct={macroCurrent / macroWeeks} />
        <ProgressRow label="Programa completo" detail={`Semana ${CURRENT_WEEK_NUMBER}/${PROGRAM_STATS.totalWeeks}`} pct={programPct / 100} accent />
      </section>

      {/* CTA Iniciar treino */}
      <section className="grid grid-cols-2 gap-2">
        <Link
          to="/hoje"
          className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99]"
        >
          Iniciar treino
          <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
        </Link>
        <Link
          to="/semanas"
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface/60 px-4 py-3.5 text-[14px] font-medium active:bg-surface-elevated"
        >
          Ver semana
        </Link>
      </section>

      {/* Próximo treino */}
      <section className="glass rounded-2xl p-4">
        <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
          Próximo treino
        </div>
        <div className="mt-2 text-[16px] font-semibold tracking-tight">{today.day}</div>
        <div className="mt-0.5 text-[12px] text-muted-foreground line-clamp-2">{today.session}</div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
          <span className="rounded-full border border-border/70 bg-surface/40 px-2 py-0.5">
            {today.strength.length} força
          </span>
          <span className="rounded-full border border-border/70 bg-surface/40 px-2 py-0.5">
            {today.core.length} core
          </span>
          {today.tempo && (
            <span className="rounded-full border border-border/70 bg-surface/40 px-2 py-0.5 num">
              {today.tempo}
            </span>
          )}
        </div>
      </section>

      {/* Conquistas recentes */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            Conquistas
          </div>
          <span className="text-[10px] text-muted-foreground">
            {data?.recentAchievements.length ?? 0} desbloqueadas
          </span>
        </div>
        {data?.recentAchievements.length ? (
          <div className="grid gap-2">
            {data.recentAchievements.map((a) => {
              const ach = a.achievements as { title: string; description: string; xp_reward: number } | null;
              return (
                <div key={a.achievement_code} className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Trophy className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-[13px] font-semibold">{ach?.title}</div>
                    <div className="truncate text-[11px] text-muted-foreground">{ach?.description}</div>
                  </div>
                  <div className="shrink-0 text-[11px] font-semibold text-primary">+{ach?.xp_reward}</div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 p-5 text-center">
            <Zap className="mx-auto h-6 w-6 text-muted-foreground/60" />
            <p className="mt-2 text-[12px] text-muted-foreground">
              Complete seu primeiro treino para desbloquear conquistas.
            </p>
          </div>
        )}
      </section>

      {/* Stats rápidos */}
      <section className="grid grid-cols-3 gap-2">
        <MiniStat icon={Trophy} label="Treinos" value={totalCompleted} />
        <MiniStat icon={Flame} label="Recorde" value={profile?.streak_longest ?? 0} suffix="d" />
        <MiniStat icon={Footprints} label="Macros" value={MACROS.length} />
      </section>
    </div>
  );
}

function ProgressRow({ label, detail, pct, accent }: { label: string; detail: string; pct: number; accent?: boolean }) {
  const safePct = Math.max(0, Math.min(1, pct));
  return (
    <div className="glass rounded-2xl px-4 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[12px] font-medium">{label}</span>
        <span className="text-[10px] text-muted-foreground">{detail}</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface">
        <div
          className={`h-full transition-all duration-700 ${accent ? "bg-gradient-to-r from-primary to-primary/70" : "bg-foreground/70"}`}
          style={{ width: `${safePct * 100}%` }}
        />
      </div>
      <div className="mt-1 text-right text-[10px] font-semibold num">
        {Math.round(safePct * 100)}%
      </div>
    </div>
  );
}

function MiniStat({ icon: Icon, label, value, suffix }: { icon: typeof Trophy; label: string; value: number; suffix?: string }) {
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 px-3 py-3 text-center">
      <Icon className="mx-auto h-4 w-4 text-muted-foreground" strokeWidth={1.75} />
      <div className="num mt-1 text-[18px] font-semibold leading-none">
        {value}{suffix}
      </div>
      <div className="mt-0.5 text-[9px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}
