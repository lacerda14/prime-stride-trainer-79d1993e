import { Capacitor, registerPlugin } from "@capacitor/core";
import { supabase } from "@/integrations/supabase/client";

// Plugin nativo iOS (HealthKitPlugin.swift, jsName "HealthKit").
// Na web / Android resolve pra um proxy que rejeita — sempre guardar com isNative().
interface HealthKitPlugin {
  isAvailable(): Promise<{ available: boolean }>;
  requestAuthorization(): Promise<{ granted: boolean }>;
  readHeartRate(opts: { start: string; end: string }): Promise<{ samples: Array<{ bpm: number; date: string }> }>;
  readRestingHeartRate(): Promise<{ bpm?: number; date?: string }>;
  readBodyMass(): Promise<{ kg?: number; date?: string }>;
  readWorkouts(opts: { limit?: number }): Promise<{
    workouts: Array<{ uuid: string; activityType: number; start: string; end: string; durationSec: number; calories: number }>;
  }>;
  writeWorkout(opts: { start: string; end: string; activityType?: number; calories?: number }): Promise<{ saved: boolean; uuid: string }>;
  readDailyMetrics(opts: { days?: number }): Promise<{ metrics: DailyHealthMetric[] }>;
}

// Métrica diária lida do Apple Saúde (campos batem com ingest-healthkit-batch).
export interface DailyHealthMetric {
  date: string; // YYYY-MM-DD
  steps?: number;
  active_energy_kcal?: number;
  exercise_minutes?: number;
  resting_hr?: number;
  hrv_ms?: number;
  sleep_duration_min?: number;
}

const HealthKit = registerPlugin<HealthKitPlugin>("HealthKit");

export function healthAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios";
}

export async function requestHealthAuth(): Promise<boolean> {
  if (!healthAvailable()) return false;
  try {
    const { granted } = await HealthKit.requestAuthorization();
    return granted;
  } catch {
    return false;
  }
}

export interface SessionHealthMetrics {
  avgHeartRate: number | null;
  maxHeartRate: number | null;
  minHeartRate: number | null;
  calories: number | null; // kcal vindos do Apple Watch (HKWorkout) cobrindo a janela
  sampleCount: number;
}

// Lê FC (média/máx/mín) e calorias de um treino do Apple Watch para a janela [start,end].
// Calorias vêm do HKWorkout do relógio que cruze a janela (se houver).
export async function readSessionHealth(startIso: string, endIso: string): Promise<SessionHealthMetrics | null> {
  if (!healthAvailable()) return null;
  const empty: SessionHealthMetrics = {
    avgHeartRate: null, maxHeartRate: null, minHeartRate: null, calories: null, sampleCount: 0,
  };
  try {
    const start = new Date(startIso).getTime();
    const end = new Date(endIso).getTime();

    // Frequência cardíaca
    let hr = empty;
    try {
      const { samples } = await HealthKit.readHeartRate({ start: startIso, end: endIso });
      const bpms = (samples ?? []).map((s) => s.bpm).filter((n) => Number.isFinite(n) && n > 0);
      if (bpms.length > 0) {
        const sum = bpms.reduce((a, b) => a + b, 0);
        hr = {
          ...empty,
          avgHeartRate: Math.round(sum / bpms.length),
          maxHeartRate: Math.round(Math.max(...bpms)),
          minHeartRate: Math.round(Math.min(...bpms)),
          sampleCount: bpms.length,
        };
      }
    } catch { /* sem permissão / sem dados */ }

    // Calorias — procura um HKWorkout do relógio que cruze a janela do treino
    let calories: number | null = null;
    try {
      const { workouts } = await HealthKit.readWorkouts({ limit: 20 });
      const overlapping = (workouts ?? []).filter((w) => {
        const ws = new Date(w.start).getTime();
        const we = new Date(w.end).getTime();
        return we >= start - 5 * 60_000 && ws <= end + 5 * 60_000; // tolerância 5min
      });
      const cal = overlapping.reduce((a, w) => a + (w.calories || 0), 0);
      if (cal > 0) calories = Math.round(cal);
    } catch { /* sem permissão / sem dados */ }

    return { ...hr, calories };
  } catch {
    return null;
  }
}

// Sincroniza as métricas diárias do Apple Saúde (últimos N dias) com o backend.
// Traz, de quebra, o que o Garmin Connect sincroniza com o Apple Saúde — sem a
// API do Garmin. Cada dia vira um upsert em daily_health_metrics → recuperação.
export async function syncDailyHealthMetrics(days = 7): Promise<{ synced: number }> {
  if (!healthAvailable()) return { synced: 0 };
  const granted = await requestHealthAuth();
  if (!granted) return { synced: 0 };

  let metrics: DailyHealthMetric[] = [];
  try {
    const res = await HealthKit.readDailyMetrics({ days });
    metrics = res.metrics ?? [];
  } catch {
    return { synced: 0 };
  }

  let synced = 0;
  for (const m of metrics) {
    const { date, ...fields } = m;
    if (!date || Object.keys(fields).length === 0) continue; // dia sem dado útil
    try {
      const { error } = await supabase.functions.invoke("ingest-healthkit-batch", {
        body: { date, platform: "healthkit", ...fields },
      });
      if (!error) synced++;
    } catch {
      /* ignora dia com falha; segue os demais */
    }
  }
  return { synced };
}
