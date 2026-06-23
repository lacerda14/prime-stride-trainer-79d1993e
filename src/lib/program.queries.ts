import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverError } from "@/lib/server-errors";
import { materializeNextMesocycle, isRollingEngineEnabled } from "@/lib/engine/pm-engine.server";
import { needsMaterialization } from "@/lib/engine/rolling";

const localTodaySchema = z.object({
  local_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  day_number: z.number().int().min(1).max(7),
  day_name: z.string().min(1).max(32),
  timezone: z.string().min(1).max(80).optional(),
});

// ============================================================
// Tipos retornados (consumidos pelas telas)
// ============================================================

export interface ExerciseLite {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
}

export interface SessionExerciseDTO {
  id: string;
  slot: number;
  pair_slot: number | null;
  sets: number;
  reps: string;
  rpe_target: number | null;
  rest_seconds: number | null;
  notes: string | null;
  exercise: ExerciseLite;
}

export interface RunningProtocolDTO {
  id: string;
  protocol_type: string;
  protocol_name: string | null;
  goal: string | null;
  total_duration_minutes: number | null;
  warmup_minutes: number | null;
  cooldown_minutes: number | null;
  blocks: number | null;
  /** tiros por bloco (campo novo) */
  intervals_per_block: number | null;
  /** legado — fallback se intervals_per_block estiver null */
  intervals: number | null;
  work_duration_seconds: number | null;
  rest_duration_seconds: number | null;
  between_blocks_rest_seconds: number | null;
  /** novos campos de pace alvo */
  target_pace_min: number | null;
  target_pace_max: number | null;
  /** legado */
  pace_min: number | null;
  pace_max: number | null;
  notes: string | null;
}

export interface TrainingDayDTO {
  id: string;
  day_number: number;
  day_name: string;
  session_type: "full_body" | "run_upper" | "run" | "rest";
  objective: string | null;
  duration_minutes: number | null;
  completed_at: string | null;
  exercises: SessionExerciseDTO[];
  running: RunningProtocolDTO | null;
}

export interface MesoSummary {
  id: string;
  name: string;
  start_week: number;
  end_week: number;
  method: string | null;
  objective: string | null;
}

export interface MacroSummary {
  id: string;
  name: string;
  start_week: number;
  end_week: number;
  objective: string | null;
  dominant_method: string | null;
  mesos: MesoSummary[];
}

export interface ProgramSummary {
  id: string;
  total_weeks: number;
  active_week: number;
  active_day: number;
  program_start_date: string | null;
  current_week: number;
  goal: string;
  experience_level: string;
  available_days: number;
  reference_velocity: number | null;
  macros: MacroSummary[];
  /** week_number → { mesoName, macroName } */
  weekIndex: Record<number, { mesoName: string; macroName: string; weekType: "A" | "B" }>;
}

export interface WeekDetailDTO {
  id: string;
  week_number: number;
  week_type: "A" | "B";
  meso: MesoSummary;
  macro: { id: string; name: string; objective: string | null; dominant_method: string | null };
  days: TrainingDayDTO[];
}

export interface TodayTrainingCalendarDTO {
  local_date: string;
  day_number: number;
  day_name: string;
  timezone: string | null;
  program_start_date: string;
  current_week: number;
  total_weeks: number;
}

// ============================================================
// Helpers
// ============================================================

async function getActiveProgramId(supabase: any, userId: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("training_programs")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
  return data?.id ?? null;
}

async function ensureValidActiveProgram(supabase: any, userId: string): Promise<string | null> {
  // READ-ONLY: retorna só o programa ativo. NÃO valida nem regenera aqui.
  // Antes, quando a validação de distribuição falhava, isto REGENERAVA o programa
  // de 12 semanas (loadExercisePool + generatePlan + persistProgram + RPC) a CADA
  // carregamento da home — causa raiz da lentidão extrema ("eternidade") e do
  // estouro de session_exercises (linhas órfãs, ~5x o esperado). A (re)geração
  // agora só acontece em ações EXPLÍCITAS: submit-onboarding e salvar perfil
  // (regenerate_plan), nunca numa leitura.
  return getActiveProgramId(supabase, userId);
}

function daysBetweenLocalDates(start: string, end: string): number {
  const [sy, sm, sd] = start.split("-").map(Number);
  const [ey, em, ed] = end.split("-").map(Number);
  const startMs = Date.UTC(sy, sm - 1, sd);
  const endMs = Date.UTC(ey, em - 1, ed);
  return Math.floor((endMs - startMs) / 86_400_000);
}

