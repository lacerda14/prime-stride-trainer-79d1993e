// Mock periodization data for PM Hybrid Performance System.
// Will be replaced by user's real 48-week spreadsheet once provided.

export type SetMethod = "Straight" | "Biset" | "Triset" | "Drop" | "Cluster" | "RestPause" | "AMRAP";

export interface ExerciseSet {
  set: number;
  reps: string; // e.g. "8" or "8-10" or "AMRAP"
  loadTarget?: string; // e.g. "RPE 8" or "70% 1RM"
  rest: string; // e.g. "90s"
  notes?: string;
}

export interface Exercise {
  id: string;
  name: string;
  method?: SetMethod;
  superset?: string; // group id
  sets: ExerciseSet[];
  notes?: string;
  tempo?: string;
}

export interface CoreBlock {
  id: string;
  name: string;
  rounds: number;
  exercises: { name: string; reps: string; rest?: string }[];
}

export interface RunSession {
  id: string;
  type: "VO2" | "Threshold" | "Long Run" | "Recovery" | "Tempo" | "Fartlek";
  objective: string;
  blocks: {
    label: string;
    reps?: number;
    duration?: string;
    pace?: string;
    speed?: string;
    rest?: string;
  }[];
  totalDuration: string;
}

export type DayType = "Strength" | "Hypertrophy" | "Power" | "Hybrid" | "Run" | "Recovery";

export interface TrainingDay {
  id: string;
  day: "Segunda" | "Terça" | "Quarta" | "Quinta" | "Sexta";
  type: DayType;
  method: string;
  objective: string;
  estimatedMinutes: number;
  exercises: Exercise[];
  core?: CoreBlock;
  run?: RunSession;
}

export interface Week {
  number: number;
  macrocycle: string;
  mesocycle: string;
  focus: string;
  volumeLabel: string; // "Acumulação" / "Intensificação" / "Deload"
  days: TrainingDay[];
}

const baseStrengthDay = (day: TrainingDay["day"], focus: string, exercises: Exercise[]): TrainingDay => ({
  id: `${day}-${focus}`,
  day,
  type: "Strength",
  method: "Biset + Straight",
  objective: focus,
  estimatedMinutes: 65,
  exercises,
});

const ex = (
  name: string,
  sets: number,
  reps: string,
  rest: string,
  opts: { method?: SetMethod; loadTarget?: string; notes?: string; tempo?: string; superset?: string } = {},
): Exercise => ({
  id: `${name}-${Math.random().toString(36).slice(2, 7)}`,
  name,
  method: opts.method,
  superset: opts.superset,
  tempo: opts.tempo,
  notes: opts.notes,
  sets: Array.from({ length: sets }, (_, i) => ({
    set: i + 1,
    reps,
    rest,
    loadTarget: opts.loadTarget,
  })),
});

