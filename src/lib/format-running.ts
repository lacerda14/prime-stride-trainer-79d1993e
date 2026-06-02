import type { RunningProtocolDTO } from "@/lib/program.queries";

const TYPE_LABEL: Record<string, string> = {
  hiit: "HIIT",
  tabata: "Tabata",
  emom: "EMOM",
  fartlek: "Fartlek",
  continuous: "Contínuo",
  tempo: "Tempo Run",
  long_run: "Long Run",
  recovery: "Recuperação",
  intervals: "Tiros",
  threshold: "Limiar",
};

export function runningTypeLabel(protocol: RunningProtocolDTO): string {
  return TYPE_LABEL[protocol.protocol_type] ?? protocol.protocol_type.toUpperCase();
}

export function runningHeadline(p: RunningProtocolDTO): string {
  const t = runningTypeLabel(p);
  if (p.total_duration_minutes) return `${t} · ${p.total_duration_minutes} min`;
  return t;
}

export function paceRange(p: RunningProtocolDTO): string | null {
  if (p.pace_min && p.pace_max) {
    return `${p.pace_min.toFixed(2)}–${p.pace_max.toFixed(2)} min/km`;
  }
  if (p.pace_min) return `${p.pace_min.toFixed(2)} min/km`;
  if (p.pace_max) return `${p.pace_max.toFixed(2)} min/km`;
  return null;
}

/**
 * Returns the structured step-by-step instructions for the run.
 * Tells the user EXACTLY what to do.
 */
export function runningInstructions(p: RunningProtocolDTO): string[] {
  const steps: string[] = [];
  const pace = paceRange(p);

  // Estrutura principal
  if (p.blocks && p.intervals && p.work_duration_seconds) {
    const work = p.work_duration_seconds;
    const rest = p.rest_duration_seconds ?? 0;
    steps.push(
      `${p.blocks} bloco${p.blocks > 1 ? "s" : ""} de ${p.intervals} tiro${
        p.intervals > 1 ? "s" : ""
      }`,
    );
    steps.push(
      `Cada tiro: ${work}s forte${rest ? ` + ${rest}s recuperação leve` : ""}`,
    );
    if (p.blocks > 1) {
      steps.push(`Entre blocos: 2–3 min de trote / caminhada`);
    }
  } else if (p.intervals && p.work_duration_seconds) {
    const rest = p.rest_duration_seconds ?? 0;
    steps.push(
      `${p.intervals} tiros de ${p.work_duration_seconds}s${
        rest ? ` com ${rest}s de recuperação` : ""
      }`,
    );
  } else if (p.total_duration_minutes) {
    steps.push(
      `Corrida contínua de ${p.total_duration_minutes} min em ritmo${
        pace ? "" : " confortável"
      }`,
    );
  }

  // Aquecimento + desaquecimento padrão para sessões intervaladas
  if (p.intervals || p.blocks) {
    steps.unshift("Aquecimento: 8–10 min trote leve + mobilidade");
    steps.push("Desaquecimento: 5 min trote leve + alongamento");
  }

  if (pace) steps.push(`Pace alvo: ${pace}`);
  if (p.notes) steps.push(p.notes);

  return steps;
}
