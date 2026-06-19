import { describe, it, expect } from "vitest";
import { dayNamesToNumbers } from "./program.functions";

describe("dayNamesToNumbers — nomes pt-BR de dias → números (1=Seg…7=Dom)", () => {
  it("mapeia nomes válidos (case-insensitive)", () => {
    expect(dayNamesToNumbers(["Segunda", "quarta", "SEXTA"])).toEqual([1, 3, 5]);
  });

  it("aceita com e sem acento (terça/terca, sábado/sabado)", () => {
    expect(dayNamesToNumbers(["terça", "sabado"])).toEqual([2, 6]);
    expect(dayNamesToNumbers(["terca", "sábado"])).toEqual([2, 6]);
  });

  it("ordena e remove duplicatas", () => {
    expect(dayNamesToNumbers(["sexta", "segunda", "sexta"])).toEqual([1, 5]);
  });

  it("ignora nomes inválidos e entradas não-string (não quebra)", () => {
    expect(dayNamesToNumbers(["xpto", "segunda", "  "])).toEqual([1]);
    // @ts-expect-error — entrada suja proposital
    expect(dayNamesToNumbers([123, null, "domingo"])).toEqual([7]);
  });

  it("ausência → array vazio (default seguro)", () => {
    expect(dayNamesToNumbers(null)).toEqual([]);
    expect(dayNamesToNumbers(undefined)).toEqual([]);
    expect(dayNamesToNumbers([])).toEqual([]);
  });
});
