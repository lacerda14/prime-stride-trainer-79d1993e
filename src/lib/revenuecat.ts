import { Capacitor } from "@capacitor/core";

// Chave pública do RevenueCat (iOS) — injetada no build (.env.local). Pública
// por design. Entitlement configurado no painel do RevenueCat.
const IOS_KEY = import.meta.env.VITE_REVENUECAT_IOS_KEY as string | undefined;
// Identifier do entitlement no painel do RevenueCat.
const ENTITLEMENT = "PM Hybrid Pro";

// Só ativa no app iOS nativo COM a chave configurada. Na web / sem chave → no-op
// (a web continua usando o Stripe).
export function revenueCatAvailable(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === "ios" && !!IOS_KEY;
}

let configuredFor: string | null = null;

async function ensureConfigured(appUserId: string): Promise<boolean> {
  if (!revenueCatAvailable()) return false;
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  if (configuredFor === null) {
    await Purchases.configure({ apiKey: IOS_KEY!, appUserID: appUserId });
    configuredFor = appUserId;
  } else if (configuredFor !== appUserId) {
    await Purchases.logIn({ appUserID: appUserId });
    configuredFor = appUserId;
  }
  return true;
}

// True se o usuário tem o entitlement premium ativo na Apple (via RevenueCat).
export async function isPremiumActiveRC(appUserId: string): Promise<boolean> {
  if (!(await ensureConfigured(appUserId))) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.getCustomerInfo();
    return !!customerInfo.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}

export interface PurchaseResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

// Abre a compra nativa da Apple (StoreKit) via RevenueCat.
export async function purchasePremium(
  appUserId: string,
  plan: "plus" | "pro" = "pro",
): Promise<PurchaseResult> {
  if (!(await ensureConfigured(appUserId))) return { success: false, error: "unavailable" };
  const { Purchases } = await import("@revenuecat/purchases-capacitor");
  try {
    const offerings = await Purchases.getOfferings();
    const pkgs = offerings.current?.availablePackages ?? [];
    // Escolhe o package do plano (id contém 'plus'/'pro'); fallback p/ o primeiro.
    const pkg =
      pkgs.find((p) => p.identifier?.toLowerCase().includes(plan)) ??
      pkgs.find((p) => p.product?.identifier?.toLowerCase().includes(plan)) ??
      pkgs[0];
    if (!pkg) return { success: false, error: "no_package" };
    const { customerInfo } = await Purchases.purchasePackage({ aPackage: pkg });
    return { success: !!customerInfo.entitlements.active[ENTITLEMENT] };
  } catch (e) {
    const err = e as { userCancelled?: boolean; message?: string };
    if (err?.userCancelled) return { success: false, cancelled: true };
    return { success: false, error: err?.message ?? "purchase_failed" };
  }
}

// Restaura compras (botão obrigatório pela Apple em apps com assinatura).
export async function restorePurchases(appUserId: string): Promise<boolean> {
  if (!(await ensureConfigured(appUserId))) return false;
  try {
    const { Purchases } = await import("@revenuecat/purchases-capacitor");
    const { customerInfo } = await Purchases.restorePurchases();
    return !!customerInfo.entitlements.active[ENTITLEMENT];
  } catch {
    return false;
  }
}
