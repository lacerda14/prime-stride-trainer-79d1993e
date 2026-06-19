import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  getTodayTraining,
  getProgramSummary,
  getWeekDetail,
  type TrainingDayDTO,
} from "@/lib/program.queries";
import { useAuth } from "@/hooks/use-auth";
import { useLocalToday } from "@/hooks/use-local-today";
import {
  Play,
  Coffee,
  ChevronDown,
  Clock,
  Dumbbell,
  CalendarDays,
  BookOpen,
  Footprints,
  Loader2,
  Check,
  Timer,
} from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/treinos")({
  head: () => ({
    meta: [
      { title: "Treinos · PM Hybrid" },
      { name: "description", content: "Treino do dia, semana e histórico do programa." },
    ],
  }),
  component: TreinosPage,
});

type TabKey = "hoje" | "semana" | "calendario" | "biblioteca";

const TABS: { key: TabKey; label: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { key: "hoje", label: "Hoje", icon: Play },
  { key: "semana", label: "Semana", icon: CalendarDays },
  { key: "calendario", label: "Calendário", icon: CalendarDays },
  { key: "biblioteca", label: "Biblioteca", icon: BookOpen },
];

function TreinosPage() {
  const [tab, setTab] = useState<TabKey>("hoje");

  return (
    <AppShell eyebrow="Centro de treinos" title="Treinos">
      {/* Tabs internas */}
      <div className="sticky top-14 z-20 bg-background/95 backdrop-blur-xl border-b border-border/60">
        <div className="flex overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-4 gap-1 py-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-[12.5px] font-medium transition-all ${
                tab === t.key
                  ? "bg-primary text-primary-foreground shadow-glow"
                  : "border border-border bg-surface/60 text-muted-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo da tab */}
      {tab === "hoje" && <TreinoHojeTab />}
      {tab === "semana" && <TreinoSemanaTab />}
      {(tab === "calendario" || tab === "biblioteca") && (
        <ComingSoonTab label={tab === "calendario" ? "Calendário" : "Biblioteca"} />
      )}
    </AppShell>
  );
}

// ─────────────────────────────────────────────
// Tab: Hoje
// ─────────────────────────────────────────────

