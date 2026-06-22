// src/lib/notifications/schedule.ts
// =============================================================================
// Lógica PURA do agendamento de notificações LOCAIS (Fase 1, sem backend).
// Recebe o estado do usuário + "agora" e devolve a lista de notificações a
// agendar nas próximas 24-48h. O orquestrador nativo cancela as antigas e agenda
// estas (idempotente). Roda sem I/O → testável.
//
// Copy é PLACEHOLDER editável (o texto final virá do doc da esposa do Pedro).
// =============================================================================

export interface NotifPrefs {
  enabled: boolean; // master
  workout: boolean; // lembrete do dia + nudge de treino
  streak: boolean; // sequência em risco + marcos
  achievements: boolean; // nível / conquista / PR (remoto)
  social: boolean; // pedidos / reações / comentários (remoto)
  coach: boolean; // IA coach (remoto)
  health: boolean; // prontidão / recuperação (remoto)
  news: boolean; // re-engajamento / novidades (remoto)
}

export const DEFAULT_NOTIF_PREFS: NotifPrefs = {
  enabled: true,
  workout: true,
  streak: true,
  achievements: true,
  social: true,
  coach: true,
  health: true,
  news: true,
};

export type NotifCategory = keyof Omit<NotifPrefs, "enabled">;

// Categorias de push remoto. "billing" é transacional (não tem preferência →
// sempre envia: pagamento falhou, trial acabando, etc.).
export type PushCategory = NotifCategory | "billing";

/** Pode enviar push desta categoria pro usuário, dadas as preferências dele? */
export function isCategoryAllowed(prefs: NotifPrefs, category: PushCategory): boolean {
  if (category === "billing") return true; // transacional, sempre
  if (!prefs.enabled) return false; // master off
  return prefs[category] !== false;
}

/** Faz merge do JSONB salvo (parcial) com os defaults — chave ausente = ON. */
export function mergePrefs(raw: unknown): NotifPrefs {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<NotifPrefs>;
  const out = { ...DEFAULT_NOTIF_PREFS };
  for (const k of Object.keys(DEFAULT_NOTIF_PREFS) as (keyof NotifPrefs)[]) {
    if (typeof r[k] === "boolean") out[k] = r[k] as boolean;
  }
  return out;
}

// IDs estáveis (LocalNotifications usa inteiros). Faixas por tipo → reschedule
// cancela e regrava de forma determinística.
export const NOTIF_ID = {
  workoutReminderBase: 1000, // + offset de dias (0..6)
  eveningNudge: 2000,
} as const;

const EVENING_HOUR = 20; // nudge de sequência/treino perdido
const DEFAULT_REMINDER_HOUR = 18;

const PERIOD_HOUR: Record<string, number> = {
  manhã: 8,
  almoço: 12,
  tarde: 15,
  noite: 19,
};

/** "Manhã"/"Almoço"/"Tarde"/"Noite" → hora do lembrete (fallback 18h). */
export function reminderHourFromPeriod(period: string | null | undefined): number {
  if (!period) return DEFAULT_REMINDER_HOUR;
  return PERIOD_HOUR[period.toLowerCase().trim()] ?? DEFAULT_REMINDER_HOUR;
}

/** Dia da semana ISO (1=Seg .. 7=Dom) de uma Date, no fuso local. */
export function isoWeekday(d: Date): number {
  return ((d.getDay() + 6) % 7) + 1;
}

export interface LocalPlan {
  id: number;
  category: "workout" | "streak"; // só estas têm notificação local (Fase 1)
  title: string;
  body: string;
  at: Date;
}

export interface PlanInput {
  now: Date;
  prefs: NotifPrefs;
  /** Dias de treino em ISO (1=Seg..7=Dom), ex. via dayNamesToNumbers. */
  trainingWeekdays: number[];
  /** Hora do lembrete (via reminderHourFromPeriod). */
  reminderHour: number;
  streakCurrent: number;
  /** Já treinou hoje? (o caller checa workout_sessions / flag local). */
  trainedToday: boolean;
  /** Quantos dias à frente agendar lembretes de treino (default 7). */
  horizonDays?: number;
}

/**
 * Calcula as notificações locais a agendar agora. Determinístico.
 * - Lembretes de treino: próximos N dias que são dia de treino, na hora preferida.
 * - Nudge da noite (20h, só hoje): se não treinou e ainda dá tempo, com copy que
 *   adapta pra "sequência em risco" quando há streak.
 */
export function computeLocalNotifications(input: PlanInput): LocalPlan[] {
  const out: LocalPlan[] = [];
  if (!input.prefs.enabled) return out;

  const horizon = input.horizonDays ?? 7;

  // ── Lembretes de treino ────────────────────────────────────────────────────
  if (input.prefs.workout && input.trainingWeekdays.length > 0) {
    for (let offset = 0; offset < horizon; offset++) {
      const d = new Date(input.now);
      d.setDate(d.getDate() + offset);
      d.setHours(input.reminderHour, 0, 0, 0);
      if (d.getTime() <= input.now.getTime()) continue; // hora de hoje já passou
      if (!input.trainingWeekdays.includes(isoWeekday(d))) continue;
      out.push({
        id: NOTIF_ID.workoutReminderBase + offset,
        category: "workout",
        title: "Hora de treinar 💪",
        body: "Seu treino de hoje tá te esperando.",
        at: d,
      });
    }
  }

  // ── Nudge da noite (sequência / treino perdido) — só hoje ───────────────────
  const evening = new Date(input.now);
  evening.setHours(EVENING_HOUR, 0, 0, 0);
  const trainingToday = input.trainingWeekdays.includes(isoWeekday(input.now));
  const wantNudge =
    input.prefs.streak &&
    !input.trainedToday &&
    evening.getTime() > input.now.getTime() &&
    (input.streakCurrent >= 1 || trainingToday);

  if (wantNudge) {
    const hasStreak = input.streakCurrent >= 2;
    out.push({
      id: NOTIF_ID.eveningNudge,
      category: "streak",
      title: hasStreak ? "🔥 Sua sequência tá em risco!" : "Ainda dá tempo 💪",
      body: hasStreak
        ? `Não perca seus ${input.streakCurrent} dias seguidos — bora treinar antes da meia-noite.`
        : "Um treino rápido hoje mantém o ritmo.",
      at: evening,
    });
  }

  return out;
}
