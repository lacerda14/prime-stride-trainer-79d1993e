// src/lib/features.ts
// =============================================================================
// Flags de FEATURE pra FOCO (plano de viabilidade, Fase 0/1).
// Esconder ≠ apagar: a feature some da UI mas o código + dados continuam.
// Religar = trocar pra `true` aqui (1 lugar). Reversível e seguro.
// =============================================================================

export const FEATURES = {
  /** Feed social / amigos (estilo Gym Rats). Escondido pra focar no motor
   *  adaptativo — território Strava, dilui foco. Religa quando o core retiver. */
  social: false,

  /** XP / níveis / streak. Mantido por ora (streak ajuda retenção). */
  gamification: true,
} as const;

export type FeatureFlag = keyof typeof FEATURES;
