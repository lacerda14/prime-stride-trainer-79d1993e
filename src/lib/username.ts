// src/lib/username.ts
// =============================================================================
// Regras de @username (escolhido no onboarding, único, usado pra achar amigos).
// Lógica PURA (sem I/O) — usada no cliente (feedback ao vivo) e no servidor
// (validação autoritativa). Username é sempre armazenado em lowercase.
// =============================================================================

export const USERNAME_MIN = 3;
export const USERNAME_MAX = 20;

export type UsernameError =
  | "too_short"
  | "too_long"
  | "invalid_chars"
  | "must_start_letter"
  | "reserved";

// Nomes que não podem ser usados (impersonação / rotas / ruído).
const RESERVED = new Set([
  "admin",
  "administrator",
  "root",
  "system",
  "sistema",
  "suporte",
  "support",
  "pmhybrid",
  "pm_hybrid",
  "pm",
  "hybrid",
  "moderator",
  "mod",
  "staff",
  "equipe",
  "null",
  "undefined",
  "none",
  "atleta",
  "user",
  "usuario",
  "me",
  "you",
]);

/** Normaliza pro formato canônico: trim + lowercase. */
export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

/** Remove caracteres inválidos enquanto digita (lowercase, só [a-z0-9_], corta no máx). */
export function sanitizeUsernameInput(raw: string): string {
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "")
    .slice(0, USERNAME_MAX);
}

/** Validação completa. Retorna o valor canônico ou o motivo da rejeição. */
export function validateUsername(
  raw: string,
): { ok: true; value: string } | { ok: false; reason: UsernameError } {
  const v = normalizeUsername(raw);
  if (v.length < USERNAME_MIN) return { ok: false, reason: "too_short" };
  if (v.length > USERNAME_MAX) return { ok: false, reason: "too_long" };
  if (!/^[a-z]/.test(v)) return { ok: false, reason: "must_start_letter" };
  if (!/^[a-z0-9_]+$/.test(v)) return { ok: false, reason: "invalid_chars" };
  if (RESERVED.has(v)) return { ok: false, reason: "reserved" };
  return { ok: true, value: v };
}

export function usernameErrorMessage(reason: UsernameError): string {
  switch (reason) {
    case "too_short":
      return `Mínimo ${USERNAME_MIN} caracteres.`;
    case "too_long":
      return `Máximo ${USERNAME_MAX} caracteres.`;
    case "must_start_letter":
      return "Deve começar com uma letra.";
    case "invalid_chars":
      return "Use só letras, números e _.";
    case "reserved":
      return "Esse nome não está disponível.";
  }
}
