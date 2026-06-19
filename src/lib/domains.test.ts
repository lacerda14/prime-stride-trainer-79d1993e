import { describe, it, expect } from "vitest";
import { DOMAINS, domainFor, recommendedDomainsForGoal } from "./domains";

describe("domainFor — resolve slug → domínio", () => {
  it("retorna o domínio para um slug válido", () => {
    expect(domainFor("running")?.name).toBe("Corrida");
    expect(domainFor("strength_hypertrophy")?.slug).toBe("strength_hypertrophy");
  });

  it("retorna null para slug inexistente ou ausente", () => {
    expect(domainFor("nao_existe")).toBeNull();
    expect(domainFor(null)).toBeNull();
    expect(domainFor(undefined)).toBeNull();
    expect(domainFor("")).toBeNull();
  });
});

describe("DOMAINS — invariante de produto", () => {
  it("TODOS os domínios são Pro-only (especialistas exigem Pro)", () => {
    for (const d of Object.values(DOMAINS)) {
      expect(d.requiredTier).toBe("pro");
    }
  });

  it("a chave do registro bate com o slug interno (sem desalinhamento)", () => {
    for (const [key, d] of Object.entries(DOMAINS)) {
      expect(d.slug).toBe(key);
    }
  });
});

describe("recommendedDomainsForGoal — time recomendado por objetivo", () => {
  it("objetivo conhecido retorna domínios válidos e na quantidade certa", () => {
    const hip = recommendedDomainsForGoal("hipertrofia");
    expect(hip.map((d) => d.slug)).toEqual([
      "strength_hypertrophy",
      "nutrition",
      "recovery_mobility",
    ]);

    // performance_hibrida recomenda 5 — se algum slug estivesse quebrado, o
    // .filter(Boolean) derrubaria silenciosamente e este count cairia.
    expect(recommendedDomainsForGoal("performance_hibrida")).toHaveLength(5);
  });

  it("objetivo desconhecido/ausente cai no fallback (4 domínios), sem quebrar", () => {
    const fallback = recommendedDomainsForGoal("objetivo_inexistente");
    expect(fallback).toHaveLength(4);
    expect(recommendedDomainsForGoal(null)).toHaveLength(4);
    expect(recommendedDomainsForGoal(undefined)).toHaveLength(4);
  });

  it("nenhum objetivo referencia um slug inexistente (sem domínios órfãos)", () => {
    const goals = [
      "emagrecimento",
      "hipertrofia",
      "ganho_forca",
      "condicionamento",
      "correr_5k",
      "correr_10k",
      "saude_geral",
      "performance_hibrida",
    ];
    for (const g of goals) {
      const domains = recommendedDomainsForGoal(g);
      expect(domains.length).toBeGreaterThan(0);
      for (const d of domains) {
        expect(DOMAINS[d.slug]).toBeDefined();
      }
    }
  });
});
