import { createFileRoute } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { AppShell } from "@/components/app-shell";
import { TrendingUp } from "lucide-react";

export const Route = createFileRoute("/progressao")({
  head: () => ({
    meta: [
      { title: "Progressão · PM Hybrid" },
      { name: "description", content: "Registre carga, reps e RPE — o sistema projeta as próximas semanas." },
    ],
  }),
  component: ProgressaoPage,
});

const EXERCISES = ["Supino Reto", "Agachamento", "Levantamento Terra", "Pull-Up", "Desenvolvimento"];

interface Row {
  week: number;
  load: number;
  reps: number;
  rpe: number;
  manual?: boolean;
}

function ProgressaoPage() {
  const [selected, setSelected] = useState("Agachamento");
  const [base, setBase] = useState<{ load: number; reps: number; rpe: number }>({
    load: 100,
    reps: 5,
    rpe: 7,
  });

  // Auto-project loads based on RPE & progressive overload (~2.5% per week, deload every 4th)
  const rows = useMemo<Row[]>(() => {
    const arr: Row[] = [];
    let load = base.load;
    for (let w = 1; w <= 12; w++) {
      const isDeload = w % 4 === 0;
      if (w > 1) {
        load = isDeload ? Math.round(load * 0.85) : Math.round(load * 1.025);
      }
      arr.push({ week: w, load, reps: base.reps, rpe: isDeload ? Math.max(5, base.rpe - 2) : base.rpe });
    }
    return arr;
  }, [base]);

  return (
    <AppShell eyebrow="Progressão" title="Progressão de Carga">
      <div className="space-y-5 p-4">
        <section className="glass-strong animate-fade-in rounded-2xl p-5">
          <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Exercício
          </div>
          <h2 className="mt-1 text-xl font-semibold tracking-tight">{selected}</h2>

          <div className="-mx-1 mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {EXERCISES.map((e) => (
              <button
                key={e}
                onClick={() => setSelected(e)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-medium transition-all ${
                  e === selected
                    ? "bg-primary text-primary-foreground shadow-glow"
                    : "border border-border bg-surface/60 text-muted-foreground"
                }`}
              >
                {e}
              </button>
            ))}
          </div>

          <div className="num mt-5 grid grid-cols-3 gap-2">
            <Field label="Carga" suffix="kg" value={base.load} onChange={(v) => setBase({ ...base, load: v })} />
            <Field label="Reps" value={base.reps} onChange={(v) => setBase({ ...base, reps: v })} />
            <Field label="RPE" value={base.rpe} onChange={(v) => setBase({ ...base, rpe: v })} step={0.5} />
          </div>
        </section>

        <section className="space-y-2">
          <div className="flex items-center gap-2 px-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Projeção 12 semanas
          </div>
          <div className="space-y-1.5">
            {rows.map((r, i) => {
              const prev = rows[i - 1];
              const delta = prev ? r.load - prev.load : 0;
              const deload = r.week % 4 === 0;
              return (
                <div
                  key={r.week}
                  className={`num flex items-center gap-3 rounded-xl border border-border/60 px-4 py-3 ${
                    deload ? "bg-primary/5" : "bg-surface/40"
                  }`}
                >
                  <div className="flex w-12 flex-col">
                    <span className="text-sm font-semibold">W{String(r.week).padStart(2, "0")}</span>
                    {deload && (
                      <span className="mt-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                        Deload
                      </span>
                    )}
                  </div>
                  <div className="flex flex-1 items-baseline gap-1">
                    <span className="text-lg font-semibold tracking-tight">{r.load}</span>
                    <span className="text-xs text-muted-foreground">kg</span>
                  </div>
                  <div className="flex flex-col items-end text-[11px] text-muted-foreground">
                    <span>{r.reps} reps · RPE {r.rpe}</span>
                    <span className={delta > 0 ? "text-primary" : ""}>
                      {delta > 0 ? "+" : ""}{delta || "—"}{delta !== 0 && " kg"}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, step = 1, suffix }: { label: string; value: number; onChange: (v: number) => void; step?: number; suffix?: string }) {
  return (
    <label className="block rounded-xl border border-border bg-surface/60 p-3 focus-within:border-primary/50">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
        {label}{suffix && <span className="ml-1 normal-case tracking-normal">({suffix})</span>}
      </div>
      <input
        type="number"
        step={step}
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full bg-transparent text-xl font-semibold tracking-tight outline-none"
      />
    </label>
  );
}

