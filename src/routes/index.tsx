import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DASHBOARD_STATS, getCurrentWeek, getTodayWorkout, PROGRAM_STATS } from "@/lib/mock-data";
import { ArrowUpRight, Calendar, Timer, Footprints, Target, TrendingUp } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { firstName, inferGender, welcomeWord, timeOfDayGreeting } from "@/lib/greeting";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PM Hybrid Performance System" },
      { name: "description", content: "Dashboard de periodização híbrida — força, corrida e progressão." },
    ],
  }),
  component: Dashboard,
});

function MetricCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Timer;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        <span className="truncate">{label}</span>
      </div>
      <div className="num mt-2 text-2xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Dashboard() {
  const week = getCurrentWeek();
  const today = getTodayWorkout();
  const adherencePct = Math.round(DASHBOARD_STATS.adherence * 100);
  const { user } = useAuth();
  const rawName =
    (user?.user_metadata?.display_name as string | undefined) ||
    (user?.user_metadata?.full_name as string | undefined) ||
    (user?.user_metadata?.name as string | undefined) ||
    user?.email?.split("@")[0] ||
    "";
  const name = firstName(rawName);
  const gender = inferGender(rawName);
  const greeting = `${timeOfDayGreeting()}, ${name || "atleta"}`;
  const welcome = welcomeWord(gender);

  return (
    <AppShell eyebrow="Visão geral" title="Dashboard">
      <div className="space-y-5 p-4">
        {/* Saudação personalizada */}
        <section className="animate-fade-in">
          <div className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            {welcome}
          </div>
          <h2 className="mt-1 text-[22px] font-semibold leading-tight tracking-tight">
            {greeting}
          </h2>
        </section>

        {/* Hero — Semana atual */}
        <section className="animate-fade-in glass-strong relative overflow-hidden rounded-3xl p-6">
          <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
          <div className="relative">
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
              Semana {String(week.number).padStart(2, "0")} · {week.macroLabel}
            </div>
            <h2 className="mt-3 text-[26px] font-semibold leading-[1.1] tracking-tight">
              <span className="text-gradient-primary">{week.objective}</span>
            </h2>
            <p className="mt-2 text-[13px] text-muted-foreground">{week.mesociclo}</p>

            <div className="mt-5 flex flex-col gap-2">
              <Link
                to="/hoje"
                className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-primary px-5 py-3.5 text-[15px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99]"
              >
                Iniciar treino
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </Link>
              <Link
                to="/semanas"
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface/60 px-5 py-3 text-[14px] font-medium text-foreground active:bg-surface-elevated"
              >
                Ver semana
              </Link>
            </div>
          </div>
        </section>

        {/* Próximo treino */}
        <section className="glass rounded-2xl p-5">
          <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" strokeWidth={1.75} />
            Próximo treino
          </div>
          <div className="mt-2 text-[17px] font-semibold tracking-tight">{today.day}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground line-clamp-2">{today.session}</div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
            <span className="rounded-full border border-border/70 bg-surface/40 px-2.5 py-1">
              {today.strength.length} ex. força
            </span>
            <span className="rounded-full border border-border/70 bg-surface/40 px-2.5 py-1">
              {today.core.length} core
            </span>
            {today.tempo && (
              <span className="rounded-full border border-border/70 bg-surface/40 px-2.5 py-1 num">
                {today.tempo}
              </span>
            )}
          </div>
        </section>

        {/* Métricas — 2 por linha */}
        <section className="grid grid-cols-2 gap-3">
          <MetricCard
            icon={Timer}
            label="Tempo"
            value={`${DASHBOARD_STATS.weeklyMinutes}min`}
            hint="últimos 7 dias"
          />
          <MetricCard
            icon={TrendingUp}
            label="Sessões"
            value={`0/${PROGRAM_STATS.totalSessions}`}
            hint={`${PROGRAM_STATS.totalWeeks} semanas`}
          />
          <MetricCard
            icon={Footprints}
            label="Corridas"
            value={`${DASHBOARD_STATS.runsCompleted}`}
            hint="completas"
          />
          <MetricCard
            icon={Target}
            label="Aderência"
            value={`${adherencePct}%`}
            hint={`${DASHBOARD_STATS.streak}d sequência`}
          />
        </section>
      </div>
    </AppShell>
  );
}
