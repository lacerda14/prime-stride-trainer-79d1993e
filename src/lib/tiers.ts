// src/lib/tiers.ts
// =============================================================================
// Fonte única dos planos no FRONTEND: metadados + tratamento da COROA por tier.
// A coroa (ícone lucide Crown) é o ÚNICO indicador de status de assinatura —
// White (Free) · Silver (Plus) · Gold (Pro). Não introduzir outros símbolos.
// =============================================================================

export type TierId = "free" | "plus" | "pro";
export type CrownTone = "white" | "silver" | "gold";

export interface TierMeta {
  id: TierId;
  name: string; // "Free" | "Plus" | "Pro"
  crown: CrownTone;
  /** classes do ícone Crown (cor + fill) — tratamento metálico por tier */
  crownClass: string;
  /** accent de borda p/ cards/badges do tier */
  accentClass: string;
  /** posicionamento (outcome, não feature) */
  tagline: string;
  priceMonthly: number | null; // R$/mês (null = grátis)
  priceAnnual: number | null; // R$/ano
}

export const TIERS: Record<TierId, TierMeta> = {
  free: {
    id: "free",
    name: "Free",
    crown: "white",
    // Coroa "vazia": contorno apagado, SEM preenchimento metálico — pra não
    // confundir com o Silver (Plus). Free tem que parecer claramente sem assinatura.
    crownClass: "text-zinc-500",
    accentClass: "border-border/60",
    tagline: "Experimente o PM Hybrid",
    priceMonthly: 0,
    priceAnnual: null,
  },
  plus: {
    id: "plus",
    name: "Plus",
    crown: "silver",
    crownClass: "text-slate-300 fill-slate-300/25",
    accentClass: "border-slate-400/40",
    tagline: "Seu coach pessoal híbrido",
    priceMonthly: 39.9,
    priceAnnual: 349,
  },
  pro: {
    id: "pro",
    name: "Pro",
    crown: "gold",
    crownClass: "text-amber-400 fill-amber-400/30",
    accentClass: "border-amber-400/40",
    tagline: "Seu time de performance completo",
    priceMonthly: 69.9,
    priceAnnual: 599,
  },
};

export const TIER_ORDER: TierId[] = ["free", "plus", "pro"];

/** Mapeia o `plan` da subscription → tier (premium_ai legado = pro). */
export function tierFromPlan(plan: string | null | undefined): TierId {
  if (plan === "pro" || plan === "premium_ai") return "pro";
  if (plan === "plus") return "plus";
  return "free";
}

/**
 * Tier de ACESSO efetivo — FONTE ÚNICA do gate de feature. Considera trial = Pro
 * (o trial libera o topo). Usar isto em vez de recomputar
 * `billing_status === "trialing" ? "pro" : tierFromPlan(plan)` espalhado nas telas.
 */
export function accessTier(plan: string | null | undefined, billingStatus?: string | null): TierId {
  if (billingStatus === "trialing") return "pro";
  return tierFromPlan(plan);
}

// =============================================================================
// ENTITLEMENTS — helpers semânticos (FONTE ÚNICA dos gates). SEMPRE usar estes
// em vez de comparar `plan`/`billing_status` na mão. Comparar `plan === "premium_ai"`
// cru (sem cobrir "pro"/trial) já travou owner e assinantes Pro nos coaches — não repetir.
// =============================================================================

/** Forma mínima do objeto de subscription (o que getMySubscription retorna). */
export interface SubLike {
  plan?: string | null;
  billing_status?: string | null;
}

/** Tier de acesso a partir do objeto de subscription (null-safe → "free"). */
export function tierOf(sub: SubLike | null | undefined): TierId {
  return accessTier(sub?.plan, sub?.billing_status);
}

/** Acesso PRO (topo): coaches especialistas, IA ilimitada, feed social.
 *  Cobre plan="pro" (owner/grant/assinante), "premium_ai" (legado) E trial. */
export function isProAccess(sub: SubLike | null | undefined): boolean {
  return tierOf(sub) === "pro";
}

/** Qualquer acesso PAGO (Plus ou Pro). Usar p/ esconder CTA de upgrade. */
export function isPaidAccess(sub: SubLike | null | undefined): boolean {
  return tierOf(sub) !== "free";
}

/** "R$ 39,90" a partir do valor numérico. */
export function formatBRL(amount: number): string {
  return `R$ ${amount.toFixed(2).replace(".", ",")}`;
}
