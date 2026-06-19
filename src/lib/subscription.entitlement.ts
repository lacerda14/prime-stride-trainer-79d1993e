// src/lib/subscription.entitlement.ts
// =============================================================================
// Lógica de entitlement da assinatura — PURA e testável (sem rede/SSR).
// O server fn `getMySubscription` é um wrapper fino sobre `resolveSubscription`,
// injetando o fetch do banco. Assim a decisão (owner / free default) é coberta
// por testes sem mockar o client Supabase inteiro.
// =============================================================================

import { isOwnerEmail } from "@/lib/owner";

/** Shape estável da assinatura consumida pelo app (o que getMySubscription retorna). */
export interface SubscriptionView {
  plan: string;
  billing_status: string;
  trial_used: boolean;
  trial_ends_at: string | null;
  current_period_end: string | null;
  cancelled_at: string | null;
  external_subscription_id: string | null;
  payment_provider: string | null;
}

/**
 * Owner: SEMPRE o tier mais TOP (hoje 'pro'), vitalício, independente do banco.
 * Se um tier acima do Pro surgir, atualizar `plan` AQUI (fonte única).
 */
export const LIFETIME_PREMIUM: SubscriptionView = {
  plan: "pro",
  billing_status: "active",
  trial_used: false,
  trial_ends_at: null,
  current_period_end: null,
  cancelled_at: null,
  external_subscription_id: null,
  payment_provider: "owner",
};

/** Sem linha de subscription = free (default seguro). */
export const FREE_SUBSCRIPTION: SubscriptionView = {
  plan: "free",
  billing_status: "active",
  trial_used: false,
  trial_ends_at: null,
  current_period_end: null,
  cancelled_at: null,
  external_subscription_id: null,
  payment_provider: null,
};

/**
 * Decide a assinatura efetiva (entitlement):
 *  1. owner (por email, robusto a Gmail) → LIFETIME_PREMIUM (top, vitalício);
 *  2. senão, o registro do banco (via `fetchRow` injetado);
 *  3. se não houver registro → FREE_SUBSCRIPTION.
 *
 * `fetchRow` é injetado de propósito: desacopla a regra de negócio do IO,
 * tornando-a unit-testável. NÃO é chamado para o owner (curto-circuito).
 */
export async function resolveSubscription(
  email: string | null | undefined,
  fetchRow: () => Promise<SubscriptionView | null>,
): Promise<SubscriptionView> {
  if (isOwnerEmail(email)) return LIFETIME_PREMIUM;
  return (await fetchRow()) ?? FREE_SUBSCRIPTION;
}
