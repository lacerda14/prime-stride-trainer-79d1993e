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
      <div className="mx-auto max-w-5xl space-y-6 p-6 lg:p-10">
        <section className="glass-strong animate-fade-in rounded-3xl p-7">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
                Exercício
              </div>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight">{selected}</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {EXERCISES.map((e) => (
                <button
                  key={e}
                  onClick={() => setSelected(e)}
                  className={`rounded-full px-4 py-1.5 text-xs font-medium transition-all ${
                    e === selected
                      ? "bg-primary text-primary-foreground shadow-glow"
                      : "border border-border bg-surface/60 text-muted-foreground hover:bg-surface-elevated hover:text-foreground"
                  }`}
                >
                  {e}
                </button>
              ))}
            </div>
          </div>

          <div className="num mt-6 grid gap-4 sm:grid-cols-3">
            <Field label="Carga base (kg)" value={base.load} onChange={(v) => setBase({ ...base, load: v })} />
            <Field label="Reps alvo" value={base.reps} onChange={(v) => setBase({ ...base, reps: v })} />
            <Field label="RPE alvo" value={base.rpe} onChange={(v) => setBase({ ...base, rpe: v })} step={0.5} />
          </div>
        </section>

        <section className="glass overflow-hidden rounded-2xl">
          <div className="flex items-center gap-2 border-b border-border px-5 py-3 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">
            <TrendingUp className="h-3.5 w-3.5" /> Projeção de 12 semanas
          </div>
          <div className="num divide-y divide-border">
            <div className="grid grid-cols-5 px-5 py-2.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              <span>Semana</span>
              <span>Carga</span>
              <span>Reps</span>
              <span>RPE</span>
              <span className="text-right">Δ</span>
            </div>
            {rows.map((r, i) => {
              const prev = rows[i - 1];
              const delta = prev ? r.load - prev.load : 0;
              return (
                <div
                  key={r.week}
                  className={`grid grid-cols-5 px-5 py-3 text-sm transition-colors hover:bg-white/[0.02] ${
                    r.week % 4 === 0 ? "bg-primary/5" : ""
                  }`}
                >
                  <span className="font-semibold">
                    W{String(r.week).padStart(2, "0")}
                    {r.week % 4 === 0 && (
                      <span className="ml-2 rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-medium uppercase tracking-wider text-primary">
                        Deload
                      </span>
                    )}
                  </span>
                  <span>{r.load} kg</span>
                  <span>{r.reps}</span>
                  <span>{r.rpe}</span>
                  <span className={`text-right text-xs ${delta > 0 ? "text-primary" : delta < 0 ? "text-muted-foreground" : "text-muted-foreground"}`}>
                    {delta > 0 ? "+" : ""}{delta || "—"}{delta !== 0 && " kg"}
                  </span>
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </AppShell>
  );
}

function Field({ label, value, onChange, step = 1 }: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <label className="block rounded-xl border border-border bg-surface/60 p-4 transition-colors focus-within:border-primary/50">
      <div className="text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="mt-1 w-full bg-transparent text-2xl font-semibold tracking-tight outline-none"
      />
    </label>
  );
}
