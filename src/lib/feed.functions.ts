// src/lib/feed.functions.ts
// =============================================================================
// Feed social (Pro-only, baseado em amigos). A RLS (migration 64) é o boundary
// primário: SELECT/INSERT só Pro + autor/amigo. Aqui adicionamos gate explícito
// (erro limpo "pro_required") + montagem do DTO (autor, stats do treino, reações,
// signed URL da foto). Fotos: cliente sobe em feed-photos/{userId}/..., manda o path.
// =============================================================================

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { isOwnerEmail } from "@/lib/owner";
import { serverError } from "@/lib/server-errors";

const REACTION_EMOJIS = ["fire", "muscle", "clap", "rocket", "heart"] as const;
type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

export interface FeedAuthor {
  id: string;
  name: string;
  username: string | null;
  avatar_url: string | null;
}
export interface FeedWorkout {
  week_number: number;
  day_key: string;
  duration_min: number | null;
  completed_at: string | null;
}
export interface FeedPostDTO {
  id: string;
  author: FeedAuthor;
  is_mine: boolean;
  kind: "workout" | "check_in";
  caption: string | null;
  photo_url: string | null;
  workout: FeedWorkout | null;
  reactions: { emoji: string; count: number }[];
  my_reaction: string | null;
  reaction_total: number;
  comment_count: number;
  created_at: string;
}

// Shape dos rows dos selects (o client tipado não infere selects relacionais
// profundos — cast explícito, padrão pragmático já usado no projeto).
interface FeedRow {
  id: string;
  user_id: string;
  kind: "workout" | "check_in";
  caption: string | null;
  photo_path: string | null;
  created_at: string;
  workout: {
    week_number: number;
    day_key: string;
    duration_min: number | null;
    completed_at: string | null;
  } | null;
  feed_reactions: { emoji: string; user_id: string }[];
  feed_comments: { count: number }[];
}
interface ProfileRow {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

// ── Gate de Pro (defesa + erro limpo) ────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function assertPro(supabase: any, claims: { email?: string } | undefined, userId: string) {
  if (isOwnerEmail(claims?.email)) return; // owner = sempre Pro
  const { data, error } = await supabase
    .from("subscriptions")
    .select("plan,billing_status")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) serverError("Não foi possível verificar seu plano.", error);
  const plan = data?.plan;
  const status = data?.billing_status;
  const isPro =
    status === "trialing" || ((plan === "pro" || plan === "premium_ai") && status === "active");
  if (!isPro) throw new Error("pro_required");
}

// ── listFeed ─────────────────────────────────────────────────────────────────
export const listFeed = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<FeedPostDTO[]> => {
    const { supabase, userId, claims } = context;
    await assertPro(supabase, claims as { email?: string } | undefined, userId);

    // RLS já escopa pra (Pro E (próprio OU amigo)). Posts + reações + nº comentários.
    const { data, error } = await supabase
      .from("feed_posts")
      .select(
        "id, user_id, kind, caption, photo_path, created_at, " +
          "workout:workout_sessions(week_number, day_key, duration_min, completed_at), " +
          "feed_reactions(emoji, user_id), feed_comments(count)",
      )
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) serverError("Não foi possível carregar o feed.", error);
    const rows = (data ?? []) as unknown as FeedRow[];
    if (rows.length === 0) return [];

    // Autores (1 query, sem N+1).
    const authorIds = [...new Set(rows.map((p) => p.user_id))];
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, name, first_name, last_name, username, avatar_url")
      .in("id", authorIds);
    const authorById = new Map<string, FeedAuthor>(
      ((profiles ?? []) as unknown as ProfileRow[]).map((pr) => [
        pr.id,
        {
          id: pr.id,
          name:
            pr.name ||
            [pr.first_name, pr.last_name].filter(Boolean).join(" ") ||
            pr.username ||
            "Atleta",
          username: pr.username,
          avatar_url: pr.avatar_url,
        },
      ]),
    );

    // Signed URLs das fotos (service role; os posts já passaram pela RLS).
    const withPhotos = rows.filter((p): p is FeedRow & { photo_path: string } => !!p.photo_path);
    const photoUrlByPost = new Map<string, string>();
    if (withPhotos.length > 0) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await Promise.all(
        withPhotos.map(async (p) => {
          const { data: signed } = await supabaseAdmin.storage
            .from("feed-photos")
            .createSignedUrl(p.photo_path, 60 * 60);
          if (signed?.signedUrl) photoUrlByPost.set(p.id, signed.signedUrl);
        }),
      );
    }

    return rows.map((p): FeedPostDTO => {
      const counts = new Map<string, number>();
      let mine: string | null = null;
      for (const r of p.feed_reactions ?? []) {
        counts.set(r.emoji, (counts.get(r.emoji) ?? 0) + 1);
        if (r.user_id === userId) mine = r.emoji;
      }
      return {
        id: p.id,
        author: authorById.get(p.user_id) ?? {
          id: p.user_id,
          name: "Atleta",
          username: null,
          avatar_url: null,
        },
        is_mine: p.user_id === userId,
        kind: p.kind,
        caption: p.caption,
        photo_url: photoUrlByPost.get(p.id) ?? null,
        workout: p.workout
          ? {
              week_number: p.workout.week_number,
              day_key: p.workout.day_key,
              duration_min: p.workout.duration_min,
              completed_at: p.workout.completed_at,
            }
          : null,
        reactions: [...counts.entries()].map(([emoji, count]) => ({ emoji, count })),
        my_reaction: mine,
        reaction_total: (p.feed_reactions ?? []).length,
        comment_count: p.feed_comments?.[0]?.count ?? 0,
        created_at: p.created_at,
      };
    });
  });

