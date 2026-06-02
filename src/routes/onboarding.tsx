import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { completeOnboarding, getProfile, registerProgressPhoto } from "@/lib/profile.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLocalToday } from "@/lib/local-today";
import { supabase } from "@/integrations/supabase/client";
import pmLogo from "@/assets/pm-logo.png.asset.json";
import {
  PRIMARY_GOAL_OPTIONS, SECONDARY_GOALS, TRAINING_HISTORY_OPTIONS,
  TRAINING_LOCATION_OPTIONS, DAYS_PER_WEEK, MINUTES_PER_SESSION,
  SPORTS_OPTIONS, RUNNING_MODES, RUNNING_LEVEL, RUNNING_CONTINUOUS,
  RUNNING_GOALS_OPTIONS, WEEK_DAYS, CARDIO_OPTIONS, PREFERRED_TIMES,
  MEDICAL_CONDITIONS, PAIN_REGIONS, PAST_INJURIES, UNCOMFORTABLE_MOVEMENTS,
  PREFERENCES_OPTIONS, TRAINING_STYLES,
  MOTIVATIONS_OPTIONS, LIFTS_DONE, EXPERIENCE_OPTIONS,
  FULL_GYM_COMPLETENESS, FULL_GYM_MISSING_OPTIONS,
  CONDO_GYM_EQUIPMENT, HOME_EQUIPMENT,
  BOX_COMPLETENESS, BOX_EQUIPMENT, MIXED_PRIMARY_LOCATIONS,
} from "@/lib/onboarding-options";

interface GymSetup {
  location: string;
  // Academia completa
  full_gym_completeness: string;
  full_gym_missing: string[];
  full_gym_missing_other: string;
  // Condomínio
  condo_equipment: string[];
  condo_other: string;
  // Casa
  home_equipment: string[];
  home_other: string;
  // Box
  box_completeness: string;
  box_equipment: string[];
  box_other: string;
  // Misto
  mixed_primary: string;
  mixed_other_locations: string[];
}

const EMPTY_GYM_SETUP: GymSetup = {
  location: "",
  full_gym_completeness: "", full_gym_missing: [], full_gym_missing_other: "",
  condo_equipment: [], condo_other: "",
  home_equipment: [], home_other: "",
  box_completeness: "", box_equipment: [], box_other: "",
  mixed_primary: "", mixed_other_locations: [],
};

/** Compõe a lista plana de equipamentos para o engine a partir do gym_setup. */
function deriveEquipment(g: GymSetup): string[] {
  const set = new Set<string>();
  switch (g.location) {
    case "Academia Completa": {
      if (g.full_gym_completeness === "Algumas máquinas não existem") {
        // adiciona tudo padrão e remove ausentes
        ["Rack", "Barra olímpica", "Anilhas", "Halteres", "Banco ajustável",
         "Leg Press", "Máquina de cabos", "Barra fixa", "Smith", "Hack Squat",
         "Cadeira Extensora", "Mesa Flexora", "Esteira", "Bicicleta"].forEach((e) => set.add(e));
        g.full_gym_missing.forEach((m) => set.delete(m));
      } else {
        ["Academia completa", "Rack", "Barra olímpica", "Anilhas", "Halteres",
         "Banco ajustável", "Leg Press", "Máquina de cabos", "Barra fixa",
         "Smith", "Esteira", "Bicicleta"].forEach((e) => set.add(e));
      }
      break;
    }
    case "Academia de Condomínio / Prédio":
      g.condo_equipment.forEach((e) => set.add(e));
      break;
    case "Casa":
      g.home_equipment.forEach((e) => set.add(e));
      break;
    case "Box de CrossFit":
      if (g.box_completeness === "Sim") {
        ["Remo", "Bike", "SkiErg", "Barra olímpica", "Anilhas bumper",
         "Caixa de salto", "Kettlebells", "Dumbbells", "Corda", "Argolas",
         "Barra fixa", "GHD", "Wall Ball"].forEach((e) => set.add(e));
      } else {
        g.box_equipment.forEach((e) => set.add(e));
      }
      break;
    case "Misto": {
      const pickFor = (loc: string) => {
        if (loc === "Academia") ["Rack", "Barra olímpica", "Halteres", "Máquina de cabos", "Leg Press", "Banco ajustável"].forEach((e) => set.add(e));
        if (loc === "Condomínio") g.condo_equipment.forEach((e) => set.add(e));
        if (loc === "Casa") g.home_equipment.forEach((e) => set.add(e));
        if (loc === "Box") g.box_equipment.forEach((e) => set.add(e));
      };
      if (g.mixed_primary) pickFor(g.mixed_primary);
      g.mixed_other_locations.forEach(pickFor);
      break;
    }
  }
  return Array.from(set);
}

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Avaliação · PM Hybrid" }] }),
  component: OnboardingPage,
});

