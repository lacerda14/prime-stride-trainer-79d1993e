export interface LocalToday {
  local_date: string;
  day_number: number;
  day_name: string;
  timezone: string;
}

const DAY_NAMES: Record<number, string> = {
  1: "Segunda-feira",
  2: "Terça-feira",
  3: "Quarta-feira",
  4: "Quinta-feira",
  5: "Sexta-feira",
  6: "Sábado",
  7: "Domingo",
};

function localDateISO(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function getLocalToday(date = new Date()): LocalToday {
  const jsDay = date.getDay();
  const day_number = jsDay === 0 ? 7 : jsDay;
  return {
    local_date: localDateISO(date),
    day_number,
    day_name: DAY_NAMES[day_number],
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "local",
  };
}

export function msUntilNextLocalMidnight(date = new Date()): number {
  const next = new Date(date);
  next.setHours(24, 0, 0, 0);
  return Math.max(1_000, next.getTime() - date.getTime() + 250);
}