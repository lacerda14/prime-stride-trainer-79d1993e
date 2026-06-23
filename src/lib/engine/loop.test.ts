import { describe, it, expect } from "vitest";
import {
  recoveryIndex,
  recurringPainRegions,
  deriveMesoAdjustment,
  applyMesoAdjustment,
  type SubjectiveSummary,
  type AdjustableExercise,
} from "./loop";
import type { Decision } from "./autoregulation.server";

const baseDecision: Decision = {
  load_adjust_pct: 0,
  accessory_volume_adjust: 0,
  deload_recommended: false,
  monitor_only: false,
  message: "",
};

describe("recoveryIndex", () => {
  it("vazio = 0 (neutro)", () => {
    expect(recoveryIndex([])).toBe(0);
  });
  it("bem recuperado (sono ótimo + energia alta) → positivo", () => {
    const s: SubjectiveSummary[] = [{ sleep_quality: "otimo", energy_level: "alta" }];
    expect(recoveryIndex(s)).toBeGreaterThan(0.5);
  });
  it("mal recuperado (sono ruim + energia baixa + dor) → negativo", () => {
    const s: SubjectiveSummary[] = [
      { sleep_quality: "ruim", energy_level: "baixa", joint_pain: ["Joelho", "Ombro"] },
    ];
    expect(recoveryIndex(s)).toBeLessThan(0);
  });
  it("clampa em [-1, 1]", () => {
    const s: SubjectiveSummary[] = [
      { sleep_quality: "ruim", energy_level: "baixa", joint_pain: ["a", "b", "c", "d", "e"] },
    ];
    expect(recoveryIndex(s)).toBeGreaterThanOrEqual(-1);
  });
});

describe("recurringPainRegions", () => {
  it("só conta dor articular que aparece em >= 2 sessões", () => {
    const s: SubjectiveSummary[] = [
      { joint_pain: ["Joelho", "Ombro"] },
      { joint_pain: ["Joelho"] },
      { joint_pain: ["Punho"] },
    ];
    expect(recurringPainRegions(s)).toEqual(["Joelho"]);
  });
  it("ignora dor muscular (esperada no treino)", () => {
    const s: SubjectiveSummary[] = [
      { muscle_soreness: ["Pernas"] },
      { muscle_soreness: ["Pernas"] },
    ];
    expect(recurringPainRegions(s)).toEqual([]);
  });
});

describe("deriveMesoAdjustment", () => {
  it("recuperação ruim força alívio/deload", () => {
    const adj = deriveMesoAdjustment(baseDecision, -0.8, []);
    expect(adj.deload).toBe(true);
    expect(adj.rpe_adjust).toBeLessThanOrEqual(-1);
    expect(adj.accessory_volume_adjust).toBeLessThanOrEqual(-1);
  });
  it("progressão da Decision + boa recuperação → sobe intensidade", () => {
    const d: Decision = { ...baseDecision, load_adjust_pct: 0.05, accessory_volume_adjust: 1 };
    const adj = deriveMesoAdjustment(d, 0.6, []);
    expect(adj.rpe_adjust).toBeGreaterThan(0);
    expect(adj.deload).toBe(false);
  });
  it("repassa as regiões de dor a evitar", () => {
    const adj = deriveMesoAdjustment(baseDecision, 0, ["Joelho"]);
    expect(adj.avoid_pain_regions).toEqual(["Joelho"]);
    expect(adj.reason).toContain("Joelho");
  });
  it("clampa rpe_adjust em [-1, 0.5]", () => {
    const d: Decision = { ...baseDecision, load_adjust_pct: 0.05 };
    expect(deriveMesoAdjustment(d, 1, []).rpe_adjust).toBeLessThanOrEqual(0.5);
    const d2: Decision = { ...baseDecision, load_adjust_pct: -0.1, deload_recommended: true };
    expect(deriveMesoAdjustment(d2, -1, []).rpe_adjust).toBeGreaterThanOrEqual(-1);
  });
});

describe("applyMesoAdjustment", () => {
  const ex: AdjustableExercise[] = [
    { slot: 1, sets: 4, rpe_target: 8 }, // principal — volume preservado
    { slot: 2, sets: 3, rpe_target: 7 }, // acessório
  ];
  it("preserva volume do principal (slot 1), ajusta acessório (slot >= 2)", () => {
    const out = applyMesoAdjustment(ex, {
      accessory_volume_adjust: -1,
      rpe_adjust: 0,
      deload: false,
      avoid_pain_regions: [],
      reason: "",
    });
    expect(out[0].sets).toBe(4); // principal intacto
    expect(out[1].sets).toBe(2); // acessório -1
  });
  it("nudge de rpe clampa em [6, 9.5] e respeita null", () => {
    const out = applyMesoAdjustment(
      [
        { slot: 1, sets: 4, rpe_target: 9.5 },
        { slot: 2, sets: 3, rpe_target: null },
      ],
      {
        accessory_volume_adjust: 0,
        rpe_adjust: 0.5,
        deload: false,
        avoid_pain_regions: [],
        reason: "",
      },
    );
    expect(out[0].rpe_target).toBe(9.5); // clampado no teto
    expect(out[1].rpe_target).toBeNull(); // null preservado
  });
  it("clampa séries acessórias em [2, 5]", () => {
    const out = applyMesoAdjustment([{ slot: 2, sets: 2, rpe_target: 7 }], {
      accessory_volume_adjust: -2,
      rpe_adjust: 0,
      deload: false,
      avoid_pain_regions: [],
      reason: "",
    });
    expect(out[0].sets).toBe(2); // piso
  });
});
