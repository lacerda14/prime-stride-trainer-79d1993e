import { describe, it, expect } from "vitest";
import { TIERS, TIER_ORDER, tierFromPlan, accessTier, formatBRL } from "./tiers";

describe("tierFromPlan — mapeia plano da subscription → tier de acesso", () => {
  it("pro e premium_ai (legado) → 'pro'", () => {
    expect(tierFromPlan("pro")).toBe("pro");
    expect(tierFromPlan("premium_ai")).toBe("pro");
  });

  it("plus → 'plus'", () => {
    expect(tierFromPlan("plus")).toBe("plus");
  });

  it("free e qualquer ausência → 'free'", () => {
    expect(tierFromPlan("free")).toBe("free");
    expect(tierFromPlan(null)).toBe("free");
    expect(tierFromPlan(undefined)).toBe("free");
    expect(tierFromPlan("")).toBe("free");
  });

  it("'premium' legado NÃO é pago (backfill migration 61 rebaixou pra free)", () => {
    expect(tierFromPlan("premium")).toBe("free");
  });

  it("plano desconhecido degrada com segurança pra 'free' (nunca dá acesso por engano)", () => {
    expect(tierFromPlan("enterprise")).toBe("free");
    expect(tierFromPlan("PRO")).toBe("free"); // case-sensitive de propósito
  });
});

describe("accessTier — tier de acesso efetivo (gate único, trial = Pro)", () => {
  it("trial libera o topo (Pro) independente do plano no banco", () => {
    expect(accessTier("free", "trialing")).toBe("pro");
    expect(accessTier(null, "trialing")).toBe("pro");
    expect(accessTier("plus", "trialing")).toBe("pro");
  });

  it("sem trial, segue o tier do plano", () => {
    expect(accessTier("pro", "active")).toBe("pro");
    expect(accessTier("premium_ai", "active")).toBe("pro");
    expect(accessTier("plus", "active")).toBe("plus");
    expect(accessTier("free", "active")).toBe("free");
  });

  it("ausências degradam pra free (nunca acesso por engano)", () => {
    expect(accessTier(null)).toBe("free");
    expect(accessTier(undefined, null)).toBe("free");
    expect(accessTier("free")).toBe("free");
  });

  it("status cancelado/expirado NÃO concede trial (só 'trialing' libera)", () => {
    expect(accessTier("free", "canceled")).toBe("free");
    expect(accessTier("free", "past_due")).toBe("free");
  });
});

describe("TIER_ORDER — progressão Free → Plus → Pro", () => {
  it("tem os 3 tiers na ordem certa, free primeiro", () => {
    expect(TIER_ORDER).toEqual(["free", "plus", "pro"]);
  });
});

describe("TIERS — metadados e invariantes da coroa", () => {
  it("preços finais (Plus 39,90/349 · Pro 69,90/599)", () => {
    expect(TIERS.free.priceMonthly).toBe(0);
    expect(TIERS.plus.priceMonthly).toBe(39.9);
    expect(TIERS.plus.priceAnnual).toBe(349);
    expect(TIERS.pro.priceMonthly).toBe(69.9);
    expect(TIERS.pro.priceAnnual).toBe(599);
  });

  it("toda coroa é visualmente distinta entre tiers (White/Silver/Gold)", () => {
    const crowns = [TIERS.free.crownClass, TIERS.plus.crownClass, TIERS.pro.crownClass];
    expect(new Set(crowns).size).toBe(3);
  });

  it("regressão: a coroa Free NÃO tem preenchimento metálico (não pode parecer Plus)", () => {
    // Bug real (jun/2026): free usava `fill-zinc-200/10`, idêntico ao Silver →
    // todo cadastro "parecia Plus". Free tem que ser contorno apagado.
    expect(TIERS.free.crownClass).not.toMatch(/fill-/);
    expect(TIERS.plus.crownClass).toMatch(/fill-/);
    expect(TIERS.pro.crownClass).toMatch(/fill-/);
  });
});

describe("formatBRL", () => {
  it("formata em real com vírgula decimal e 2 casas", () => {
    expect(formatBRL(39.9)).toBe("R$ 39,90");
    expect(formatBRL(69.9)).toBe("R$ 69,90");
    expect(formatBRL(599)).toBe("R$ 599,00");
    expect(formatBRL(0)).toBe("R$ 0,00");
  });
});
