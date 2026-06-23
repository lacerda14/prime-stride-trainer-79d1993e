import { describe, it, expect } from "vitest";
import {
  classifyEdge,
  otherUserId,
  relationshipStatus,
  displayName,
  toFriendUser,
  type RawEdge,
  type ProfileRow,
} from "./friends.logic";

const ME = "11111111-1111-1111-1111-111111111111";
const OTHER = "22222222-2222-2222-2222-222222222222";

function edge(over: Partial<RawEdge>): RawEdge {
  return {
    id: "e1",
    requester_id: ME,
    addressee_id: OTHER,
    status: "pending",
    accepted_at: null,
    created_at: "2026-06-19T00:00:00Z",
    ...over,
  };
}

describe("otherUserId — sempre o lado oposto a mim", () => {
  it("eu sou requester → retorna addressee", () => {
    expect(otherUserId(edge({ requester_id: ME, addressee_id: OTHER }), ME)).toBe(OTHER);
  });
  it("eu sou addressee → retorna requester", () => {
    expect(otherUserId(edge({ requester_id: OTHER, addressee_id: ME }), ME)).toBe(OTHER);
  });
});

describe("classifyEdge — ponto de vista do usuário atual", () => {
  it("accepted → friend (independe da direção)", () => {
    expect(classifyEdge(edge({ status: "accepted" }), ME)).toBe("friend");
    expect(
      classifyEdge(edge({ status: "accepted", requester_id: OTHER, addressee_id: ME }), ME),
    ).toBe("friend");
  });
  it("pending e EU sou o destinatário → incoming", () => {
    expect(
      classifyEdge(edge({ status: "pending", requester_id: OTHER, addressee_id: ME }), ME),
    ).toBe("incoming");
  });
  it("pending e EU sou o remetente → outgoing", () => {
    expect(
      classifyEdge(edge({ status: "pending", requester_id: ME, addressee_id: OTHER }), ME),
    ).toBe("outgoing");
  });
  it("blocked → other", () => {
    expect(classifyEdge(edge({ status: "blocked" }), ME)).toBe("other");
  });
});

describe("relationshipStatus — status com um usuário específico", () => {
  it("sem aresta → none", () => {
    expect(relationshipStatus([], ME, OTHER)).toBe("none");
  });
  it("aceito (qualquer direção) → friends", () => {
    expect(
      relationshipStatus(
        [edge({ status: "accepted", requester_id: OTHER, addressee_id: ME })],
        ME,
        OTHER,
      ),
    ).toBe("friends");
  });
  it("eu enviei, pendente → outgoing", () => {
    expect(
      relationshipStatus(
        [edge({ status: "pending", requester_id: ME, addressee_id: OTHER })],
        ME,
        OTHER,
      ),
    ).toBe("outgoing");
  });
  it("ele enviou, pendente → incoming", () => {
    expect(
      relationshipStatus(
        [edge({ status: "pending", requester_id: OTHER, addressee_id: ME })],
        ME,
        OTHER,
      ),
    ).toBe("incoming");
  });
  it("ignora arestas de terceiros (só importa a que envolve os dois)", () => {
    const third = "33333333-3333-3333-3333-333333333333";
    const edges = [
      edge({ id: "x", status: "accepted", requester_id: ME, addressee_id: third }),
      edge({ id: "y", status: "pending", requester_id: ME, addressee_id: OTHER }),
    ];
    expect(relationshipStatus(edges, ME, OTHER)).toBe("outgoing");
  });
});

describe("displayName — precedência name > first+last > username > Atleta", () => {
  const base: Pick<ProfileRow, "name" | "first_name" | "last_name" | "username"> = {
    name: null,
    first_name: null,
    last_name: null,
    username: null,
  };
  it("usa name quando presente", () => {
    expect(displayName({ ...base, name: "Pedro", first_name: "X", username: "pm" })).toBe("Pedro");
  });
  it("cai pra first + last", () => {
    expect(displayName({ ...base, first_name: "Ana", last_name: "Lima" })).toBe("Ana Lima");
  });
  it("cai pra username", () => {
    expect(displayName({ ...base, username: "analima" })).toBe("analima");
  });
  it("fallback final → Atleta", () => {
    expect(displayName(base)).toBe("Atleta");
  });
});

describe("toFriendUser — level com fallback", () => {
  it("level null vira 1", () => {
    const p: ProfileRow = {
      id: OTHER,
      name: "Bia",
      first_name: null,
      last_name: null,
      username: "bia",
      avatar_url: null,
      level: null,
    };
    expect(toFriendUser(p)).toEqual({
      id: OTHER,
      name: "Bia",
      username: "bia",
      avatar_url: null,
      level: 1,
    });
  });
});
