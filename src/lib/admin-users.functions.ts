import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

async function ensureAdmin(supabase: any, userId: string) {
  const { data, error } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId)
    .eq("role", "admin")
    .maybeSingle();
  if (error) throw new Error(error.message);
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
}

export const listAllUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<AdminUserDTO[]> => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: profiles, error } = await supabaseAdmin
      .from("profiles")
      .select("id, name, created_at, streak_current, level, xp_total")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);

    // Buscar emails via auth admin
    const { data: usersList, error: uErr } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });
    if (uErr) throw new Error(uErr.message);

    const emailById = new Map<string, string | null>();
    for (const u of usersList.users) emailById.set(u.id, u.email ?? null);

    return (profiles ?? []).map((p: any) => ({
      id: p.id,
      name: p.name,
      email: emailById.get(p.id) ?? null,
      created_at: p.created_at,
      streak_current: p.streak_current ?? 0,
      level: p.level ?? 1,
      xp_total: p.xp_total ?? 0,
    }));
  });

export const deleteUserById = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ targetUserId: z.string().uuid() }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    if (data.targetUserId === userId) {
      throw new Error("Você não pode excluir a própria conta por aqui.");
    }
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin.auth.admin.deleteUser(data.targetUserId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
