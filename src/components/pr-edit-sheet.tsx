import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Loader2, Trash2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { upsertManualPR, deletePR } from "@/lib/personal-records.functions";
import { PR_EXERCISE_CODES, type PRExerciseCode } from "@/lib/pr-detection.server";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  code: PRExerciseCode | null;
  current?: {
    value: number;
    secondary_value: number | null;
    achieved_at: string;
  } | null;
}

function toLocalDate(iso?: string): string {
  const d = iso ? new Date(iso) : new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseTimeToSeconds(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;
  // formato mm:ss ou hh:mm:ss
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => Number(p));
    if (parts.some((n) => Number.isNaN(n))) return null;
    if (parts.length === 2) return parts[0] * 60 + parts[1];
    if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
    return null;
  }
  // só segundos
  const n = Number(trimmed);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function secondsToMMSS(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export function PREditSheet({ open, onOpenChange, code, current }: Props) {
  const qc = useQueryClient();
  const save = useServerFn(upsertManualPR);
  const remove = useServerFn(deletePR);

  const meta = code ? PR_EXERCISE_CODES[code] : null;

  const [value, setValue] = useState("");
  const [reps, setReps] = useState("");
  const [date, setDate] = useState(toLocalDate());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!open || !meta || !code) return;
    setDate(toLocalDate(current?.achieved_at));
    if (meta.metric === "time_seconds" || meta.metric === "pace_seconds_km") {
      setValue(current?.value ? secondsToMMSS(current.value) : "");
    } else {
      setValue(current?.value != null ? String(current.value) : "");
    }
    setReps(current?.secondary_value != null ? String(current.secondary_value) : "");
  }, [open, code, meta, current]);

  if (!code || !meta) return null;

  const isTime = meta.metric === "time_seconds" || meta.metric === "pace_seconds_km";
  const isWeight = meta.metric === "weight_load";
  const isReps = meta.metric === "reps";
  const isDist = meta.metric === "distance_km";

  const unitLabel = isWeight
    ? "kg"
    : isReps
      ? "reps"
      : meta.metric === "time_seconds"
        ? "mm:ss"
        : meta.metric === "pace_seconds_km"
          ? "mm:ss /km"
          : "km";

  async function handleSave() {
    if (!code || !meta) return;
    let numericValue: number | null = null;
    if (isTime) {
      numericValue = parseTimeToSeconds(value);
    } else {
      const n = Number(value.replace(",", "."));
      numericValue = Number.isFinite(n) && n > 0 ? n : null;
    }
    if (numericValue == null || numericValue <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    const repsNum = isWeight && reps ? Number(reps) : null;
    if (isWeight && repsNum != null && (!Number.isFinite(repsNum) || repsNum <= 0)) {
      toast.error("Reps inválidas.");
      return;
    }
    setSaving(true);
    try {
      await save({
        data: {
          exercise_code: code,
          value: numericValue,
          secondary_value: repsNum,
          achieved_at: new Date(`${date}T12:00:00`).toISOString(),
        },
      });
      toast.success("PR atualizado");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["personal-records"] }),
        qc.invalidateQueries({ queryKey: ["recent-prs"] }),
      ]);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar PR.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!code) return;
    setDeleting(true);
    try {
      await remove({ data: { exercise_code: code } });
      toast.success("PR removido");
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["personal-records"] }),
        qc.invalidateQueries({ queryKey: ["recent-prs"] }),
      ]);
      onOpenChange(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao remover PR.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl border-border/60 bg-background p-0">
        <div className="mx-auto w-full max-w-[480px] px-5 pb-8 pt-2">
          <SheetHeader className="text-left">
            <SheetTitle className="text-[18px] tracking-tight">{meta.label}</SheetTitle>
            <SheetDescription className="text-[12px]">
              {current ? "Edite seu recorde manualmente" : "Registre seu recorde atual"}
            </SheetDescription>
          </SheetHeader>

          <div className="mt-5 space-y-4">
            <div>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                {isWeight
                  ? "Carga"
                  : isReps
                    ? "Reps"
                    : meta.metric === "time_seconds"
                      ? "Tempo"
                      : meta.metric === "pace_seconds_km"
                        ? "Pace"
                        : "Distância"}{" "}
                · {unitLabel}
              </div>
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={isTime ? "ex: 22:30" : isDist ? "ex: 5.2" : "ex: 100"}
                inputMode={isTime ? "text" : "decimal"}
                className="h-14 w-full rounded-2xl border border-border bg-surface/40 px-4 text-[18px] font-semibold tabular-nums outline-none focus:border-primary/60"
              />
            </div>

            {isWeight && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                  Reps (para estimar 1RM)
                </div>
                <input
                  value={reps}
                  onChange={(e) => setReps(e.target.value)}
                  placeholder="ex: 5"
                  inputMode="numeric"
                  className="h-12 w-full rounded-2xl border border-border bg-surface/40 px-4 text-[15px] font-medium tabular-nums outline-none focus:border-primary/60"
                />
              </div>
            )}

            <div>
              <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Data
              </div>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-12 w-full rounded-2xl border border-border bg-surface/40 px-4 text-[15px] font-medium outline-none focus:border-primary/60"
              />
            </div>
          </div>

          <SheetFooter className="mt-6 flex-col gap-2 sm:flex-col">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-60 active:scale-[0.99]"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : null}
              {current ? "Atualizar PR" : "Registrar PR"}
            </button>
            {current && (
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl border border-border bg-surface/40 text-[13px] font-medium text-muted-foreground active:scale-[0.99]"
              >
                {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                Remover PR
              </button>
            )}
          </SheetFooter>
        </div>
      </SheetContent>
    </Sheet>
  );
}