function TreinoHojeTab() {
  const { user } = useAuth();
  const fetchToday = useServerFn(getTodayTraining);
  const localToday = useLocalToday();

  const { data, isLoading } = useQuery({
    queryKey: ["today-training", user?.id, localToday.local_date, localToday.timezone],
    queryFn: () => fetchToday({ data: localToday }),
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!data?.today) {
    return (
      <div className="p-6 text-center">
        <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated">
          <Coffee className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="text-[15px] font-semibold">Dia de descanso</div>
        <p className="mt-1.5 text-[13px] text-muted-foreground">
          {data?.calendar.day_name ?? "Hoje"} não tem treino programado. Descanse, hidrate-se e
          prepare-se para amanhã.
        </p>
      </div>
    );
  }

  const today = data.today;
  const week = data.week;
  const strength = today.exercises.filter((e) => e.exercise.category !== "core");
  const core = today.exercises.filter((e) => e.exercise.category === "core");

  return (
    <div className="space-y-4 p-4 pb-10">
      {/* Hero card do treino */}
      <div className="relative overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-br from-primary/10 via-surface to-surface p-5">
        <div className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            {data.calendar.day_name} · Semana {String(week.week_number).padStart(2, "0")}
          </div>
          <h2 className="mt-1.5 text-[20px] font-semibold leading-tight tracking-tight">
            {today.objective ?? week.meso.name}
          </h2>
          {week.meso.method && (
            <p className="mt-1 text-[12px] text-muted-foreground">Método: {week.meso.method}</p>
          )}
          <div className="mt-3 flex flex-wrap gap-3 text-[12px] text-muted-foreground num">
            {today.duration_minutes && (
              <span className="flex items-center gap-1.5">
                <Clock className="h-3.5 w-3.5" /> ~{today.duration_minutes} min
              </span>
            )}
            {strength.length > 0 && (
              <span className="flex items-center gap-1.5">
                <Dumbbell className="h-3.5 w-3.5" /> {strength.length} de força
              </span>
            )}
            {today.running && (
              <span className="flex items-center gap-1.5">
                <Footprints className="h-3.5 w-3.5" /> {today.running.total_duration_minutes} min
                corrida
              </span>
            )}
          </div>
          <div className="mt-4 flex gap-2">
            <Link
              to="/treino"
              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow transition-transform active:scale-[0.99]"
            >
              <Play className="h-4 w-4 fill-current" /> Entrar no treino
            </Link>
            <Link
              to="/hoje"
              className="inline-flex items-center justify-center rounded-2xl border border-border bg-surface/60 px-4 py-3.5 text-[13px] font-medium"
            >
              Detalhes
            </Link>
          </div>
        </div>
      </div>

      {/* Lista de exercícios */}
      {strength.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Exercícios de força
          </div>
          <div className="space-y-1.5">
            {strength.map((e, i) => (
              <div
                key={e.id}
                className="flex items-center gap-3 rounded-xl border border-border/60 bg-surface/40 px-4 py-3"
              >
                <div className="num flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-[11px] font-semibold text-muted-foreground">
                  {String(i + 1).padStart(2, "0")}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{e.exercise.name}</div>
                  {e.pair_slot && (
                    <span className="rounded-full bg-primary/15 px-1.5 py-0.5 text-[9px] uppercase text-primary">
                      Biset {e.pair_slot}
                    </span>
                  )}
                </div>
                <div className="num shrink-0 text-[12px] text-muted-foreground">
                  {e.sets}×{e.reps}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {core.length > 0 && (
        <div>
          <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            Core
          </div>
          <div className="space-y-1.5">
            {core.map((e) => (
              <div
                key={e.id}
                className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/40 px-4 py-3"
              >
                <span className="text-[13px] font-medium">{e.exercise.name}</span>
                <span className="num text-[12px] text-muted-foreground">
                  {e.sets}×{e.reps}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {today.running && (
        <div className="rounded-2xl border border-border/60 bg-surface/40 p-4">
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground mb-2">
            Corrida
          </div>
          <div className="num flex items-center gap-3 text-[13px]">
            <Timer className="h-4 w-4 text-primary" />
            <span>
              {today.running.protocol_type.toUpperCase()} · {today.running.total_duration_minutes}{" "}
              min
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Tab: Semana
// ─────────────────────────────────────────────

function DayCard({ day }: { day: TrainingDayDTO }) {
  const [open, setOpen] = useState(false);
  const isRest = day.session_type === "rest";
  const strength = day.exercises.filter((e) => e.exercise.category !== "core");
  const core = day.exercises.filter((e) => e.exercise.category === "core");
  const completed = !!day.completed_at;

  if (isRest) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-border/40 bg-surface/30 px-5 py-4 opacity-60">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface-elevated">
          <Coffee className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            {day.day_name}
          </div>
          <div className="mt-0.5 text-[13px] font-semibold tracking-tight">OFF · Recuperação</div>
        </div>
      </div>
    );
  }

  return (
    <div
      className={`overflow-hidden rounded-2xl border ${completed ? "border-primary/30 bg-primary/5" : "border-border/60 bg-surface/40"}`}
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-5 py-4 text-left hover:bg-white/[0.02]"
      >
        <div className="flex items-center gap-3">
          {completed && (
            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/20">
              <Check className="h-3.5 w-3.5 text-primary" />
            </div>
          )}
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
              {day.day_name}
            </div>
            <div className="mt-0.5 text-[14px] font-semibold tracking-tight">
              {day.objective ?? day.session_type}
            </div>
          </div>
        </div>
        <ChevronDown
          className={`h-4 w-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      <div
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
      >
        <div className="overflow-hidden">
          <div className="space-y-3 border-t border-border/60 px-5 pb-5 pt-4">
            {strength.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Força
                </div>
                <div className="space-y-1">
                  {strength.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-[12px]"
                    >
                      <span className="font-medium">{e.exercise.name}</span>
                      <span className="text-muted-foreground num">
                        {e.sets}×{e.reps}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {core.length > 0 && (
              <div>
                <div className="mb-1.5 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
                  Core
                </div>
                <div className="space-y-1">
                  {core.map((e) => (
                    <div
                      key={e.id}
                      className="flex items-center justify-between rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-[12px]"
                    >
                      <span className="font-medium">{e.exercise.name}</span>
                      <span className="text-muted-foreground num">
                        {e.sets}×{e.reps}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {day.running && (
              <div className="num rounded-lg border border-border/60 bg-surface/40 px-3 py-2 text-[12px]">
                Corrida · {day.running.protocol_type.toUpperCase()} ·{" "}
                {day.running.total_duration_minutes} min
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TreinoSemanaTab() {
  const { user } = useAuth();
  const fetchSummary = useServerFn(getProgramSummary);
  const fetchWeek = useServerFn(getWeekDetail);

  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ["program-summary", user?.id],
    queryFn: () => fetchSummary(),
    enabled: !!user,
  });

  const activeWeek = summary?.active_week ?? 1;
  const [selected, setSelected] = useState(activeWeek);

  const { data: week, isLoading: loadingWeek } = useQuery({
    queryKey: ["week-detail", user?.id, selected],
    queryFn: () => fetchWeek({ data: { week_number: selected } }),
    enabled: !!user && !!summary,
  });

  const [pickerOpen, setPickerOpen] = useState(false);
  const totalWeeks = summary?.total_weeks ?? 48;
  const meta = summary?.weekIndex[selected];

  if (loadingSummary) {
    return (
      <div className="flex justify-center p-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 pb-10">
      {/* Seletor de semana */}
      <div className="relative">
        <button
          onClick={() => setPickerOpen((v) => !v)}
          className="glass-strong flex w-full items-center justify-between rounded-2xl p-5 text-left"
        >
          <div>
            <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
              {meta ? `${meta.macroName} · ${meta.mesoName}` : "—"}
            </div>
            <div className="num mt-1 text-[26px] font-semibold tracking-tight">
              SEMANA {String(selected).padStart(2, "0")}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {week?.meso.objective ?? "Carregando…"}
            </div>
          </div>
          <ChevronDown
            className={`h-5 w-5 text-muted-foreground transition-transform ${pickerOpen ? "rotate-180" : ""}`}
          />
        </button>

        {pickerOpen && (
          <div className="absolute left-0 right-0 top-full z-20 mt-2 max-h-[360px] overflow-y-auto rounded-2xl border border-border bg-popover/95 p-2 shadow-elevated backdrop-blur-xl">
            <div className="grid grid-cols-4 gap-1">
              {Array.from({ length: totalWeeks }).map((_, i) => {
                const n = i + 1;
                return (
                  <button
                    key={n}
                    onClick={() => {
                      setSelected(n);
                      setPickerOpen(false);
                    }}
                    className={`num relative rounded-lg px-3 py-3 text-sm font-semibold transition-all ${
                      n === selected
                        ? "bg-primary text-primary-foreground shadow-glow"
                        : "text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                    }`}
                  >
                    {String(n).padStart(2, "0")}
                    {n === selected && <Check className="absolute right-1 top-1 h-3 w-3" />}
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Info semana */}
      {week && (
        <div className="glass rounded-2xl p-4">
          <div className="grid grid-cols-3 gap-3 text-[12px]">
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">Tipo</div>
              <div className="mt-0.5 font-semibold">Semana {week.week_type}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Método
              </div>
              <div className="mt-0.5 font-semibold">{week.meso.method ?? "—"}</div>
            </div>
            <div>
              <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                Macro
              </div>
              <div className="mt-0.5 font-semibold">{week.macro.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* Dias */}
      {loadingWeek ? (
        <div className="flex justify-center p-8">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {week?.days.map((d) => (
            <DayCard key={d.id} day={d} />
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Coming Soon tab
// ─────────────────────────────────────────────

function ComingSoonTab({ label }: { label: string }) {
  return (
    <div className="flex flex-col items-center gap-4 p-8 pt-12 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/30 bg-primary/10">
        <CalendarDays className="h-7 w-7 text-primary" />
      </div>
      <div>
        <div className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-primary mb-3">
          Em breve
        </div>
        <div className="text-[18px] font-semibold tracking-tight">{label}</div>
        <p className="mt-2 text-[13px] text-muted-foreground max-w-[260px]">
          {label === "Calendário"
            ? "Visualize seus treinos feitos, perdidos e futuros em um calendário mensal."
            : "Explore o catálogo completo de exercícios com vídeos e instruções."}
        </p>
      </div>
    </div>
  );
}
