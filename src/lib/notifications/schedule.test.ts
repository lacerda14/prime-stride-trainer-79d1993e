import { describe, it, expect } from "vitest";
import {
  mergePrefs,
  reminderHourFromPeriod,
  isoWeekday,
  computeLocalNotifications,
  isCategoryAllowed,
  DEFAULT_NOTIF_PREFS,
  NOTIF_ID,
  type PlanInput,
} from "./schedule";

describe("isCategoryAllowed — gating de push remoto", () => {
  it("billing é transacional → sempre envia (até com master off)", () => {
    expect(isCategoryAllowed({ ...DEFAULT_NOTIF_PREFS, enabled: false }, "billing")).toBe(true);
  });
  it("master off → bloqueia categorias não-transacionais", () => {
    expect(isCategoryAllowed({ ...DEFAULT_NOTIF_PREFS, enabled: false }, "social")).toBe(false);
  });
  it("categoria off → bloqueia só ela", () => {
    const prefs = { ...DEFAULT_NOTIF_PREFS, social: false };
    expect(isCategoryAllowed(prefs, "social")).toBe(false);
    expect(isCategoryAllowed(prefs, "achievements")).toBe(true);
  });
  it("tudo on → permite", () => {
    expect(isCategoryAllowed(DEFAULT_NOTIF_PREFS, "achievements")).toBe(true);
  });
});

describe("mergePrefs — chave ausente = ON", () => {
  it("vazio → todos defaults (ON)", () => {
    expect(mergePrefs({})).toEqual(DEFAULT_NOTIF_PREFS);
    expect(mergePrefs(null)).toEqual(DEFAULT_NOTIF_PREFS);
    expect(mergePrefs("lixo")).toEqual(DEFAULT_NOTIF_PREFS);
  });
  it("respeita override booleano e ignora não-boolean", () => {
    const p = mergePrefs({ workout: false, social: false, news: "sim" });
    expect(p.workout).toBe(false);
    expect(p.social).toBe(false);
    expect(p.news).toBe(true); // não-boolean ignorado → default
    expect(p.streak).toBe(true);
  });
});

describe("reminderHourFromPeriod", () => {
  it("mapeia os períodos", () => {
    expect(reminderHourFromPeriod("Manhã")).toBe(8);
    expect(reminderHourFromPeriod("Almoço")).toBe(12);
    expect(reminderHourFromPeriod("Tarde")).toBe(15);
    expect(reminderHourFromPeriod("Noite")).toBe(19);
  });
  it("case-insensitive e fallback 18h", () => {
    expect(reminderHourFromPeriod("noite")).toBe(19);
    expect(reminderHourFromPeriod(null)).toBe(18);
    expect(reminderHourFromPeriod("qualquer")).toBe(18);
  });
});

describe("isoWeekday — 1=Seg..7=Dom", () => {
  it("15/jun/2026 é segunda (1)", () => {
    expect(isoWeekday(new Date(2026, 5, 15))).toBe(1);
  });
  it("21/jun/2026 é domingo (7)", () => {
    expect(isoWeekday(new Date(2026, 5, 21))).toBe(7);
  });
});

const ALL_DAYS = [1, 2, 3, 4, 5, 6, 7];
function baseInput(over: Partial<PlanInput> = {}): PlanInput {
  return {
    now: new Date(2026, 5, 15, 9, 0), // seg 09:00 local
    prefs: { ...DEFAULT_NOTIF_PREFS },
    trainingWeekdays: ALL_DAYS,
    reminderHour: 8,
    streakCurrent: 0,
    trainedToday: false,
    ...over,
  };
}

describe("computeLocalNotifications — lembretes de treino", () => {
  it("master OFF → nada", () => {
    expect(
      computeLocalNotifications(baseInput({ prefs: { ...DEFAULT_NOTIF_PREFS, enabled: false } })),
    ).toEqual([]);
  });

  it("pula a hora de hoje se já passou (08h < 09h agora)", () => {
    const workout = computeLocalNotifications(baseInput()).filter((p) => p.category === "workout");
    // offset 0 (hoje 08h) já passou → começa amanhã; horizon 7 → offsets 1..6 = 6
    expect(workout).toHaveLength(6);
    expect(workout.every((p) => p.at.getHours() === 8)).toBe(true);
    expect(workout[0].id).toBe(NOTIF_ID.workoutReminderBase + 1);
  });

  it("inclui hoje se a hora ainda não passou (lembrete 20h, agora 09h)", () => {
    const workout = computeLocalNotifications(baseInput({ reminderHour: 20 })).filter(
      (p) => p.category === "workout",
    );
    expect(workout).toHaveLength(7); // hoje incluído (20h > 09h)
    expect(workout[0].at.getDate()).toBe(15);
  });

  it("prefs.workout OFF → sem lembretes de treino", () => {
    const workout = computeLocalNotifications(
      baseInput({ prefs: { ...DEFAULT_NOTIF_PREFS, workout: false } }),
    ).filter((p) => p.category === "workout");
    expect(workout).toHaveLength(0);
  });

  it("só agenda nos dias de treino", () => {
    const workout = computeLocalNotifications(
      baseInput({ trainingWeekdays: [3], prefs: { ...DEFAULT_NOTIF_PREFS, streak: false } }),
    ).filter((p) => p.category === "workout");
    expect(workout.every((p) => isoWeekday(p.at) === 3)).toBe(true);
    expect(workout.length).toBeGreaterThan(0);
  });

  it("sem dias de treino → nenhum lembrete", () => {
    const workout = computeLocalNotifications(baseInput({ trainingWeekdays: [] })).filter(
      (p) => p.category === "workout",
    );
    expect(workout).toHaveLength(0);
  });
});

describe("computeLocalNotifications — nudge da noite (sequência/perdido)", () => {
  const nudgeOf = (i: PlanInput) =>
    computeLocalNotifications(i).find((p) => p.category === "streak");

  it("com streak ≥ 2 → 'em risco' às 20h, menciona os dias", () => {
    const n = nudgeOf(baseInput({ streakCurrent: 5 }));
    expect(n).toBeTruthy();
    expect(n!.at.getHours()).toBe(20);
    expect(n!.title).toMatch(/risco/i);
    expect(n!.body).toContain("5");
    expect(n!.id).toBe(NOTIF_ID.eveningNudge);
  });

  it("sem streak mas é dia de treino → nudge genérico", () => {
    const n = nudgeOf(baseInput({ streakCurrent: 0, trainingWeekdays: ALL_DAYS }));
    expect(n).toBeTruthy();
    expect(n!.title).not.toMatch(/risco/i);
  });

  it("já treinou hoje → sem nudge", () => {
    expect(nudgeOf(baseInput({ trainedToday: true }))).toBeUndefined();
  });

  it("depois das 20h → sem nudge", () => {
    expect(nudgeOf(baseInput({ now: new Date(2026, 5, 15, 21, 0) }))).toBeUndefined();
  });

  it("prefs.streak OFF → sem nudge", () => {
    expect(
      nudgeOf(baseInput({ streakCurrent: 5, prefs: { ...DEFAULT_NOTIF_PREFS, streak: false } })),
    ).toBeUndefined();
  });

  it("sem streak e não é dia de treino → sem nudge", () => {
    // 15/jun é seg(1); tira segunda dos dias de treino
    expect(nudgeOf(baseInput({ streakCurrent: 0, trainingWeekdays: [3, 5] }))).toBeUndefined();
  });
});
