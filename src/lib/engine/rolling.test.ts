import { describe, it, expect } from "vitest";
import { nextMesocycleWindow, needsMaterialization, type MesoBounds } from "./rolling";

// 4 mesociclos: 1-4, 5-8, 9-16, 17-24 (total 24)
const MESOS: MesoBounds[] = [
  { start_week: 1, end_week: 4 },
  { start_week: 5, end_week: 8 },
  { start_week: 9, end_week: 16 },
  { start_week: 17, end_week: 24 },
];

describe("nextMesocycleWindow — janela do próximo mesociclo", () => {
  it("cursor 0 → primeiro meso (1-4)", () => {
    expect(nextMesocycleWindow(0, MESOS, 24)).toEqual({ from: 1, to: 4 });
  });
  it("cursor 4 → segundo meso (5-8)", () => {
    expect(nextMesocycleWindow(4, MESOS, 24)).toEqual({ from: 5, to: 8 });
  });
  it("cursor 8 → terceiro meso (9-16)", () => {
    expect(nextMesocycleWindow(8, MESOS, 24)).toEqual({ from: 9, to: 16 });
  });
  it("cursor 16 → quarto meso (17-24)", () => {
    expect(nextMesocycleWindow(16, MESOS, 24)).toEqual({ from: 17, to: 24 });
  });
  it("cursor no fim (24) → null (tudo materializado)", () => {
    expect(nextMesocycleWindow(24, MESOS, 24)).toBeNull();
  });
  it("cursor além do total → null", () => {
    expect(nextMesocycleWindow(30, MESOS, 24)).toBeNull();
  });
  it("clampa o 'to' ao total de semanas", () => {
    expect(nextMesocycleWindow(16, MESOS, 20)).toEqual({ from: 17, to: 20 });
  });
});

describe("needsMaterialization — gatilho", () => {
  it("programa antigo (cursor null) → nunca materializa", () => {
    expect(needsMaterialization(40, null, 48)).toBe(false);
  });
  it("já materializou tudo (cursor = total) → false", () => {
    expect(needsMaterialization(24, 24, 24)).toBe(false);
  });
  it("dispara na penúltima semana materializada", () => {
    expect(needsMaterialization(3, 4, 24)).toBe(true); // 3 >= 4-1
    expect(needsMaterialization(4, 4, 24)).toBe(true);
  });
  it("não dispara cedo demais", () => {
    expect(needsMaterialization(2, 4, 24)).toBe(false); // 2 < 3
  });
});
