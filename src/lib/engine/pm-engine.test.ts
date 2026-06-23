import { describe, it, expect } from "vitest";
import {
  activeDays,
  fbVolumeForWeek,
  mapDbGoalToEngineGoal,
  type UserProfileInput,
} from "./pm-engine.server";

const BASE: UserProfileInput = {
  age: 30,
  weight_kg: 80,
  height_cm: 180,
  sex: "male",
  experience_level: "intermediate",
  goal: "hybrid",
  available_days: 5,
};
const mk = (o: Partial<UserProfileInput> = {}): UserProfileInput => ({ ...BASE, ...o });

describe("mapDbGoalToEngineGoal — objetivo do banco → goal do motor", () => {
  it("mapeia os conhecidos", () => {
    expect(mapDbGoalToEngineGoal("fat_loss")).toBe("fat_loss");
    expect(mapDbGoalToEngineGoal("general_health")).toBe("fat_loss");
    expect(mapDbGoalToEngineGoal("hypertrophy")).toBe("hypertrophy");
    expect(mapDbGoalToEngineGoal("endurance")).toBe("endurance");
    expect(mapDbGoalToEngineGoal("run_5k")).toBe("endurance");
    expect(mapDbGoalToEngineGoal("conditioning")).toBe("hybrid");
  });
  it("desconhecido/ausente → hybrid (default seguro)", () => {
    expect(mapDbGoalToEngineGoal("xpto")).toBe("hybrid");
    expect(mapDbGoalToEngineGoal(null)).toBe("hybrid");
    expect(mapDbGoalToEngineGoal(undefined)).toBe("hybrid");
  });
});

describe("fbVolumeForWeek — periodização por bloco (12 → 10 → 8)", () => {
  it("1-12 = 12, 13-24 = 10, 25+ = 8", () => {
    expect(fbVolumeForWeek(1)).toBe(12);
    expect(fbVolumeForWeek(12)).toBe(12);
    expect(fbVolumeForWeek(13)).toBe(10);
    expect(fbVolumeForWeek(24)).toBe(10);
    expect(fbVolumeForWeek(25)).toBe(8);
    expect(fbVolumeForWeek(48)).toBe(8);
  });
});

describe("activeDays — agenda semanal (origem do bug de loop de regeneração)", () => {
  it("respeita dias selecionados: filtra inválidos (0, 9), dedupe, ordena", () => {
    const days = activeDays(
      mk({ selected_days: [3, 1, 1, 9, 5, 0], running_mode: "desabilitado" }),
    );
    expect(days.map((d) => d.num)).toEqual([1, 3, 5]);
    expect(days.map((d) => d.name)).toEqual(["Segunda", "Quarta", "Sexta"]);
  });

  it("sem dias selecionados → usa available_days (Seg..N)", () => {
    const days = activeDays(
      mk({ selected_days: [], available_days: 4, running_mode: "desabilitado" }),
    );
    expect(days.map((d) => d.num)).toEqual([1, 2, 3, 4]);
  });

  it("running_mode 'desabilitado' → zero dias de corrida", () => {
    const days = activeDays(mk({ selected_days: [1, 2, 3, 4, 5], running_mode: "desabilitado" }));
    expect(days.every((d) => d.kind === "fb")).toBe(true);
  });

  it("'principal' (5 dias) → 3 corridas (~60%), sobra força", () => {
    const days = activeDays(mk({ selected_days: [1, 2, 3, 4, 5], running_mode: "principal" }));
    expect(days.filter((d) => d.kind === "run").length).toBe(3);
    expect(days.filter((d) => d.kind === "fb").length).toBe(2);
  });

  it("'opcional' → 1 corrida com ≥2 dias, 0 com 1 dia", () => {
    expect(
      activeDays(mk({ selected_days: [1, 2, 3], running_mode: "opcional" })).filter(
        (d) => d.kind === "run",
      ).length,
    ).toBe(1);
    expect(
      activeDays(mk({ selected_days: [1], running_mode: "opcional" })).filter(
        (d) => d.kind === "run",
      ).length,
    ).toBe(0);
  });

  it("INVARIANTE: nunca tudo corrida — sempre sobra ≥1 dia de força (anti-loop)", () => {
    for (const mode of ["opcional", "integrado", "principal"] as const) {
      for (let n = 2; n <= 6; n++) {
        const days = activeDays(
          mk({ selected_days: Array.from({ length: n }, (_, i) => i + 1), running_mode: mode }),
        );
        expect(days.length).toBe(n);
        expect(days.every((d) => d.kind === "fb" || d.kind === "run")).toBe(true);
        expect(days.filter((d) => d.kind === "fb").length).toBeGreaterThanOrEqual(1);
      }
    }
  });
});
