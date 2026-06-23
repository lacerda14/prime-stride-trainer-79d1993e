import { describe, it, expect } from "vitest";
import { levelFromXp, xpForLevel, levelProgress, getTitleForLevel } from "./gamification";

describe("levelFromXp — curva floor(sqrt(xp/100)) + 1", () => {
  it("marcos da curva", () => {
    expect(levelFromXp(0)).toBe(1);
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(2);
    expect(levelFromXp(400)).toBe(3);
    expect(levelFromXp(1600)).toBe(5);
  });
  it("xp negativo nunca quebra (clamp em 0 → nível 1)", () => {
    expect(levelFromXp(-500)).toBe(1);
  });
});

describe("xpForLevel — inverso de levelFromXp", () => {
  it("threshold por nível", () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(100);
    expect(xpForLevel(3)).toBe(400);
    expect(xpForLevel(5)).toBe(1600);
  });
  it("INVARIANTE round-trip: xpForLevel(levelFromXp(xp)) ≤ xp < próximo threshold", () => {
    for (const xp of [0, 50, 100, 399, 400, 1000, 5000, 123456]) {
      const lvl = levelFromXp(xp);
      expect(xpForLevel(lvl)).toBeLessThanOrEqual(xp);
      expect(xp).toBeLessThan(xpForLevel(lvl + 1));
    }
  });
});

describe("levelProgress — barra de progresso", () => {
  it("início de nível → pct 0", () => {
    const p = levelProgress(100);
    expect(p.level).toBe(2);
    expect(p.pct).toBe(0);
    expect(p.xpToNext).toBe(300);
  });
  it("meio de nível → pct ~0.5", () => {
    const p = levelProgress(250); // nível 2: base 100, span 300, into 150
    expect(p.level).toBe(2);
    expect(p.pct).toBeCloseTo(0.5, 5);
    expect(p.xpToNext).toBe(150);
  });
  it("pct sempre em [0,1] e xpToNext nunca negativo", () => {
    for (const xp of [0, 1, 99, 100, 500, 9999, 1_000_000]) {
      const p = levelProgress(xp);
      expect(p.pct).toBeGreaterThanOrEqual(0);
      expect(p.pct).toBeLessThanOrEqual(1);
      expect(p.xpToNext).toBeGreaterThanOrEqual(0);
    }
  });
});

describe("getTitleForLevel — títulos por faixa (limites)", () => {
  it("respeita cada limiar", () => {
    expect(getTitleForLevel(1)).toBe("Iniciante");
    expect(getTitleForLevel(4)).toBe("Iniciante");
    expect(getTitleForLevel(5)).toBe("Consistente");
    expect(getTitleForLevel(9)).toBe("Consistente");
    expect(getTitleForLevel(10)).toBe("Atleta");
    expect(getTitleForLevel(19)).toBe("Atleta");
    expect(getTitleForLevel(20)).toBe("Avançado");
    expect(getTitleForLevel(35)).toBe("Competidor");
    expect(getTitleForLevel(50)).toBe("Elite");
    expect(getTitleForLevel(100)).toBe("Lenda");
  });
});
