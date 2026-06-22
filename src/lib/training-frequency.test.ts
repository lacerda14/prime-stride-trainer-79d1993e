import { describe, it, expect } from "vitest";
import {
  maxDaysFor,
  isFrequencyLocked,
  isIntenseFrequency,
  deriveDaysFromCount,
  BEGINNER_UNLOCK_WORKOUTS,
} from "./training-frequency";

describe("maxDaysFor — trava de iniciante", () => {
  it("iniciante com <20 treinos → máx 4", () => {
    expect(maxDaysFor("beginner", 0)).toBe(4);
    expect(maxDaysFor("beginner", 19)).toBe(4);
  });
  it("iniciante com >=20 treinos → libera 6", () => {
    expect(maxDaysFor("beginner", BEGINNER_UNLOCK_WORKOUTS)).toBe(6);
    expect(maxDaysFor("beginner", 50)).toBe(6);
  });
  it("intermediário/avançado → 6 sempre", () => {
    expect(maxDaysFor("intermediate", 0)).toBe(6);
    expect(maxDaysFor("advanced", 0)).toBe(6);
  });
});

describe("isFrequencyLocked", () => {
  it("iniciante novo trava 5 e 6", () => {
    expect(isFrequencyLocked(5, "beginner", 0)).toBe(true);
    expect(isFrequencyLocked(6, "beginner", 0)).toBe(true);
    expect(isFrequencyLocked(4, "beginner", 0)).toBe(false);
    expect(isFrequencyLocked(2, "beginner", 0)).toBe(false);
  });
  it("iniciante com 20 treinos destrava 5 e 6", () => {
    expect(isFrequencyLocked(5, "beginner", 20)).toBe(false);
    expect(isFrequencyLocked(6, "beginner", 20)).toBe(false);
  });
  it("intermediário não trava nada de 2 a 6", () => {
    for (const n of [2, 3, 4, 5, 6]) expect(isFrequencyLocked(n, "intermediate", 0)).toBe(false);
  });
});

describe("isIntenseFrequency — 5/6 em vermelho", () => {
  it("5 e 6 são intensos; 2-4 não", () => {
    expect(isIntenseFrequency(5)).toBe(true);
    expect(isIntenseFrequency(6)).toBe(true);
    expect(isIntenseFrequency(4)).toBe(false);
    expect(isIntenseFrequency(2)).toBe(false);
  });
});

describe("deriveDaysFromCount — espalhamento", () => {
  it("conta certo o número de dias", () => {
    for (const n of [2, 3, 4, 5, 6]) expect(deriveDaysFromCount(n)).toHaveLength(n);
  });
  it("3 → Seg/Qua/Sex", () => {
    expect(deriveDaysFromCount(3)).toEqual(["Segunda", "Quarta", "Sexta"]);
  });
  it("clampa fora do range", () => {
    expect(deriveDaysFromCount(1)).toHaveLength(2);
    expect(deriveDaysFromCount(9)).toHaveLength(6);
  });
});