// ── createPost ───────────────────────────────────────────────────────────────
export const createPost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        caption: z.string().trim().max(500).optional(),
        photo_path: z.string().max(500).optional(),
        workout_session_id: z.string().uuid().optional(),
      })
      .refine((v) => v.caption || v.photo_path || v.workout_session_id, {
        message: "empty_post",
      })
      .parse(input),
  )
  .handler(async ({ context, data }): Promise<{ id: string }> => {
    const { supabase, userId, claims } = context;
    await assertPro(supabase, claims as { email?: string } | undefined, userId);

    const { data: row, error } = await supabase
      .from("feed_posts")
      .insert({
        user_id: userId,
        kind: data.workout_session_id ? "workout" : "check_in",
        caption: data.caption || null,
        photo_path: data.photo_path || null,
        workout_session_id: data.workout_session_id || null,
      })
      .select("id")
      .single();
    if (error) serverError("Não foi possível publicar.", error);
    return { id: row!.id };
  });

// ── toggleReaction ───────────────────────────────────────────────────────────
export const toggleReaction = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ post_id: z.string().uuid(), emoji: z.enum(REACTION_EMOJIS) }).parse(input),
  )
  .handler(async ({ context, data }): Promise<{ my_reaction: string | null }> => {
    const { supabase, userId, claims } = context;
    await assertPro(supabase, claims as { email?: string } | undefined, userId);

    const { data: existing } = await supabase
      .from("feed_reactions")
      .select("id, emoji")
      .eq("post_id", data.post_id)
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      if (existing.emoji === data.emoji) {
        const { error } = await supabase.from("feed_reactions").delete().eq("id", existing.id);
        if (error) serverError("Não foi possível reagir.", error);
        return { my_reaction: null };
      }
      const { error } = await supabase
        .from("feed_reactions")
        .update({ emoji: data.emoji })
        .eq("id", existing.id);
      if (error) serverError("Não foi possível reagir.", error);
      return { my_reaction: data.emoji };
    }
    const { error } = await supabase
      .from("feed_reactions")
      .insert({ post_id: data.post_id, user_id: userId, emoji: data.emoji });
    if (error) serverError("Não foi possível reagir.", error);
    return { my_reaction: data.emoji };
  });

// ── deletePost (próprio) ─────────────────────────────────────────────────────
export const deletePost = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ post_id: z.string().uuid() }).parse(input))
  .handler(async ({ context, data }): Promise<{ ok: true }> => {
    const { supabase, userId } = context;
    const { error } = await supabase
      .from("feed_posts")
      .delete()
      .eq("id", data.post_id)
      .eq("user_id", userId);
    if (error) serverError("Não foi possível apagar o post.", error);
    return { ok: true };
  });

export type { ReactionEmoji };
export { REACTION_EMOJIS };
