// src/lib/friends.logic.ts
// =============================================================================
// Lógica pura de amizades (sem I/O nem deps de server) — testável isolada.
// Os server functions (friends.functions.ts) compõem em cima disto.
// =============================================================================

export interface FriendUser {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
  level: number;
}
export interface FriendEdge {
  friendship_id: string;
  user: FriendUser;
  since: string | null; // accepted_at
}
export interface PendingRequest {
  friendship_id: string;
  user: FriendUser;
  created_at: string;
}
export interface FriendsOverview {
  me: { friend_code: string | null; username: string | null };
  friends: FriendEdge[];
  incoming: PendingRequest[];
  outgoing: PendingRequest[];
}
export type RelationshipStatus = "none" | "friends" | "incoming" | "outgoing";
export interface SearchResult {
  user: FriendUser;
  status: RelationshipStatus;
}

export interface RawEdge {
  id: string;
  requester_id: string;
  addressee_id: string;
  status: string;
  accepted_at: string | null;
  created_at: string;
}

export interface ProfileRow {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
  level: number | null;
}

/** Quem é o "outro" lado da aresta em relação a mim. */
export function otherUserId(
  e: Pick<RawEdge, "requester_id" | "addressee_id">,
  myId: string,
): string {
  return e.requester_id === myId ? e.addressee_id : e.requester_id;
}

/** Classifica a aresta do ponto de vista do usuário atual. */
export function classifyEdge(
  e: RawEdge,
  myId: string,
): "friend" | "incoming" | "outgoing" | "other" {
  if (e.status === "accepted") return "friend";
  if (e.status === "pending") return e.addressee_id === myId ? "incoming" : "outgoing";
  return "other"; // blocked
}

/** Status do relacionamento com um usuário específico, dado meu conjunto de arestas. */
export function relationshipStatus(
  edges: RawEdge[],
  myId: string,
  otherId: string,
): RelationshipStatus {
  const e = edges.find(
    (x) =>
      (x.requester_id === myId && x.addressee_id === otherId) ||
      (x.addressee_id === myId && x.requester_id === otherId),
  );
  if (!e) return "none";
  if (e.status === "accepted") return "friends";
  if (e.status === "pending") return e.addressee_id === myId ? "incoming" : "outgoing";
  return "none";
}

/** Nome de exibição (mesma regra do feed). */
export function displayName(
  p: Pick<ProfileRow, "name" | "first_name" | "last_name" | "username">,
): string {
  return p.name || [p.first_name, p.last_name].filter(Boolean).join(" ") || p.username || "Atleta";
}

export function toFriendUser(p: ProfileRow): FriendUser {
  return {
    id: p.id,
    name: displayName(p),
    username: p.username,
    avatar_url: p.avatar_url,
    level: p.level ?? 1,
  };
}