type Sex = "male" | "female" | "other";
type Experience = "beginner" | "intermediate" | "advanced";

interface Data {
  // S1
  first_name: string; last_name: string;
  birth_date: string; sex: Sex | "";
  height_cm: number | ""; weight_kg: number | "";
  waist_cm: number | ""; hip_cm: number | "";
  chest_cm: number | ""; arm_cm: number | ""; thigh_cm: number | "";
  phone: string;
  // S2
  primary_goal: string;
  // S3
  secondary_goals: string[];
  // S4
  experience_level: Experience | "";
  training_history: string;
  
  available_days: number | "";
  available_minutes: number | "";
  // S5
  sports: string[];
  sports_frequency: Record<string, number>;
  // S6
  running_mode: string;
  running_level: string;
  running_continuous_minutes: string;
  running_goals: string[];
  running_preferred_days: string[];
  cardio_preference: string;
  // S7
  available_days_list: string[];
  preferred_time: string;
  // S8
  medical_conditions: string[];
  medications: string;
  surgeries: { name: string; year?: string }[];
  medical_restrictions: string;
  // S9
  current_pain_level: number;
  pain_regions: string[];
  past_injuries: string[];
  uncomfortable_movements: string[];
  // S10 — local + equipamentos
  gym_setup: GymSetup;
  // S11
  preferences: string[];
  training_style: string;
  motivations: string[];
  // S12
  perf_max_pushups: number | "";
  perf_max_squats: number | "";
  perf_max_plank_seconds: number | "";
  perf_max_run_minutes: number | "";
  perf_lifts_done: string[];
}