function weekFromStartDate(startDate: string, localDate: string, totalWeeks: number): number {
  const elapsedDays = Math.max(0, daysBetweenLocalDates(startDate, localDate));
  return Math.min(totalWeeks, Math.floor(elapsedDays / 7) + 1);
}

// ============================================================
// loadProgramSummary (helper interno) + getProgramSummary (RPC)
// ============================================================

async function loadProgramSummary(
  supabase: any,
  userId: string,
  calendar?: z.infer<typeof localTodaySchema>,
): Promise<ProgramSummary | null> {
  const programId = await ensureValidActiveProgram(supabase, userId);
  if (!programId) return null;

  const { data: prog, error: pErr } = await supabase
    .from("training_programs")
    .select(
      "id,total_weeks,active_week,active_day,goal,experience_level,available_days,reference_velocity",
    )
    .eq("id", programId)
    .maybeSingle();
  if (pErr) serverError("Não foi possível concluir a operação. Tente novamente.", pErr);
  if (!prog) return null;

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("program_start_date,current_week")
    .eq("id", userId)
    .maybeSingle();
  if (profileErr) serverError("Não foi possível concluir a operação. Tente novamente.", profileErr);

  const programStartDate = profile?.program_start_date ?? calendar?.local_date ?? null;
  const computedWeek =
    programStartDate && calendar
      ? weekFromStartDate(programStartDate, calendar.local_date, prog.total_weeks)
      : (profile?.current_week ?? prog.active_week);
  const activeDay = calendar?.day_number ?? prog.active_day;

  const [
    { data: macros, error: mErr },
    { data: mesos, error: msErr },
    { data: weeks, error: wErr },
  ] = await Promise.all([
    supabase
      .from("macrocycles")
      .select("id,name,start_week,end_week,objective,dominant_method,sort_order")
      .eq("program_id", prog.id)
      .order("sort_order"),
    supabase
      .from("mesocycles")
      .select(
        "id,name,start_week,end_week,method,objective,sort_order,macrocycle_id,macrocycle:macrocycles!inner(program_id)",
      )
      .eq("macrocycle.program_id", prog.id)
      .order("sort_order"),
    supabase
      .from("weeks")
      .select("week_number,week_type,mesocycle_id")
      .eq("program_id", prog.id)
      .order("week_number"),
  ]);
  if (mErr) serverError("Não foi possível concluir a operação. Tente novamente.", mErr);
  if (msErr) serverError("Não foi possível concluir a operação. Tente novamente.", msErr);
  if (wErr) serverError("Não foi possível concluir a operação. Tente novamente.", wErr);

  const macroIds = new Set((macros ?? []).map((m: any) => m.id));
  const filteredMesos = (mesos ?? []).filter((m: any) => macroIds.has(m.macrocycle_id));
  const mesosByMacro = new Map<string, MesoSummary[]>();
  for (const m of filteredMesos) {
    const arr = mesosByMacro.get(m.macrocycle_id) ?? [];
    arr.push({
      id: m.id,
      name: m.name,
      start_week: m.start_week,
      end_week: m.end_week,
      method: m.method,
      objective: m.objective,
    });
    mesosByMacro.set(m.macrocycle_id, arr);
  }

  const macroList: MacroSummary[] = (macros ?? []).map((m: any) => ({
    id: m.id,
    name: m.name,
    start_week: m.start_week,
    end_week: m.end_week,
    objective: m.objective,
    dominant_method: m.dominant_method,
    mesos: (mesosByMacro.get(m.id) ?? []).sort((a, b) => a.start_week - b.start_week),
  }));

  const mesoLookup = new Map<string, { mesoName: string; macroName: string }>();
  for (const macro of macroList) {
    for (const meso of macro.mesos) {
      mesoLookup.set(meso.id, { mesoName: meso.name, macroName: macro.name });
    }
  }
  const weekIndex: ProgramSummary["weekIndex"] = {};
  for (const w of weeks ?? []) {
    const info = mesoLookup.get(w.mesocycle_id);
    if (!info) continue;
    weekIndex[w.week_number] = { ...info, weekType: w.week_type };
  }

  return {
    id: prog.id,
    total_weeks: prog.total_weeks,
    active_week: computedWeek,
    active_day: activeDay,
    program_start_date: programStartDate,
    current_week: computedWeek,
    goal: prog.goal,
    experience_level: prog.experience_level,
    available_days: prog.available_days,
    reference_velocity: prog.reference_velocity,
    macros: macroList,
    weekIndex,
  };
}

