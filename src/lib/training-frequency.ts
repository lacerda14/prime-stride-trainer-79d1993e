// src/lib/training-frequency.ts
// =============================================================================
// Frequência semanal de treino (quantos dias). Substitui a escolha de "quais
// dias" no onboarding/perfil. Lógica PURA (testável).
//
// Regra de trava (decidida): iniciante só pode 5x/6x depois de 20 treinos
// concluídos; até lá, máx 4x. Intermediário/avançado: livre (5/6 só mostra
// vermelho como aviso de intensidade). O motor já trabalha por contagem
// (activeDays usa available_days quando selected_days é vazio).
// =============================================================================

export const FREQUENCY_OPTIONS = [2, 3, 4, 5, 6] as const;
export type Frequency = (typeof FREQUENCY_OPTIONS)[number];

export const BEGINNER_UNLOCK_WORKOUTS = 20;

/** Máximo de dias/semana permitido pro usuário, dada a experiência e o nº de
 *  treinos concluídos. */
export function maxDaysFor(
  experience: string | null | undefined,
  completedWorkouts: number,
): number {
  if (experience === "beginner") {
    return completedWorkouts >= BEGINNER_UNLOCK_WORKOUTS ? 6 : 4;
  }
  return 6;
}

/** A opção de N dias está travada pra esse usuário? */
export function isFrequencyLocked(
  n: number,
  experience: string | null | undefined,
  completedWorkouts: number,
): boolean {
  return n > maxDaysFor(experience, completedWorkouts);
}

/** 5x e 6x são frequências intensas — exibir em vermelho (aviso). */
export function isIntenseFrequency(n: number): boolean {
  return n >= 5;
}

// Espalhamento padrão dos dias por contagem (mantém o motor + as notificações
// locais funcionando, que ainda dependem de dias específicos). Nomes em PT
// batem com WEEK_DAYS / dayNamesToNumbers.
const DAY_SPREAD: Record<number, string[]> = {
  2: ["Segunda", "Quinta"],
  3: ["Segunda", "Quarta", "Sexta"],
  4: ["Segunda", "Terça", "Quinta", "Sexta"],
  5: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
  6: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"],
};

/** Deriva o espalhamento de dias a partir da contagem escolhida. */
export function deriveDaysFromCount(n: number): string[] {
  const clamped = Math.min(6, Math.max(2, Math.round(n)));
  return DAY_SPREAD[clamped] ?? [];
}
