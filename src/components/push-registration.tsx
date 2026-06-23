// src/components/push-registration.tsx
// Registra o device pra push remoto (Fase 2) e roteia o tap da notificação.
// Roda só no nativo, pra usuário logado, e SÓ se a permissão de notificação já
// foi concedida — não força o prompt no boot (o opt-in vem do toggle em
// Configurações / depois do 1º treino). Renderiza null.
import { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { PushNotifications } from "@capacitor/push-notifications";
import { useAuth } from "@/hooks/use-auth";
import { isNative, platform, registerPush } from "@/integrations/native";
import { registerDeviceToken } from "@/lib/push.functions";

export function PushRegistration() {
  const { user } = useAuth();
  const register = useServerFn(registerDeviceToken);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isNative() || !user) return;
    let cancelled = false;
    (async () => {
      try {
        const perm = await PushNotifications.checkPermissions();
        if (perm.receive !== "granted") return; // não força prompt no boot
        await registerPush({
          onToken: (token) => {
            if (cancelled) return;
            const plat = platform() === "ios" ? "ios" : "android";
            void register({ data: { token, platform: plat } }).catch(() => {});
          },
          onAction: (a) => {
            const route = (a.notification?.data as { route?: string } | undefined)?.route;
            if (route) void navigate({ to: route as never });
          },
        });
      } catch (e) {
        console.warn("[push] registro falhou", e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user, register, navigate]);

  return null;
}
