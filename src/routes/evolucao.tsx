import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getDashboard } from "@/lib/profile.functions";
import { getEvolutionData } from "@/lib/evolution.functions";
import { useAuth } from "@/hooks/use-auth";
import { levelProgress, getTitleForLevel } from "@/lib/gamification";
import {
  TrendingUp,
  Scale,
  Ruler,
  BarChart3,
  Loader2,
  Trophy,
  Flame,
  Zap,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/evolucao")({
  head: () => ({
    meta: [
      { title: "Evolução · PM Hybrid" },
      { name: "description", content: "Acompanhe sua força, consistência e composição corporal." },
    ],
  }),
  component: EvolucaoPage,
});

function EvolucaoPage() {
  const { user } = useAuth();
  const fetchDashboard = useServerFn(getDashboard);
  const fetchEvolution = useServerFn(getEvolutionData);

  const { data: dash, isLoading: loadingDash } = useQuery({
    queryKey: ["dashboard", user?.id],
    queryFn: () => fetchDashboard(),
    enabled: !!user,
  });

  const { data: evo, isLoading: loadingEvo } = useQuery({
    queryKey: ["evolution", user?.id],
    queryFn: () => fetchEvolution(),
    enabled: !!user,
  });

  const isLoading = loadingDash || loadingEvo;
  const profile = dash?.profile;
  const xp = profile?.xp_total ?? 0;
  const prog = levelProgress(xp);
  const level = prog.level;
  const title = getTitleForLevel(level);

  return (
    <AppShell eyebrow="Minha evolução" title="Evolução">
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4 p-4 pb-8">
          {/* ── Hero: Nível e XP ── */}
          <section className="animate-fade-in glass-strong relative overflow-hidden rounded-3xl p-5">
            <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
            <div className="relative">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                    Nível atual
                  </div>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className="num text-[40px] font-semibold leading-none tracking-tight text-gradient-primary">
                      {level}
                    </span>
                    <div>
                      <div className="text-[13px] font-semibold">{title}</div>
                      <div className="num text-[11px] text-muted-foreground">
                        {xp.toLocaleString("pt-BR")} XP total
                      </div>
                    </div>
                  </div>
                </div>
                <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-primary/30 bg-primary/15">
                  <Trophy className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div className="mt-4">
                <div className="flex items-center justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>
                    {prog.intoLevel.toLocaleString("pt-BR")} /{" "}
                    {prog.levelSpan.toLocaleString("pt-BR")} XP
                  </span>
                  <span>
                    Nível {level + 1} em {prog.xpToNext.toLocaleString("pt-BR")} XP
                  </span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                    style={{ width: `${prog.pct * 100}%` }}
                  />
                </div>
              </div>
            </div>
          </section>

          {/* ── Streak ── */}
          <section className="grid grid-cols-2 gap-2">
            <StatCard
              icon={<Flame className="h-4 w-4 text-orange-400" />}
              label="Sequência atual"
              value={`${profile?.streak_current ?? 0}`}
              suffix={profile?.streak_current === 1 ? "dia" : "dias"}
              color="orange"
            />
            <StatCard
              icon={<Zap className="h-4 w-4 text-primary" />}
              label="Maior sequência"
              value={`${profile?.streak_longest ?? 0}`}
              suffix="dias"
              color="primary"
            />
          </section>

          {/* ── Força ── */}
          <section className="animate-fade-in">
            <SectionHeader icon={<BarChart3 className="h-4 w-4" />} title="Força" />
            {evo?.weeklyStrengthVolume != null ? (
              <div className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-1">
                      Volume semanal (últimos 7 dias)
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="num text-[32px] font-semibold leading-none tracking-tight">
                        {evo.weeklyStrengthVolume.toLocaleString("pt-BR")}
                      </span>
                      <span className="text-[13px] text-muted-foreground">kg</span>
                    </div>
                    {evo.strengthDeltaPct != null ? (
                      <p
                        className={`mt-1.5 text-[12px] font-medium ${
                          evo.strengthDeltaPct >= 0 ? "text-primary" : "text-muted-foreground"
                        }`}
                      >
                        {evo.strengthDeltaPct >= 0 ? "+" : ""}
                        {evo.strengthDeltaPct}% vs semana anterior
                        {evo.prevWeekStrengthVolume != null && (
                          <span className="ml-1 num text-muted-foreground">
                            ({evo.prevWeekStrengthVolume.toLocaleString("pt-BR")} kg)
                          </span>
                        )}
                      </p>
                    ) : (
                      <p className="mt-1.5 text-[12px] text-muted-foreground">
                        Soma de carga × reps de todos os sets registrados.
                      </p>
                    )}
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10">
                    <TrendingUp className="h-5 w-5 text-primary" />
                  </div>
                </div>
              </div>
            ) : (
              <PlaceholderCard
                icon={<BarChart3 className="h-5 w-5" />}
                title="Sem dados de força ainda"
                description="Complete treinos com cargas registradas para ver seu volume semanal aqui."
                ctaLabel="Ir para treino"
                ctaHref="/hoje"
              />
            )}
          </section>

          {/* ── Consistência ── */}
          <section className="animate-fade-in">
            <SectionHeader icon={<CheckCircle2 className="h-4 w-4" />} title="Consistência" />
            <div className="glass rounded-2xl p-5">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-3">
                Últimos 30 dias
              </div>
              <div className="flex items-end gap-4">
                <div>
                  <div className="num text-[36px] font-semibold leading-none tracking-tight text-primary">
                    {evo?.consistencyPct ?? 0}%
                  </div>
                  <div className="mt-1 text-[12px] text-muted-foreground">
                    {evo?.sessionsLast30 ?? 0} sessão{evo?.sessionsLast30 !== 1 ? "ões" : ""}{" "}
                    concluída{evo?.sessionsLast30 !== 1 ? "s" : ""}
                  </div>
                </div>
                <div className="flex-1">
                  <div className="mb-1 flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>0%</span>
                    <span>100%</span>
                  </div>
                  <div className="h-3 w-full overflow-hidden rounded-full bg-surface">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-700"
                      style={{ width: `${Math.min(100, evo?.consistencyPct ?? 0)}%` }}
                    />
                  </div>
                </div>
              </div>
              {/* Mini barra dos últimos 7 dias (índice 0 = hoje) */}
              {evo?.daysWithSession30 && (
                <div className="mt-4">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">
                    Últimos 7 dias
                  </div>
                  <div className="flex items-end justify-between gap-1.5">
                    {evo.daysWithSession30
                      .slice(0, 7)
                      .reverse()
                      .map((done, i) => {
                        const d = new Date();
                        d.setHours(0, 0, 0, 0);
                        d.setDate(d.getDate() - (6 - i));
                        const label = d.toLocaleDateString("pt-BR", { weekday: "narrow" });
                        return (
                          <div key={i} className="flex flex-1 flex-col items-center gap-1">
                            <div
                              className={`w-full rounded-md transition-colors ${
                                done ? "bg-primary" : "bg-surface border border-border/60"
                              }`}
                              style={{ height: done ? "32px" : "10px" }}
                            />
                            <div className="text-[9px] text-muted-foreground">{label}</div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
              {(evo?.consistencyPct ?? 0) >= 80 && (
                <div className="mt-3 flex items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 px-3 py-2 text-[11px] text-primary">
                  <Flame className="h-3.5 w-3.5" />
                  Consistência excelente — continue assim!
                </div>
              )}
            </div>
          </section>

          {/* ── Peso corporal ── */}
          <section className="animate-fade-in">
            <SectionHeader icon={<Scale className="h-4 w-4" />} title="Peso corporal" />
            {evo?.lastWeightKg != null ? (
              <div className="glass rounded-2xl p-5">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-1">
                      Último registro
                    </div>
                    <div className="flex items-baseline gap-1.5">
                      <span className="num text-[32px] font-semibold leading-none tracking-tight">
                        {evo.lastWeightKg.toLocaleString("pt-BR", {
                          minimumFractionDigits: 1,
                          maximumFractionDigits: 1,
                        })}
                      </span>
                      <span className="text-[13px] text-muted-foreground">kg</span>
                    </div>
                    {evo.lastWeightDate && (
                      <div className="mt-0.5 text-[11px] text-muted-foreground">
                        {new Date(evo.lastWeightDate).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </div>
                    )}
                  </div>
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border/60 bg-surface-elevated">
                    <Scale className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                {/* Gráfico de barras 30 dias */}
                {evo.weight30d && evo.weight30d.some((p) => p.weight_kg != null) && (
                  <div>
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">
                      Últimos 30 dias
                    </div>
                    {(() => {
                      const vals = evo.weight30d
                        .map((p) => p.weight_kg)
                        .filter((v): v is number => v != null);
                      const min = Math.min(...vals);
                      const max = Math.max(...vals);
                      const range = max - min || 1;
                      return (
                        <>
                          <div className="flex items-end gap-[2px] h-16">
                            {evo.weight30d.map((p, i) => {
                              if (p.weight_kg == null) {
                                return (
                                  <div
                                    key={i}
                                    className="flex-1 rounded-sm bg-surface border border-border/40"
                                    style={{ height: "4px" }}
                                  />
                                );
                              }
                              const pct = (p.weight_kg - min) / range;
                              const h = 12 + pct * 52; // 12px–64px
                              return (
                                <div
                                  key={i}
                                  className="flex-1 rounded-sm bg-primary/50"
                                  style={{ height: `${h}px` }}
                                  title={`${p.date}: ${p.weight_kg.toFixed(1)} kg`}
                                />
                              );
                            })}
                          </div>
                          <div className="mt-1.5 flex items-center justify-between text-[9px] text-muted-foreground num">
                            <span>{min.toFixed(1)} kg</span>
                            <span>30d</span>
                            <span>{max.toFixed(1)} kg</span>
                          </div>
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>
            ) : (
              <PlaceholderCard
                icon={<Scale className="h-5 w-5" />}
                title="Sem registros de peso"
                description="Registre seu peso no perfil para acompanhar sua evolução ao longo do tempo."
                ctaLabel="Ir ao perfil"
                ctaHref="/perfil"
              />
            )}
          </section>

          {/* ── Recordes Pessoais (PRs) ── */}
          <section className="animate-fade-in">
            <SectionHeader icon={<Trophy className="h-4 w-4" />} title="Recordes pessoais" />
            {evo?.personalRecords && evo.personalRecords.length > 0 ? (
              <div className="space-y-2">
                {evo.personalRecords.slice(0, 10).map((pr) => (
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
                        {new Date(pr.achieved_at).toLocaleDateString("pt-BR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                        {pr.reps ? ` · ${pr.reps} reps` : ""}
                      </div>
                    </div>
                    <div className="num shrink-0 text-[14px] font-semibold text-primary">
                      {pr.load_kg.toLocaleString("pt-BR")}
                      <span className="ml-1 text-[10px] text-muted-foreground">kg</span>
                    </div>
                  </div>
                ))}
                {evo.personalRecords.length > 10 && (
                  <div className="text-center text-[11px] text-muted-foreground pt-1">
                    +{evo.personalRecords.length - 10} outros recordes
                  </div>
                )}
              </div>
            ) : (
              <PlaceholderCard
                icon={<Trophy className="h-5 w-5" />}
                title="Sem PRs registrados"
                description="Registre cargas durante seus treinos para começar a contabilizar recordes pessoais."
                ctaLabel="Ir para treino"
                ctaHref="/hoje"
              />
            )}
          </section>

          {/* ── Medidas ── */}
          <section className="animate-fade-in">
            <SectionHeader icon={<Ruler className="h-4 w-4" />} title="Medidas corporais" />
            {hasMeasures(evo?.measures) ? (
              <div className="glass rounded-2xl p-5">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Cintura", value: evo?.measures.waist_cm },
                    { label: "Quadril", value: evo?.measures.hip_cm },
                    { label: "Peito", value: evo?.measures.chest_cm },
                    { label: "Braço", value: evo?.measures.arm_cm },
                    { label: "Coxa", value: evo?.measures.thigh_cm },
                  ]
                    .filter((m) => m.value != null)
                    .map((m) => (
                      <div
                        key={m.label}
                        className="rounded-xl border border-border/60 bg-surface/40 px-4 py-3"
                      >
                        <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                          {m.label}
                        </div>
                        <div className="num mt-1 flex items-baseline gap-1">
                          <span className="text-[20px] font-semibold">{m.value}</span>
                          <span className="text-[12px] text-muted-foreground">cm</span>
                        </div>
                      </div>
                    ))}
                </div>
                <Link
                  to="/perfil"
                  className="mt-3 flex items-center justify-center gap-1.5 text-[12px] font-medium text-primary"
                >
                  Atualizar medidas <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </div>
            ) : (
              <PlaceholderCard
                icon={<Ruler className="h-5 w-5" />}
                title="Sem medidas registradas"
                description="Adicione cintura, quadril e outras medidas no seu perfil para acompanhar sua composição."
                ctaLabel="Ir ao perfil"
                ctaHref="/perfil"
              />
            )}
          </section>

          {/* ── Link para histórico completo ── */}
          <section>
            <Link
              to="/historico"
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/40 px-5 py-4 text-[14px] font-medium hover:bg-surface/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated">
                  <Trophy className="h-4 w-4 text-muted-foreground" />
                </div>
                Ver histórico completo de treinos
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </section>

          <section>
            <Link
              to="/progressao"
              className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/40 px-5 py-4 text-[14px] font-medium hover:bg-surface/60 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated">
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </div>
                Projeção de progressão de carga
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </section>
        </div>
      )}
    </AppShell>
  );
}

// ── Helpers ────────────────────────────────────────────────────

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
        {title}
      </span>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  suffix,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  suffix?: string;
  color: "orange" | "primary";
}) {
  return (
    <div className="glass rounded-2xl px-4 py-4 text-center">
      <div className="flex items-center justify-center gap-1 mb-1">{icon}</div>
      <div
        className={`num text-[24px] font-semibold leading-none ${color === "orange" ? "text-orange-400" : "text-primary"}`}
      >
        {value}
      </div>
      {suffix && <div className="mt-0.5 text-[10px] text-muted-foreground">{suffix}</div>}
      <div className="mt-1 text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </div>
    </div>
  );
}

function PlaceholderCard({
  icon,
  title,
  description,
  ctaLabel,
  ctaHref,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  ctaLabel: string;
  ctaHref: string;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/60 bg-surface/30 p-6 text-center">
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/60 bg-surface-elevated text-muted-foreground">
        {icon}
      </div>
      <div>
        <div className="text-[13px] font-semibold">{title}</div>
        <p className="mt-1 text-[11px] text-muted-foreground max-w-[240px] mx-auto">
          {description}
        </p>
      </div>
      <Link
        to={ctaHref}
        className="inline-flex items-center gap-1.5 text-[12px] font-medium text-primary"
      >
        {ctaLabel} <ArrowRight className="h-3.5 w-3.5" />
      </Link>
    </div>
  );
}

function hasMeasures(
  m?: {
    waist_cm: number | null;
    hip_cm: number | null;
    chest_cm: number | null;
    arm_cm: number | null;
    thigh_cm: number | null;
  } | null,
): boolean {
  if (!m) return false;
  return (
    m.waist_cm != null ||
    m.hip_cm != null ||
    m.chest_cm != null ||
    m.arm_cm != null ||
    m.thigh_cm != null
  );
}
