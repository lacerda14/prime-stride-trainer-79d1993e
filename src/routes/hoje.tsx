import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTodayTraining, type SessionExerciseDTO } from "@/lib/program.queries";
import { getLastWeightsForExercises } from "@/lib/workout-logs.functions";
import { useAuth } from "@/hooks/use-auth";
import { ChevronDown, Play, Timer, Target, Loader2, PlayCircle, ArrowRightLeft } from "lucide-react";
import { runningHeadline, runningInstructions } from "@/lib/format-running";
import { useLocalToday } from "@/hooks/use-local-today";
import { ExerciseDetailModal, useExerciseDetail } from "@/components/exercise-detail-modal";
import { ExerciseSwapSheet } from "@/components/exercise-swap-sheet";
import type { SwapSuggestion } from "@/lib/exercise-swap.functions";

// Swap aplicado a um exercício do dia (overlay puramente visual / local)
type AppliedSwap = { id: string; name: string; category: string };
type SwapMap = Record<string, AppliedSwap>;

function swapKey(date: string) { return `hoje_swaps_${date}`; }
function loadSwaps(date: string): SwapMap {
  try { return JSON.parse(localStorage.getItem(swapKey(date)) ?? "{}") as SwapMap; }
  catch { return {}; }
}
function persistSwaps(date: string, m: SwapMap) {
  try { localStorage.setItem(swapKey(date), JSON.stringify(m)); } catch { /* noop */ }
}

function applySwap(e: SessionExerciseDTO, swaps: SwapMap): SessionExerciseDTO {
  const s = swaps[e.id];
  if (!s) return e;
  return { ...e, exercise: { id: s.id, name: s.name, category: s.category } };
}

export const Route = createFileRoute("/hoje")({
  head: () => ({
    meta: [
      { title: "Treino de Hoje · PM Hybrid" },
      { name: "description", content: "Sessão de treino do dia com séries, descanso e progressão." },
    ],
  }),
  component: HojePage,
});

// ── Helpers ────────────────────────────────────────────────────

type ExerciseGroup =
  | { kind: "single"; exercise: SessionExerciseDTO; index: number }
  | { kind: "biset"; exercises: SessionExerciseDTO[]; slot: number; index: number };

function groupExercises(list: SessionExerciseDTO[]): ExerciseGroup[] {
  const groups: ExerciseGroup[] = [];
  const usedSlots = new Set<number>();
  let visualIndex = 0;

  for (const ex of list) {
    if (ex.pair_slot !== null) {
      if (usedSlots.has(ex.pair_slot)) continue;
      usedSlots.add(ex.pair_slot);
      const pair = list.filter((e) => e.pair_slot === ex.pair_slot);
      groups.push({ kind: "biset", exercises: pair, slot: ex.pair_slot, index: visualIndex++ });
    } else {
      groups.push({ kind: "single", exercise: ex, index: visualIndex++ });
    }
  }
  return groups;
}

// ── Carga local (localStorage) ─────────────────────────────────

function loadKey(exerciseId: string, set: number) {
  return `load_${exerciseId}_s${set}`;
}
function getLoad(exerciseId: string, set: number): string {
  try { return localStorage.getItem(loadKey(exerciseId, set)) ?? ""; } catch { return ""; }
}
function setLoad(exerciseId: string, set: number, value: string) {
  try { localStorage.setItem(loadKey(exerciseId, set), value); } catch { /* noop */ }
}

// ── Sub-components ─────────────────────────────────────────────

function SetRow({ exerciseId, setNum, reps, lastWeight }: {
  exerciseId: string;
  setNum: number;
  reps: string;
  lastWeight?: number | null;
}) {
  const [peso, setPesoState] = useState(() => getLoad(exerciseId, setNum));

  return (
    <div className="num grid grid-cols-[36px_1fr_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        Set {setNum}
      </div>
      <div>
        <div className="text-sm font-semibold">{reps} reps</div>
        {lastWeight != null && !peso && (
          <div className="text-[10px] text-primary/70">Último: {lastWeight}kg</div>
        )}
      </div>
      <input
        type="number"
        min={0}
        step={0.5}
        value={peso}
        onChange={(e) => {
          setPesoState(e.target.value);
          setLoad(exerciseId, setNum, e.target.value);
        }}
        placeholder={lastWeight != null ? `${lastWeight}` : "kg"}
        className="num w-16 rounded-lg border border-border/60 bg-surface-elevated px-2 py-1 text-center text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
      />
    </div>
  );
}

