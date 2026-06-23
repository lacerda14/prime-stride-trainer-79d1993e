import { describe, it, expect, vi } from "vitest";
import {
  resolveSubscription,
  LIFETIME_PREMIUM,
  FREE_SUBSCRIPTION,
  type SubscriptionView,
} from "./subscription.entitlement";

const paidRow: SubscriptionView = {
  plan: "plus",
  billing_status: "active",
  trial_used: true,
  trial_ends_at: null,
  current_period_end: "2026-12-31T00:00:00Z",
  cancelled_at: null,
  external_subscription_id: "sub_123",
  payment_provider: "stripe",
};

describe("resolveSubscription — decisão de entitlement", () => {
  it("owner → SEMPRE Pro vitalício, sem nem tocar no banco", async () => {
    const fetchRow = vi.fn(async (): Promise<SubscriptionView | null> => paidRow);
    const result = await resolveSubscription("pedrolacerda.m@gmail.com", fetchRow);
    expect(result).toEqual(LIFETIME_PREMIUM);
    expect(result.plan).toBe("pro");
    // curto-circuito: não consulta o banco pro owner
    expect(fetchRow).not.toHaveBeenCalled();
  });

  it("owner por variante Gmail (pontos/+) também curto-circuita pra Pro", async () => {
    const fetchRow = vi.fn(async (): Promise<SubscriptionView | null> => null);
    expect(await resolveSubscription("pedro.lacerda.m+x@gmail.com", fetchRow)).toEqual(
      LIFETIME_PREMIUM,
    );
    expect(fetchRow).not.toHaveBeenCalled();
  });

  it("não-owner com registro no banco → retorna o registro real", async () => {
    const result = await resolveSubscription("user@example.com", async () => paidRow);
    expect(result).toEqual(paidRow);
    expect(result.plan).toBe("plus");
  });

  it("não-owner SEM registro → free (default seguro, nunca premium por engano)", async () => {
    const result = await resolveSubscription("novo@example.com", async () => null);
    expect(result).toEqual(FREE_SUBSCRIPTION);
    expect(result.plan).toBe("free");
  });

  it("email ausente (sem claim) e sem registro → free", async () => {
    expect(await resolveSubscription(null, async () => null)).toEqual(FREE_SUBSCRIPTION);
    expect(await resolveSubscription(undefined, async () => null)).toEqual(FREE_SUBSCRIPTION);
  });

  it("erro no fetch do banco propaga (não mascara como free)", async () => {
    await expect(
      resolveSubscription("user@example.com", async () => {
        throw new Error("db down");
      }),
    ).rejects.toThrow("db down");
  });
});
