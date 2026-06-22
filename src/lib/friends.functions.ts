// src/lib/friends.functions.ts
// =============================================================================
// Gestão de amigos (substrato do feed social). Aberto a qualquer usuário
// autenticado — a rede cresce livre; o FEED é que é Pro-only (ver feed.functions).
//
// Segurança:
//  - friendships: a RLS (authenticated) já escopa tudo ao próprio usuário
//    (INSERT requester=auth.uid(); SELECT/UPDATE/DELETE quando envolvido) →
//    usamos o client user-scoped (context.supabase) pra todas as escritas.
//  - profiles: a RLS só deixa ver o PRÓPRIO perfil → busca/enriquecimento de
//    OUTROS usuários é feito com service role (supabaseAdmin), retornando apenas
//    campos públicos (whitelist). Nunca expor phone/medical/etc.
//  - friend_code: gerado via service role pra unicidade correta (gen_friend_code
//    roda como invoker e a RLS cegaria a checagem de duplicidade).
//
// Lógica pura (classificação/status/nome) vive em friends.logic.ts (testável).
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { serverError } from "@/lib/server-errors";
import {
  classifyEdge,
  otherUserId,
  relationshipStatus,
  toFriendUser,
  type FriendUser,
  type FriendEdge,
  type FriendsOverview,
  type PendingRequest,
  type ProfileRow,
  type RawEdge,
  type SearchResult,
} from "@/lib/friends.logic";

export type {
  FriendUser,
  FriendEdge,
  FriendsOverview,
  PendingRequest,
  RelationshipStatus,
  SearchResult,
} from "@/lib/friends.logic";

// Campos públicos de profile que podem trafegar pro cliente. NUNCA adicionar
// phone, medical, contatos de emergência, etc.
const PUBLIC_PROFILE_FIELDS = "id, name, first_name, last_name, username, avatar_url, level";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Admin = any;

async function getAdmin(): Promise<Admin> {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin as Admin;
}

// Push best-effort: nunca bloqueia nem derruba a ação. No-op sem credenciais.
async function safePush(
  userId: string,
  payload: import("@/lib/notifications/push-send").PushPayload,
) {
  try {
    const { sendPushToUser } = await import("@/lib/notifications/push-send");
    await sendPushToUser(userId, payload);
  } catch (e) {
    console.warn("[push] notificação de amizade falhou", e);
  }
}

/** Busca perfis públicos por id (service role; profiles RLS bloqueia cross-user). */
async function fetchProfiles(admin: Admin, ids: string[]): Promise<Map<string, FriendUser>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { data } = await admin.from("profiles").select(PUBLIC_PROFILE_FIELDS).in("id", unique);
  return new Map(((data ?? []) as ProfileRow[]).map((p) => [p.id, toFriendUser(p)]));
}

// ── getFriendsOverview ───────────────────────────────────────────────────────
// Tudo num round-trip: meu friend_code (gerado on-demand), amigos, e pedidos
// recebidos/enviados — já enriquecidos com o perfil do outro lado.
export const getFriendsOverview = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FriendsOverview> => {
    const { supabase, userId } = context;
    const admin = await getAdmin();

    // 1) Garante friend_code (unicidade via service role).
    const { data: me } = await admin
      .from("profiles")
      .select("friend_code, username")
      .eq("id", userId)
      .maybeSingle();
    let friendCode: string | null = me?.friend_code ?? null;
    if (!friendCode) {
      const { data: gen, error: genErr } = await admin.rpc("gen_friend_code");
      if (!genErr && gen) {
        friendCode = gen as string;
        await admin.from("profiles").update({ friend_code: friendCode }).eq("id", userId);
      }
    }

    // 2) Minhas arestas (RLS já escopa às que me envolvem).
    const { data: edgeData, error } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, accepted_at, created_at")
      .in("status", ["accepted", "pending"]);
    if (error) serverError("Não foi possível carregar seus amigos.", error);
    const edges = (edgeData ?? []) as RawEdge[];

    // 3) Enriquece com os perfis do "outro" lado.
    const others = await fetchProfiles(
      admin,
      edges.map((e) => otherUserId(e, userId)),
    );
    const fallback = (id: string): FriendUser => ({
      id,
      name: "Atleta",
      username: null,
      avatar_url: null,
      level: 1,
    });

    const friends: FriendEdge[] = [];
    const incoming: PendingRequest[] = [];
    const outgoing: PendingRequest[] = [];
    for (const e of edges) {
      const oid = otherUserId(e, userId);
      const user = others.get(oid) ?? fallback(oid);
      const kind = classifyEdge(e, userId);
      if (kind === "friend") friends.push({ friendship_id: e.id, user, since: e.accepted_at });
      else if (kind === "incoming")
        incoming.push({ friendship_id: e.id, user, created_at: e.created_at });
      else if (kind === "outgoing")
        outgoing.push({ friendship_id: e.id, user, created_at: e.created_at });
    }
    friends.sort((a, b) => a.user.name.localeCompare(b.user.name));

    return {
      me: { friend_code: friendCode, username: me?.username ?? null },
      friends,
      incoming,
      outgoing,
    };
  });

