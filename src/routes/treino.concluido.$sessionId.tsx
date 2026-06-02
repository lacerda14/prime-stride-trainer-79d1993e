import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { RequireAuth } from "@/components/require-auth";
import {
  ChevronDown,
  ChevronUp,
  Flame,
  Footprints,
  Loader2,
  Sparkles,
  Trophy,
  Check,
  Clock,
} from "lucide-react";
import { getCompletedSession, saveWorkoutLogs, type SetLogDTO } from "@/lib/workout-logs.functions";
import { getWeekDetail } from "@/lib/program.queries";
import { estimateCalories } from "@/lib/calories";
import { toast } from "sonner";

export const Route = createFileRoute("/treino/concluido/$sessionId")({
  head: () => ({
    meta: [
      { title: "Treino concluído · PM Hybrid" },
      { name: "description", content: "Revise os dados do seu treino e salve as cargas usadas." },
    ],
  }),
  component: () => (
    <RequireAuth>
      <ConcluidoPage />
    </RequireAuth>
  ),
});

// ============================================================
// Helpers
// ============================================================

function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m.toString().padStart(2, "0")}m`;
  return `${m}:${sec.toString().padStart(2, "0")}`;
}

function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

interface SetRow {
  exercise_index: number;
  exercise_name: string;
  exercise_id: string | null;
  set_number: number;
  planned_reps: string | null;
  actual_reps: string;
  actual_load_kg: string;
  actual_rpe: string;
  notes: string;
}

// ============================================================
// Página
// ============================================================

function ConcluidoPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const params = Route.useParams();
  const sessionId = params.sessionId;

  const fetchCompleted = useServerFn(getCompletedSession);
  const fetchWeek = useServerFn(getWeekDetail);
  const saveLogs = useServerFn(saveWorkoutLogs);

  const completedQ = useQuery({
    queryKey: ["completed-session", sessionId, user?.id],
    queryFn: () => fetchCompleted({ data: { session_id: sessionId } }),
    enabled: !!user,
  });

  const weekQ = useQuery({
    queryKey: ["week-detail", completedQ.data?.session.week_number, user?.id],
    queryFn: () => fetchWeek({ data: { week_number: completedQ.data!.session.week_number } }),
    enabled: !!user && !!completedQ.data,
  });

  const planned = useMemo(() => {
    if (!weekQ.data || !completedQ.data) return null;
    const day = weekQ.data.days.find((d) => d.day_name === completedQ.data.session.day_key);
    return day ?? null;
  }, [weekQ.data, completedQ.data]);

  // ----------------------------------------------------------
  // Estado dos formulários
  // ----------------------------------------------------------
  const [setRows, setSetRows] = useState<SetRow[]>([]);
  const [runDuration, setRunDuration] = useState("");
  const [runDistance, setRunDistance] = useState("");
  const [runAvgSpeed, setRunAvgSpeed] = useState("");
  const [runMaxSpeed, setRunMaxSpeed] = useState("");
  const [runEffort, setRunEffort] = useState("");
  const [runNotes, setRunNotes] = useState("");
  const [generalEffort, setGeneralEffort] = useState("");
  const [generalNotes, setGeneralNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [savedOnce, setSavedOnce] = useState(false);

  // Constrói as linhas a partir do plano + logs existentes
  useEffect(() => {
    if (!planned || !completedQ.data) return;
    const existingByKey = new Map<string, SetLogDTO>();
    for (const l of completedQ.data.set_logs) {
      existingByKey.set(`${l.exercise_index}:${l.set_number}`, l);
    }
    const rows: SetRow[] = [];
    let exIdx = 0;
    for (const e of planned.exercises) {
      const sets = Math.max(1, e.sets);
      for (let s = 1; s <= sets; s++) {
        const existing = existingByKey.get(`${exIdx}:${s}`);
        rows.push({
          exercise_index: exIdx,
          exercise_name: e.exercise.name,
          exercise_id: e.exercise.id,
          set_number: s,
          planned_reps: e.reps,
          actual_reps: existing?.actual_reps != null ? String(existing.actual_reps) : "",
          actual_load_kg: existing?.actual_load_kg != null ? String(existing.actual_load_kg) : "",
          actual_rpe: existing?.actual_rpe != null ? String(existing.actual_rpe) : "",
          notes: existing?.notes ?? "",
        });
      }
      exIdx++;
    }
    setSetRows(rows);

    // running log preencher
    const r = completedQ.data.running_log;
    if (r) {
      setRunDuration(r.total_duration_seconds ? String(Math.round(r.total_duration_seconds / 60)) : "");
      setRunDistance(r.distance_km != null ? String(r.distance_km) : "");
      setRunAvgSpeed(r.average_speed_kmh != null ? String(r.average_speed_kmh) : "");
      setRunMaxSpeed(r.max_speed_kmh != null ? String(r.max_speed_kmh) : "");
      setRunEffort(r.perceived_effort != null ? String(r.perceived_effort) : "");
      setRunNotes(r.notes ?? "");
    }
    const sum = completedQ.data.session.completed_summary ?? null;
    if (sum?.perceived_effort != null) setGeneralEffort(String(sum.perceived_effort));
    if (sum?.general_notes) setGeneralNotes(sum.general_notes);
  }, [planned, completedQ.data]);

  // Estimativa de calorias em tempo real
  const estimatedCal = useMemo(() => {
    if (!completedQ.data) return 0;
    const sess = completedQ.data.session;
    const weight = completedQ.data.profile.weight_kg ?? null;
    const dur = sess.duration_seconds ?? 0;
    const hasRun = !!planned?.running;
    const runSec = runDuration ? Number(runDuration) * 60 : null;
    const avgSpeed = runAvgSpeed ? Number(runAvgSpeed) : null;
    const effort = generalEffort ? Number(generalEffort) : runEffort ? Number(runEffort) : null;
    return estimateCalories({
      weight_kg: weight,
      duration_seconds: dur,
      has_run: hasRun,
      strength_set_count: setRows.length,
      perceived_effort: effort,
      avg_speed_kmh: avgSpeed,
      running_seconds: runSec,
    });
  }, [completedQ.data, planned?.running, runDuration, runAvgSpeed, runEffort, generalEffort, setRows.length]);

  // ----------------------------------------------------------
  // Submit
  // ----------------------------------------------------------
  async function handleSave() {
    if (!completedQ.data) return;
    setSaving(true);
    try {
      const payloadSets = setRows
        .filter((r) => r.actual_reps !== "" || r.actual_load_kg !== "" || r.actual_rpe !== "" || r.notes !== "")
        .map((r) => ({
          exercise_index: r.exercise_index,
          exercise_name: r.exercise_name,
          exercise_id: r.exercise_id,
          set_number: r.set_number,
          planned_reps: r.planned_reps,
          actual_reps: r.actual_reps !== "" ? Number(r.actual_reps) : null,
          actual_load_kg: r.actual_load_kg !== "" ? Number(r.actual_load_kg) : null,
          actual_rpe: r.actual_rpe !== "" ? Number(r.actual_rpe) : null,
          notes: r.notes || null,
        }));

      const runningPayload = planned?.running
        ? {
            total_duration_seconds: runDuration ? Number(runDuration) * 60 : null,
            distance_km: runDistance ? Number(runDistance) : null,
            average_speed_kmh: runAvgSpeed ? Number(runAvgSpeed) : null,
            max_speed_kmh: runMaxSpeed ? Number(runMaxSpeed) : null,
            perceived_effort: runEffort ? Number(runEffort) : null,
            notes: runNotes || null,
          }
        : null;

      await saveLogs({
        data: {
          session_id: sessionId,
          estimated_calories: estimatedCal,
          set_logs: payloadSets,
          running_log: runningPayload,
          general_notes: generalNotes || null,
          perceived_effort: generalEffort ? Number(generalEffort) : null,
        },
      });
      setSavedOnce(true);
      toast.success("Treino salvo com sucesso");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao salvar";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  // ----------------------------------------------------------
  // Loading
  // ----------------------------------------------------------
  if (completedQ.isLoading || !completedQ.data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const sess = completedQ.data.session;
  const prof = completedQ.data.profile;
  const completedExercises = planned?.exercises.length ?? 0;
  const completedSets = setRows.length;

  return (
    <div className="min-h-screen bg-background pb-32 safe-pad">
      <div className="mx-auto w-full max-w-[480px] px-5 pt-8">
        {/* Header */}
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Check className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-2xl font-semibold tracking-tight">Treino concluído com sucesso</h1>
          <p className="mt-1 text-sm text-muted-foreground">Revise os dados do seu treino abaixo.</p>
        </div>

        {/* Resumo */}
        <Section title="Resumo" defaultOpen icon={<Clock className="h-4 w-4" />}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Início" value={formatClock(sess.started_at)} />
            <Stat label="Fim" value={formatClock(sess.finished_at)} />
            <Stat label="Duração" value={formatHMS(sess.duration_seconds ?? 0)} />
            <Stat
              label="Calorias estimadas"
              value={`${estimatedCal} kcal`}
              icon={<Flame className="h-3.5 w-3.5 text-primary" />}
            />
            <Stat label="Exercícios" value={String(completedExercises)} />
            <Stat label="Séries" value={String(completedSets)} />
            <Stat label="Streak" value={`${prof.streak_current} dias`} />
            <Stat label="Nível" value={`Nv. ${prof.level}`} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Estimativa baseada no seu peso, duração e intensidade do treino.
          </p>
        </Section>

        {/* Avaliação geral */}
        <Section title="Avaliação" defaultOpen icon={<Sparkles className="h-4 w-4" />}>
          <Label>Esforço percebido geral (1-10)</Label>
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={10}
            value={generalEffort}
            onChange={(e) => setGeneralEffort(e.target.value)}
            className="mt-1 w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            placeholder="Ex: 7"
          />
          <Label className="mt-3">Comentários</Label>
          <textarea
            value={generalNotes}
            onChange={(e) => setGeneralNotes(e.target.value)}
            rows={3}
            maxLength={1000}
            className="mt-1 w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
            placeholder="Como você se sentiu?"
          />
        </Section>

        {/* Corrida */}
        {planned?.running && (
          <Section title="Dados da corrida" defaultOpen icon={<Footprints className="h-4 w-4" />}>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Duração total (min)" value={runDuration} onChange={setRunDuration} type="number" />
              <Field label="Distância (km)" value={runDistance} onChange={setRunDistance} type="number" step="0.1" />
              <Field
                label="Velocidade média (km/h)"
                value={runAvgSpeed}
                onChange={setRunAvgSpeed}
                type="number"
                step="0.1"
              />
              <Field
                label="Velocidade máx. (km/h)"
                value={runMaxSpeed}
                onChange={setRunMaxSpeed}
                type="number"
                step="0.1"
              />
              <Field
                label="Esforço (1-10)"
                value={runEffort}
                onChange={setRunEffort}
                type="number"
                min={1}
                max={10}
              />
            </div>
            <Label className="mt-3">Comentário</Label>
            <textarea
              value={runNotes}
              onChange={(e) => setRunNotes(e.target.value)}
              rows={2}
              maxLength={500}
              className="mt-1 w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
              placeholder="Como foi a corrida?"
            />
          </Section>
        )}

        {/* Cargas usadas */}
        {setRows.length > 0 && (
          <Section title="Cargas usadas" defaultOpen={false} icon={<Trophy className="h-4 w-4" />} highlight>
            <p className="mb-3 text-xs text-muted-foreground">Informe as cargas usadas em cada série.</p>
            <SetLogList rows={setRows} onChange={setSetRows} />
          </Section>
        )}

        {/* XP / Salvar */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex w-full items-center justify-center gap-2 rounded-full bg-primary py-4 text-sm font-semibold text-primary-foreground shadow-glow disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {savedOnce ? "Salvar alterações" : "Salvar treino"}
          </button>
          {savedOnce && (
            <p className="text-center text-sm text-primary">Treino salvo com sucesso</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => navigate({ to: "/historico" })}
              className="rounded-full border border-border bg-surface/60 py-3 text-sm font-medium text-foreground hover:bg-surface"
            >
              Ver progresso
            </button>
            <button
              onClick={() => navigate({ to: "/" })}
              className="rounded-full border border-border bg-surface/60 py-3 text-sm font-medium text-foreground hover:bg-surface"
            >
              Voltar ao início
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Componentes
// ============================================================

function Section({
  title,
  defaultOpen,
  icon,
  highlight,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  icon?: React.ReactNode;
  highlight?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(!!defaultOpen);
  return (
    <div
      className={`mt-4 overflow-hidden rounded-2xl border ${
        highlight ? "border-primary/40 bg-primary/5" : "border-border bg-surface/40"
      }`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground">
          {icon}
          {title}
        </span>
        {open ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>
      {open && <div className="border-t border-border/50 px-4 py-4">{children}</div>}
    </div>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-border/50 bg-background/40 p-3">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-base font-semibold text-foreground">{value}</div>
    </div>
  );
}

function Label({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`text-[11px] uppercase tracking-wide text-muted-foreground ${className ?? ""}`}>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  step,
  min,
  max,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  type?: string;
  step?: string;
  min?: number;
  max?: number;
}) {
  return (
    <div>
      <Label>{label}</Label>
      <input
        type={type}
        step={step}
        min={min}
        max={max}
        inputMode={type === "number" ? "decimal" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-xl border border-border bg-surface/60 px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
      />
    </div>
  );
}

function SetLogList({
  rows,
  onChange,
}: {
  rows: SetRow[];
  onChange: (next: SetRow[]) => void;
}) {
  const grouped = useMemo(() => {
    const map = new Map<number, SetRow[]>();
    for (const r of rows) {
      const arr = map.get(r.exercise_index) ?? [];
      arr.push(r);
      map.set(r.exercise_index, arr);
    }
    return Array.from(map.entries()).map(([idx, sets]) => ({ idx, sets }));
  }, [rows]);

  function patch(exIdx: number, setN: number, key: keyof SetRow, value: string) {
    onChange(
      rows.map((r) =>
        r.exercise_index === exIdx && r.set_number === setN ? { ...r, [key]: value } : r,
      ),
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {grouped.map(({ idx, sets }) => (
        <div key={idx} className="rounded-xl border border-border/40 bg-background/40 p-3">
          <div className="text-sm font-semibold text-foreground">{sets[0]?.exercise_name}</div>
          <div className="text-[11px] text-muted-foreground">
            Programado: {sets[0]?.planned_reps ?? "—"} reps · {sets.length} séries
          </div>
          <div className="mt-3 flex flex-col gap-2">
            {sets.map((s) => (
              <div key={s.set_number} className="grid grid-cols-[40px_1fr_1fr_1fr] gap-2">
                <div className="flex items-center justify-center rounded-lg bg-surface/60 text-xs text-muted-foreground">
                  S{s.set_number}
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Carga kg"
                  value={s.actual_load_kg}
                  onChange={(e) => patch(s.exercise_index, s.set_number, "actual_load_kg", e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/60 px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                <input
                  type="number"
                  inputMode="numeric"
                  placeholder="Reps"
                  value={s.actual_reps}
                  onChange={(e) => patch(s.exercise_index, s.set_number, "actual_reps", e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/60 px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="RPE"
                  min={0}
                  max={10}
                  value={s.actual_rpe}
                  onChange={(e) => patch(s.exercise_index, s.set_number, "actual_rpe", e.target.value)}
                  className="w-full rounded-lg border border-border bg-surface/60 px-2 py-2 text-sm text-foreground outline-none focus:border-primary"
                />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
