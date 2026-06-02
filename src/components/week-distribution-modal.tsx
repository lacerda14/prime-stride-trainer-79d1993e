import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { getWeekPlan, saveWeekPlan } from "@/lib/training.functions";
import { WEEKS, type DayName } from "@/lib/mock-data";
import { useAuth } from "@/hooks/use-auth";
import { CheckCircle2, Calendar, Circle, ArrowLeft, Sparkles } from "lucide-react";

// 0 = Domingo … 6 = Sábado
const WEEKDAYS: { v: number; short: string; long: string }[] = [
  { v: 1, short: "Seg", long: "Segunda" },
  { v: 2, short: "Ter", long: "Terça" },
  { v: 3, short: "Qua", long: "Quarta" },
  { v: 4, short: "Qui", long: "Quinta" },
  { v: 5, short: "Sex", long: "Sexta" },
  { v: 6, short: "Sáb", long: "Sábado" },
  { v: 0, short: "Dom", long: "Domingo" },
];

const PROGRAM_TO_WEEKDAY: Record<DayName, number> = {
  Segunda: 1, Terça: 2, Quarta: 3, Quinta: 4, Sexta: 5, Sábado: 6, Domingo: 0,
};

export function WeekDistributionModal({ weekNumber }: { weekNumber: number }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const fetchPlan = useServerFn(getWeekPlan);
  const savePlan = useServerFn(saveWeekPlan);

  const { data: plan, isLoading } = useQuery({
    queryKey: ["week-plan", user?.id, weekNumber],
    queryFn: () => fetchPlan({ data: { week_number: weekNumber } }),
    enabled: !!user,
  });

  const week = useMemo(() => WEEKS.find((w) => w.number === weekNumber) ?? WEEKS[0], [weekNumber]);
  const trainingDays = useMemo(() => week.days.filter((d) => !d.isOff), [week]);

  const [assignments, setAssignments] = useState<Record<string, number>>({});
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<"plan" | "review">("plan");

  useEffect(() => {
    if (isLoading || !user) return;
    if (!plan) {
      const init: Record<string, number> = {};
      trainingDays.forEach((d) => (init[d.day] = PROGRAM_TO_WEEKDAY[d.day]));
      setAssignments(init);
      setStep("plan");
      setOpen(true);
    }
  }, [plan, isLoading, user, trainingDays]);

  const mutation = useMutation({
    mutationFn: () =>
      savePlan({ data: { week_number: weekNumber, days_distribution: assignments } }),
    onSuccess: () => {
      toast.success("Semana planejada! 🔥");
      qc.invalidateQueries({ queryKey: ["week-plan", user?.id, weekNumber] });
      setOpen(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Erro ao salvar."),
  });

  const setDay = (programDay: string, weekday: number) => {
    setAssignments((prev) => ({ ...prev, [programDay]: weekday }));
  };

  const usedDays = Object.values(assignments);
  const hasDuplicates = new Set(usedDays).size !== usedDays.length;
  const allAssigned = trainingDays.every((d) => assignments[d.day] !== undefined);
  const plannedCount = trainingDays.filter((d) => assignments[d.day] !== undefined).length;
  const summary = trainingDays
    .filter((d) => assignments[d.day] !== undefined)
    .map((d) => {
      const wd = WEEKDAYS.find((w) => w.v === assignments[d.day])!;
      return { day: d.day, session: d.session, weekday: wd };
    })
    .sort((a, b) => {
      // Segunda primeiro, Domingo por último
      const order = (v: number) => (v === 0 ? 7 : v);
      return order(a.weekday.v) - order(b.weekday.v);
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-[440px] gap-0 overflow-hidden rounded-3xl border-border/60 bg-background p-0">
        <DialogHeader className="px-5 pt-5">
          <div className="mb-2 inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
            <Calendar className="h-3 w-3" />
            Semana {weekNumber}
          </div>
          <DialogTitle className="text-[20px] font-semibold tracking-tight">
            Como você quer distribuir seus treinos?
          </DialogTitle>
          <DialogDescription className="text-[12px] text-muted-foreground">
            Escolha em qual dia da semana cada sessão será feita. Você pode ajustar depois.
          </DialogDescription>
        </DialogHeader>


        {/* Checklist de progresso de planejamento */}
        <div className="border-y border-border/60 bg-surface/20 px-5 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              Treinos planejados
            </span>
            <span className="num text-[11px] font-semibold text-primary">
              {plannedCount}/{trainingDays.length}
            </span>
          </div>
          <div className="h-1 w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
              style={{ width: `${(plannedCount / trainingDays.length) * 100}%` }}
            />
          </div>
          <ul className="mt-3 space-y-1.5">
            {trainingDays.map((d) => {
              const assigned = assignments[d.day] !== undefined;
              const wd = WEEKDAYS.find((w) => w.v === assignments[d.day]);
              return (
                <li key={d.day} className="flex items-center gap-2 text-[11px]">
                  {assigned ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-primary" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                  )}
                  <span className={`flex-1 truncate ${assigned ? "text-foreground" : "text-muted-foreground"}`}>
                    {d.day} · {d.session}
                  </span>
                  {wd && (
                    <span className="shrink-0 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-semibold text-primary">
                      {wd.short}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
        </div>

        {step === "plan" ? (
          <div className="max-h-[40vh] space-y-3 overflow-y-auto px-5 py-4">
            {trainingDays.map((d) => (
              <div key={d.day} className="rounded-2xl border border-border/60 bg-surface/40 p-3">
                <div className="min-w-0 flex-1">
                  <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    Programa · {d.day}
                  </div>
                  <div className="mt-0.5 truncate text-[13px] font-semibold">{d.session}</div>
                </div>
                <div className="mt-3 grid grid-cols-7 gap-1">
                  {WEEKDAYS.map((wd) => {
                    const active = assignments[d.day] === wd.v;
                    const conflict = active && usedDays.filter((v) => v === wd.v).length > 1;
                    return (
                      <button
                        key={wd.v}
                        onClick={() => setDay(d.day, wd.v)}
                        className={`h-10 rounded-xl border text-[11px] font-semibold transition-all active:scale-95 ${
                          active
                            ? conflict
                              ? "border-destructive bg-destructive/15 text-destructive"
                              : "border-primary bg-primary text-primary-foreground shadow-glow"
                            : "border-border/60 bg-background/40 text-muted-foreground hover:border-border"
                        }`}
                      >
                        {wd.short}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="max-h-[40vh] space-y-2 overflow-y-auto px-5 py-4">
            <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-primary">
              <Sparkles className="h-3 w-3" />
              Resumo da semana
            </div>
            {summary.length === 0 ? (
              <p className="text-center text-[12px] text-muted-foreground">Nenhum treino planejado.</p>
            ) : (
              summary.map((item) => (
                <div
                  key={item.day}
                  className="flex items-start gap-3 rounded-2xl border border-border/60 bg-surface/40 p-3"
                >
                  <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <span className="text-[9px] font-medium uppercase tracking-wider">{item.weekday.short}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                      {item.weekday.long}
                    </div>
                    <div className="mt-0.5 truncate text-[13px] font-semibold">{item.session}</div>
                    <div className="mt-0.5 truncate text-[10px] text-muted-foreground">Programa · {item.day}</div>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        <div className="border-t border-border/60 bg-surface/30 px-5 py-3">
          {hasDuplicates && (
            <p className="mb-2 text-center text-[11px] font-medium text-destructive">
              Dois treinos no mesmo dia. Ajuste antes de salvar.
            </p>
          )}
          {step === "plan" ? (
            <button
              disabled={!allAssigned || hasDuplicates}
              onClick={() => setStep("review")}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Revisar plano
              <Sparkles className="h-4 w-4" />
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={() => setStep("plan")}
                disabled={mutation.isPending}
                className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-border/60 bg-background/40 px-4 py-3.5 text-[13px] font-medium active:scale-[0.99]"
              >
                <ArrowLeft className="h-4 w-4" />
                Editar
              </button>
              <button
                disabled={!allAssigned || hasDuplicates || mutation.isPending}
                onClick={() => mutation.mutate()}
                className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow transition active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <CheckCircle2 className="h-4 w-4" />
                {mutation.isPending ? "Salvando…" : "Confirmar e salvar"}
              </button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
