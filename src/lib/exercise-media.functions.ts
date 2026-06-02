import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Admin guard
// ============================================================
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

// ============================================================
// Public: meu papel (usado pelo app shell pra mostrar link admin)
// ============================================================
export const getMyRole = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<{ isAdmin: boolean }> => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();
    return { isAdmin: !!data };
  });

// ============================================================
// Estudante: vídeo aprovado primário + alternativas
// ============================================================
export interface ExerciseDetailDTO {
  exercise: {
    id: string;
    name: string;
    category: string;
    instructions: string | null;
    common_mistakes: string | null;
    primary_muscles: string[];
  };
  primary_media: ExerciseMediaDTO | null;
  alternatives: ExerciseMediaDTO[];
}

export interface ExerciseMediaDTO {
  id: string;
  media_type: string;
  source: string | null;
  title: string | null;
  url: string | null;
  embed_url: string | null;
  thumbnail_url: string | null;
  storage_path: string | null;
  duration_seconds: number | null;
  instructor_name: string | null;
  channel_name: string | null;
  source_quality_score: number | null;
  embed_allowed: boolean;
  is_primary: boolean;
  is_approved: boolean;
  created_by_agent: boolean;
  reason_for_recommendation: string | null;
  safety_notes: string | null;
}

export const getExerciseDetail = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ exercise_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ExerciseDetailDTO> => {
    const { supabase } = context;
    const { data: ex, error: exErr } = await supabase
      .from("exercise_pool")
      .select("id,name,category,instructions,common_mistakes,primary_muscles")
      .eq("id", data.exercise_id)
      .single();
    if (exErr) throw new Error(exErr.message);

    const { data: media } = await supabase
      .from("exercise_media")
      .select("*")
      .eq("exercise_id", data.exercise_id)
      .eq("is_approved", true)
      .order("is_primary", { ascending: false })
      .order("source_quality_score", { ascending: false });

    const list = (media ?? []) as ExerciseMediaDTO[];
    const primary = list.find((m) => m.is_primary) ?? list[0] ?? null;
    const alternatives = list.filter((m) => m.id !== primary?.id);

    return {
      exercise: {
        id: ex.id,
        name: ex.name,
        category: ex.category,
        instructions: ex.instructions ?? null,
        common_mistakes: ex.common_mistakes ?? null,
        primary_muscles: (ex.primary_muscles ?? []) as string[],
      },
      primary_media: primary,
      alternatives,
    };
  });

// ============================================================
// Admin: lista de exercícios + status de vídeo
// ============================================================
export interface ExerciseRowDTO {
  id: string;
  name: string;
  category: string;
  total_candidates: number;
  approved_count: number;
  has_primary: boolean;
}

export const listExercisesWithStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<ExerciseRowDTO[]> => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { data: exercises, error } = await supabase
      .from("exercise_pool")
      .select("id,name,category")
      .order("name");
    if (error) throw new Error(error.message);

    const { data: media } = await supabase
      .from("exercise_media")
      .select("exercise_id,is_approved,is_primary");

    const byEx: Record<string, { total: number; approved: number; primary: boolean }> = {};
    for (const m of (media ?? []) as { exercise_id: string; is_approved: boolean; is_primary: boolean }[]) {
      const e = (byEx[m.exercise_id] ??= { total: 0, approved: 0, primary: false });
      e.total += 1;
      if (m.is_approved) e.approved += 1;
      if (m.is_approved && m.is_primary) e.primary = true;
    }

    return (exercises ?? []).map((e: any) => ({
      id: e.id,
      name: e.name,
      category: e.category,
      total_candidates: byEx[e.id]?.total ?? 0,
      approved_count: byEx[e.id]?.approved ?? 0,
      has_primary: byEx[e.id]?.primary ?? false,
    }));
  });

// ============================================================
// Admin: candidatos de um exercício
// ============================================================
export const listCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ exercise_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }): Promise<ExerciseMediaDTO[]> => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { data: media, error } = await supabase
      .from("exercise_media")
      .select("*")
      .eq("exercise_id", data.exercise_id)
      .order("is_approved", { ascending: false })
      .order("is_primary", { ascending: false })
      .order("source_quality_score", { ascending: false });
    if (error) throw new Error(error.message);
    return (media ?? []) as ExerciseMediaDTO[];
  });

// ============================================================
// Agent: buscar candidatos no YouTube
// ============================================================
interface YouTubeItem {
  id: { videoId: string };
  snippet: {
    title: string;
    channelTitle: string;
    description: string;
    thumbnails: { high?: { url: string }; medium?: { url: string } };
  };
}

interface YouTubeVideoDetail {
  id: string;
  contentDetails: { duration: string };
  status: { embeddable: boolean };
  statistics: { viewCount?: string; likeCount?: string };
  snippet: { channelTitle: string; title: string; description: string };
}

