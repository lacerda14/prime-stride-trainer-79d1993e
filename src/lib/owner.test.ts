import { describe, it, expect } from "vitest";
import { isOwnerEmail, OWNER_EMAIL } from "./owner";

// Contexto: o owner entra por Google. O Gmail ignora pontos no local-part e tudo
// após "+", então o e-mail do JWT pode vir com grafia diferente da constante.
// Bug real (jun/2026): match exato falhava e o owner caía como free.
describe("isOwnerEmail — reconhecimento robusto do dono (Gmail-aware)", () => {
  it("bate com o e-mail exato da constante", () => {
    expect(isOwnerEmail(OWNER_EMAIL)).toBe(true);
    expect(isOwnerEmail("pedrolacerda.m@gmail.com")).toBe(true);
  });

  it("ignora pontos no local-part (Gmail trata como o mesmo endereço)", () => {
    expect(isOwnerEmail("pedrolacerdam@gmail.com")).toBe(true);
    expect(isOwnerEmail("pedro.lacerda.m@gmail.com")).toBe(true);
    expect(isOwnerEmail("p.e.d.r.o.l.a.c.e.r.d.a.m@gmail.com")).toBe(true);
  });

  it("ignora sub-endereçamento com '+'", () => {
    expect(isOwnerEmail("pedrolacerda.m+test@gmail.com")).toBe(true);
    expect(isOwnerEmail("pedrolacerdam+qualquercoisa@gmail.com")).toBe(true);
  });

  it("trata googlemail.com como gmail.com", () => {
    expect(isOwnerEmail("pedrolacerdam@googlemail.com")).toBe(true);
  });

  it("é case-insensitive e tolera espaços nas bordas", () => {
    expect(isOwnerEmail("PedroLacerda.M@Gmail.com")).toBe(true);
    expect(isOwnerEmail("  pedrolacerda.m@gmail.com  ")).toBe(true);
  });

  it("NÃO reconhece terceiros nem ausências", () => {
    expect(isOwnerEmail("outrapessoa@gmail.com")).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
  });

  it("NÃO confunde mesmo local-part em outro domínio (pontos contam fora do Gmail)", () => {
    expect(isOwnerEmail("pedrolacerda.m@outlook.com")).toBe(false);
    expect(isOwnerEmail("pedrolacerdam@hotmail.com")).toBe(false);
  });

  it("string sem '@' não quebra e retorna false", () => {
    expect(isOwnerEmail("pedrolacerda.m")).toBe(false);
  });
});
