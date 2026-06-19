/**
 * Bridge fina pra APIs nativas (Capacitor).
 * Tudo aqui é safe-no-op no navegador — checa `Capacitor.isNativePlatform()`
 * antes de tocar em qualquer plugin nativo.
 */
import { Capacitor } from "@capacitor/core";
import { StatusBar, Style } from "@capacitor/status-bar";
import { SplashScreen } from "@capacitor/splash-screen";
import { Haptics, ImpactStyle, NotificationType } from "@capacitor/haptics";
import { App } from "@capacitor/app";
import { Keyboard } from "@capacitor/keyboard";
import {
  PushNotifications,
  type Token,
  type PushNotificationSchema,
  type ActionPerformed,
} from "@capacitor/push-notifications";
import { LocalNotifications } from "@capacitor/local-notifications";

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'
export const isIOS = () => platform() === "ios";

/** Chamar 1x no boot do app (root component) */
export async function initNative() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform() === "android") {
      await StatusBar.setBackgroundColor({ color: "#000000" });
    }
    await StatusBar.setOverlaysWebView({ overlay: true });
    await SplashScreen.hide({ fadeOutDuration: 250 });

    if (isIOS()) {
      Keyboard.setAccessoryBarVisible({ isVisible: false }).catch(() => {});
    }
  } catch (e) {
    console.warn("[native] init falhou", e);
  }
}

/** Haptics — silenciosos no web */
export const haptics = {
  async light() {
    if (isNative()) await Haptics.impact({ style: ImpactStyle.Light }).catch(() => {});
  },
  async medium() {
    if (isNative()) await Haptics.impact({ style: ImpactStyle.Medium }).catch(() => {});
  },
  async heavy() {
    if (isNative()) await Haptics.impact({ style: ImpactStyle.Heavy }).catch(() => {});
  },
  async success() {
    if (isNative()) await Haptics.notification({ type: NotificationType.Success }).catch(() => {});
  },
  async warning() {
    if (isNative()) await Haptics.notification({ type: NotificationType.Warning }).catch(() => {});
  },
  async error() {
    if (isNative()) await Haptics.notification({ type: NotificationType.Error }).catch(() => {});
  },
  async selection() {
    if (isNative()) await Haptics.selectionStart().catch(() => {});
  },
};

/** Deep link listener — pra capturar callback OAuth `com.pmhybrid.app://...` */
export function onDeepLink(handler: (url: string) => void) {
  if (!isNative()) return () => {};
  const subPromise = App.addListener("appUrlOpen", (event) => handler(event.url));
  return () => {
    subPromise.then((s) => s.remove());
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Push Notifications (APNs no iOS, FCM no Android)
// ─────────────────────────────────────────────────────────────────────────────

export type PushHandlers = {
  onToken?: (token: string) => void;
  onError?: (err: unknown) => void;
  onReceived?: (n: PushNotificationSchema) => void;
  onAction?: (a: ActionPerformed) => void;
};

/**
 * Pede permissão e registra device token.
 * Chamar depois do login (ou onde fizer sentido pedir permissão ao usuário).
 */
export async function registerPush(handlers: PushHandlers = {}) {
  if (!isNative()) return { granted: false, reason: "web" as const };

  const perm = await PushNotifications.checkPermissions();
  let receive = perm.receive;
  if (receive === "prompt" || receive === "prompt-with-rationale") {
    const req = await PushNotifications.requestPermissions();
    receive = req.receive;
  }
  if (receive !== "granted") return { granted: false, reason: "denied" as const };

  await PushNotifications.removeAllListeners();
  if (handlers.onToken) {
    await PushNotifications.addListener("registration", (t: Token) => handlers.onToken!(t.value));
  }
  if (handlers.onError) {
    await PushNotifications.addListener("registrationError", (e) => handlers.onError!(e));
  }
  if (handlers.onReceived) {
    await PushNotifications.addListener("pushNotificationReceived", handlers.onReceived);
  }
  if (handlers.onAction) {
    await PushNotifications.addListener("pushNotificationActionPerformed", handlers.onAction);
  }
  await PushNotifications.register();
  return { granted: true };
}

// ─────────────────────────────────────────────────────────────────────────────
// Local notifications (lembrete de treino, fim de descanso, etc.)
// ─────────────────────────────────────────────────────────────────────────────

export async function ensureLocalNotifPermission() {
  if (!isNative()) return false;
  const cur = await LocalNotifications.checkPermissions();
  if (cur.display === "granted") return true;
  const req = await LocalNotifications.requestPermissions();
  return req.display === "granted";
}

export async function scheduleLocalNotif(opts: {
  id: number;
  title: string;
  body: string;
  at?: Date;
  sound?: string;
}) {
  if (!isNative()) return;
  await LocalNotifications.schedule({
    notifications: [
      {
        id: opts.id,
        title: opts.title,
        body: opts.body,
        schedule: opts.at ? { at: opts.at, allowWhileIdle: true } : undefined,
        sound: opts.sound,
      },
    ],
  });
}

export async function cancelLocalNotif(id: number) {
  if (!isNative()) return;
  await LocalNotifications.cancel({ notifications: [{ id }] });
}