function parseIsoDuration(iso: string): number {
  // PT#M#S → seconds
  const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!m) return 0;
  const h = parseInt(m[1] ?? "0", 10);
  const min = parseInt(m[2] ?? "0", 10);
  const s = parseInt(m[3] ?? "0", 10);
  return h * 3600 + min * 60 + s;
}

const TRUSTED_CHANNELS = [
  "athlean-x",
  "jeff nippard",
  "squat university",
  "renaissance periodization",
  "calisthenicmovement",
  "thenx",
  "fitnessfaqs",
  "scottherman",
  "buff dudes",
  "stronger by science",
  "mind pump",
  "barbell medicine",
  "alan thrall",
  "juggernaut training",
  "rebel performance",
  "knees over toes guy",
  "global triathlon network",
  "running channel",
];

function scoreVideo(detail: YouTubeVideoDetail, durationSec: number): number {
  let score = 50;
  const channel = detail.snippet.channelTitle.toLowerCase();
  const title = detail.snippet.title.toLowerCase();

  // duration: prefer 30s-4min demos
  if (durationSec >= 30 && durationSec <= 240) score += 20;
  else if (durationSec > 240 && durationSec <= 600) score += 10;
  else if (durationSec > 1200) score -= 15;
  else if (durationSec < 20) score -= 10;

  // trusted channel boost
  if (TRUSTED_CHANNELS.some((t) => channel.includes(t))) score += 25;

  // title hints
  if (/(how to|tutorial|technique|form|execution|proper|guide|demo)/i.test(title)) score += 8;
  if (/(challenge|fail|prank|reaction|workout vlog)/i.test(title)) score -= 20;

  // views/likes
  const views = parseInt(detail.statistics.viewCount ?? "0", 10);
  if (views > 1_000_000) score += 8;
  else if (views > 100_000) score += 5;

  // embeddable mandatory
  if (!detail.status.embeddable) score -= 100;

  return Math.max(0, Math.min(100, score));
}

export const searchVideosForExercise = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        exercise_id: z.string().uuid(),
        max_results: z.number().int().min(1).max(10).default(5),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<{ saved: number; candidates: ExerciseMediaDTO[] }> => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const apiKey = process.env.YOUTUBE_API_KEY;
    if (!apiKey) throw new Error("YOUTUBE_API_KEY not configured");

    const { data: ex, error: exErr } = await supabase
      .from("exercise_pool")
      .select("id,name")
      .eq("id", data.exercise_id)
      .single();
    if (exErr) throw new Error(exErr.message);

    // Search
    const q = `${ex.name} exercise proper form technique`;
    const searchUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoEmbeddable=true&safeSearch=strict&maxResults=${data.max_results}&q=${encodeURIComponent(q)}&key=${apiKey}`;
    const searchRes = await fetch(searchUrl);
    if (!searchRes.ok) {
      const txt = await searchRes.text();
      throw new Error(`YouTube search failed: ${searchRes.status} ${txt}`);
    }
    const searchJson = (await searchRes.json()) as { items: YouTubeItem[] };
    const ids = (searchJson.items ?? []).map((it) => it.id.videoId).filter(Boolean);
    if (ids.length === 0) return { saved: 0, candidates: [] };

    // Details (need duration + embeddable + stats)
    const detailUrl = `https://www.googleapis.com/youtube/v3/videos?part=contentDetails,status,statistics,snippet&id=${ids.join(",")}&key=${apiKey}`;
    const detailRes = await fetch(detailUrl);
    if (!detailRes.ok) {
      const txt = await detailRes.text();
      throw new Error(`YouTube details failed: ${detailRes.status} ${txt}`);
    }
    const detailJson = (await detailRes.json()) as { items: YouTubeVideoDetail[] };

    // Score & upsert
    const candidates = detailJson.items.map((v) => {
      const durationSec = parseIsoDuration(v.contentDetails.duration);
      const score = scoreVideo(v, durationSec);
      const thumb =
        searchJson.items.find((s) => s.id.videoId === v.id)?.snippet.thumbnails?.high?.url ??
        searchJson.items.find((s) => s.id.videoId === v.id)?.snippet.thumbnails?.medium?.url ??
        null;
      return {
        exercise_id: data.exercise_id,
        media_type: "youtube_embed" as const,
        source: "youtube",
        external_id: v.id,
        title: v.snippet.title,
        url: `https://www.youtube.com/watch?v=${v.id}`,
        embed_url: `https://www.youtube.com/embed/${v.id}`,
        thumbnail_url: thumb,
        duration_seconds: durationSec,
        channel_name: v.snippet.channelTitle,
        instructor_name: v.snippet.channelTitle,
        source_quality_score: score,
        embed_allowed: v.status.embeddable,
        is_primary: false,
        is_approved: false,
        created_by_agent: true,
        reason_for_recommendation: `Score ${score}/100. ${TRUSTED_CHANNELS.some((t) => v.snippet.channelTitle.toLowerCase().includes(t)) ? "Canal confiável. " : ""}Duração ${durationSec}s.`,
        safety_notes:
          score < 70
            ? "Score abaixo de 70 — revisar manualmente antes de aprovar."
            : null,
      };
    });

    let saved = 0;
    const saved_rows: ExerciseMediaDTO[] = [];
    for (const c of candidates) {
      const { data: row, error } = await supabase
        .from("exercise_media")
        .upsert(c, { onConflict: "exercise_id,source,external_id", ignoreDuplicates: false })
        .select("*")
        .single();
      if (!error && row) {
        saved += 1;
        saved_rows.push(row as ExerciseMediaDTO);
      }
    }

    return { saved, candidates: saved_rows };
  });

