// PM Hybrid Performance System — Real periodization data
// Source: PM_V19_CORRECTED_STRUCTURE_LOCKED.xlsx (V18 plan, 48 weeks)

import raw from "./program-data.json";

export interface MacroBlock {
  macro: string;
  weeks: string;
  mesociclo: string;
  volume: string;
  metodo: string;
  forca: string;
  corrida: string;
  objetivo: string;
  regra: string;
}

export interface RawExercise {
  name: string;
  sets: number;
  reps: string;
  method?: string;
  superset?: string;
}

export interface RawRun {
  raw: string;
  lines: string[];
}

export type DayName = "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta" | "Sábado" | "Domingo";

export interface ProgramDay {
  day: DayName;
  session: string;
  isOff: boolean;
  method: string;
  methodLabel: string;
  objective: string;
  tempo: string;
  strength: RawExercise[];
  core: RawExercise[];
  run: RawRun | null;
}

export interface ProgramWeek {
  number: number;
  title: string;
  macro: string;
  macroLabel: string;
  mesociclo: string;
  methodDominant: string;
  volume: string;
  objective: string;
  forcaTarget: string;
  corridaTarget: string;
  rule: string;
  days: ProgramDay[];
}

export interface Program {
  macros: MacroBlock[];
  weeks: ProgramWeek[];
}

const program = raw as unknown as Program;

export const MACROS: MacroBlock[] = program.macros;
export const WEEKS: ProgramWeek[] = program.weeks;

// "Today" defaults — week 1 / Monday. Could be wired to a real clock later.
export const CURRENT_WEEK_NUMBER = 1;
const dayNames: DayName[] = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const todayName = dayNames[new Date().getDay()];

export const getCurrentWeek = (): ProgramWeek =>
  WEEKS.find((w) => w.number === CURRENT_WEEK_NUMBER) ?? WEEKS[0];

export const getTodayWorkout = (): ProgramDay => {
  const week = getCurrentWeek();
  const today = week.days.find((d) => d.day === todayName && !d.isOff);
  if (today) return today;
  // fallback: first non-OFF day of the week
  return week.days.find((d) => !d.isOff) ?? week.days[0];
};

export const getWeek = (n: number): ProgramWeek =>
  WEEKS.find((w) => w.number === n) ?? WEEKS[0];

export const getMacroForWeek = (n: number): MacroBlock | undefined => {
  for (const m of MACROS) {
    const rng = String(m.weeks);
    const [a, b] = rng.includes("-") ? rng.split("-").map(Number) : [Number(rng), Number(rng)];
    if (n >= a && n <= b) return m;
  }
  return undefined;
};

// Aggregated stats for the dashboard (derived from program structure)
const totalSessions = WEEKS.reduce((acc, w) => acc + w.days.filter((d) => !d.isOff).length, 0);
const runSessions = WEEKS.reduce(
  (acc, w) => acc + w.days.filter((d) => d.run !== null).length,
  0,
);

export const PROGRAM_STATS = {
  totalWeeks: WEEKS.length,
  totalSessions,
  runSessions,
  strengthSessions: totalSessions - runSessions,
};

export const DASHBOARD_STATS = {
  weeklyMinutes: 285,
  weeklyVolume: 0, // not tracked in V18 spreadsheet — populated as user logs
  runsCompleted: 2,
  adherence: 0.9,
  nextSession: "VO2 + peito/ombro/tríceps",
  streak: 6,
};
