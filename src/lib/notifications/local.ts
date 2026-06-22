// src/lib/notifications/local.ts
// =============================================================================
// Orquestrador de notificações LOCAIS (Fase 1). Pega o plano puro
// (computeLocalNotifications) e (re)agenda no device de forma idempotente:
// cancela as nossas pendentes (faixa de id 1000..2999) e agenda as novas.
// Safe-no-op no web (guarda isNative). Não precisa de backend.
// =============================================================================

import { LocalNotifications } from "@capacitor/local-notifications";
import { isNative, ensureLocalNotifPermission } from "@/integrations/native";
import { computeLocalNotifications, type PlanInput, type LocalPlan } from "./schedule";

// Faixa de ids reservada às notificações locais deste módulo (ver NOTIF_ID).
const ID_MIN = 1000;
const ID_MAX = 2999;

const ROUTE_BY_CATEGORY: Record<LocalPlan["category"], string> = {
  workout: "/treino",
  streak: "/treino",
};

/**
 * Recalcula e reagenda as notificações locais. Idempotente — pode chamar no boot,
 * ao concluir treino, ao mudar preferências/agenda. Retorna quantas agendou.
 * Nunca lança (notificação é best-effort).
 */
export async function rescheduleLocalNotifications(
  input: PlanInput,
): Promise<{ scheduled: number; granted: boolean }> {
  if (!isNative()) return { scheduled: 0, granted: false };
  try {
    const granted = await ensureLocalNotifPermission();
    if (!granted) return { scheduled: 0, granted: false };

    // 1) Cancela as NOSSAS pendentes (não mexe em ids de fora da faixa).
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications ?? [])
      .filter((n) => typeof n.id === "number" && n.id >= ID_MIN && n.id <= ID_MAX)
      .map((n) => ({ id: n.id }));
    if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });

    // 2) Agenda o novo plano.
    const plan = computeLocalNotifications(input);
    if (plan.length === 0) return { scheduled: 0, granted: true };

    await LocalNotifications.schedule({
      notifications: plan.map((p) => ({
        id: p.id,
        title: p.title,
        body: p.body,
        schedule: { at: p.at, allowWhileIdle: true },
        extra: { category: p.category, route: ROUTE_BY_CATEGORY[p.category] },
      })),
    });
    return { scheduled: plan.length, granted: true };
  } catch (e) {
    console.warn("[notifications] reschedule falhou", e);
    return { scheduled: 0, granted: false };
  }
}

/**
 * Dispara uma notificação local IMEDIATA (ex.: o coach aplicou uma mudança no
 * treino). Native-only (no-op no web), best-effort (nunca lança). Usa id na faixa
 * 3000+ pra não colidir com as agendadas (1000..2999).
 */
export async function notifyNow(
  title: string,
  body: string,
  opts?: { route?: string },
): Promise<void> {
  if (!isNative()) return;
  try {
    const granted = await ensureLocalNotifPermission();
    if (!granted) return;
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 3000 + Math.floor(Math.random() * 9000),
          title,
          body,
          schedule: { at: new Date(Date.now() + 200), allowWhileIdle: true },
          extra: opts?.route ? { route: opts.route } : {},
        },
      ],
    });
  } catch (e) {
    console.warn("[notifications] notifyNow falhou", e);
  }
}

/** Cancela todas as notificações locais deste módulo (ex.: master OFF / logout). */
export async function clearLocalNotifications(): Promise<void> {
  if (!isNative()) return;
  try {
    const pending = await LocalNotifications.getPending();
    const ours = (pending.notifications ?? [])
      .filter((n) => typeof n.id === "number" && n.id >= ID_MIN && n.id <= ID_MAX)
      .map((n) => ({ id: n.id }));
    if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });
  } catch (e) {
    console.warn("[notifications] clear falhou", e);
  }
}
