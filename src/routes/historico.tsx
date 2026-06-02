import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { History, Loader2, Timer } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { listWorkoutHistory } from "@/lib/workout-session.functions";

export const Route = createFileRoute("/historico")({
  head: () => ({
    meta: [
      { title: "Histórico · PM Hybrid" },
      { name: "description", content: "Sessões treinadas, volume e PRs." },
    ],
  }),
  component: HistoricoPage,
});

function HistoricoPage() {
  const { user } = useAuth();
  const fetchHistory = useServerFn(listWorkoutHistory);
  const { data, isLoading } = useQuery({
    queryKey: ["workout-history", user?.id],
    queryFn: () => fetchHistory(),
    enabled: !!user,
  });

  const sessions = data ?? [];
  const totalSeconds = sessions.reduce((acc, s) => acc + (s.duration_seconds ?? 0), 0);
  const totalHours = Math.floor(totalSeconds / 3600);
  const totalMinutes = Math.round((totalSeconds % 3600) / 60);

  return (
    <AppShell eyebrow="Atividade" title="Histórico">
      <div className="space-y-5 p-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Sessões" value={String(sessions.length)} hint="concluídas" />
          <Stat
            label="Tempo total"
            value={totalHours > 0 ? `${totalHours}h${String(totalMinutes).padStart(2, "0")}` : `${totalMinutes}min`}
            hint="treinando"
          />
          <Stat
            label="Última"
            value={sessions[0] ? formatRelative(sessions[0].finished_at) : "—"}
            hint=""
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center p-12">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="glass flex flex-col items-center gap-3 rounded-2xl p-8 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-surface-elevated">
              <History className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <div className="text-sm font-semibold tracking-tight">Sem sessões registradas</div>
              <p className="mt-1 text-xs text-muted-foreground">
                Conclua um treino em <span className="text-foreground">Hoje</span> para começar seu histórico.
              </p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sessions.map((s) => (
              <div key={s.id} className="glass rounded-2xl p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="text-sm font-semibold tracking-tight truncate">
                      {s.day_key} · Semana {String(s.week_number).padStart(2, "0")}
                    </div>
                    <div className="num mt-1 text-[11px] text-muted-foreground">
                      {formatDateTime(s.started_at)} {s.finished_at ? `→ ${formatTime(s.finished_at)}` : ""}
                    </div>
                  </div>
                  <div className="num inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-[11px] font-semibold text-primary shrink-0">
                    <Timer className="h-3 w-3" /> {formatDuration(s.duration_seconds ?? 0)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-surface/40 p-3">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="num mt-1.5 text-xl font-semibold tracking-tight truncate">{value}</div>
      <div className="mt-0.5 text-[10px] text-muted-foreground">{hint}</div>
    </div>
  );
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (h > 0) return `${h}h${String(m).padStart(2, "0")}`;
  return `${m}min`;
}

function formatDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function formatRelative(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const diffMs = Date.now() - d.getTime();
  const days = Math.floor(diffMs / (24 * 60 * 60 * 1000));
  if (days === 0) return "hoje";
  if (days === 1) return "ontem";
  if (days < 7) return `${days}d`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}
