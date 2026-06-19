import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// ============================================================
// Ajuste de semana — o sistema se adapta ao usuário (não o contrário).
// skipNextWorkout: marca o PRÓXIMO treino pendente da semana ativa como
// resolvido (completed_at = now), tirando-o da fila sem recriar nada.
// Mutação bounded e segura (RLS td_modify_own garante que é o próprio).
// Reorganização "de verdade" é roteada pro Pedro (orquestração com prévia).
// ============================================================
export interface SkipNextResult {
  ok: boolean;
  skipped_day?: string | null;
  error?: string;
}

export const skipNextWorkout = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<SkipNextResult> => {
    try {
      const { data: prog } = await context.supabase
        .from("training_programs")
        .select("id, active_week")
        .eq("user_id", context.userId)
        .is("archived_at", null)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!prog) return { ok: false, error: "Nenhum programa ativo." };
      const p = prog as { id: string; active_week: number | null };

      const { data: wk } = await context.supabase
        .from("weeks")
        .select("id")
        .eq("program_id", p.id)
        .eq("week_number", p.active_week ?? 1)
        .maybeSingle();
      if (!wk) return { ok: false, error: "Semana ativa não encontrada." };

      const { data: days } = await context.supabase
        .from("training_days")
        .select("id, day_name, session_type, completed_at, day_number")
        .eq("week_id", (wk as { id: string }).id)
        .order("day_number", { ascending: true });

      const next = (days ?? []).find((d) => {
        const r = d as { session_type: string; completed_at: string | null };
        return r.completed_at == null && r.session_type !== "rest";
      }) as { id: string; day_name: string | null } | undefined;
      if (!next) return { ok: false, error: "Nenhum treino pendente para pular." };

      const { error } = await context.supabase
        .from("training_days")
        .update({ completed_at: new Date().toISOString() })
        .eq("id", next.id);
      if (error) return { ok: false, error: "Não foi possível pular o treino." };

      return { ok: true, skipped_day: next.day_name };
    } catch {
      return { ok: false, error: "Não foi possível ajustar a semana." };
    }
  });
