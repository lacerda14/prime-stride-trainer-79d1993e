import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { AppShell } from "@/components/app-shell";
import { Loader2, ShieldAlert, Users, Dumbbell, TrendingUp, Activity } from "lucide-react";
import { getMyRole } from "@/lib/exercise-media.functions";
import { getKpis } from "@/lib/admin-users.functions";

export const Route = createFileRoute("/admin/metrics")({
  head: () => ({
    meta: [
      { title: "Métricas · Admin · PM Hybrid" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminMetricsPage,
});

function AdminMetricsPage() {
  const fetchRole = useServerFn(getMyRole);
  const { data: role, isLoading } = useQuery({ queryKey: ["my-role"], queryFn: () => fetchRole() });

  if (isLoading) {
    return (
      <AppShell title="Métricas" eyebrow="Admin">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!role?.isAdmin) {
    return (
      <AppShell title="Restrito">
        <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Esta área é restrita a administradores.</p>
        </div>
      </AppShell>
    );
  }
  return <MetricsBoard />;
}

function pct(n?: number | null, d?: number | null): string {
  if (!d || d <= 0 || n == null) return "—";
  return `${Math.round((100 * n) / d)}%`;
}

function Stat({
  icon: Icon,
  label,
  value,
  hint,
  tone,
}: {
  icon: typeof Users;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "good" | "warn";
}) {
  const valueColor =
    tone === "good" ? "text-emerald-400" : tone === "warn" ? "text-amber-400" : "text-foreground";
  return (
    <div className="rounded-2xl border border-border/60 bg-surface/40 p-4">
      <div className="flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className={`mt-1.5 text-2xl font-semibold tracking-tight ${valueColor}`}>{value}</div>
      {hint && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function MetricsBoard() {
  const fetchKpis = useServerFn(getKpis);
  const { data, isLoading } = useQuery({ queryKey: ["admin-kpis"], queryFn: () => fetchKpis() });
  const ov = data?.overview;
  const act = data?.activation;
  const ret = data?.retention;

  const ativacao = act?.ativacao_pct;
  const ativacaoTone = ativacao != null ? (ativacao >= 40 ? "good" : "warn") : undefined;

  return (
    <AppShell title="Métricas" eyebrow="Admin">
      <div className="space-y-5 px-5 pb-28 pt-4">
        {isLoading ? (
          <div className="flex h-48 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Visão geral
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat icon={Users} label="Usuários" value={ov?.usuarios ?? "—"} />
                <Stat
                  icon={Users}
                  label="Onboarded"
                  value={ov?.onboarded ?? "—"}
                  hint={`${pct(ov?.onboarded, ov?.usuarios)} dos usuários`}
                />
                <Stat
                  icon={Dumbbell}
                  label="Fizeram 1º treino"
                  value={ov?.fizeram_1_treino ?? "—"}
                />
                <Stat icon={Activity} label="Treinos (7d)" value={ov?.treinos_7d ?? "—"} />
                <Stat icon={Activity} label="Ativos 7d" value={ov?.ativos_7d ?? "—"} />
                <Stat icon={Activity} label="Ativos 30d" value={ov?.ativos_30d ?? "—"} />
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                Ativação & retenção{" "}
                <span className="normal-case text-muted-foreground/70">(o que decide tudo)</span>
              </h2>
              <div className="grid grid-cols-2 gap-2.5">
                <Stat
                  icon={TrendingUp}
                  label="Ativação"
                  value={ativacao != null ? `${ativacao}%` : "—"}
                  hint="onboarded que treinou"
                  tone={ativacaoTone}
                />
                <Stat
                  icon={TrendingUp}
                  label="Retenção D7"
                  value={pct(ret?.retidos_d7, ret?.coorte_7d)}
                  hint={`${ret?.retidos_d7 ?? 0}/${ret?.coorte_7d ?? 0} ainda ativos`}
                />
                <Stat
                  icon={TrendingUp}
                  label="Retenção D30"
                  value={pct(ret?.retidos_d30, ret?.coorte_30d)}
                  hint={`${ret?.retidos_d30 ?? 0}/${ret?.coorte_30d ?? 0} ainda ativos`}
                />
              </div>
              <p className="mt-3 text-[11.5px] leading-relaxed text-muted-foreground">
                Meta: <strong className="text-foreground">retenção D30 ≥ 30-40%</strong>. Se a
                ativação estiver baixa, o gargalo é entre "configurou" e "treinou" — foca aí antes
                de qualquer feature nova.
              </p>
            </section>

            <Link
              to="/admin/users"
              className="block rounded-2xl border border-border/60 bg-surface/40 px-4 py-3 text-center text-[13px] font-medium text-muted-foreground active:scale-[0.99]"
            >
              Gerenciar usuários →
            </Link>
          </>
        )}
      </div>
    </AppShell>
  );
}
