import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner";
import { serverError } from "@/lib/server-errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function ensureAdmin(context: any) {
  const { supabase, userId, claims } = context;
  // Dono do sistema é sempre admin — não depende da tabela/RLS.
  if (isOwnerEmail(claims?.email)) return;
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
  if (!data) throw new Error("Forbidden: admin only");
}

export interface AdminUserDTO {
  id: string;
  name: string | null;
  email: string | null;
  created_at: string | null;
  streak_current: number;
  level: number;
  xp_total: number;
  plan: string;
  premium_until: string | null; // null = vitalício (quando premium)
}

// Mesma lista do _shared/billing.ts (PREMIUM_FEATURES) — features liberadas no premium.
const PREMIUM_FEATURES = [
  "core_tracking",
  "static_templates",
  "basic_history",
  "basic_charts",
  "ai_coach_chat",
  "ai_workout_generation",
  "ai_adaptation",
  "ai_coach_feedback",
  "multiple_ai_coaches",
  "advanced_insights",
  "recovery_analysis",
  "smart_periodization",
  "premium_templates",
  "rag_knowledge_base",
  "ad_free",
  "ai_insights",
  "advanced_charts",
  "full_history",
  "nutrition_guidance",
  "priority_support",
  "specialist_domains",
  "unlimited_ai",
  "social_feed",
  "social_friends",
  "social_ranking",
  "social_groups",
  "social_challenges",
];
const FREE_FEATURES = ["core_tracking", "static_templates", "basic_history"];
// Plus = Pedro liberado + adaptativo + analytics + sem anúncios (sem especialistas/social).
const PLUS_FEATURES = [
  "core_tracking",
  "static_templates",
  "full_history",
  "basic_charts",
  "advanced_analytics",
  "ad_free",
  "no_ads",
  "ai_coach_chat",
  "ai_workout_generation",
  "ai_adaptation",
  "adaptive_training",
];

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserDTO[]> => {
    await ensureAdmin(context);

    let supabaseAdmin:
      | Awaited<
          ReturnType<
            (typeof import("@/integrations/supabase/client.server"))["supabaseAdmin"]["from"]
          >
        >
      | any;
    try {
      const mod = await import("@/integrations/supabase/client.server");
      supabaseAdmin = mod.supabaseAdmin;
    } catch {
      throw new Error(
        "Variável SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione em Project Settings → Environment Variables.",
      );
    }

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, created_at, streak_current, level, xp_total")
      .order("created_at", { ascending: false });
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);

    // Buscar emails via auth admin — RESILIENTE: se falhar, segue sem emails
    // (não derruba a lista inteira). Antes, um erro aqui zerava a tela.
    const emailById = new Map<string, string | null>();
    try {
      const { data: usersList, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      });
      if (uErr) serverError("Não foi possível concluir a operação. Tente novamente.", uErr);
      for (const u of usersList?.users ?? []) emailById.set(u.id, u.email ?? null);
    } catch (e) {
      console.error("[listAllUsers] auth.admin.listUsers falhou — listando sem emails", e);
    }

    // Assinaturas (plano + validade) — resiliente.
    const subById = new Map<
      string,
      { plan: string; billing_status: string; current_period_end: string | null }
    >();
    try {
      const { data: subs } = await supabaseAdmin
        .from("subscriptions")
        .select("user_id, plan, billing_status, current_period_end");
      for (const s of (subs ?? []) as Array<{
        user_id: string;
        plan: string;
        billing_status: string;
        current_period_end: string | null;
      }>) {
        subById.set(s.user_id, {
          plan: s.plan,
          billing_status: s.billing_status,
          current_period_end: s.current_period_end,
        });
      }
    } catch (e) {
      console.error("[listAllUsers] subscriptions falhou", e);
    }

    return (profiles ?? []).map((p: any) => {
      const sub = subById.get(p.id);
      const email = emailById.get(p.id) ?? null;
      const isPaid = !!sub?.plan && sub.plan !== "free" && sub?.billing_status === "active";
      // Owner é SEMPRE o plano mais top (Pro), vitalício — independente do banco.
      const isOwner = isOwnerEmail(email);
      return {
        id: p.id,
        name: p.name,
        email,
        created_at: p.created_at,
        streak_current: p.streak_current ?? 0,
        level: p.level ?? 1,
        xp_total: p.xp_total ?? 0,
        plan: isOwner ? "pro" : isPaid ? sub!.plan : "free", // plano real: plus | pro | premium_ai(legado)
        premium_until: isOwner ? null : isPaid ? (sub?.current_period_end ?? null) : null,
      };
    });
  });

// ── Conceder / remover Premium (admin) ───────────────────────────
export const grantPremiumToUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        targetUserId: z.string().uuid(),
        // null = vitalício; senão dias de duração
        durationDays: z.number().int().min(1).max(3650).nullable(),
        plan: z.enum(["plus", "pro"]).default("pro"),
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true; premium_until: string | null }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const now = new Date();
    const periodEnd = data.durationDays
      ? new Date(now.getTime() + data.durationDays * 24 * 60 * 60 * 1000).toISOString()
      : null;

    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: data.targetUserId,
        plan: data.plan, // 'plus' | 'pro'
        billing_status: "active",
        active_features: data.plan === "plus" ? PLUS_FEATURES : PREMIUM_FEATURES,
        show_ads: false,
        payment_provider: "manual",
        current_period_start: now.toISOString(),
        current_period_end: periodEnd,
        expires_at: periodEnd,
        cancelled_at: null,
        updated_at: now.toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
    return { ok: true, premium_until: periodEnd };
  });

export const revokePremiumFromUser = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    await ensureAdmin(context);
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.from("subscriptions").upsert(
      {
        user_id: data.targetUserId,
        plan: "free",
        billing_status: "active",
        active_features: FREE_FEATURES,
        show_ads: true,
        current_period_end: null,
        expires_at: null,
        cancelled_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    );
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
    return { ok: true };
  });

export const deleteUserById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ targetUserId: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { userId } = context;
    await ensureAdmin(context);
    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir a própria conta por aqui.");
    }
    let supabaseAdmin: any;
    try {
      const mod = await import("@/integrations/supabase/client.server");
      supabaseAdmin = mod.supabaseAdmin;
    } catch {
      throw new Error(
        "Variável SUPABASE_SERVICE_ROLE_KEY não configurada. Adicione em Project Settings → Environment Variables.",
      );
    }
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) serverError("Não foi possível concluir a operação. Tente novamente.", error);
    return { ok: true };
  });