const buildWeek = (n: number): Week => {
  const macro = n <= 16 ? "Base" : n <= 32 ? "Build" : "Peak";
  const meso = ((Math.floor((n - 1) / 4) % 3) + 1).toString();
  const isDeload = n % 4 === 0;
  const volume = isDeload ? "Deload" : n % 4 === 3 ? "Intensificação" : "Acumulação";

  return {
    number: n,
    macrocycle: macro,
    mesocycle: `Meso ${meso}`,
    focus: isDeload ? "Recuperação ativa" : macro === "Base" ? "Volume e técnica" : macro === "Build" ? "Força específica" : "Potência e taper",
    volumeLabel: volume,
    days: [
      baseStrengthDay("Segunda", "Upper Push", [
        ex("Supino Reto Barra", 4, "6-8", "120s", { loadTarget: "RPE 8", tempo: "3-0-1" }),
        ex("Desenvolvimento Halteres", 3, "8-10", "90s", { method: "Biset", superset: "A" }),
        ex("Elevação Lateral", 3, "12-15", "60s", { method: "Biset", superset: "A" }),
        ex("Tríceps Corda", 3, "10-12", "60s", { method: "Drop" }),
      ]),
      {
        id: `terca-${n}`,
        day: "Terça",
        type: "Run",
        method: "Intervalado VO2",
        objective: "Capacidade aeróbica",
        estimatedMinutes: 45,
        exercises: [],
        run: {
          id: `run-vo2-${n}`,
          type: "VO2",
          objective: "Aumentar VO2max via intervalos curtos de alta intensidade",
          totalDuration: "45min",
          blocks: [
            { label: "Aquecimento", duration: "10min", pace: "6:00/km" },
            { label: "Série principal", reps: 5, duration: "1min", speed: "9.5 km/h", rest: "1min" },
            { label: "Desaquecimento", duration: "10min", pace: "6:30/km" },
          ],
        },
      },
      baseStrengthDay("Quarta", "Lower", [
        ex("Agachamento Livre", 5, "5", "180s", { loadTarget: "80% 1RM", tempo: "3-1-1" }),
        ex("RDL", 4, "8", "120s", { loadTarget: "RPE 8" }),
        ex("Búlgaro", 3, "10", "75s", { method: "Triset", superset: "B" }),
        ex("Leg Curl", 3, "12", "60s", { method: "Triset", superset: "B" }),
        ex("Panturrilha em Pé", 3, "15", "45s", { method: "Triset", superset: "B" }),
      ]),
      baseStrengthDay("Quinta", "Upper Pull", [
        ex("Pull-Up", 4, "8", "90s", { loadTarget: "BW + 5kg" }),
        ex("Remada Curvada", 4, "8-10", "90s", { loadTarget: "RPE 8" }),
        ex("Remada Sentada", 3, "10-12", "75s", { method: "Biset", superset: "C" }),
        ex("Face Pull", 3, "15", "60s", { method: "Biset", superset: "C" }),
        ex("Rosca Direta", 3, "10-12", "60s"),
      ]),
      {
        id: `sexta-${n}`,
        day: "Sexta",
        type: "Hybrid",
        method: "Strength + Tempo Run",
        objective: "Trabalho híbrido full body + tempo run",
        estimatedMinutes: 70,
        exercises: [
          ex("Levantamento Terra", 4, "5", "180s", { loadTarget: "75% 1RM" }),
          ex("Supino Inclinado", 3, "8", "90s"),
          ex("Remada Cavalinho", 3, "10", "75s"),
        ],
        core: {
          id: `core-${n}`,
          name: "Core Stability",
          rounds: 3,
          exercises: [
            { name: "Plank", reps: "45s", rest: "20s" },
            { name: "Dead Bug", reps: "10 ea", rest: "20s" },
            { name: "Pallof Press", reps: "12 ea", rest: "20s" },
          ],
        },
        run: {
          id: `run-tempo-${n}`,
          type: "Tempo",
          objective: "Limiar de lactato",
          totalDuration: "25min",
          blocks: [
            { label: "Aquecimento", duration: "5min", pace: "6:00/km" },
            { label: "Tempo", duration: "15min", pace: "4:45/km" },
            { label: "Desaquecimento", duration: "5min", pace: "6:30/km" },
          ],
        },
      },
    ],
  };
};

export const WEEKS: Week[] = Array.from({ length: 48 }, (_, i) => buildWeek(i + 1));

export const CURRENT_WEEK_NUMBER = 7;
export const CURRENT_DAY_INDEX = 0; // Segunda

export const getCurrentWeek = () => WEEKS[CURRENT_WEEK_NUMBER - 1];
export const getTodayWorkout = () => getCurrentWeek().days[CURRENT_DAY_INDEX];

export const DASHBOARD_STATS = {
  weeklyVolume: 18420, // kg
  weeklyMinutes: 312,
  runsCompleted: 2,
  adherence: 0.87,
  nextSession: "Terça · VO2 Intervalado",
  streak: 12,
};
