// Saudação personalizada com inferência simples de gênero a partir do nome (PT-BR).
// Heurística leve: termina em "a" → feminino, "o"/consoante → masculino,
// com listas pequenas de exceções para nomes comuns no Brasil.

const FEMALE_EXCEPTIONS = new Set([
  "isis", "beatris", "ines", "carmen", "miriam", "miriã", "raquel", "ester",
  "esther", "abigail", "rute", "ruth", "soledad", "iris", "noemi", "noemí",
  "doris", "lis", "liz", "mercedes", "lourdes",
]);

const MALE_EXCEPTIONS = new Set([
  "luca", "joshua", "elias", "tobias", "matias", "matheus", "mateus",
  "andre", "andré", "jose", "josé", "jonas", "lucas", "thomas", "tomas",
  "nicolas", "nicholas", "barnaba", "akira", "yoshi", "kenta",
  "dida", "neca", "guida",
]);

export type Gender = "f" | "m" | "n";

export function inferGender(rawName: string | null | undefined): Gender {
  if (!rawName) return "n";
  const first = rawName
    .trim()
    .split(/\s+/)[0]
    ?.toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zà-ÿ]/gi, "");
  if (!first) return "n";

  if (FEMALE_EXCEPTIONS.has(first)) return "f";
  if (MALE_EXCEPTIONS.has(first)) return "m";

  const last = first.slice(-1);
  if (last === "a") return "f";
  if (last === "o" || last === "r" || last === "l" || last === "n" || last === "s" || last === "z" || last === "m") return "m";
  if (last === "e" || last === "i" || last === "u" || last === "y") return "m";
  return "n";
}

export function firstName(rawName: string | null | undefined): string {
  if (!rawName) return "";
  const first = rawName.trim().split(/\s+/)[0] ?? "";
  if (!first) return "";
  return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
}

export function welcomeWord(gender: Gender): string {
  if (gender === "f") return "Bem-vinda";
  if (gender === "m") return "Bem-vindo";
  return "Boas-vindas";
}

export function timeOfDayGreeting(date: Date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return "Boa madrugada";
  if (h < 12) return "Bom dia";
  if (h < 18) return "Boa tarde";
  return "Boa noite";
}
