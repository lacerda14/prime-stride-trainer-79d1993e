import { describe, it, expect } from "vitest";
import { computeAdvance, elapsedMsInPhase, totalElapsedMs, isFinished } from "./workout-machine";

describe("computeAdvance", () => {
  it("força em 'work' → vai pra 'rest' do MESMO step e marca captureSet", () => {
    expect(computeAdvance("strength", "work", 3)).toEqual({
      step: 3,
      phase: "rest",
      captureSet: true,
    });
  });

  it("força em 'rest' → avança pro próximo step em 'work', sem capturar", () => {
    expect(computeAdvance("strength", "rest", 3)).toEqual({
      step: 4,
      phase: "work",
      captureSet: false,
    });
  });

  it("corrida → sempre avança pro próximo step em 'work', sem capturar", () => {
    expect(computeAdvance("run", "work", 0)).toEqual({ step: 1, phase: "work", captureSet: false });
    expect(computeAdvance("run", "rest", 5)).toEqual({ step: 6, phase: "work", captureSet: false });
  });

  it("sem item atual → no-op (não muda nada)", () => {
    expect(computeAdvance(undefined, "work", 2)).toEqual({
      step: 2,
      phase: "work",
      captureSet: false,
    });
  });

  it("nunca captura série em corrida (não há peso a registrar)", () => {
    expect(computeAdvance("run", "work", 0).captureSet).toBe(false);
  });
});

describe("elapsedMsInPhase", () => {
  const now = 10_000;

  it("rodando: soma o tempo desde phaseStartedAt ao acumulado", () => {
    expect(
      elapsedMsInPhase({ paused: false, phaseStartedAt: 7_000, phaseAccumMs: 2_000 }, now),
    ).toBe(5_000);
  });

  it("pausado: ignora o relógio, retorna só o acumulado", () => {
    expect(
      elapsedMsInPhase({ paused: true, phaseStartedAt: 7_000, phaseAccumMs: 2_000 }, now),
    ).toBe(2_000);
  });

  it("não iniciado (phaseStartedAt null): retorna o acumulado", () => {
    expect(
      elapsedMsInPhase({ paused: false, phaseStartedAt: null, phaseAccumMs: 1_500 }, now),
    ).toBe(1_500);
  });
});

describe("totalElapsedMs", () => {
  const now = 20_000;

  it("rodando: total = totalAccum + phaseAccum + (now - start)", () => {
    expect(
      totalElapsedMs(
        { paused: false, phaseStartedAt: 15_000, phaseAccumMs: 1_000, totalAccumMs: 30_000 },
        now,
      ),
    ).toBe(36_000);
  });

  it("pausado: total = totalAccum + phaseAccum (sem relógio)", () => {
    expect(
      totalElapsedMs(
        { paused: true, phaseStartedAt: 15_000, phaseAccumMs: 1_000, totalAccumMs: 30_000 },
        now,
      ),
    ).toBe(31_000);
  });

  it("pausar/retomar não perde nem dobra tempo", () => {
    // fase começou em t=0, rodou 5s, pausou (acumula 5s), retoma em t=10s, roda +3s até t=13s
    const running = { paused: false, phaseStartedAt: 10_000, phaseAccumMs: 5_000, totalAccumMs: 0 };
    expect(totalElapsedMs(running, 13_000)).toBe(8_000);
  });
});

describe("isFinished", () => {
  it("step além do fim de fila não-vazia → concluído", () => {
    expect(isFinished(6, 6)).toBe(true);
    expect(isFinished(7, 6)).toBe(true);
  });
  it("ainda no meio → não concluído", () => {
    expect(isFinished(3, 6)).toBe(false);
  });
  it("fila vazia → nunca concluído (evita falso positivo no carregamento)", () => {
    expect(isFinished(0, 0)).toBe(false);
  });
});
