import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Loader2, VideoOff, X } from "lucide-react";
import { getExerciseDetail } from "@/lib/exercise-media.functions";

// Remove link externo e branding do YouTube no embed
function sanitizeEmbedUrl(url: string): string {
  try {
    const u = new URL(url);
    u.searchParams.set("rel", "0");
    u.searchParams.set("modestbranding", "1");
    u.searchParams.set("playsinline", "1");
    u.searchParams.delete("autoplay");
    return u.toString();
  } catch {
    return url;
  }
}

interface Props {
  exerciseId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ExerciseDetailModal({ exerciseId, open, onOpenChange }: Props) {
  const fetchDetail = useServerFn(getExerciseDetail);
  const { data, isLoading } = useQuery({
    queryKey: ["exercise-detail", exerciseId],
    queryFn: () => fetchDetail({ data: { exercise_id: exerciseId! } }),
    enabled: !!exerciseId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] max-h-[90vh] overflow-y-auto bg-background border-border/60 p-0">
        {/* Cabeçalho com o ÚNICO botão de fechar — separado do vídeo pra não
            confundir com a UI/link do YouTube. Fechar volta pra tela de origem. */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/40 bg-background/95 px-4 py-3 backdrop-blur-sm">
          <DialogTitle className="truncate text-base font-semibold tracking-tight">
            {data?.exercise.name ?? "Exercício"}
          </DialogTitle>
          <button
            onClick={() => onOpenChange(false)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface/70 text-foreground transition-colors hover:bg-surface focus:outline-none"
            aria-label="Fechar e voltar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading || !data ? (
          <div className="flex h-64 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div>
            {/* Video (sem botão sobreposto) */}
            <div className="relative aspect-video w-full bg-surface-elevated">
              {data.primary_media && data.primary_media.embed_allowed && data.primary_media.embed_url ? (
                data.primary_media.media_type === "uploaded_video" ? (
                  <video
                    src={data.primary_media.embed_url}
                    controls
                    playsInline
                    className="h-full w-full"
                  />
                ) : (
                  <iframe
                    src={sanitizeEmbedUrl(data.primary_media.embed_url)}
                    title={data.primary_media.title ?? data.exercise.name}
                    allow="accelerometer; autoplay; encrypted-media; gyroscope"
                    sandbox="allow-scripts allow-same-origin allow-presentation"
                    className="h-full w-full"
                  />
                )
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-2 text-muted-foreground">
                  <VideoOff className="h-6 w-6" />
                  <p className="text-xs">Vídeo de execução em breve</p>
                </div>
              )}
            </div>

            <div className="space-y-5 p-5">
              {data.primary_media?.channel_name && (
                <p className="-mt-1 text-xs text-muted-foreground">
                  Por {data.primary_media.channel_name}
                </p>
              )}

              {data.exercise.primary_muscles.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Músculos
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {data.exercise.primary_muscles.map((m) => (
                      <span
                        key={m}
                        className="rounded-full border border-border/60 bg-surface/50 px-2.5 py-0.5 text-[11px] font-medium"
                      >
                        {m}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {data.exercise.instructions && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Execução
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {data.exercise.instructions}
                  </p>
                </div>
              )}

              {data.exercise.common_mistakes && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Erros comuns
                  </div>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-foreground/90">
                    {data.exercise.common_mistakes}
                  </p>
                </div>
              )}

              {data.alternatives.length > 0 && (
                <div>
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Outras referências
                  </div>
                  <ul className="mt-2 space-y-1.5">
                    {data.alternatives.map((m) => (
                      <li key={m.id} className="text-xs text-muted-foreground">
                        {m.channel_name ?? m.source} · {m.title}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ============================================================
// Hook utilitário: trigger reutilizável
// ============================================================
import { useState, type ReactNode } from "react";

export function useExerciseDetail() {
  const [exerciseId, setExerciseId] = useState<string | null>(null);
  const open = exerciseId !== null;
  return {
    open: (id: string) => setExerciseId(id),
    close: () => setExerciseId(null),
    modalProps: {
      exerciseId,
      open,
      onOpenChange: (v: boolean) => !v && setExerciseId(null),
    },
  };
}

export function ExerciseNameButton({
  exerciseId,
  onClick,
  className,
  children,
}: {
  exerciseId: string;
  onClick: (id: string) => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(exerciseId)}
      className={`text-left underline-offset-2 transition-colors hover:text-primary ${className ?? ""}`}
    >
      {children}
    </button>
  );
}
