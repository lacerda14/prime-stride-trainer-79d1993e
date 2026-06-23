import { describe, it, expect } from "vitest";
import {
  normalizeUsername,
  sanitizeUsernameInput,
  validateUsername,
  usernameErrorMessage,
  USERNAME_MIN,
  USERNAME_MAX,
} from "./username";

describe("normalizeUsername", () => {
  it("trim + lowercase", () => {
    expect(normalizeUsername("  Pedro_Lacerda  ")).toBe("pedro_lacerda");
  });
});

describe("sanitizeUsernameInput — limpa enquanto digita", () => {
  it("remove inválidos, lowercase, corta no máx", () => {
    expect(sanitizeUsernameInput("Pedro Lacerda!@#")).toBe("pedrolacerda");
    expect(sanitizeUsernameInput("José.Silva-99")).toBe("jossilva99");
  });
  it("respeita o limite de tamanho", () => {
    expect(sanitizeUsernameInput("a".repeat(50)).length).toBe(USERNAME_MAX);
  });
  it("mantém underscore e números", () => {
    expect(sanitizeUsernameInput("lucas_99")).toBe("lucas_99");
  });
});

describe("validateUsername", () => {
  it("aceita válido e retorna canônico", () => {
    expect(validateUsername("  PedroLacerda ")).toEqual({ ok: true, value: "pedrolacerda" });
  });
  it("rejeita curto demais", () => {
    expect(validateUsername("ab")).toEqual({ ok: false, reason: "too_short" });
  });
  it("rejeita longo demais", () => {
    expect(validateUsername("a".repeat(USERNAME_MAX + 1))).toEqual({
      ok: false,
      reason: "too_long",
    });
  });
  it("exige começar com letra", () => {
    expect(validateUsername("1pedro")).toEqual({ ok: false, reason: "must_start_letter" });
    expect(validateUsername("_pedro")).toEqual({ ok: false, reason: "must_start_letter" });
  });
  it("rejeita caractere inválido", () => {
    // normalizeUsername não remove '.', então cai em invalid_chars
    expect(validateUsername("pedro.lacerda")).toEqual({ ok: false, reason: "invalid_chars" });
  });
  it("rejeita reservados (case-insensitive)", () => {
    expect(validateUsername("Admin")).toEqual({ ok: false, reason: "reserved" });
    expect(validateUsername("suporte")).toEqual({ ok: false, reason: "reserved" });
  });
  it("aceita no limite mínimo", () => {
    expect(validateUsername("abc")).toEqual({ ok: true, value: "abc" });
    expect("abc".length).toBe(USERNAME_MIN);
  });
});

describe("usernameErrorMessage", () => {
  it("tem mensagem pra todos os motivos", () => {
    for (const r of [
      "too_short",
      "too_long",
      "invalid_chars",
      "must_start_letter",
      "reserved",
    ] as const) {
      expect(usernameErrorMessage(r).length).toBeGreaterThan(0);
    }
  });
});
