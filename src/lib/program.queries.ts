import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Tipos retornados (consumidos pelas telas)
// ============================================================

export interface ExerciseLite {
  id: string;
  name: string;
  category: string;
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
  total_duration_minutes: number | null;
  blocks: number | null;
  intervals: number | null;
  work_duration_seconds: number | null;
  rest_duration_seconds: number | null;
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

// ============================================================
// Helpers
// ============================================================

async function getActiveProgramId(
  supabase: any,
  userId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("training_programs")
    .select("id")
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.id ?? null;
}

// ============================================================
// loadProgramSummary (helper interno) + getProgramSummary (RPC)
// ============================================================

async function loadProgramSummary(
  supabase: any,
  userId: string,
): Promise<ProgramSummary | null> {
  const { data: prog, error: pErr } = await supabase
    .from("training_programs")
    .select(
      "id,total_weeks,active_week,active_day,goal,experience_level,available_days,reference_velocity",
    )
    .eq("user_id", userId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (pErr) throw new Error(pErr.message);
  if (!prog) return null;

  const [{ data: macros, error: mErr }, { data: mesos, error: msErr }, { data: weeks, error: wErr }] =
    await Promise.all([
      supabase
        .from("macrocycles")
        .select("id,name,start_week,end_week,objective,dominant_method,sort_order")
        .eq("program_id", prog.id)
        .order("sort_order"),
      supabase
        .from("mesocycles")
        .select("id,name,start_week,end_week,method,objective,sort_order,macrocycle_id")
        .order("sort_order"),
      supabase
        .from("weeks")
        .select("week_number,week_type,mesocycle_id")
        .eq("program_id", prog.id)
        .order("week_number"),
    ]);
  if (mErr) throw new Error(mErr.message);
  if (msErr) throw new Error(msErr.message);
  if (wErr) throw new Error(wErr.message);

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
    active_week: prog.active_week,
    active_day: prog.active_day,
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
  if (wErr) throw new Error(wErr.message);
  if (!week) return null;

  const { data: days, error: dErr } = await supabase
    .from("training_days")
    .select(
      `id,day_number,day_name,session_type,objective,duration_minutes,completed_at,
       session_exercises(id,slot,pair_slot,sets,reps,rpe_target,rest_seconds,notes,
         exercise:exercise_pool(id,name,category)),
       running_protocols(id,protocol_type,total_duration_minutes,blocks,intervals,
         work_duration_seconds,rest_duration_seconds,pace_min,pace_max,notes)`,
    )
    .eq("week_id", week.id)
    .order("day_number");
  if (dErr) throw new Error(dErr.message);

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
            ? { id: e.exercise.id, name: e.exercise.name, category: e.exercise.category }
            : { id: "", name: "—", category: "unknown" },
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
    const { supabase, userId } = context;
    const programId = await getActiveProgramId(supabase, userId);
    if (!programId) return null;

    const { data: week, error: wErr } = await supabase
      .from("weeks")
      .select(
        `id,week_number,week_type,
         mesocycle:mesocycles!inner(id,name,start_week,end_week,method,objective,
           macrocycle:macrocycles!inner(id,name,objective,dominant_method))`,
      )
      .eq("program_id", programId)
      .eq("week_number", data.week_number)
      .maybeSingle();
    if (wErr) throw new Error(wErr.message);
    if (!week) return null;

    const { data: days, error: dErr } = await supabase
      .from("training_days")
      .select(
        `id,day_number,day_name,session_type,objective,duration_minutes,completed_at,
         session_exercises(id,slot,pair_slot,sets,reps,rpe_target,rest_seconds,notes,
           exercise:exercise_pool(id,name,category)),
         running_protocols(id,protocol_type,total_duration_minutes,blocks,intervals,
           work_duration_seconds,rest_duration_seconds,pace_min,pace_max,notes)`,
      )
      .eq("week_id", week.id)
      .order("day_number");
    if (dErr) throw new Error(dErr.message);

    const meso: any = week.mesocycle;
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
              ? { id: e.exercise.id, name: e.exercise.name, category: e.exercise.category }
              : { id: "", name: "—", category: "unknown" },
          })),
        running: (d.running_protocols ?? [])[0] ?? null,
      })),
    };
  });

// ============================================================
// getTodayTraining — usa active_week + active_day
// ============================================================

export const getTodayTraining = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{
    program: ProgramSummary;
    week: WeekDetailDTO;
    today: TrainingDayDTO | null;
  } | null> => {
    const { supabase, userId } = context;

    // Reuse summary logic inline (avoid recursive serverFn call)
    const { data: prog } = await supabase
      .from("training_programs")
      .select("id,total_weeks,active_week,active_day,goal,experience_level,available_days,reference_velocity")
      .eq("user_id", userId)
      .is("archived_at", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!prog) return null;

    const summary = await getProgramSummary();
    if (!summary) return null;

    const { data: week } = await supabase
      .from("weeks")
      .select(
        `id,week_number,week_type,
         mesocycle:mesocycles!inner(id,name,start_week,end_week,method,objective,
           macrocycle:macrocycles!inner(id,name,objective,dominant_method))`,
      )
      .eq("program_id", prog.id)
      .eq("week_number", prog.active_week)
      .maybeSingle();
    if (!week) return null;

    const { data: days } = await supabase
      .from("training_days")
      .select(
        `id,day_number,day_name,session_type,objective,duration_minutes,completed_at,
         session_exercises(id,slot,pair_slot,sets,reps,rpe_target,rest_seconds,notes,
           exercise:exercise_pool(id,name,category)),
         running_protocols(id,protocol_type,total_duration_minutes,blocks,intervals,
           work_duration_seconds,rest_duration_seconds,pace_min,pace_max,notes)`,
      )
      .eq("week_id", week.id)
      .order("day_number");

    const meso: any = (week as any).mesocycle;
    const macro: any = meso.macrocycle;
    const weekDetail: WeekDetailDTO = {
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
              ? { id: e.exercise.id, name: e.exercise.name, category: e.exercise.category }
              : { id: "", name: "—", category: "unknown" },
          })),
        running: (d.running_protocols ?? [])[0] ?? null,
      })),
    };

    const today =
      weekDetail.days.find((d) => d.day_number === prog.active_day) ?? weekDetail.days[0] ?? null;

    return { program: summary, week: weekDetail, today };
  });

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
    const programId = await getActiveProgramId(supabase, userId);
    if (!programId) return [];

    const { data, error } = await supabase
      .from("running_protocols")
      .select(
        `id,protocol_type,total_duration_minutes,blocks,intervals,work_duration_seconds,
         rest_duration_seconds,pace_min,pace_max,notes,
         training_day:training_days!inner(day_number,day_name,session_type,objective,
           week:weeks!inner(week_number,program_id))`,
      )
      .order("id");
    if (error) throw new Error(error.message);

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
          total_duration_minutes: r.total_duration_minutes,
          blocks: r.blocks,
          intervals: r.intervals,
          work_duration_seconds: r.work_duration_seconds,
          rest_duration_seconds: r.rest_duration_seconds,
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
    const programId = await getActiveProgramId(supabase, userId);
    if (!programId) return [];

    const { data, error } = await supabase
      .from("session_exercises")
      .select(
        `exercise_id,sets,
         training_day:training_days!inner(week:weeks!inner(program_id)),
         exercise:exercise_pool(id,name)`,
      );
    if (error) throw new Error(error.message);

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
