import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { completeOnboarding, getProfile } from "@/lib/profile.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLocalToday } from "@/lib/local-today";
import pmLogo from "@/assets/pm-logo.png.asset.json";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Bem-vindo — PM Hybrid" }] }),
  component: OnboardingPage,
});

type Sex = "male" | "female" | "other";
type Experience = "beginner" | "intermediate" | "advanced";
type Goal =
  | "fat_loss"
  | "hypertrophy"
  | "general_health"
  | "conditioning"
  | "run_5k"
  | "hybrid";
type AvailableDays = 3 | 4 | 5;
type AvailableMinutes = 30 | 45 | 60 | 90;
type TrainingHistory = "none" | "lt_6m" | "6m_2y" | "2_5y" | "gt_5y";
type TrainingLocation = "gym" | "home_gym" | "crossfit_box" | "home";

interface Data {
  // S1
  name: string;
  phone: string;
  age: number | "";
  sex: Sex | "";
  weight_kg: number | "";
  height_cm: number | "";
  // S2
  goal: Goal | "";
  // S3
  experience_level: Experience | "";
  training_history: TrainingHistory | "";
  training_location: TrainingLocation | "";
  available_days: AvailableDays | "";
  available_minutes: AvailableMinutes | "";
  // S4
  sports: string[];
  preferences: string[];
  motivations: string[];
}

