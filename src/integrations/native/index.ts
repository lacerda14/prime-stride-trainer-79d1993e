/**
 * Bridge fina pra APIs nativas (Capacitor).
 * Tudo aqui é safe-no-op no navegador — checa `Capacitor.isNativePlatform()`
 * antes de tocar em qualquer plugin nativo.
 */
import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { App } from '@capacitor/app';

export const isNative = () => Capacitor.isNativePlatform();
export const platform = () => Capacitor.getPlatform(); // 'ios' | 'android' | 'web'

/** Chamar 1x no boot do app (root component) */
export async function initNative() {
  if (!isNative()) return;
  try {
    await StatusBar.setStyle({ style: Style.Dark });
    if (platform() === 'android') {
      await StatusBar.setBackgroundColor({ color: '#000000' });
    }
    await StatusBar.setOverlaysWebView({ overlay: true });
    await SplashScreen.hide({ fadeOutDuration: 250 });
  } catch (e) {
    console.warn('[native] init falhou', e);
  }
}

/** Haptics — silenciosos no web */
export const haptics = {
  async light() { if (isNative()) await Haptics.impact({ style: ImpactStyle.Light }); },
  async medium() { if (isNative()) await Haptics.impact({ style: ImpactStyle.Medium }); },
  async heavy() { if (isNative()) await Haptics.impact({ style: ImpactStyle.Heavy }); },
  async success() { if (isNative()) await Haptics.notification({ type: NotificationType.Success }); },
  async warning() { if (isNative()) await Haptics.notification({ type: NotificationType.Warning }); },
  async error() { if (isNative()) await Haptics.notification({ type: NotificationType.Error }); },
};

/** Deep link listener — pra capturar callback OAuth `com.pmhybrid.app://...` */
export function onDeepLink(handler: (url: string) => void) {
  if (!isNative()) return () => {};
  const sub = App.addListener('appUrlOpen', (event) => handler(event.url));
  return () => { sub.then((s) => s.remove()); };
}