// ── searchUsers ──────────────────────────────────────────────────────────────
// Por friend_code (exato) ou username (prefixo). Service role + whitelist.
// Sanitiza a entrada pra evitar wildcards/injeção no filtro.
export const searchUsers = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ q: z.string().trim().min(2).max(40) }).parse(input))
  .handler(async ({ context, data }): Promise<SearchResult[]> => {
    const { supabase, userId } = context;
    const admin = await getAdmin();

    const sanitized = data.q.replace(/[^a-zA-Z0-9_]/g, "");
    if (sanitized.length < 2) return [];
    const ilikePattern = `${sanitized.replace(/[%_]/g, "\\$&")}%`;

    // Duas queries parametrizadas (eq/ilike são URL-encodadas pelo supabase-js).
    const [byCode, byName] = await Promise.all([
      admin
        .from("profiles")
        .select(PUBLIC_PROFILE_FIELDS)
        .eq("friend_code", sanitized.toUpperCase())
        .neq("id", userId)
        .limit(5),
      admin
        .from("profiles")
        .select(PUBLIC_PROFILE_FIELDS)
        .ilike("username", ilikePattern)
        .neq("id", userId)
        .limit(12),
    ]);

    const byId = new Map<string, ProfileRow>();
    for (const p of [...(byCode.data ?? []), ...(byName.data ?? [])] as ProfileRow[]) {
      byId.set(p.id, p);
    }
    const profiles = [...byId.values()];
    if (profiles.length === 0) return [];

    // Status do relacionamento com cada resultado (user-scoped, RLS escopa a mim).
    const { data: edgeData } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, accepted_at, created_at");
    const edges = (edgeData ?? []) as RawEdge[];

    return profiles
      .map((p) => ({ user: toFriendUser(p), status: relationshipStatus(edges, userId, p.id) }))
      .slice(0, 12);
  });

// ── sendFriendRequest ────────────────────────────────────────────────────────
// Por addressee_id (vindo da busca) ou friend_code. Se o outro já me enviou um
// pedido, isso ACEITA em vez de duplicar.
export const sendFriendRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        addressee_id: z.string().uuid().optional(),
        friend_code: z.string().trim().max(20).optional(),
      })
      .refine((v) => v.addressee_id || v.friend_code, { message: "missing_target" })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ status: "sent" | "accepted" }> => {
    const { supabase, userId } = context;
    const admin = await getAdmin();

    // Resolve o alvo.
    let targetId = data.addressee_id ?? null;
    if (!targetId && data.friend_code) {
      const code = data.friend_code.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
      const { data: t } = await admin
        .from("profiles")
        .select("id")
        .eq("friend_code", code)
        .maybeSingle();
      targetId = t?.id ?? null;
    }
    if (!targetId) throw new Error("user_not_found");
    if (targetId === userId) throw new Error("cannot_friend_self");

    // Rótulo do remetente pra notificação (@username ou nome).
    const { data: meProfile } = await admin
      .from("profiles")
      .select("name, username")
      .eq("id", userId)
      .maybeSingle();
    const senderLabel = meProfile?.username
      ? `@${meProfile.username}`
      : meProfile?.name || "Alguém";

    // Já existe aresta entre nós?
    const { data: existingData } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status, accepted_at, created_at");
    const existing = ((existingData ?? []) as RawEdge[]).find(
      (e) =>
        (e.requester_id === userId && e.addressee_id === targetId) ||
        (e.addressee_id === userId && e.requester_id === targetId),
    );
    if (existing) {
      if (existing.status === "accepted") throw new Error("already_friends");
      if (existing.status === "pending") {
        if (existing.addressee_id === userId) {
          // Ele me enviou → aceita.
          const { error } = await supabase
            .from("friendships")
            .update({ status: "accepted", accepted_at: new Date().toISOString() })
            .eq("id", existing.id);
          if (error) serverError("Não foi possível aceitar o pedido.", error);
          await safePush(targetId, {
            category: "social",
            title: "Pedido aceito 🤝",
            body: `${senderLabel} aceitou seu pedido de amizade`,
            route: "/social",
          });
          return { status: "accepted" };
        }
        throw new Error("already_sent");
      }
    }

    const { error } = await supabase
      .from("friendships")
      .insert({ requester_id: userId, addressee_id: targetId, status: "pending" });
    if (error) {
      // Corrida → violação de unique. Trata como "já enviado".
      if ((error as { code?: string }).code === "23505") throw new Error("already_sent");
      serverError("Não foi possível enviar o pedido.", error);
    }
    await safePush(targetId, {
      category: "social",
      title: "Novo pedido de amizade",
      body: `${senderLabel} quer ser seu amigo`,
      route: "/social",
    });
    return { status: "sent" };
  });

// ── respondToRequest ─────────────────────────────────────────────────────────
export const respondToRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({ friendship_id: z.string().uuid(), action: z.enum(["accept", "decline"]) })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;

    // RLS deixa eu ver a aresta só se eu estiver envolvido.
    const { data: edge } = await supabase
      .from("friendships")
      .select("id, requester_id, addressee_id, status")
      .eq("id", data.friendship_id)
      .maybeSingle();
    if (!edge) throw new Error("request_not_found");

    if (data.action === "accept") {
      // Só o destinatário aceita, e só se ainda pendente.
      if (edge.addressee_id !== userId || edge.status !== "pending")
        throw new Error("cannot_accept");
      const { error } = await supabase
        .from("friendships")
        .update({ status: "accepted", accepted_at: new Date().toISOString() })
        .eq("id", data.friendship_id);
      if (error) serverError("Não foi possível aceitar o pedido.", error);
      return { ok: true };
    }

    // decline = recusar (destinatário) ou cancelar (remetente) → apaga a aresta.
    const { error } = await supabase.from("friendships").delete().eq("id", data.friendship_id);
    if (error) serverError("Não foi possível recusar o pedido.", error);
    return { ok: true };
  });

// ── removeFriend ─────────────────────────────────────────────────────────────
export const removeFriend = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ friendship_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    // RLS DELETE exige envolvimento; reforçamos por id (+ filtro defensivo).
    const { error } = await supabase
      .from("friendships")
      .delete()
      .eq("id", data.friendship_id)
      .or(`requester_id.eq.${userId},addressee_id.eq.${userId}`);
    if (error) serverError("Não foi possível remover a amizade.", error);
    return { ok: true };
  });
