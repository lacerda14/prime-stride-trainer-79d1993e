import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, ArrowRightLeft, X } from "lucide-react";
import { suggestExerciseSwaps, type SwapSuggestion } from "@/lib/exercise-swap.functions";

interface Props {
  open: boolean;
  exerciseId: string | null;
  exerciseName: string;
  /** IDs já presentes no treino — removidos das sugestões (sem repetidos). */
  excludeIds?: string[];
  onClose: () => void;
  onSelect: (swap: SwapSuggestion) => void;
}

export function ExerciseSwapSheet({ open, exerciseId, exerciseName, excludeIds = [], onClose, onSelect }: Props) {
  const fetchSwaps = useServerFn(suggestExerciseSwaps);
  const q = useQuery({
    queryKey: ["exercise-swaps", exerciseId],
    queryFn: () => fetchSwaps({ data: { exercise_id: exerciseId!, limit: 12 } }),
    enabled: !!exerciseId && open,
    staleTime: 60_000,
  });
  // Filtra exercícios que já estão no treino (regra: sem repetidos).
  const exclude = new Set(excludeIds);
  const suggestions = (q.data ?? []).filter((s) => !exclude.has(s.id));

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-end justify-center bg-background/80 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div
        className="glass-strong w-full max-w-[480px] rounded-t-3xl border-t border-border p-5 pb-[max(env(safe-area-inset-bottom),20px)]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-muted-foreground">
              Trocar exercício
            </div>
            <h3 className="mt-1 text-base font-semibold leading-tight tracking-tight">
              {exerciseName}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-border bg-surface/60 text-muted-foreground"
            aria-label="Fechar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {q.isLoading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        ) : suggestions.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Nenhuma alternativa equivalente disponível (as demais já estão no treino).
          </div>
        ) : (
          <ul className="max-h-[60vh] space-y-2 overflow-y-auto pr-1">
            {suggestions.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => onSelect(s)}
                  className="flex w-full items-start gap-3 rounded-2xl border border-border bg-surface/40 p-4 text-left transition-colors active:bg-surface/80"
                >
                  <ArrowRightLeft className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold tracking-tight">{s.name}</div>
                    <div className="mt-1 flex flex-wrap gap-1.5 text-[10px] uppercase tracking-wider text-muted-foreground">
                      {s.equipment && (
                        <span className="rounded-full border border-border/60 px-2 py-0.5">
                          {s.equipment}
                        </span>
                      )}
                      {s.primary_muscles.slice(0, 3).map((m) => (
                        <span key={m} className="rounded-full border border-border/60 px-2 py-0.5">
                          {m}
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 text-[11px] text-muted-foreground">{s.reason}</div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
