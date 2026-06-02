import type { RunningProtocolDTO } from "@/lib/program.queries";

const TYPE_LABEL: Record<string, string> = {
  vo2_intervals: "VO2 Intervals",
  threshold: "Threshold",
  tempo_run: "Tempo Run",
  zone_2: "Zone 2",
  pace_work: "Pace Work",
  recovery_run: "Recovery Run",
  // legados
  vo2: "VO2 Intervals",
  z2: "Zone 2",
  tempo: "Tempo Run",
  intervals: "Intervals",
  recovery: "Recovery Run",
};

export function runningTypeLabel(p: RunningProtocolDTO): string {
  return TYPE_LABEL[p.protocol_type] ?? p.protocol_type.toUpperCase();
}

export function runningHeadline(p: RunningProtocolDTO): string {
  const t = p.protocol_name?.trim() || runningTypeLabel(p);
  if (p.total_duration_minutes) return `${t} · ${p.total_duration_minutes} min`;
  return t;
}

export function paceRange(p: RunningProtocolDTO): string | null {
  const mn = p.target_pace_min ?? p.pace_min;
  const mx = p.target_pace_max ?? p.pace_max;
  if (mn != null && mx != null) return `${mn.toFixed(1)}–${mx.toFixed(1)} km/h`;
  if (mn != null) return `${mn.toFixed(1)} km/h`;
  if (mx != null) return `${mx.toFixed(1)} km/h`;
  return null;
}

function intervalsCount(p: RunningProtocolDTO): number | null {
  return p.intervals_per_block ?? p.intervals;
}

export function formatRunSeconds(s: number): string {
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const r = s % 60;
  return r === 0 ? `${m}min` : `${m}min${String(r).padStart(2, "0")}s`;
}

/**
 * Lista textual estruturada (usada nos cards de leitura).
 */
export function runningInstructions(p: RunningProtocolDTO): string[] {
  const steps: string[] = [];
  const pace = paceRange(p);
  const ipb = intervalsCount(p);

  if (p.warmup_minutes && p.warmup_minutes > 0) {
    steps.push(`Aquecimento: ${p.warmup_minutes} min caminhada leve + mobilidade`);
  }

  if (p.blocks && ipb && p.work_duration_seconds) {
    steps.push(`${p.blocks} blocos × ${ipb} tiros`);
    steps.push(`Tempo de tiro: ${formatRunSeconds(p.work_duration_seconds)} corrida`);
    steps.push(
      `Descanso entre tiros: ${
        p.rest_duration_seconds ? `${formatRunSeconds(p.rest_duration_seconds)} caminhada` : "não configurado"
      }`,
    );
    steps.push(
      `Descanso entre blocos: ${
        p.blocks > 1
          ? p.between_blocks_rest_seconds
            ? formatRunSeconds(p.between_blocks_rest_seconds)
            : "OBRIGATÓRIO — não configurado"
          : "não aplicável (1 bloco)"
      }`,
    );
  } else if (ipb && p.work_duration_seconds) {
    steps.push(
      `${ipb} tiros de ${p.work_duration_seconds}s${
        p.rest_duration_seconds ? ` + ${p.rest_duration_seconds}s leve` : ""
      }`,
    );
  } else if (p.total_duration_minutes) {
    steps.push(`Corrida contínua de ${p.total_duration_minutes} min`);
  }

  if (p.cooldown_minutes && p.cooldown_minutes > 0) {
    steps.push(`Cooldown: ${p.cooldown_minutes} min caminhada`);
  }

  if (pace) steps.push(`Pace alvo: ${pace}`);
  if (p.goal) steps.push(`Foco: ${p.goal}`);
  if (p.notes) steps.push(p.notes);

  return steps;
}

// ============================================================
// Fases para o timer do Lock Screen
// ============================================================

export type RunPhaseKind = "warmup" | "work" | "rest" | "between" | "cooldown" | "continuous";

export interface RunPhase {
  kind: RunPhaseKind;
  label: string;
  detail: string;
  seconds: number;
  block?: number;
  completedBlock?: number;
  nextBlock?: number;
  interval?: number;
  totalIntervals?: number;
  totalBlocks?: number;
}

/**
 * Sequência cronométrica completa de uma sessão de corrida.
 * O timer executa cada fase em ordem.
 */
export function buildRunPhases(p: RunningProtocolDTO): RunPhase[] {
  const phases: RunPhase[] = [];
  const pace = paceRange(p);
  const paceDetail = pace ? `Pace ${pace}` : "";
  const ipb = intervalsCount(p);

  if (p.warmup_minutes && p.warmup_minutes > 0) {
    phases.push({
      kind: "warmup",
      label: "Aquecimento",
      detail: "Caminhada leve + mobilidade",
      seconds: p.warmup_minutes * 60,
    });
  }

  if (p.blocks && ipb && p.work_duration_seconds) {
    for (let b = 1; b <= p.blocks; b++) {
      for (let i = 1; i <= ipb; i++) {
        phases.push({
          kind: "work",
          label: `Tiro ${i} / ${ipb}`,
          detail: paceDetail || "Ritmo forte",
          seconds: p.work_duration_seconds,
          block: b,
          interval: i,
          totalIntervals: ipb,
          totalBlocks: p.blocks,
        });
        const isLastInterval = i === ipb;
        if (!isLastInterval && p.rest_duration_seconds) {
          phases.push({
            kind: "rest",
            label: "Recuperação",
            detail: "Caminhada leve",
            seconds: p.rest_duration_seconds,
            block: b,
          });
        }
      }
      const isLastBlock = b === p.blocks;
      if (!isLastBlock && p.blocks > 1) {
        phases.push({
          kind: "between",
          label: "DESCANSO ENTRE BLOCOS",
          detail: p.between_blocks_rest_seconds
            ? `Prepare-se para o bloco ${b + 1}`
            : "Descanso obrigatório não configurado",
          seconds: p.between_blocks_rest_seconds ?? 1,
          block: b,
          completedBlock: b,
          nextBlock: b + 1,
          totalBlocks: p.blocks,
        });
      }
    }
  } else if (p.total_duration_minutes) {
    phases.push({
      kind: "continuous",
      label: p.protocol_name || runningTypeLabel(p),
      detail: paceDetail || p.notes || "Corrida contínua",
      seconds: p.total_duration_minutes * 60,
    });
  }

  if (p.cooldown_minutes && p.cooldown_minutes > 0) {
    phases.push({
      kind: "cooldown",
      label: "Cooldown",
      detail: "Caminhada leve",
      seconds: p.cooldown_minutes * 60,
    });
  }

  return phases;
}