const TOTAL_STEPS = 5; // 4 + intro splash

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fetchProfile = useServerFn(getProfile);
  const submit = useServerFn(completeOnboarding);
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });

  const [step, setStep] = useState(0); // 0 = splash
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Data>({
    name: "", phone: "", age: "", sex: "", weight_kg: "", height_cm: "",
    goal: "",
    experience_level: "", training_history: "", training_location: "",
    available_days: "", available_minutes: "",
    sports: [], preferences: [], motivations: [],
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: "/onboarding" } as never, replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profileQ.data?.onboarding_completed === true) {
      navigate({ to: "/", replace: true });
    }
    if (profileQ.data && !d.name && profileQ.data.name) {
      setD((x) => ({ ...x, name: profileQ.data!.name as string }));
    }
  }, [profileQ.data, navigate, d.name]);

  if (loading || !user || profileQ.isPending || profileQ.data?.onboarding_completed === true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 0: return true;
      case 1:
        return (
          d.name.trim().length > 0 &&
          typeof d.age === "number" && d.age >= 10 && d.age <= 100 &&
          d.sex !== "" &&
          typeof d.weight_kg === "number" && d.weight_kg >= 20 &&
          typeof d.height_cm === "number" && d.height_cm >= 100
        );
      case 2:
        return d.goal !== "";
      case 3:
        return (
          d.experience_level !== "" &&
          d.training_history !== "" &&
          d.training_location !== "" &&
          d.available_days !== "" &&
          d.available_minutes !== ""
        );
      case 4:
        return true; // multi-select all optional
      default: return false;
    }
  };

  const next = () => canAdvance() && step < TOTAL_STEPS - 1 && setStep(step + 1);
  const back = () => step > 0 && setStep(step - 1);

  const finish = async () => {
    if (!canAdvance()) return;
    setSaving(true);
    try {
      await submit({
        data: {
          name: d.name.trim(),
          phone: d.phone.trim() || null,
          program_start_date: getLocalToday().local_date,
          age: d.age as number,
          sex: d.sex as Sex,
          weight_kg: d.weight_kg as number,
          height_cm: d.height_cm as number,
          goal: d.goal as Goal,
          experience_level: d.experience_level as Experience,
          training_history: d.training_history as TrainingHistory,
          training_location: d.training_location as TrainingLocation,
          available_days: d.available_days as AvailableDays,
          available_minutes: d.available_minutes as AvailableMinutes,
          sports: d.sports,
          preferences: d.preferences,
          motivations: d.motivations,
        },
      });
      if (user?.id) {
        qc.setQueryData(["profile", user.id], (current: unknown) => ({
          ...(current && typeof current === "object" ? current : {}),
          onboarding_completed: true,
        }));
      }
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Bem-vindo ao PM Hybrid.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const pct = step === 0 ? 0 : (step / (TOTAL_STEPS - 1)) * 100;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      {step > 0 && (
        <div className="sticky top-0 z-10 bg-background/85 px-6 pt-7 pb-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span>Passo {step} de {TOTAL_STEPS - 1}</span>
            <span className="num">{Math.round(pct)}%</span>
          </div>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-surface">
            <div
              className="h-full bg-titanium transition-all duration-700"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 px-6 pb-32 pt-8">
        {step === 0 && <Splash onStart={() => setStep(1)} />}
        {step === 1 && <Step1 d={d} setD={setD} />}
        {step === 2 && <Step2 d={d} setD={setD} />}
        {step === 3 && <Step3 d={d} setD={setD} />}
        {step === 4 && <Step4 d={d} setD={setD} />}
      </div>

      {step > 0 && (
        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-border/40 bg-background/95 px-6 py-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <button
              onClick={back}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface/50 active:scale-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
            {isLast ? (
              <button
                onClick={finish}
                disabled={saving || !canAdvance()}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-[0.99]"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {saving ? "Gerando seu programa..." : "Concluir"}
              </button>
            ) : (
              <button
                onClick={next}
                disabled={!canAdvance()}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-[0.99]"
              >
                Continuar
                <ArrowRight className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ====================================================== Splash ======================================================

function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center animate-fade-in">
      <img src={pmLogo.url} alt="PM Hybrid" className="h-24 w-auto object-contain mb-10 opacity-95" />
      <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
        Performance System
      </div>
      <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-tight text-titanium">
        Bem-vindo<br />ao PM Hybrid
      </h1>
      <p className="mt-5 max-w-[320px] text-[15px] leading-relaxed text-muted-foreground">
        Um sistema híbrido de 48 semanas calibrado para você — força, corrida e condicionamento em equilíbrio.
      </p>
      <button
        onClick={onStart}
        className="mt-12 flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99]"
      >
        Começar
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ====================================================== Steps ======================================================

function Hero({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="animate-fade-in">
      <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</div>
      <h1 className="mt-3 text-[32px] font-semibold leading-[1.1] tracking-tight text-titanium">{title}</h1>
      {hint && <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-2xl border border-border bg-surface/40 px-5 text-[16px] font-medium tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-surface/60 transition-colors";

const labelCls = "text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2 block";

function Step1({ d, setD }: { d: Data; setD: React.Dispatch<React.SetStateAction<Data>> }) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="Etapa 1 · Perfil" title="Vamos te conhecer." hint="Usamos esses dados para calibrar cada prescrição." />
      <div className="animate-fade-in space-y-5">
        <div>
          <label className={labelCls}>Nome</label>
          <input className={inputCls} placeholder="Como prefere ser chamado?" value={d.name}
            onChange={(e) => setD({ ...d, name: e.target.value })} maxLength={80} autoFocus />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Idade</label>
            <input type="number" inputMode="numeric" className={inputCls} placeholder="30"
              value={d.age} onChange={(e) => setD({ ...d, age: e.target.value === "" ? "" : Number(e.target.value) })}
              min={10} max={100} />
          </div>
          <div>
            <label className={labelCls}>Sexo</label>
            <div className="grid grid-cols-3 gap-1.5">
              {(["male", "female", "other"] as Sex[]).map((v) => (
                <button key={v} onClick={() => setD({ ...d, sex: v })}
                  className={`h-14 rounded-2xl border text-[13px] font-medium transition-all ${
                    d.sex === v ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-surface/40 text-muted-foreground"
                  }`}>
                  {v === "male" ? "M" : v === "female" ? "F" : "Outro"}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Peso · kg</label>
            <input type="number" inputMode="decimal" className={inputCls} placeholder="75.0"
              value={d.weight_kg} step="0.1" min={20} max={300}
              onChange={(e) => setD({ ...d, weight_kg: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Altura · cm</label>
            <input type="number" inputMode="numeric" className={inputCls} placeholder="175"
              value={d.height_cm} min={100} max={250}
              onChange={(e) => setD({ ...d, height_cm: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Telefone · opcional</label>
          <input type="tel" className={inputCls} placeholder="(11) 99999-9999"
            value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} maxLength={40} />
        </div>
      </div>
    </div>
  );
}

const GOALS: { v: Goal; label: string; hint: string }[] = [
  { v: "fat_loss", label: "Fat Loss", hint: "Redução de gordura" },
  { v: "hypertrophy", label: "Muscle Gain", hint: "Hipertrofia" },
  { v: "general_health", label: "General Health", hint: "Saúde e bem-estar" },
  { v: "conditioning", label: "Improve Conditioning", hint: "Capacidade física geral" },
  { v: "run_5k", label: "Run 5K", hint: "Foco corrida 5 km" },
  { v: "hybrid", label: "Hybrid Performance", hint: "Força + corrida" },
];

function Step2({ d, setD }: { d: Data; setD: React.Dispatch<React.SetStateAction<Data>> }) {
  return (
    <div className="space-y-8">
      <Hero eyebrow="Etapa 2 · Objetivo" title="Qual seu foco principal?" hint="Escolha uma direção — você pode mudar depois no perfil." />
      <div className="animate-fade-in grid gap-2.5">
        {GOALS.map((g) => (
          <BigChoice key={g.v} active={d.goal === g.v} onClick={() => setD({ ...d, goal: g.v })}
            title={g.label} hint={g.hint} />
        ))}
      </div>
    </div>
  );
}

const HISTORY: { v: TrainingHistory; label: string }[] = [
  { v: "none", label: "Nunca treinei" },
  { v: "lt_6m", label: "Menos de 6 meses" },
  { v: "6m_2y", label: "6 meses a 2 anos" },
  { v: "2_5y", label: "2 a 5 anos" },
  { v: "gt_5y", label: "Mais de 5 anos" },
];

const LOCATIONS: { v: TrainingLocation; label: string }[] = [
  { v: "gym", label: "Academia" },
  { v: "home_gym", label: "Home Gym" },
  { v: "crossfit_box", label: "CrossFit Box" },
  { v: "home", label: "Em casa" },
];

const EXPERIENCE: { v: Experience; label: string }[] = [
  { v: "beginner", label: "Iniciante" },
  { v: "intermediate", label: "Intermediário" },
  { v: "advanced", label: "Avançado" },
];

function Step3({ d, setD }: { d: Data; setD: React.Dispatch<React.SetStateAction<Data>> }) {
  return (
    <div className="space-y-8">
      <Hero eyebrow="Etapa 3 · Histórico" title="Sua rotina de treino" hint="Como você treina hoje." />

      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Nível</label>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPERIENCE.map((o) => (
              <PillChoice key={o.v} active={d.experience_level === o.v}
                onClick={() => setD({ ...d, experience_level: o.v })}>{o.label}</PillChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Há quanto tempo treina</label>
          <div className="grid gap-1.5">
            {HISTORY.map((o) => (
              <RowChoice key={o.v} active={d.training_history === o.v}
                onClick={() => setD({ ...d, training_history: o.v })}>{o.label}</RowChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Onde treina</label>
          <div className="grid grid-cols-2 gap-1.5">
            {LOCATIONS.map((o) => (
              <PillChoice key={o.v} active={d.training_location === o.v}
                onClick={() => setD({ ...d, training_location: o.v })}>{o.label}</PillChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Dias por semana</label>
          <div className="grid grid-cols-3 gap-1.5">
            {([3, 4, 5] as AvailableDays[]).map((n) => (
              <PillChoice key={n} active={d.available_days === n}
                onClick={() => setD({ ...d, available_days: n })}>{n} dias</PillChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Tempo por treino</label>
          <div className="grid grid-cols-4 gap-1.5">
            {([30, 45, 60, 90] as AvailableMinutes[]).map((n) => (
              <PillChoice key={n} active={d.available_minutes === n}
                onClick={() => setD({ ...d, available_minutes: n })}>{n}min</PillChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const SPORTS = ["Running", "CrossFit", "Jiu Jitsu", "Muay Thai", "Soccer", "Basketball", "Cycling", "Swimming"];
const PREFERENCES = ["Strength", "Hypertrophy", "Conditioning", "Mobility", "Fast Workouts", "Heavy Workouts"];
const MOTIVATIONS = ["Aesthetics", "Health", "Performance", "Competition", "Consistency"];

function Step4({ d, setD }: { d: Data; setD: React.Dispatch<React.SetStateAction<Data>> }) {
  const toggle = (key: "sports" | "preferences" | "motivations", v: string) => {
    setD((cur) => ({
      ...cur,
      [key]: cur[key].includes(v) ? cur[key].filter((x) => x !== v) : [...cur[key], v],
    }));
  };

  return (
    <div className="space-y-8">
      <Hero eyebrow="Etapa 4 · Personalização" title="Conte mais sobre você" hint="Selecione tudo que se aplica. Tudo opcional." />

      <div className="animate-fade-in space-y-7">
        <Multi label="Esportes praticados" items={SPORTS} selected={d.sports} onToggle={(v) => toggle("sports", v)} />
        <Multi label="Preferências de treino" items={PREFERENCES} selected={d.preferences} onToggle={(v) => toggle("preferences", v)} />
        <Multi label="O que te motiva" items={MOTIVATIONS} selected={d.motivations} onToggle={(v) => toggle("motivations", v)} />
      </div>
    </div>
  );
}

// ====================================================== UI primitives ======================================================

function BigChoice({ active, title, hint, onClick }: { active: boolean; title: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-2xl border px-5 py-5 text-left transition-all active:scale-[0.99] ${
        active ? "border-primary/60 bg-primary/[0.08] shadow-glow" : "border-border bg-surface/40 hover:bg-surface/60"
      }`}>
      <div className="text-[16px] font-semibold tracking-tight">{title}</div>
      <div className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function RowChoice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3.5 text-left text-[14px] font-medium transition-all active:scale-[0.99] ${
        active ? "border-primary/60 bg-primary/[0.08] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}>
      {children}
    </button>
  );
}

function PillChoice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`h-12 rounded-xl border text-[13px] font-medium transition-all ${
        active ? "border-primary/60 bg-primary/[0.10] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}>
      {children}
    </button>
  );
}

function Multi({ label, items, selected, onToggle }: { label: string; items: string[]; selected: string[]; onToggle: (v: string) => void }) {
  return (
    <div>
      <label className={labelCls}>{label}</label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => {
          const on = selected.includes(v);
          return (
            <button key={v} onClick={() => onToggle(v)}
              className={`rounded-full border px-4 py-2 text-[13px] font-medium transition-all ${
                on ? "border-primary/60 bg-primary/[0.12] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
              }`}>
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
