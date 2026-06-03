import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { AppShell } from "@/components/app-shell";
import { RequireAuth } from "@/components/require-auth";
import { useAuth } from "@/hooks/use-auth";
import { getPersonalRecords, getRecentPRs, type PersonalRecordDTO } from "@/lib/personal-records.functions";
import { PR_EXERCISE_CODES, type PRExerciseCode } from "@/lib/pr-detection.server";
import { PREditSheet } from "@/components/pr-edit-sheet";
import { Trophy, TrendingUp, Loader2, ArrowRight, Dumbbell, Footprints, Plus, Pencil } from "lucide-react";

export const Route = createFileRoute("/performance")({
  head: () => ({
    meta: [
      { title: "PRs & Performance · PM Hybrid" },
      { name: "description", content: "Seus recordes pessoais de força e corrida." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <PerformancePage />
    </RequireAuth>
  ),
});

const STRENGTH_ORDER: PRExerciseCode[] = [
  "back_squat",
  "front_squat",
  "deadlift",
  "bench_press",
  "strict_military_press",
  "strict_pull_up",
];
const RUNNING_ORDER: PRExerciseCode[] = ["run_5k", "run_1k", "best_pace", "distance_30min"];

function formatValue(code: PRExerciseCode, value: number, est1rm: number | null): string {
  const meta = PR_EXERCISE_CODES[code];
  if (meta.metric === "weight_load") return `${value} kg${est1rm ? ` · 1RM ~${est1rm}` : ""}`;
  if (meta.metric === "reps") return `${value} reps`;
  if (meta.metric === "time_seconds") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  if (meta.metric === "pace_seconds_km") {
    const m = Math.floor(value / 60);
    const s = Math.round(value % 60);
    return `${m}:${String(s).padStart(2, "0")} /km`;
  }
  if (meta.metric === "distance_km") return `${value.toFixed(2)} km`;
  return String(value);
}

function PerformancePage() {
  const { user } = useAuth();
  const fetchPRs = useServerFn(getPersonalRecords);
  const fetchRecent = useServerFn(getRecentPRs);

  const prs = useQuery({
    queryKey: ["personal-records", user?.id],
    queryFn: () => fetchPRs(),
    enabled: !!user,
  });
  const recent = useQuery({
    queryKey: ["recent-prs", user?.id],
    queryFn: () => fetchRecent({ data: { limit: 5 } }),
    enabled: !!user,
  });

  const isLoading = prs.isLoading || recent.isLoading;
  const prMap = new Map((prs.data ?? []).map((r) => [r.exercise_code, r]));

  return (
    <AppShell eyebrow="Minha performance" title="PRs & Performance">
      {isLoading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-5 p-4 pb-8">
          {/* Recentes */}
          <section>
            <SectionHeader icon={<Trophy className="h-4 w-4" />} title="Recentes" />
            {recent.data && recent.data.length > 0 ? (
              <div className="space-y-2">
                {recent.data.map((r, i) => (
                  <div
                    key={`${r.exercise_code}-${r.achieved_at}-${i}`}
                    className="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 p-3.5"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <Trophy className="h-5 w-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-[13px] font-semibold">{r.label}</div>
                      <div className="num text-[11px] text-muted-foreground">
                        {new Date(r.achieved_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
                        {r.improvement_pct != null && r.improvement_pct > 0 && (
                          <span className="ml-1.5 text-primary">+{r.improvement_pct}%</span>
                        )}
                      </div>
                    </div>
                    <div className="num shrink-0 text-[13px] font-semibold text-primary">
                      {formatValue(r.exercise_code, r.value, r.estimated_1rm)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <EmptyCard text="Conclua treinos com cargas registradas para começar a quebrar PRs." />
            )}
          </section>

          {/* Força */}
          <section>
            <SectionHeader icon={<Dumbbell className="h-4 w-4" />} title="Força" />
            <div className="space-y-2">
              {STRENGTH_ORDER.map((code) => (
                <PRCard key={code} code={code} pr={prMap.get(code)} />
              ))}
            </div>
          </section>

          {/* Corrida */}
          <section>
            <SectionHeader icon={<Footprints className="h-4 w-4" />} title="Corrida" />
            <div className="space-y-2">
              {RUNNING_ORDER.map((code) => (
                <PRCard key={code} code={code} pr={prMap.get(code)} />
              ))}
            </div>
          </section>

          <Link
            to="/evolucao"
            className="flex items-center justify-between rounded-2xl border border-border/60 bg-surface/40 px-5 py-4 text-[14px] font-medium hover:bg-surface/60"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-border/60 bg-surface-elevated">
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </div>
              Ver evolução completa
            </div>
            <ArrowRight className="h-4 w-4 text-muted-foreground" />
          </Link>
        </div>
      )}
    </AppShell>
  );
}

function SectionHeader({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div className="mb-2 flex items-center gap-2 px-1">
      <span className="text-primary">{icon}</span>
      <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground">{title}</span>
    </div>
  );
}

function PRCard({
  code,
  pr,
}: {
  code: PRExerciseCode;
  pr:
    | {
        value: number;
        estimated_1rm: number | null;
        previous_value: number | null;
        improvement_pct: number | null;
        achieved_at: string;
      }
    | undefined;
}) {
  const meta = PR_EXERCISE_CODES[code];
  if (!pr) {
    return (
      <div className="rounded-2xl border border-dashed border-border/50 bg-surface/30 p-4">
        <div className="text-[13px] font-semibold text-muted-foreground">{meta.label}</div>
        <div className="mt-0.5 text-[11px] text-muted-foreground/70">Sem recorde ainda</div>
      </div>
    );
  }
  return (
    <div className="glass rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-[13px] font-semibold">{meta.label}</div>
          <div className="num mt-2 flex items-baseline gap-2">
            <span className="text-[24px] font-semibold leading-none tracking-tight text-gradient-primary">
              {formatValue(code, pr.value, pr.estimated_1rm)}
            </span>
          </div>
          <div className="num mt-1.5 text-[11px] text-muted-foreground">
            {new Date(pr.achieved_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}
            {pr.improvement_pct != null && pr.improvement_pct !== 0 && (
              <span className={`ml-1.5 ${pr.improvement_pct > 0 ? "text-primary" : "text-muted-foreground"}`}>
                {pr.improvement_pct > 0 ? "+" : ""}
                {pr.improvement_pct}%
              </span>
            )}
          </div>
        </div>
        <Trophy className="h-5 w-5 shrink-0 text-primary/60" />
      </div>
    </div>
  );
}

function EmptyCard({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-border/60 bg-surface/30 p-5 text-center text-[12px] text-muted-foreground">
      {text}
    </div>
  );
}
