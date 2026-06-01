import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { DASHBOARD_STATS, getCurrentWeek, getTodayWorkout, PROGRAM_STATS } from "@/lib/mock-data";
import { ArrowUpRight, Flame, Timer, Footprints, Target, TrendingUp } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "PM Hybrid Performance System" },
      { name: "description", content: "Dashboard de periodização híbrida — força, corrida e progressão." },
    ],
  }),
  component: Dashboard,
});

function Stat({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: typeof Flame;
  label: string;
  value: string;
  hint?: string;
}) {
  return (
    <div className="glass group relative overflow-hidden rounded-2xl p-5 transition-all hover:border-white/10 hover:shadow-elevated">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" strokeWidth={1.75} />
      </div>
      <div className="num mt-3 text-3xl font-semibold tracking-tight">{value}</div>
      {hint && <div className="mt-1 text-xs text-muted-foreground">{hint}</div>}
    </div>
  );
}

function Dashboard() {
  const week = getCurrentWeek();
  const today = getTodayWorkout();
  const adherencePct = Math.round(DASHBOARD_STATS.adherence * 100);
  const activeDays = week.days.filter((d) => !d.isOff);

  return (
    <AppShell eyebrow="Visão Geral" title="Dashboard">
      <div className="mx-auto max-w-7xl space-y-8 p-6 lg:p-10">
        {/* Hero */}
        <section className="animate-fade-in glass-strong relative overflow-hidden rounded-3xl p-8 lg:p-10">
          <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative grid gap-8 lg:grid-cols-[1.4fr_1fr]">
            <div>
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                Semana {String(week.number).padStart(2, "0")} · {week.macroLabel} · {week.mesociclo}
              </div>
              <h2 className="mt-3 max-w-xl text-4xl font-semibold leading-[1.05] tracking-tight lg:text-5xl">
                <span className="text-gradient-primary">{week.objective}</span>
              </h2>
              <p className="mt-3 max-w-lg text-sm text-muted-foreground">
                Método dominante: {week.methodDominant}. Volume alvo: {week.volume}.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  to="/hoje"
                  className="group inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
                >
                  Iniciar treino de hoje
                  <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
                </Link>
                <Link
                  to="/semanas"
                  className="inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
                >
                  Ver periodização
                </Link>
              </div>
            </div>

            <div className="glass flex flex-col justify-between rounded-2xl p-5">
              <div>
                <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Próximo treino
                </div>
                <div className="mt-2 text-lg font-semibold tracking-tight">
                  {today.day} · {today.session}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">{today.objective}</div>
              </div>
              <div className="num mt-6 grid grid-cols-3 gap-3 border-t border-border pt-4">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Força</div>
                  <div className="text-xl font-semibold">{today.strength.length}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Core</div>
                  <div className="text-xl font-semibold">{today.core.length}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tempo</div>
                  <div className="truncate text-xl font-semibold">{today.tempo || "—"}</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Stats */}
        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat icon={Timer} label="Tempo treinado" value={`${DASHBOARD_STATS.weeklyMinutes}m`} hint="últimos 7 dias" />
          <Stat
            icon={TrendingUp}
            label="Sessões no plano"
            value={`${PROGRAM_STATS.totalSessions}`}
            hint={`${PROGRAM_STATS.totalWeeks} semanas`}
          />
          <Stat icon={Footprints} label="Corridas" value={`${DASHBOARD_STATS.runsCompleted}`} hint="completas" />
          <Stat icon={Target} label="Aderência" value={`${adherencePct}%`} hint={`${DASHBOARD_STATS.streak} dias de sequência`} />
        </section>

        {/* Week strip */}
        <section className="glass animate-slide-up rounded-2xl p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                Semana em andamento
              </div>
              <div className="mt-1 text-base font-semibold tracking-tight">
                {activeDays.length} sessões · {week.volume}
              </div>
            </div>
            <Link to="/semanas" className="text-xs font-medium text-primary hover:underline">
              Ver todas as 48 semanas →
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-5">
            {activeDays.map((d, i) => (
              <div
                key={d.day}
                className={`rounded-xl border p-4 transition-colors ${
                  i === 0
                    ? "border-primary/40 bg-primary/5"
                    : "border-border bg-surface/40 hover:bg-surface-elevated/60"
                }`}
              >
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{d.day}</div>
                <div className="mt-1 line-clamp-2 text-sm font-semibold tracking-tight">{d.session}</div>
                <div className="num mt-2 text-[11px] text-muted-foreground">{d.tempo || "—"}</div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppShell>
  );
}