async function loadWeekDetail(
  supabase: any,
  programId: string,
  weekNumber: number,
): Promise<WeekDetailDTO | null> {
  const { data: week, error: wErr } = await supabase
    .from("weeks")
    .select(
      `id,week_number,week_type,
       mesocycle:mesocycles!inner(id,name,start_week,end_week,method,objective,
         macrocycle:macrocycles!inner(id,name,objective,dominant_method))`,
    )
    .eq("program_id", programId)
    .eq("week_number", weekNumber)
    .maybeSingle();
  if (wErr) serverError("Não foi possível concluir a operação. Tente novamente.", wErr);
  if (!week) return null;

  const { data: days, error: dErr } = await supabase
    .from("training_days")
    .select(
      `id,day_number,day_name,session_type,objective,duration_minutes,completed_at,
       session_exercises(id,slot,pair_slot,sets,reps,rpe_target,rest_seconds,notes,
         exercise:exercise_pool(id,name,category,equipment)),
       running_protocols(id,protocol_type,protocol_name,goal,total_duration_minutes,
         warmup_minutes,cooldown_minutes,blocks,intervals,intervals_per_block,
         work_duration_seconds,rest_duration_seconds,between_blocks_rest_seconds,
         target_pace_min,target_pace_max,pace_min,pace_max,notes)`,
    )
    .eq("week_id", week.id)
    .order("day_number");
  if (dErr) serverError("Não foi possível concluir a operação. Tente novamente.", dErr);

  const meso: any = (week as any).mesocycle;
  const macro: any = meso.macrocycle;
  return {
    id: week.id,
    week_number: week.week_number,
    week_type: week.week_type,
    meso: {
      id: meso.id,
      name: meso.name,
      start_week: meso.start_week,
      end_week: meso.end_week,
      method: meso.method,
      objective: meso.objective,
    },
    macro: {
      id: macro.id,
      name: macro.name,
      objective: macro.objective,
      dominant_method: macro.dominant_method,
    },
    days: (days ?? []).map((d: any) => ({
      id: d.id,
      day_number: d.day_number,
      day_name: d.day_name,
      session_type: d.session_type,
      objective: d.objective,
      duration_minutes: d.duration_minutes,
      completed_at: d.completed_at,
      exercises: (d.session_exercises ?? [])
        .sort((a: any, b: any) => a.slot - b.slot)
        .map((e: any) => ({
          id: e.id,
          slot: e.slot,
          pair_slot: e.pair_slot,
          sets: e.sets,
          reps: e.reps,
          rpe_target: e.rpe_target,
          rest_seconds: e.rest_seconds,
          notes: e.notes,
          exercise: e.exercise
            ? {
                id: e.exercise.id,
                name: e.exercise.name,
                category: e.exercise.category,
                equipment: e.exercise.equipment ?? null,
              }
            : { id: "", name: "—", category: "unknown", equipment: null },
        })),
      running: (d.running_protocols ?? [])[0] ?? null,
    })),
  };
}

export const getProgramSummary = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => loadProgramSummary(context.supabase, context.userId));

// ============================================================
// getWeekDetail(weekNumber)
// ============================================================

export const getWeekDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ week_number: z.number().int().min(1).max(60) }).parse(input),
  )
  .handler(async ({ data, context }): Promise<WeekDetailDTO | null> => {
    const programId = await ensureValidActiveProgram(context.supabase, context.userId);
    if (!programId) return null;
    return loadWeekDetail(context.supabase, programId, data.week_number);
  });

// ============================================================
// getTodayTraining — usa data local do dispositivo + program_start_date
// ============================================================