function ExerciseRows({ exercise, onOpenVideo }: { exercise: SessionExerciseDTO; onOpenVideo: (id: string) => void }) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 px-1 pb-1">
        <button
          type="button"
          onClick={() => onOpenVideo(exercise.exercise.id)}
          className="inline-flex items-center gap-1.5 text-sm font-semibold tracking-tight transition-colors hover:text-primary text-left"
        >
          {exercise.exercise.name}
          <PlayCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        </button>
        <div className="num flex items-center gap-2 text-xs text-muted-foreground">
          <span>{exercise.sets}×{exercise.reps}</span>
          {exercise.rpe_target && <span>· RPE {exercise.rpe_target}</span>}
        </div>
      </div>
      {Array.from({ length: exercise.sets || 1 }).map((_, i) => (
        <SetRow key={i} exerciseId={exercise.id} setNum={i + 1} reps={exercise.reps} />
      ))}
    </div>
  );
}

// Card de exercício simples
function SingleCard({ exercise, index, onOpenVideo, lastWeights, onRequestSwap, isSwapped }: {
  exercise: SessionExerciseDTO;
  index: number;
  onOpenVideo: (id: string) => void;
  lastWeights: Record<string, number | null>;
  onRequestSwap: (slotId: string, currentPoolId: string, currentName: string) => void;
  isSwapped: boolean;
}) {
  const [open, setOpen] = useState(index === 0);

  return (
    <div className="glass overflow-hidden rounded-2xl">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-4">
          <div className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface text-sm font-semibold text-muted-foreground">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2 text-base font-semibold tracking-tight">
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onOpenVideo(exercise.exercise.id); }}
                className="inline-flex items-center gap-1.5 text-left transition-colors hover:text-primary"
              >
                {exercise.exercise.name}
                <PlayCircle className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
              {isSwapped && (
                <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
                  Trocado
                </span>
              )}
            </div>
            <div className="num mt-0.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span>{exercise.sets}×{exercise.reps}</span>
              {exercise.rest_seconds && (
                <span className="inline-flex items-center gap-1 text-primary/90">
                  <Timer className="h-3 w-3" /> {exercise.rest_seconds}s
                </span>
              )}
              {exercise.rpe_target && <span>· RPE {exercise.rpe_target}</span>}
            </div>
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="space-y-2 border-t border-border px-5 pb-5 pt-4">
            {Array.from({ length: exercise.sets || 1 }).map((_, i) => (
              <SetRow key={i} exerciseId={exercise.id} setNum={i + 1} reps={exercise.reps} lastWeight={lastWeights[exercise.exercise.id]} />
            ))}
            <button
              type="button"
              onClick={() => onRequestSwap(exercise.id, exercise.exercise.id, exercise.exercise.name)}
              className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/40 px-3 py-2 text-[11px] font-semibold text-muted-foreground transition-colors hover:text-primary"
            >
              <ArrowRightLeft className="h-3.5 w-3.5" />
              {isSwapped ? "Trocar novamente" : "Sugerir alternativa"}
            </button>
            {exercise.rest_seconds && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-2 text-xs font-medium text-primary">
                <Timer className="h-3.5 w-3.5" /> Descanso: {exercise.rest_seconds}s após cada série
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Card de biset — agrupa todos os exercícios do par
function BisetCard({ exercises, slot, index, onOpenVideo, lastWeights, onRequestSwap, swappedIds }: {
  exercises: SessionExerciseDTO[];
  slot: number;
  index: number;
  onOpenVideo: (id: string) => void;
  lastWeights: Record<string, number | null>;
  onRequestSwap: (slotId: string, currentPoolId: string, currentName: string) => void;
  swappedIds: Set<string>;
}) {
  const [open, setOpen] = useState(index === 0);
  const restSeconds = exercises.find((e) => e.rest_seconds)?.rest_seconds;

  return (
    <div className="overflow-hidden rounded-2xl border border-primary/25 bg-surface">
      {/* Header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between p-5 text-left transition-colors hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-4">
          <div className="num flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/30 bg-primary/10 text-sm font-semibold text-primary">
            {String(index + 1).padStart(2, "0")}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-semibold uppercase tracking-widest text-primary">
                Biset {slot}
              </span>
              <span className="text-xs text-muted-foreground">{exercises.length} exercícios</span>
            </div>
            <div className="num mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              {exercises.map((e) => (
                <span key={e.id} className="font-medium text-foreground/80">{e.exercise.name}</span>
              ))}
            </div>
            {restSeconds && (
              <div className="num mt-1 flex items-center gap-1 text-[10px] text-primary/80">
                <Timer className="h-3 w-3" /> {restSeconds}s descanso após o biset
              </div>
            )}
          </div>
        </div>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      {/* Expanded */}
      <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
        <div className="overflow-hidden">
          <div className="border-t border-border/60 px-5 pb-5 pt-4">
            {/* Séries em paralelo: para cada rodada, mostra os dois exercícios */}
            {Array.from({ length: exercises[0]?.sets || 1 }).map((_, setIdx) => (
              <div key={setIdx} className="mb-4">
                <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Rodada {setIdx + 1}
                </div>
                <div className="space-y-2">
                  {exercises.map((ex) => {
                    const lw = lastWeights[ex.exercise.id];
                    return (
                      <div
                        key={ex.id}
                        className="num grid grid-cols-[1fr_auto] items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-3 py-2.5"
                      >
                        <div>
                          <button
                            type="button"
                            onClick={() => onOpenVideo(ex.exercise.id)}
                            className="inline-flex items-center gap-1 text-xs font-semibold transition-colors hover:text-primary text-left"
                          >
                            {ex.exercise.name}
                            <PlayCircle className="h-3 w-3 text-muted-foreground" />
                          </button>
                          <div className="mt-0.5 text-[11px] text-muted-foreground">
                            {ex.reps} reps{lw != null ? ` · Último: ${lw}kg` : ""}
                          </div>
                        </div>
                        <input
                          type="number"
                          min={0}
                          step={0.5}
                          defaultValue={getLoad(ex.id, setIdx + 1)}
                          onChange={(e) => setLoad(ex.id, setIdx + 1, e.target.value)}
                          placeholder={lw != null ? `${lw}` : "kg"}
                          className="num w-16 rounded-lg border border-border/60 bg-surface-elevated px-2 py-1 text-center text-xs font-medium text-foreground placeholder:text-muted-foreground/60 focus:border-primary focus:outline-none"
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}

            {/* Botões de swap por exercício do biset */}
            <div className="mb-3 grid grid-cols-2 gap-2">
              {exercises.map((ex) => (
                <button
                  key={`swap-${ex.id}`}
                  type="button"
                  onClick={() => onRequestSwap(ex.id, ex.exercise.id, ex.exercise.name)}
                  className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface/40 px-2 py-1.5 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-primary"
                >
                  <ArrowRightLeft className="h-3 w-3" />
                  {swappedIds.has(ex.id) ? "Trocar novamente" : "Trocar"}
                </button>
              ))}
            </div>

            {/* Descanso após biset completo */}

            {restSeconds && (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-2.5 text-xs font-medium text-primary">
                <Timer className="h-3.5 w-3.5" /> Descanse {restSeconds}s antes da próxima rodada
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────

function HojePage() {
  const { user } = useAuth();
  const fetchToday   = useServerFn(getTodayTraining);
  const fetchWeights = useServerFn(getLastWeightsForExercises);
  const localToday   = useLocalToday();
  const detail       = useExerciseDetail();

  const { data, isLoading } = useQuery({
    queryKey: ["today-training", user?.id, localToday.local_date, localToday.timezone],
    queryFn: () => fetchToday({ data: localToday }),
    enabled: !!user,
  });

  const exerciseIds = data?.today?.exercises.map((e) => e.exercise.id) ?? [];
  const { data: lastWeights = {} } = useQuery({
    queryKey: ["last-weights", user?.id, exerciseIds.join(",")],
    queryFn: () => fetchWeights({ data: { exercise_ids: exerciseIds } }),
    enabled: !!user && exerciseIds.length > 0,
  });

  if (isLoading) {
    return (
      <AppShell eyebrow="Treino" title="Treino de Hoje">
        <div className="flex justify-center p-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
      </AppShell>
    );
  }

  if (!data || !data.today) {
    return (
      <AppShell eyebrow="Treino" title="Treino de Hoje">
        <div className="p-8 text-center text-sm text-muted-foreground">
          Hoje é {data?.calendar.day_name ?? "um dia sem treino"}. Nenhum treino programado para esta data.
        </div>
      </AppShell>
    );
  }

  const today = data.today;
  const week  = data.week;
  const strength = today.exercises.filter((e) => e.exercise.category !== "core");
  const core     = today.exercises.filter((e) => e.exercise.category === "core");
  const groups   = groupExercises(strength);

  return (
    <AppShell
      eyebrow={`Hoje é ${data.calendar.day_name} · Semana ${String(week.week_number).padStart(2, "0")} de ${data.calendar.total_weeks}`}
      title="Treino de Hoje"
      action={
        <Link
          to="/treino"
          className="inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground shadow-glow"
        >
          <Play className="h-3.5 w-3.5 fill-current" /> Iniciar
        </Link>
      }
    >
      <div className="mx-auto max-w-2xl space-y-5 p-4 pb-10 sm:p-6">

        {/* Info card */}
        <section className="glass-strong animate-fade-in rounded-3xl p-6">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {today.session_type.replace("_", " ").toUpperCase()}
          </div>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">
            {today.objective ?? week.meso.name}
          </h2>
          {week.meso.method && (
            <p className="mt-1 text-sm text-muted-foreground">Método: {week.meso.method}</p>
          )}
          <div className="num mt-4 flex flex-wrap gap-5 text-sm">
            {today.duration_minutes && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Timer className="h-4 w-4" /> ~{today.duration_minutes} min
              </div>
            )}
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="h-4 w-4" /> {strength.length} de força · {core.length} de core
            </div>
          </div>
        </section>

        {/* Corrida */}
        {today.running && (
          <section className="glass rounded-2xl p-5">
            <div className="flex items-baseline justify-between">
              <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Corrida</div>
              <div className="num text-[10px] uppercase tracking-wider text-primary/80">
                {runningHeadline(today.running)}
              </div>
            </div>
            <ol className="mt-3 space-y-2 text-sm">
              {runningInstructions(today.running).map((step, i) => (
                <li key={i} className="num flex gap-3 rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {i + 1}
                  </span>
                  <span className="leading-snug">{step}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {/* Força — bisets agrupados */}
        {groups.length > 0 && (
          <div>
            <div className="mb-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Força</div>
            <div className="space-y-3">
              {groups.map((g) =>
                g.kind === "single" ? (
                  <SingleCard key={g.exercise.id} exercise={g.exercise} index={g.index} onOpenVideo={detail.open} lastWeights={lastWeights} />
                ) : (
                  <BisetCard key={`biset-${g.slot}`} exercises={g.exercises} slot={g.slot} index={g.index} onOpenVideo={detail.open} lastWeights={lastWeights} />
                )
              )}
            </div>
          </div>
        )}

        {/* Core */}
        {core.length > 0 && (
          <section className="glass rounded-2xl p-5">
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Core</div>
            <div className="mt-3 space-y-2">
              {core.map((c) => (
                <div key={c.id} className="num flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2.5 text-sm">
                  <button
                    type="button"
                    onClick={() => detail.open(c.exercise.id)}
                    className="inline-flex items-center gap-1.5 font-medium text-left transition-colors hover:text-primary"
                  >
                    {c.exercise.name}
                    <PlayCircle className="h-3 w-3 text-muted-foreground" />
                  </button>
                  <div className="flex items-center gap-3 text-muted-foreground">
                    <span>{c.sets}x{c.reps}</span>
                    {c.rest_seconds && (
                      <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                        <Timer className="h-3 w-3" /> {c.rest_seconds}s
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <div className="pt-2 text-center">
          <Link
            to="/treino"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-8 py-3.5 text-sm font-semibold text-primary-foreground shadow-glow transition-transform hover:scale-[1.02]"
          >
            <Play className="h-4 w-4 fill-current" /> Entrar no Lock Screen Mode
          </Link>
        </div>
      </div>
      <ExerciseDetailModal {...detail.modalProps} />
    </AppShell>
  );
}
