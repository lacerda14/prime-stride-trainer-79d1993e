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

export interface KnowledgeDoc {
  id: string;
  title: string;
  source_type: string;
  author: string | null;
  language: string;
  chunk_count: number;
  is_active: boolean;
  created_at: string;
  tags: string[];
}

export const listKnowledgeDocs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { search?: string }) =>
    z.object({ search: z.string().optional() }).parse(input ?? {})
  )
  .handler(async ({ data, context }): Promise<KnowledgeDoc[]> => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);

    const sb = supabase as any;
    let q = sb
      .from("knowledge_documents")
      .select("id,title,source_type,author,language,chunk_count,is_active,created_at,tags")
      .order("created_at", { ascending: false })
      .limit(100);
    if (data.search) q = q.ilike("title", `%${data.search}%`);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return (rows ?? []) as KnowledgeDoc[];
  });

export const deleteKnowledgeDoc = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) =>
    z.object({ id: z.string().uuid() }).parse(input)
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    await ensureAdmin(supabase, userId);
    const { error } = await (supabase as any).from("knowledge_documents").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });
