import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getLatestReadiness } from "@/lib/engine/autoregulation.functions";
import { Sparkles } from "lucide-react";

interface Decision {
  message: string;
  load_adjust_pct: number;
  accessory_volume_adjust: number;
  deload_recommended: boolean;
  monitor_only: boolean;
}

function scoreColor(score: number): string {
  if (score >= 75) return "text-emerald-400";
  if (score >= 50) return "text-primary";
  if (score >= 30) return "text-amber-400";
  return "text-red-400";
}

function scoreLabel(score: number): string {
  if (score >= 75) return "Pronto pra avançar";
  if (score >= 50) return "Em ritmo";
  if (score >= 30) return "Atenção";
  return "Recuperação";
}

export function ReadinessCard() {
  const { user } = useAuth();
  const fetchReadiness = useServerFn(getLatestReadiness);

  const q = useQuery({
    queryKey: ["latest-readiness", user?.id],
    queryFn: () => fetchReadiness(),
    enabled: !!user,
    staleTime: 60_000,
  });

  if (!q.data) return null;
  const score = q.data.score as number;
  const decision = q.data.decision as unknown as Decision;

  return (
    <div className="rounded-2xl border border-border/50 bg-surface/40 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-[10px] uppercase tracking-widest text-muted-foreground">
            Training Readiness
          </span>
        </div>
        <span className={`num text-2xl font-semibold tabular-nums ${scoreColor(score)}`}>
          {score}
        </span>
      </div>
      <div className="mb-2 h-1.5 w-full overflow-hidden rounded-full bg-border/40">
        <div
          className="h-full rounded-full bg-primary transition-all duration-500"
          style={{ width: `${score}%` }}
        />
      </div>
      <div className={`text-xs font-medium ${scoreColor(score)}`}>{scoreLabel(score)}</div>
      <p className="mt-2 text-xs leading-relaxed text-foreground/70">{decision.message}</p>
      {decision.deload_recommended && (
        <div className="mt-3 rounded-xl border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-[11px] text-amber-300">
          ⚠️ IA sugere semana de deload (volume −30%)
        </div>
      )}
    </div>
  );
}