const TOTAL_SECTIONS = 13;
const TOTAL_STEPS = TOTAL_SECTIONS + 1; // + splash

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fetchProfile = useServerFn(getProfile);
  const submit = useServerFn(completeOnboarding);
  const registerPhoto = useServerFn(registerProgressPhoto);
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Data>({
    first_name: "", last_name: "", birth_date: "", sex: "",
    height_cm: "", weight_kg: "",
    waist_cm: "", hip_cm: "", chest_cm: "", arm_cm: "", thigh_cm: "",
    phone: "",
    primary_goal: "",
    secondary_goals: [],
    experience_level: "", training_history: "",
    available_days: "", available_minutes: "",
    sports: [], sports_frequency: {},
    running_mode: "", running_level: "", running_continuous_minutes: "",
    running_goals: [], running_preferred_days: [], cardio_preference: "",
    available_days_list: [], preferred_time: "",
    medical_conditions: [], medications: "", surgeries: [], medical_restrictions: "",
    current_pain_level: 0, pain_regions: [], past_injuries: [], uncomfortable_movements: [],
    gym_setup: { ...EMPTY_GYM_SETUP },
    preferences: [], training_style: "", motivations: [],
    perf_max_pushups: "", perf_max_squats: "", perf_max_plank_seconds: "",
    perf_max_run_minutes: "", perf_lifts_done: [],
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
    if (profileQ.data && !d.first_name) {
      const fullName = (profileQ.data.name as string | null) ?? "";
      const [fn, ...rest] = fullName.split(" ");
      if (fn) setD((x) => ({ ...x, first_name: fn, last_name: rest.join(" ") }));
    }
  }, [profileQ.data, navigate, d.first_name]);

  const canAdvance = useMemo<boolean>(() => {
    switch (step) {
      case 0: return true;
      case 1: return d.first_name.trim() !== "" && d.birth_date !== "" &&
        d.sex !== "" && typeof d.height_cm === "number" && typeof d.weight_kg === "number";
      case 2: return d.primary_goal !== "";
      case 3: return true; // secundários opcionais
      case 4: return d.experience_level !== "" && d.training_history !== "" &&
        d.available_days !== "" && d.available_minutes !== "";
      case 5: return true;
      case 6: return d.running_mode !== "";
      case 7: return d.available_days_list.length > 0 && d.preferred_time !== "";
      case 10: return d.gym_setup.location !== "";
      case 8: case 9: case 11: case 12: case 13: return true;
      default: return false;
    }
  }, [step, d]);

  const next = () => canAdvance && step < TOTAL_STEPS - 1 && setStep(step + 1);
  const back = () => step > 0 && setStep(step - 1);

  const finish = async () => {
    if (!canAdvance) return;
    setSaving(true);
    try {
      await submit({
        data: {
          first_name: d.first_name.trim(),
          last_name: d.last_name.trim() || null,
          birth_date: d.birth_date,
          sex: d.sex as Sex,
          height_cm: d.height_cm as number,
          weight_kg: d.weight_kg as number,
          waist_cm: typeof d.waist_cm === "number" ? d.waist_cm : null,
          hip_cm: typeof d.hip_cm === "number" ? d.hip_cm : null,
          chest_cm: typeof d.chest_cm === "number" ? d.chest_cm : null,
          arm_cm: typeof d.arm_cm === "number" ? d.arm_cm : null,
          thigh_cm: typeof d.thigh_cm === "number" ? d.thigh_cm : null,
          phone: d.phone.trim() || null,
          primary_goal: d.primary_goal as never,
          secondary_goals: d.secondary_goals,
          experience_level: d.experience_level as Experience,
          training_history: d.training_history as never,
          training_location: d.gym_setup.location,
          available_days: d.available_days as number,
          available_minutes: d.available_minutes as number,
          sports: d.sports, sports_frequency: d.sports_frequency,
          running_mode: d.running_mode as never,
          running_level: d.running_level || null,
          running_continuous_minutes: d.running_continuous_minutes || null,
          running_goals: d.running_goals,
          running_preferred_days: d.running_preferred_days,
          cardio_preference: d.cardio_preference || null,
          available_days_list: d.available_days_list,
          preferred_time: d.preferred_time || null,
          medical_conditions: d.medical_conditions,
          medications: d.medications || null,
          surgeries: d.surgeries,
          medical_restrictions: d.medical_restrictions || null,
          current_pain_level: d.current_pain_level,
          pain_regions: d.pain_regions,
          past_injuries: d.past_injuries,
          uncomfortable_movements: d.uncomfortable_movements,
          equipment: d.equipment,
          preferences: d.preferences,
          training_style: d.training_style || null,
          motivations: d.motivations,
          perf_max_pushups: typeof d.perf_max_pushups === "number" ? d.perf_max_pushups : null,
          perf_max_squats: typeof d.perf_max_squats === "number" ? d.perf_max_squats : null,
          perf_max_plank_seconds: typeof d.perf_max_plank_seconds === "number" ? d.perf_max_plank_seconds : null,
          perf_max_run_minutes: typeof d.perf_max_run_minutes === "number" ? d.perf_max_run_minutes : null,
          perf_lifts_done: d.perf_lifts_done,
          program_start_date: getLocalToday().local_date,
        },
      });
      if (user?.id) {
        qc.setQueryData(["profile", user.id], (current: unknown) => ({
          ...(current && typeof current === "object" ? current : {}),
          onboarding_completed: true,
        }));
      }
      void qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Tudo pronto. Seu programa foi gerado.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading || !user || profileQ.isPending || profileQ.data?.onboarding_completed === true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const pct = step === 0 ? 0 : (step / (TOTAL_STEPS - 1)) * 100;
  const isLast = step === TOTAL_STEPS - 1;

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      {step > 0 && (
        <div className="sticky top-0 z-10 bg-background/85 px-6 pt-7 pb-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span>Etapa {step} de {TOTAL_SECTIONS}</span>
            <span className="num">{Math.round(pct)}%</span>
          </div>
          <div className="mt-3 h-[3px] w-full overflow-hidden rounded-full bg-surface">
            <div className="h-full bg-titanium transition-all duration-700" style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      <div className="flex-1 px-6 pb-32 pt-8">
        {step === 0 && <Splash onStart={() => setStep(1)} />}
        {step === 1 && <S1 d={d} setD={setD} />}
        {step === 2 && <S2 d={d} setD={setD} />}
        {step === 3 && <S3 d={d} setD={setD} />}
        {step === 4 && <S4 d={d} setD={setD} />}
        {step === 5 && <S5 d={d} setD={setD} />}
        {step === 6 && <S6 d={d} setD={setD} />}
        {step === 7 && <S7 d={d} setD={setD} />}
        {step === 8 && <S8 d={d} setD={setD} />}
        {step === 9 && <S9 d={d} setD={setD} />}
        {step === 10 && <S10 d={d} setD={setD} />}
        {step === 11 && <S11 d={d} setD={setD} />}
        {step === 12 && <S12 d={d} setD={setD} />}
        {step === 13 && <S13 userId={user.id} registerPhoto={registerPhoto} />}
      </div>

      {step > 0 && (
        <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-border/40 bg-background/95 px-6 py-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-2xl">
          <div className="flex items-center gap-3">
            <button onClick={back}
              className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface/50 active:scale-95"
              aria-label="Voltar">
              <ArrowLeft className="h-5 w-5" />
            </button>
            {isLast ? (
              <button onClick={finish} disabled={saving || !canAdvance}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-[0.99]">
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {saving ? "Gerando seu programa..." : "Finalizar e gerar meu programa"}
              </button>
            ) : (
              <button onClick={next} disabled={!canAdvance}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-[0.99]">
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

// ============== Splash & primitives ==============

function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center animate-fade-in">
      <img src={pmLogo.url} alt="PM Hybrid" className="h-24 w-auto object-contain mb-10 opacity-95" />
      <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
        Avaliação inteligente
      </div>
      <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-tight text-titanium">
        Vamos calibrar<br />o seu programa
      </h1>
      <p className="mt-5 max-w-[340px] text-[15px] leading-relaxed text-muted-foreground">
        Em poucos minutos respondemos algumas perguntas e geramos uma periodização única para você — força, corrida e condicionamento em equilíbrio.
      </p>
      <button onClick={onStart}
        className="mt-12 flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99]">
        Começar avaliação
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Hero({ eyebrow, title, hint }: { eyebrow: string; title: string; hint?: string }) {
  return (
    <div className="animate-fade-in">
      <div className="text-[10px] font-medium uppercase tracking-[0.28em] text-muted-foreground">{eyebrow}</div>
      <h1 className="mt-3 text-[30px] font-semibold leading-[1.1] tracking-tight text-titanium">{title}</h1>
      {hint && <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-2xl border border-border bg-surface/40 px-5 text-[16px] font-medium tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-surface/60 transition-colors";
const textareaCls =
  "min-h-[100px] w-full rounded-2xl border border-border bg-surface/40 p-4 text-[15px] font-medium tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-surface/60 transition-colors";
const labelCls = "text-[11px] font-medium uppercase tracking-[0.2em] text-muted-foreground mb-2 block";

function BigChoice({ active, title, hint, onClick }: { active: boolean; title: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`w-full rounded-2xl border px-5 py-4 text-left transition-all active:scale-[0.99] ${
        active ? "border-primary/60 bg-primary/[0.08] shadow-glow" : "border-border bg-surface/40 hover:bg-surface/60"
      }`}>
      <div className="text-[15.5px] font-semibold tracking-tight">{title}</div>
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
      className={`h-12 rounded-xl border px-3 text-[13px] font-medium transition-all ${
        active ? "border-primary/60 bg-primary/[0.10] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}>{children}</button>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
        on ? "border-primary/60 bg-primary/[0.12] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}>{children}</button>
  );
}

function Multi({ label, items, selected, onToggle, max }: {
  label: string; items: readonly string[]; selected: string[]; onToggle: (v: string) => void; max?: number;
}) {
  return (
    <div>
      <label className={labelCls}>{label}{max ? ` · até ${max}` : ""}</label>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => (
          <Chip key={v} on={selected.includes(v)} onClick={() => onToggle(v)}>{v}</Chip>
        ))}
      </div>
    </div>
  );
}

const toggleArr = (arr: string[], v: string, max?: number) => {
  if (arr.includes(v)) return arr.filter((x) => x !== v);
  if (max && arr.length >= max) return arr;
  return [...arr, v];
};

// ============== SECTIONS ==============

type SP = { d: Data; setD: React.Dispatch<React.SetStateAction<Data>> };

function S1({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="1 / 13 · Perfil" title="Vamos te conhecer" hint="Esses dados calibram cada prescrição do seu plano." />
      <div className="animate-fade-in space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input className={inputCls} value={d.first_name} maxLength={60} autoFocus
              onChange={(e) => setD({ ...d, first_name: e.target.value })} />
          </div>
          <div>
            <label className={labelCls}>Sobrenome</label>
            <input className={inputCls} value={d.last_name} maxLength={80}
              onChange={(e) => setD({ ...d, last_name: e.target.value })} />
          </div>
        </div>
        <div>
          <label className={labelCls}>Data de nascimento</label>
          <input type="date" className={inputCls} value={d.birth_date}
            onChange={(e) => setD({ ...d, birth_date: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Sexo</label>
          <div className="grid grid-cols-3 gap-1.5">
            {(["male", "female", "other"] as Sex[]).map((v) => (
              <PillChoice key={v} active={d.sex === v} onClick={() => setD({ ...d, sex: v })}>
                {v === "male" ? "Masculino" : v === "female" ? "Feminino" : "Outro"}
              </PillChoice>
            ))}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Altura · cm</label>
            <input type="number" inputMode="numeric" className={inputCls} placeholder="175"
              value={d.height_cm} min={100} max={250}
              onChange={(e) => setD({ ...d, height_cm: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Peso · kg</label>
            <input type="number" inputMode="decimal" className={inputCls} placeholder="75"
              value={d.weight_kg} step="0.1" min={20} max={300}
              onChange={(e) => setD({ ...d, weight_kg: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
        </div>

        <details className="rounded-2xl border border-border/60 bg-surface/30 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground">Circunferências (opcional)</summary>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([
              ["waist_cm", "Cintura"], ["hip_cm", "Quadril"],
              ["chest_cm", "Peito"], ["arm_cm", "Braço"], ["thigh_cm", "Coxa"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <label className={labelCls}>{label} · cm</label>
                <input type="number" inputMode="decimal" className={inputCls} step="0.1"
                  value={d[k] as number | ""}
                  onChange={(e) => setD({ ...d, [k]: e.target.value === "" ? "" : Number(e.target.value) } as Data)} />
              </div>
            ))}
          </div>
        </details>

        <div>
          <label className={labelCls}>Telefone · opcional</label>
          <input type="tel" className={inputCls} placeholder="(11) 99999-9999"
            value={d.phone} onChange={(e) => setD({ ...d, phone: e.target.value })} maxLength={40} />
        </div>
      </div>
    </div>
  );
}

function S2({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="2 / 13 · Objetivo principal" title="Qual é o seu foco?" hint="Escolha apenas um — é a direção principal do seu programa." />
      <div className="animate-fade-in grid gap-2">
        {PRIMARY_GOAL_OPTIONS.map((g) => (
          <BigChoice key={g.v} active={d.primary_goal === g.v} title={g.label} hint={g.hint}
            onClick={() => setD({ ...d, primary_goal: g.v })} />
        ))}
      </div>
    </div>
  );
}

function S3({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="3 / 13 · Objetivos secundários" title="O que mais te interessa?" hint="Selecione até 3 — opcional." />
      <div className="animate-fade-in">
        <Multi label="Objetivos adicionais" items={SECONDARY_GOALS} selected={d.secondary_goals} max={3}
          onToggle={(v) => setD({ ...d, secondary_goals: toggleArr(d.secondary_goals, v, 3) })} />
      </div>
    </div>
  );
}

function S4({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="4 / 13 · Experiência de treino" title="Sua rotina atual" hint="Como você treina hoje." />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Nível</label>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPERIENCE_OPTIONS.map((o) => (
              <PillChoice key={o.v} active={d.experience_level === o.v}
                onClick={() => setD({ ...d, experience_level: o.v })}>{o.label}</PillChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Há quanto tempo treina</label>
          <div className="grid gap-1.5">
            {TRAINING_HISTORY_OPTIONS.map((o) => (
              <RowChoice key={o.v} active={d.training_history === o.v}
                onClick={() => setD({ ...d, training_history: o.v })}>{o.label}</RowChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Onde treina</label>
          <div className="grid grid-cols-2 gap-1.5">
            {TRAINING_LOCATION_OPTIONS.map((o) => (
              <PillChoice key={o} active={d.training_location === o}
                onClick={() => setD({ ...d, training_location: o })}>{o}</PillChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Dias por semana</label>
          <div className="grid grid-cols-4 gap-1.5">
            {DAYS_PER_WEEK.map((n) => (
              <PillChoice key={n} active={d.available_days === n}
                onClick={() => setD({ ...d, available_days: n })}>{n} dias</PillChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Tempo por treino</label>
          <div className="grid grid-cols-5 gap-1.5">
            {MINUTES_PER_SESSION.map((n) => (
              <PillChoice key={n} active={d.available_minutes === n}
                onClick={() => setD({ ...d, available_minutes: n })}>{n}min</PillChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function S5({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="5 / 13 · Esportes" title="Outras atividades" hint="Selecione o que pratica. Vamos considerar na sua recuperação." />
      <div className="animate-fade-in space-y-5">
        <Multi label="Esportes praticados" items={SPORTS_OPTIONS} selected={d.sports}
          onToggle={(v) => {
            const next = toggleArr(d.sports, v);
            const freq = { ...d.sports_frequency };
            if (!next.includes(v)) delete freq[v];
            setD({ ...d, sports: next, sports_frequency: freq });
          }} />
        {d.sports.length > 0 && (
          <div className="space-y-3">
            <label className={labelCls}>Frequência semanal</label>
            {d.sports.map((s) => (
              <div key={s} className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3">
                <span className="text-[14px] font-medium">{s}</span>
                <input type="number" min={0} max={14} inputMode="numeric"
                  className="h-10 w-20 rounded-lg border border-border bg-background px-3 text-center text-[14px] font-semibold outline-none focus:border-primary/50"
                  value={d.sports_frequency[s] ?? ""}
                  placeholder="0"
                  onChange={(e) => setD({
                    ...d,
                    sports_frequency: { ...d.sports_frequency, [s]: Number(e.target.value) || 0 },
                  })} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function S6({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="6 / 13 · Corrida e cardio" title="Como a corrida entra no seu plano?" hint="Esta resposta define se o programa terá ou não corrida." />
      <div className="animate-fade-in space-y-6">
        <div className="grid gap-2">
          {RUNNING_MODES.map((r) => (
            <BigChoice key={r.v} active={d.running_mode === r.v} title={r.label} hint={r.hint}
              onClick={() => setD({ ...d, running_mode: r.v })} />
          ))}
        </div>

        {d.running_mode !== "" && d.running_mode !== "desabilitado" && (
          <div className="space-y-5 pt-2">
            <div>
              <label className={labelCls}>Seu nível atual de corrida</label>
              <div className="grid grid-cols-2 gap-1.5">
                {RUNNING_LEVEL.map((o) => (
                  <PillChoice key={o} active={d.running_level === o}
                    onClick={() => setD({ ...d, running_level: o })}>{o}</PillChoice>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Quanto tempo consegue correr contínuo hoje</label>
              <div className="grid gap-1.5">
                {RUNNING_CONTINUOUS.map((o) => (
                  <RowChoice key={o} active={d.running_continuous_minutes === o}
                    onClick={() => setD({ ...d, running_continuous_minutes: o })}>{o}</RowChoice>
                ))}
              </div>
            </div>
            <Multi label="Objetivos com corrida" items={RUNNING_GOALS_OPTIONS}
              selected={d.running_goals}
              onToggle={(v) => setD({ ...d, running_goals: toggleArr(d.running_goals, v) })} />
            <Multi label="Dias preferidos para correr" items={WEEK_DAYS}
              selected={d.running_preferred_days}
              onToggle={(v) => setD({ ...d, running_preferred_days: toggleArr(d.running_preferred_days, v) })} />
          </div>
        )}

        <div>
          <label className={labelCls}>Se não quiser correr, qual cardio prefere?</label>
          <div className="grid grid-cols-2 gap-1.5">
            {CARDIO_OPTIONS.map((o) => (
              <PillChoice key={o} active={d.cardio_preference === o}
                onClick={() => setD({ ...d, cardio_preference: o })}>{o}</PillChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function S7({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="7 / 13 · Disponibilidade" title="Quando você pode treinar?" />
      <div className="animate-fade-in space-y-5">
        <Multi label="Dias da semana que pode treinar" items={WEEK_DAYS}
          selected={d.available_days_list}
          onToggle={(v) => setD({ ...d, available_days_list: toggleArr(d.available_days_list, v) })} />
        <div>
          <label className={labelCls}>Horário preferido</label>
          <div className="grid grid-cols-4 gap-1.5">
            {PREFERRED_TIMES.map((o) => (
              <PillChoice key={o} active={d.preferred_time === o}
                onClick={() => setD({ ...d, preferred_time: o })}>{o}</PillChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function S8({ d, setD }: SP) {
  const addSurgery = () => setD({ ...d, surgeries: [...d.surgeries, { name: "", year: "" }] });
  const updateSurgery = (i: number, key: "name" | "year", v: string) => {
    const s = [...d.surgeries]; s[i] = { ...s[i], [key]: v }; setD({ ...d, surgeries: s });
  };
  const rmSurgery = (i: number) => setD({ ...d, surgeries: d.surgeries.filter((_, idx) => idx !== i) });

  return (
    <div className="space-y-6">
      <Hero eyebrow="8 / 13 · Saúde" title="Histórico médico" hint="Tudo confidencial — usado apenas para adaptar seu plano." />
      <div className="animate-fade-in space-y-6">
        <Multi label="Diagnósticos médicos" items={MEDICAL_CONDITIONS}
          selected={d.medical_conditions}
          onToggle={(v) => setD({ ...d, medical_conditions: toggleArr(d.medical_conditions, v) })} />
        <div>
          <label className={labelCls}>Faz uso contínuo de medicamentos? Quais?</label>
          <textarea className={textareaCls} value={d.medications} maxLength={500}
            placeholder="Ex: Losartana 50mg, vitamina D..."
            onChange={(e) => setD({ ...d, medications: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Cirurgias realizadas</label>
          <div className="space-y-2">
            {d.surgeries.map((s, i) => (
              <div key={i} className="flex items-center gap-2">
                <input className={`${inputCls} h-12`} value={s.name} placeholder="Tipo (ex: menisco)"
                  onChange={(e) => updateSurgery(i, "name", e.target.value)} />
                <input className={`${inputCls} h-12 w-24`} value={s.year ?? ""} placeholder="Ano"
                  maxLength={10} onChange={(e) => updateSurgery(i, "year", e.target.value)} />
                <button onClick={() => rmSurgery(i)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface/40">
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button onClick={addSurgery}
              className="w-full rounded-xl border border-dashed border-border bg-surface/20 px-4 py-3 text-[13px] font-medium text-muted-foreground hover:text-foreground">
              + Adicionar cirurgia
            </button>
          </div>
        </div>
        <div>
          <label className={labelCls}>Restrição médica para exercícios</label>
          <textarea className={textareaCls} value={d.medical_restrictions} maxLength={500}
            placeholder="Descreva, se houver"
            onChange={(e) => setD({ ...d, medical_restrictions: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

function S9({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="9 / 13 · Lesões e dores" title="Como você se sente hoje?" hint="Vamos adaptar exercícios para evitar desconforto." />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Dor atual · {d.current_pain_level} / 10</label>
          <input type="range" min={0} max={10} value={d.current_pain_level}
            onChange={(e) => setD({ ...d, current_pain_level: Number(e.target.value) })}
            className="w-full accent-titanium" />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Sem dor</span><span>Dor intensa</span>
          </div>
        </div>
        <Multi label="Regiões com dor ou lesão" items={PAIN_REGIONS}
          selected={d.pain_regions}
          onToggle={(v) => setD({ ...d, pain_regions: toggleArr(d.pain_regions, v) })} />
        <Multi label="Lesões anteriores" items={PAST_INJURIES}
          selected={d.past_injuries}
          onToggle={(v) => setD({ ...d, past_injuries: toggleArr(d.past_injuries, v) })} />
        <Multi label="Movimentos que causam desconforto" items={UNCOMFORTABLE_MOVEMENTS}
          selected={d.uncomfortable_movements}
          onToggle={(v) => setD({ ...d, uncomfortable_movements: toggleArr(d.uncomfortable_movements, v) })} />
      </div>
    </div>
  );
}

function S10({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="10 / 13 · Equipamentos" title="O que você tem disponível?" hint="Selecione tudo que tem acesso. Vamos respeitar na hora de prescrever." />
      <div className="animate-fade-in">
        <Multi label="Equipamentos" items={EQUIPMENT_OPTIONS} selected={d.equipment}
          onToggle={(v) => setD({ ...d, equipment: toggleArr(d.equipment, v) })} />
      </div>
    </div>
  );
}

function S11({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="11 / 13 · Preferências" title="Como você gosta de treinar?" />
      <div className="animate-fade-in space-y-6">
        <Multi label="O que você mais gosta" items={PREFERENCES_OPTIONS}
          selected={d.preferences}
          onToggle={(v) => setD({ ...d, preferences: toggleArr(d.preferences, v) })} />
        <div>
          <label className={labelCls}>Estilo de treino preferido</label>
          <div className="grid grid-cols-3 gap-1.5">
            {TRAINING_STYLES.map((o) => (
              <PillChoice key={o} active={d.training_style === o}
                onClick={() => setD({ ...d, training_style: o })}>{o}</PillChoice>
            ))}
          </div>
        </div>
        <Multi label="O que mais te motiva" items={MOTIVATIONS_OPTIONS}
          selected={d.motivations}
          onToggle={(v) => setD({ ...d, motivations: toggleArr(d.motivations, v) })} />
      </div>
    </div>
  );
}

function S12({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero eyebrow="12 / 13 · Avaliação de performance" title="Seus números atuais"
        hint="Tudo opcional — quanto mais souber, melhor a estimativa de cargas iniciais." />
      <div className="animate-fade-in space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Máx. flexões</label>
            <input type="number" inputMode="numeric" min={0} className={inputCls}
              value={d.perf_max_pushups}
              onChange={(e) => setD({ ...d, perf_max_pushups: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Máx. agachamentos livres</label>
            <input type="number" inputMode="numeric" min={0} className={inputCls}
              value={d.perf_max_squats}
              onChange={(e) => setD({ ...d, perf_max_squats: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Prancha máx · segundos</label>
            <input type="number" inputMode="numeric" min={0} className={inputCls}
              value={d.perf_max_plank_seconds}
              onChange={(e) => setD({ ...d, perf_max_plank_seconds: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
          <div>
            <label className={labelCls}>Maior corrida contínua · min</label>
            <input type="number" inputMode="numeric" min={0} className={inputCls}
              value={d.perf_max_run_minutes}
              onChange={(e) => setD({ ...d, perf_max_run_minutes: e.target.value === "" ? "" : Number(e.target.value) })} />
          </div>
        </div>
        <Multi label="Já executou:" items={LIFTS_DONE} selected={d.perf_lifts_done}
          onToggle={(v) => setD({ ...d, perf_lifts_done: toggleArr(d.perf_lifts_done, v) })} />
      </div>
    </div>
  );
}

function S13({ userId, registerPhoto }: {
  userId: string;
  registerPhoto: (opts: { data: { photo_type: "frente" | "lado" | "costas"; storage_path: string } }) => Promise<unknown>;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  const upload = async (type: "frente" | "lado" | "costas", file: File) => {
    setUploading(type);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${type}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("progress-photos").upload(path, file, {
        contentType: file.type, upsert: false,
      });
      if (error) throw error;
      await registerPhoto({ data: { photo_type: type, storage_path: path } });
      setUploaded((u) => ({ ...u, [type]: true }));
      toast.success(`Foto (${type}) enviada.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(null);
    }
  };

  return (
    <div className="space-y-6">
      <Hero eyebrow="13 / 13 · Fotos de progresso" title="Tire suas fotos iniciais"
        hint="Opcional e 100% privado. Só você consegue ver." />
      <div className="animate-fade-in grid gap-3">
        {(["frente", "lado", "costas"] as const).map((type) => (
          <label key={type}
            className={`flex cursor-pointer items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
              uploaded[type] ? "border-primary/60 bg-primary/[0.08]" : "border-border bg-surface/40 hover:bg-surface/60"
            }`}>
            <div>
              <div className="text-[15px] font-semibold capitalize">{type}</div>
              <div className="text-[12px] text-muted-foreground">
                {uploaded[type] ? "Enviada" : "Toque para enviar"}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-titanium text-primary-foreground">
              {uploading === type ? <Loader2 className="h-4 w-4 animate-spin" /> :
               uploaded[type] ? <Check className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
            </div>
            <input type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(type, f); }} />
          </label>
        ))}
      </div>
      <p className="text-center text-[12px] text-muted-foreground">
        Pode pular esta etapa e enviar depois no seu perfil.
      </p>
    </div>
  );
}
