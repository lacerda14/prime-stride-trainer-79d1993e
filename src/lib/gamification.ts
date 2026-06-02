// PM Hybrid — gamification math (pure, client+server safe)

/** Level curve: smooth like Duolingo. level = floor(sqrt(xp/100)) + 1 */
export function levelFromXp(xp: number): number {
  return Math.floor(Math.sqrt(Math.max(0, xp) / 100)) + 1;
}

/** XP threshold to reach a given level */
export function xpForLevel(level: number): number {
  const l = Math.max(1, level);
  return Math.pow(l - 1, 2) * 100;
}

export function levelProgress(xp: number) {
  const level = levelFromXp(xp);
  const currentBase = xpForLevel(level);
  const nextBase = xpForLevel(level + 1);
  const into = xp - currentBase;
  const span = nextBase - currentBase;
  return {
    level,
    xp,
    intoLevel: into,
    levelSpan: span,
    pct: Math.max(0, Math.min(1, into / span)),
    xpToNext: Math.max(0, nextBase - xp),
  };
}

export const XP_REWARDS = {
  workout: 50,
  run: 30,
  pr: 100,
  weekComplete: 250,
} as const;
