import { useNavigate } from "@tanstack/react-router";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { X, SkipForward, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { skipNextWorkout } from "@/lib/week-adjust.functions";

// Sheet de ajuste de semana — controle do usuário sobre a programação.
// "Pular o próximo treino" (mutação segura) + "Reorganizar com o Pedro"
// (abre o coach geral com o pedido pronto → proposta com prévia).
export function WeekAdjustSheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const skip = useServerFn(skipNextWorkout);

  const skipMut = useMutation({
    mutationFn: () => skip(),
    onSuccess: (res) => {
      if (res.ok) {
        toast.success(
          res.skipped_day ? `Treino de ${res.skipped_day} pulado` : "Próximo treino pulado",
          { description: "Tirei ele da fila desta semana." },
        );
        qc.invalidateQueries({ queryKey: ["program"] });
        qc.invalidateQueries({ queryKey: ["training-program"] });
        qc.invalidateQueries({ queryKey: ["today-workout"] });
        qc.invalidateQueries({ queryKey: ["week"] });
        onClose();
      } else {
        toast.error(res.error ?? "Não consegui pular agora.");
      }
    },
    onError: () => toast.error("Não consegui pular agora."),
  });

  const askPedro = () => {
    try {
      sessionStorage.setItem(
        "pm_coach_prefill",
        "Treinei fora do meu dia programado. Pode reorganizar o restante da minha semana mantendo o equilíbrio do plano?",
      );
    } catch { /* ignore */ }
    onClose();
    navigate({ to: "/coach-chat", search: { persona: "general" } });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-t-3xl border border-border/60 bg-background p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <div className="text-[16px] font-semibold tracking-tight">Ajustar minha semana</div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">Treinou fora do plano? O sistema se adapta a você.</div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2.5">
          <button
            onClick={askPedro}
            className="flex w-full items-center gap-3 rounded-2xl border border-primary/40 bg-primary/[0.07] px-4 py-3.5 text-left active:scale-[0.99]"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/15">
              <Sparkles className="h-4.5 w-4.5 text-primary" />
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold tracking-tight">Reorganizar com o Pedro</span>
              <span className="block text-[12px] text-muted-foreground">Ele remonta o resto da semana e te mostra a prévia antes.</span>
            </span>
          </button>

          <button
            onClick={() => skipMut.mutate()}
            disabled={skipMut.isPending}
            className="flex w-full items-center gap-3 rounded-2xl border border-border bg-surface/40 px-4 py-3.5 text-left active:scale-[0.99] disabled:opacity-60"
          >
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface-elevated">
              {skipMut.isPending ? <Loader2 className="h-4.5 w-4.5 animate-spin" /> : <SkipForward className="h-4.5 w-4.5" />}
            </span>
            <span className="min-w-0">
              <span className="block text-[14px] font-semibold tracking-tight">Pular o próximo treino</span>
              <span className="block text-[12px] text-muted-foreground">Tira o próximo treino programado da fila desta semana.</span>
            </span>
          </button>
        </div>

        <button onClick={onClose} className="mt-4 w-full py-2 text-center text-[13px] font-medium text-muted-foreground">
          Manter programação
        </button>
      </div>
    </div>
  );
}
