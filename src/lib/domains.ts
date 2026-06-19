// src/lib/domains.ts
// =============================================================================
// Domínios de coach no FRONTEND (camada comercial = outcome, não nome).
// Espelha coach_domains (migration 59). O coach (Alex, Bia…) é a identidade
// INTERNA; o domínio é o que se vende. Todos os domínios são Pro-only.
// =============================================================================

import type { TierId } from "@/lib/tiers";

export interface DomainMeta {
  slug: string;
  name: string; // "Força & Hipertrofia"
  outcome: string; // copy de resultado
  requiredTier: TierId; // tier que libera (hoje: 'pro')
}

export const DOMAINS: Record<string, DomainMeta> = {
  strength_hypertrophy: {
    slug: "strength_hypertrophy",
    name: "Força & Hipertrofia",
    outcome: "Construa músculo e fique mais forte",
    requiredTier: "pro",
  },
  running: {
    slug: "running",
    name: "Corrida",
    outcome: "Corra 5k, 10k e melhore seu pace",
    requiredTier: "pro",
  },
  conditioning: {
    slug: "conditioning",
    name: "Condicionamento & Resistência",
    outcome: "Melhore cardio, fôlego e resistência",
    requiredTier: "pro",
  },
  nutrition: {
    slug: "nutrition",
    name: "Nutrição",
    outcome: "Melhore a composição corporal",
    requiredTier: "pro",
  },
  recovery_mobility: {
    slug: "recovery_mobility",
    name: "Recuperação & Mobilidade",
    outcome: "Recupere melhor e previna lesões",
    requiredTier: "pro",
  },
  mindset_consistency: {
    slug: "mindset_consistency",
    name: "Mentalidade & Consistência",
    outcome: "Construa disciplina e não largue o treino",
    requiredTier: "pro",
  },
  olympic_weightlifting: {
    slug: "olympic_weightlifting",
    name: "Levantamento Olímpico",
    outcome: "Evolua arranco, arremesso e explosão",
    requiredTier: "pro",
  },
  functional_fitness: {
    slug: "functional_fitness",
    name: "Fitness Funcional",
    outcome: "Performance no estilo CrossFit",
    requiredTier: "pro",
  },
  calisthenics: {
    slug: "calisthenics",
    name: "Calistenia",
    outcome: "Domine barra, paralela e skills",
    requiredTier: "pro",
  },
  home_training: {
    slug: "home_training",
    name: "Treino em Casa",
    outcome: "Treine em casa, com consistência",
    requiredTier: "pro",
  },
};

export function domainFor(slug: string | null | undefined): DomainMeta | null {
  return slug ? (DOMAINS[slug] ?? null) : null;
}

// Objetivo do onboarding → domínios recomendados (Pedro é sempre o coach principal).
// Usado p/ montar o "time recomendado". Free/Plus veem locked → upsell Pro.
const GOAL_DOMAINS: Record<string, string[]> = {
  emagrecimento: ["nutrition", "strength_hypertrophy", "conditioning", "mindset_consistency"],
  hipertrofia: ["strength_hypertrophy", "nutrition", "recovery_mobility"],
  ganho_forca: ["strength_hypertrophy", "olympic_weightlifting", "recovery_mobility"],
  condicionamento: ["conditioning", "functional_fitness", "running"],
  correr_5k: ["running", "conditioning", "recovery_mobility", "mindset_consistency"],
  correr_10k: ["running", "conditioning", "recovery_mobility", "mindset_consistency"],
  saude_geral: ["conditioning", "nutrition", "recovery_mobility", "mindset_consistency"],
  performance_hibrida: [
    "strength_hypertrophy",
    "running",
    "conditioning",
    "nutrition",
    "recovery_mobility",
  ],
};

export function recommendedDomainsForGoal(goal: string | null | undefined): DomainMeta[] {
  const slugs = (goal && GOAL_DOMAINS[goal]) || [
    "strength_hypertrophy",
    "running",
    "nutrition",
    "recovery_mobility",
  ];
  return slugs.map((s) => DOMAINS[s]).filter(Boolean);
}