// ============================================================
// Admin actions: approve, reject, set primary, manual add, edit cues
// ============================================================
export const approveCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z.object({ media_id: z.string().uuid(), set_primary: z.boolean().default(false) }).parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const { data: m, error } = await supabase
      .from("exercise_media")
      .update({
        is_approved: true,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .eq("id", data.media_id)
      .select("id,exercise_id")
      .single();
    if (error) throw new Error(error.message);

    if (data.set_primary) {
      // unset other primaries for the exercise
      await supabase
        .from("exercise_media")
        .update({ is_primary: false })
        .eq("exercise_id", m.exercise_id)
        .neq("id", m.id);
      await supabase
        .from("exercise_media")
        .update({ is_primary: true })
        .eq("id", m.id);
    }
    return { ok: true };
  });

export const rejectCandidate = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ media_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await supabase.from("exercise_media").delete().eq("id", data.media_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setPrimaryMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => z.object({ media_id: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { data: m, error } = await supabase
      .from("exercise_media")
      .select("id,exercise_id,is_approved")
      .eq("id", data.media_id)
      .single();
    if (error) throw new Error(error.message);
    if (!m.is_approved) throw new Error("Aprove o candidato antes de marcar como primário.");

    await supabase
      .from("exercise_media")
      .update({ is_primary: false })
      .eq("exercise_id", m.exercise_id);
    await supabase
      .from("exercise_media")
      .update({ is_primary: true })
      .eq("id", data.media_id);
    return { ok: true };
  });

export const addManualMedia = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        exercise_id: z.string().uuid(),
        url: z.string().url(),
        title: z.string().min(1).max(200).optional(),
        instructor_name: z.string().max(200).optional(),
        set_primary: z.boolean().default(false),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    // Detect YouTube
    type MType = "external_video" | "youtube_embed" | "vimeo_embed";
    let media_type: MType = "external_video";
    let embed_url: string | null = null;
    let external_id: string | null = null;
    let source = "external";
    const yt = /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([\w-]{11})/.exec(data.url);
    if (yt) {
      media_type = "youtube_embed";
      external_id = yt[1];
      embed_url = `https://www.youtube.com/embed/${yt[1]}`;
      source = "youtube";
    } else {
      const vimeo = /vimeo\.com\/(\d+)/.exec(data.url);
      if (vimeo) {
        media_type = "vimeo_embed";
        external_id = vimeo[1];
        embed_url = `https://player.vimeo.com/video/${vimeo[1]}`;
        source = "vimeo";
      }
    }

    const { data: row, error } = await supabase
      .from("exercise_media")
      .insert({
        exercise_id: data.exercise_id,
        media_type,
        source,
        external_id,
        title: data.title ?? null,
        url: data.url,
        embed_url,
        instructor_name: data.instructor_name ?? null,
        embed_allowed: !!embed_url,
        is_approved: true,
        is_primary: data.set_primary,
        created_by_agent: false,
        reviewed_by: userId,
        reviewed_at: new Date().toISOString(),
      })
      .select("id,exercise_id")
      .single();
    if (error) throw new Error(error.message);

    if (data.set_primary) {
      await supabase
        .from("exercise_media")
        .update({ is_primary: false })
        .eq("exercise_id", row.exercise_id)
        .neq("id", row.id);
    }
    return { ok: true, id: row.id };
  });

export const updateExerciseCues = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        exercise_id: z.string().uuid(),
        instructions: z.string().max(4000).optional(),
        common_mistakes: z.string().max(4000).optional(),
        primary_muscles: z.array(z.string().min(1).max(60)).max(20).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const patch: {
      instructions?: string;
      common_mistakes?: string;
      primary_muscles?: string[];
    } = {};
    if (data.instructions !== undefined) patch.instructions = data.instructions;
    if (data.common_mistakes !== undefined) patch.common_mistakes = data.common_mistakes;
    if (data.primary_muscles !== undefined) patch.primary_muscles = data.primary_muscles;
    if (Object.keys(patch).length === 0) return { ok: true };

    const { error } = await supabase.from("exercise_pool").update(patch).eq("id", data.exercise_id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
