import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export interface SwapSuggestion {
  id: string;
  name: string;
  category: string;
  equipment: string | null;
  movement_pattern: string | null;
  primary_muscles: string[];
  shoulder_safe: boolean;
  reason: string;
  score: number;
}

/**
 * Sugere exercícios alternativos com biomecânica semelhante ao atual.
 * Critérios (em ordem):
 *  1. Mesma `category` (chest/back/legs/core/…)
 *  2. Mesmo `movement_pattern` quando existir (push-horizontal, hinge, …)
 *  3. Compatível com o nível do usuário
 *  4. Equipamento DIFERENTE do atual (resolve aparelho ocupado), com
 *     fallback para o mesmo se sobrar pouca coisa.
 *  5. Maior overlap de `primary_muscles`.
 *  6. Prioriza `shoulder_safe` se o original também for.
 */
export const suggestExerciseSwaps = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        exercise_id: z.string().uuid(),
        limit: z.number().int().min(1).max(10).optional(),
      })
      .parse(input),
  )
  .handler(async ({ data, context }): Promise<SwapSuggestion[]> => {
    const { supabase, userId } = context;

    const { data: current, error: cErr } = await supabase
      .from("exercise_pool")
      .select(
        "id, name, category, equipment, movement_pattern, primary_muscles, shoulder_safe",
      )
      .eq("id", data.exercise_id)
      .maybeSingle();
    if (cErr) throw new Error(cErr.message);
    if (!current) return [];

    const { data: profile } = await supabase
      .from("profiles")
      .select("experience_level, equipment")
      .eq("id", userId)
      .maybeSingle();

    const level = profile?.experience_level ?? "intermediate";
    const userEquip = new Set<string>((profile?.equipment ?? []) as string[]);

    let q = supabase
      .from("exercise_pool")
      .select(
        "id, name, category, equipment, movement_pattern, primary_muscles, shoulder_safe, allowed_beginner, allowed_intermediate, allowed_advanced",
      )
      .eq("category", current.category)
      .neq("id", current.id)
      .eq("banned_weeks_1_to_12", false);

    if (level === "beginner") q = q.eq("allowed_beginner", true);
    else if (level === "intermediate") q = q.eq("allowed_intermediate", true);
    else if (level === "advanced") q = q.eq("allowed_advanced", true);

    const { data: pool, error: pErr } = await q;
    if (pErr) throw new Error(pErr.message);

    const currentMuscles = new Set<string>(current.primary_muscles ?? []);

    const scored = (pool ?? []).map((e) => {
      const muscles = new Set<string>(e.primary_muscles ?? []);
      const overlap = [...muscles].filter((m) => currentMuscles.has(m)).length;
      const sameMovement = e.movement_pattern && current.movement_pattern
        ? e.movement_pattern === current.movement_pattern
        : true;
      const differentEquip = (e.equipment ?? "") !== (current.equipment ?? "");
      const hasUserEquip = e.equipment ? userEquip.has(e.equipment) || userEquip.size === 0 : true;
      const shoulderOk = current.shoulder_safe ? e.shoulder_safe : true;

      let score = 0;
      if (sameMovement) score += 50;
      score += overlap * 15;
      if (differentEquip) score += 20; // resolve aparelho tomado
      if (hasUserEquip) score += 10;
      if (shoulderOk) score += 5;

      const reasonBits: string[] = [];
      if (sameMovement && current.movement_pattern) reasonBits.push("mesmo padrão");
      if (overlap > 0) reasonBits.push(`${overlap} músculo(s) em comum`);
      if (differentEquip) reasonBits.push("equipamento diferente");

      return {
        id: e.id,
        name: e.name,
        category: e.category,
        equipment: e.equipment ?? null,
        movement_pattern: e.movement_pattern ?? null,
        primary_muscles: (e.primary_muscles ?? []) as string[],
        shoulder_safe: !!e.shoulder_safe,
        reason: reasonBits.join(" · ") || "Alternativa do mesmo grupo",
        score,
      };
    });

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, data.limit ?? 5);
  });
