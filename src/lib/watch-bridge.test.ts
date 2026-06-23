import { describe, it, expect, vi } from "vitest";

// @capacitor/core faz side-effects de plugin no import; stub no ambiente node.
vi.mock("@capacitor/core", () => ({
  Capacitor: { isNativePlatform: () => false, getPlatform: () => "web" },
  registerPlugin: () => ({}),
}));

import { buildWatchWorkout } from "./watch-bridge";

const today = {
  id: "day-1",
  day_name: "Segunda",
  objective: "Push",
  exercises: [
    { sets: 4, reps: "8-12", rest_seconds: 90, exercise: { id: "ex-a", name: "Supino" } },
    { sets: 3, reps: "10", rest_seconds: null, exercise: { id: "ex-b", name: "Desenvolvimento" } },
  ],
};

describe("buildWatchWorkout", () => {
  it("monta o payload do dia com os campos mapeados", () => {
    const w = buildWatchWorkout(today)!;
    expect(w.id).toBe("day-1");
    expect(w.name).toBe("Segunda");
    expect(w.dayLabel).toBe("Push");
    expect(w.exercises).toHaveLength(2);
    expect(w.exercises[0]).toMatchObject({
      id: "ex-a",
      name: "Supino",
      sets: 4,
      reps: "8-12",
      restSec: 90,
    });
  });

  it("usa rest padrão 60s quando rest_seconds é null", () => {
    expect(buildWatchWorkout(today)!.exercises[1].restSec).toBe(60);
  });

  it("aplica a carga sugerida (lastWeights) por id", () => {
    const w = buildWatchWorkout(today, { lastWeights: { "ex-a": 80 } })!;
    expect(w.exercises[0].suggestedWeightKg).toBe(80);
    expect(w.exercises[1].suggestedWeightKg).toBeNull();
  });

  it("aplica troca de exercício (swap) por índice", () => {
    const w = buildWatchWorkout(today, { swaps: { 0: { id: "ex-x", name: "Crucifixo" } } })!;
    expect(w.exercises[0]).toMatchObject({ id: "ex-x", name: "Crucifixo" });
  });

  it("respeita ordem customizada", () => {
    const w = buildWatchWorkout(today, { exerciseOrder: [1, 0] })!;
    expect(w.exercises.map((e) => e.id)).toEqual(["ex-b", "ex-a"]);
  });

  it("descarta exercícios sem id", () => {
    const t = {
      ...today,
      exercises: [{ sets: 3, reps: "10", rest_seconds: 60, exercise: { id: "", name: "X" } }],
    };
    expect(buildWatchWorkout(t)).toBeNull();
  });

  it("id customizado (sessionId) sobrescreve o id do dia", () => {
    expect(buildWatchWorkout(today, { id: "session-99" })!.id).toBe("session-99");
  });

  it("retorna null para today nulo ou sem exercícios", () => {
    expect(buildWatchWorkout(null)).toBeNull();
    expect(buildWatchWorkout({ ...today, exercises: [] })).toBeNull();
  });
});
