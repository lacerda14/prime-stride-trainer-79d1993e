// src/components/local-notifications-sync.tsx
// Sincroniza as notificações LOCAIS (Fase 1) com o estado do usuário. Roda só no
// nativo, pra usuário logado. Reagenda no boot e quando prefs/perfil mudam.
// Renderiza null. Web = no-op (rescheduleLocalNotifications guarda isNative).
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useAuth } from "@/hooks/use-auth";
import { getProfile, getNotificationPrefs } from "@/lib/profile.functions";
import { dayNamesToNumbers } from "@/lib/engine/program.functions";
import { getLocalToday } from "@/lib/local-today";
import { isNative } from "@/integrations/native";
import { rescheduleLocalNotifications } from "@/lib/notifications/local";
import {
  reminderHourFromPeriod,
  type NotifPrefs,
  type PlanInput,
} from "@/lib/notifications/schedule";

export function LocalNotificationsSync() {
  const { user } = useAuth();
  const enabled = isNative() && !!user;
  const fetchProfile = useServerFn(getProfile);
  const fetchPrefs = useServerFn(getNotificationPrefs);

  const { data: profile } = useQuery({
    queryKey: ["notif-profile"],
    queryFn: () => fetchProfile(),
    enabled,
  });
  const { data: prefs } = useQuery({
    queryKey: ["notification-prefs"],
    queryFn: () => fetchPrefs(),
    enabled,
  });

  useEffect(() => {
    if (!enabled || !profile || !prefs) return;
    const todayISO = getLocalToday().local_date;
    const p = profile as {
      available_days_list?: string[] | null;
      preferred_time?: string | null;
      streak_current?: number | null;
      streak_last_date?: string | null;
    };
    const input: PlanInput = {
      now: new Date(),
      prefs: prefs as NotifPrefs,
      trainingWeekdays: dayNamesToNumbers(p.available_days_list ?? []),
      reminderHour: reminderHourFromPeriod(p.preferred_time ?? null),
      streakCurrent: p.streak_current ?? 0,
      trainedToday: (p.streak_last_date ?? null) === todayISO,
    };
    void rescheduleLocalNotifications(input);
  }, [enabled, profile, prefs]);

  return null;
}