export const getTodayTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => localTodaySchema.parse(input))
  .handler(
    async ({
      data,
      context,
    }): Promise<{
      program: ProgramSummary;
      week: WeekDetailDTO;
      today: TrainingDayDTO | null;
      calendar: TodayTrainingCalendarDTO;
      body_weight_kg: number | null;
    } | null> => {
      const calendarInput = data;
      const summary = await loadProgramSummary(context.supabase, context.userId, calendarInput);
      if (!summary) return null;

      // Engine v2 / Fase 1 (gated por ROLLING_ENGINE): se o programa é rolante e o
      // aluno chega perto do fim do que já foi materializado, gera o próximo
      // mesociclo sob demanda. Best-effort (materialize nunca lança).
      if (isRollingEngineEnabled(context.userId)) {
        const { data: prog } = await context.supabase
          .from("training_programs")
          .select("generation_cursor")
          .eq("id", summary.id)
          .maybeSingle();
        const cursor = ((prog as { generation_cursor?: number | null } | null)?.generation_cursor ??
          null) as number | null;
        if (needsMaterialization(summary.active_week, cursor, summary.total_weeks)) {
          await materializeNextMesocycle(context.supabase, context.userId);
        }
      }

      const week = await loadWeekDetail(context.supabase, summary.id, summary.active_week);
      if (!week) return null;
      const today = week.days.find((d) => d.day_number === summary.active_day) ?? null;

      await context.supabase
        .from("profiles")
        .update({ current_week: summary.current_week })
        .eq("id", context.userId)
        .neq("current_week", summary.current_week);

      // Peso do aluno (onboarding) — usado como carga dos exercícios de peso corporal.
      const { data: prof } = await context.supabase
        .from("profiles")
        .select("weight_kg")
        .eq("id", context.userId)
        .maybeSingle();
      const body_weight_kg = prof?.weight_kg != null ? Number(prof.weight_kg) : null;

      return {
        body_weight_kg,
        program: summary,
        week,
        today,
        calendar: {
          local_date: calendarInput.local_date,
          day_number: calendarInput.day_number,
          day_name: calendarInput.day_name,
          timezone: calendarInput.timezone ?? null,
          program_start_date: summary.program_start_date ?? calendarInput.local_date,
          current_week: summary.current_week,
          total_weeks: summary.total_weeks,
        },
      };
    },
  );

// ============================================================
// getRunningSessions — flat list de todas as corridas do programa
// ============================================================

export interface RunningSessionListItem {
  week_number: number;
  day_name: string;
  day_number: number;
  session_type: string;
  objective: string | null;
  protocol: RunningProtocolDTO;
}

export const getRunningSessions = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<RunningSessionListItem[]> => {
    const { supabase, userId } = context;
    const programId = await ensureValidActiveProgram(supabase, userId);
    if (!programId) return [];

    const { data, error } = await supabase
      .from("running_protocols")
      .select(
        `id,protocol_type,protocol_name,goal,total_duration_minutes,
         warmup_minutes,cooldown_minutes,blocks,intervals,intervals_per_block,
         work_duration_seconds,rest_duration_seconds,between_blocks_rest_seconds,
         target_pace_min,target_pace_max,pace_min,pace_max,notes,
         training_day:training_days!inner(day_number,day_name,session_type,objective,
           week:weeks!inner(week_number,program_id))`,
      )
      .order("id");
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);

    return (data ?? [])
      .filter((r: any) => r.training_day?.week?.program_id === programId)
      .map((r: any) => ({
        week_number: r.training_day.week.week_number,
        day_number: r.training_day.day_number,
        day_name: r.training_day.day_name,
        session_type: r.training_day.session_type,
        objective: r.training_day.objective,
        protocol: {
          id: r.id,
          protocol_type: r.protocol_type,
          protocol_name: r.protocol_name,
          goal: r.goal,
          total_duration_minutes: r.total_duration_minutes,
          warmup_minutes: r.warmup_minutes,
          cooldown_minutes: r.cooldown_minutes,
          blocks: r.blocks,
          intervals_per_block: r.intervals_per_block,
          intervals: r.intervals,
          work_duration_seconds: r.work_duration_seconds,
          rest_duration_seconds: r.rest_duration_seconds,
          between_blocks_rest_seconds: r.between_blocks_rest_seconds,
          target_pace_min: r.target_pace_min,
          target_pace_max: r.target_pace_max,
          pace_min: r.pace_min,
          pace_max: r.pace_max,
          notes: r.notes,
        },
      }))
      .sort((a, b) => a.week_number - b.week_number || a.day_number - b.day_number);
  });

// ============================================================
// getTopExercises — ranking por uso para tela de Progressão
// ============================================================

export const getTopExercises = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ id: string; name: string; usage: number }[]> => {
    const { supabase, userId } = context;
    const programId = await ensureValidActiveProgram(supabase, userId);
    if (!programId) return [];

    const { data, error } = await supabase.from("session_exercises").select(
      `exercise_id,sets,
         training_day:training_days!inner(week:weeks!inner(program_id)),
         exercise:exercise_pool(id,name)`,
    );
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);

    const map = new Map<string, { id: string; name: string; usage: number }>();
    for (const row of data ?? []) {
      const tr: any = (row as any).training_day;
      if (tr?.week?.program_id !== programId) continue;
      const ex: any = (row as any).exercise;
      if (!ex) continue;
      const cur = map.get(ex.id) ?? { id: ex.id, name: ex.name, usage: 0 };
      cur.usage += (row as any).sets ?? 1;
      map.set(ex.id, cur);
    }
    return [...map.values()].sort((a, b) => b.usage - a.usage).slice(0, 12);
  });
