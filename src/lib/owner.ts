// Email do dono do sistema — SEMPRE admin, independente do estado do banco.
// Usado como fallback robusto além da tabela user_roles (que depende de RLS).
export const OWNER_EMAIL = "pedrolacerda.m@gmail.com";

// Normaliza p/ comparar: Gmail ignora pontos no local-part e tudo após "+".
// Assim pedrolacerda.m@gmail.com == pedrolacerdam@gmail.com == pedro.lacerda.m+x@gmail.com
// (o login por Google pode trazer o e-mail com grafia diferente).
function normalizeEmail(email: string | null | undefined): string {
  const e = (email ?? "").trim().toLowerCase();
  const at = e.indexOf("@");
  if (at < 0) return e;
  let local = e.slice(0, at);
  const domain = e.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") {
    local = local.split("+")[0].replace(/\./g, "");
    return `${local}@gmail.com`;
  }
  return `${local}@${domain}`;
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  return !!email && normalizeEmail(email) === normalizeEmail(OWNER_EMAIL);
}
