import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { completeOnboarding, getProfile } from "@/lib/profile.functions";
import { getMyRole } from "@/lib/exercise-media.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLocalToday } from "@/lib/local-today";
import pmLogo from "@/assets/pm-logo.png";
import {
  PRIMARY_GOAL_OPTIONS,
  SECONDARY_GOALS,
  TRAINING_HISTORY_OPTIONS,
  TRAINING_LOCATION_OPTIONS,
  TRAINING_LOCATION_DB_VALUE,
  MINUTES_PER_SESSION,
  SPORTS_OPTIONS,
  RUNNING_MODES,
  RUNNING_LEVEL,
  RUNNING_CONTINUOUS,
  RUNNING_GOALS_OPTIONS,
  WEEK_DAYS,
  CARDIO_OPTIONS,
  PREFERRED_TIMES,
  MEDICAL_CONDITIONS,
  PAIN_REGIONS,
  PAST_INJURIES,
  UNCOMFORTABLE_MOVEMENTS,
  PREFERENCES_OPTIONS,
  TRAINING_STYLES,
  MOTIVATIONS_OPTIONS,
  EXPERIENCE_OPTIONS,
  FULL_GYM_COMPLETENESS,
  FULL_GYM_MISSING_OPTIONS,
  CONDO_GYM_EQUIPMENT,
  HOME_EQUIPMENT,
  BOX_COMPLETENESS,
  BOX_EQUIPMENT,
  MIXED_PRIMARY_LOCATIONS,
} from "@/lib/onboarding-options";

interface GymSetup {
  location: string;
  full_gym_completeness: string;
  full_gym_missing: string[];
  full_gym_missing_other: string;
  condo_equipment: string[];
  condo_other: string;
  home_equipment: string[];
  home_other: string;
  box_completeness: string;
  box_equipment: string[];
  box_other: string;
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

function deriveEquipment(g: GymSetup): string[] {
  const set = new Set<string>();
  switch (g.location) {
    case "Academia Completa": {
      if (g.full_gym_completeness === "Algumas máquinas não existem") {
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
  // Perfil
  first_name: string;
  birth_date: string; sex: Sex | "";
  height_cm: number | ""; weight_kg: number | "";
  // Objetivo
  primary_goal: string;
  secondary_goals: string[];
  // Experiência + disponibilidade
  experience_level: Experience | "";
  training_history: string;
  available_days_list: string[];
  available_minutes: number | "";
  preferred_time: string;
  // Cardio + esportes
  running_mode: string;
  running_level: string;
  running_continuous_minutes: string;
  running_goals: string[];
  running_preferred_days: string[];
  cardio_preference: string;
  sports: string[];
  // Saúde + lesões
  medical_conditions: string[];
  current_pain_level: number;
  pain_regions: string[];
  past_injuries: string[];
  uncomfortable_movements: string[];
  health_notes: string;
  // Local
  gym_setup: GymSetup;
  // Preferências
  preferences: string[];
  training_style: string;
  motivations: string[];
}

// 7 seções de conteúdo + splash
const TOTAL_STEPS = 8;

// Idade mínima para usar o app (compliance). Trava no passo da data de nascimento.
const MIN_AGE = 16;
function ageFromISO(iso: string): number | null {
  if (!iso) return null;
  const b = new Date(iso);
  if (isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}
const isAtLeast16 = (iso: string): boolean => {
  const a = ageFromISO(iso);
  return a !== null && a >= MIN_AGE;
};

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fetchProfile = useServerFn(getProfile);
  const fetchRole = useServerFn(getMyRole);
  const submit = useServerFn(completeOnboarding);
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });

  const roleQ = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
    enabled: !!user,
  });
  const isAdmin = roleQ.data?.isAdmin === true;

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Data>({
    first_name: "", birth_date: "", sex: "",
    height_cm: "", weight_kg: "",
    primary_goal: "",
    secondary_goals: [],
    experience_level: "", training_history: "",
    available_days_list: [], available_minutes: "", preferred_time: "",
    running_mode: "", running_level: "", running_continuous_minutes: "",
    running_goals: [], running_preferred_days: [], cardio_preference: "",
    sports: [],
    medical_conditions: [],
    current_pain_level: 0, pain_regions: [], past_injuries: [],
    uncomfortable_movements: [], health_notes: "",
    gym_setup: { ...EMPTY_GYM_SETUP },
    preferences: [], training_style: "", motivations: [],
  });

  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: "/onboarding" } as never, replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    const force = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("force") === "1";
    if (profileQ.data?.onboarding_completed === true && !force) {
      navigate({ to: "/", replace: true });
    }
    if (profileQ.data && !d.first_name) {
      const fullName = (profileQ.data.name as string | null) ?? "";
      const [fn] = fullName.split(" ");
      if (fn) setD((x) => ({ ...x, first_name: fn }));
    }
  }, [profileQ.data, navigate, d.first_name]);

  const canAdvance = useMemo<boolean>(() => {
    switch (step) {
      case 0: return true;
      case 1: return d.first_name.trim() !== "" && d.birth_date !== "" && isAtLeast16(d.birth_date) &&
        d.sex !== "" && typeof d.height_cm === "number" && typeof d.weight_kg === "number";
      case 2: return d.primary_goal !== "";
      case 3: return d.experience_level !== "" && d.training_history !== "" &&
        d.available_days_list.length > 0 && d.available_minutes !== "";
      case 4: return d.running_mode !== "";
      case 5: return true; // saúde toda opcional
      case 6: return d.gym_setup.location !== "";
      case 7: return true; // preferências opcionais
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
          birth_date: d.birth_date,
          sex: d.sex as Sex,
          height_cm: d.height_cm as number,
          weight_kg: d.weight_kg as number,
          primary_goal: d.primary_goal as never,
          secondary_goals: d.secondary_goals,
          experience_level: d.experience_level as Experience,
          training_history: d.training_history as never,
          training_location: d.gym_setup.location
            ? (TRAINING_LOCATION_DB_VALUE[d.gym_setup.location as keyof typeof TRAINING_LOCATION_DB_VALUE] ?? d.gym_setup.location)
            : null,
          available_days: d.available_days_list.length,
          available_minutes: d.available_minutes as number,
          available_days_list: d.available_days_list,
          preferred_time: d.preferred_time || null,
          sports: d.sports, sports_frequency: {},
          running_mode: d.running_mode as never,
          running_level: d.running_level || null,
          running_continuous_minutes: d.running_continuous_minutes || null,
          running_goals: d.running_goals,
          running_preferred_days: d.running_preferred_days,
          cardio_preference: d.cardio_preference || null,
          medical_conditions: d.medical_conditions,
          medications: null,
          surgeries: [],
          medical_restrictions: d.health_notes.trim() || null,
          current_pain_level: d.current_pain_level,
          pain_regions: d.pain_regions,
          past_injuries: d.past_injuries,
          uncomfortable_movements: d.uncomfortable_movements,
          equipment: deriveEquipment(d.gym_setup),
          gym_setup: d.gym_setup,
          preferences: d.preferences,
          training_style: d.training_style || null,
          motivations: d.motivations,
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

  const skipOnboarding = async () => {
    setSaving(true);
    try {
      await submit({
        data: {
          first_name: d.first_name.trim() || "Admin",
          birth_date: d.birth_date || "1990-01-01",
          sex: (d.sex as Sex) || "male",
          height_cm: (d.height_cm as number) || 175,
          weight_kg: (d.weight_kg as number) || 75,
          primary_goal: "saude_geral" as never,
          secondary_goals: [],
          experience_level: "intermediate" as Experience,
          training_history: "gt_5y" as never,
          training_location: "gym",
          available_days: 5,
          available_minutes: 60,
          available_days_list: ["Segunda", "Terça", "Quarta", "Quinta", "Sexta"],
          preferred_time: "Manhã",
          sports: [], sports_frequency: {},
          running_mode: "desabilitado" as never,
          running_level: null, running_continuous_minutes: null,
          running_goals: [], running_preferred_days: [],
          cardio_preference: null,
          medical_conditions: [], medications: null, surgeries: [],
          medical_restrictions: null,
          current_pain_level: 0, pain_regions: [], past_injuries: [],
          uncomfortable_movements: [],
          equipment: ["Academia completa"],
          gym_setup: { ...EMPTY_GYM_SETUP, location: "Academia Completa" },
          preferences: [], training_style: null, motivations: [],
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
      navigate({ to: "/", replace: true });
    } catch {
      navigate({ to: "/", replace: true });
    } finally {
      setSaving(false);
    }
  };

  const forceView = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("force") === "1";
  if (loading || !user || profileQ.isPending || (profileQ.data?.onboarding_completed === true && !forceView)) {
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
      {isAdmin && (
        <div className="sticky top-0 z-30 flex items-center justify-between bg-background/95 px-6 pb-2 pt-[max(env(safe-area-inset-top,0px),0.75rem)] backdrop-blur-2xl">
          <span className="text-[11px] font-medium uppercase tracking-widest text-primary/70">Admin</span>
          <button onClick={skipOnboarding} disabled={saving}
            className="rounded-xl border border-primary/40 bg-primary/10 px-4 py-2 text-[12px] font-semibold text-primary active:scale-95 disabled:opacity-50">
            {saving ? <Loader2 className="inline h-3 w-3 animate-spin" /> : "Pular onboarding →"}
          </button>
        </div>
      )}
      {step > 0 && (
        <div className="sticky top-0 z-10 bg-background/85 px-6 pt-7 pb-4 backdrop-blur-2xl">
          <div className="h-[3px] w-full overflow-hidden rounded-full bg-surface">
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

// ============================================================
// Primitives
// ============================================================

function Splash({ onStart }: { onStart: () => void }) {
  return (
    <div className="flex min-h-[80vh] flex-col items-center justify-center text-center animate-fade-in">
      <img src={pmLogo} alt="PM Hybrid" className="h-24 w-auto object-contain mb-10 opacity-95" />
      <div className="text-[10px] font-medium uppercase tracking-[0.32em] text-muted-foreground">
        Avaliação inteligente
      </div>
      <h1 className="mt-4 text-[40px] font-semibold leading-[1.05] tracking-tight text-titanium">
        Vamos calibrar<br />o seu programa
      </h1>
      <p className="mt-5 max-w-[340px] text-[15px] leading-relaxed text-muted-foreground">
        7 telas rápidas e geramos uma periodização única para você — força, corrida e condicionamento em equilíbrio.
      </p>
      <button onClick={onStart}
        className="mt-12 flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99]">
        Começar avaliação
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  );
}

function Hero({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className="animate-fade-in">
      <h1 className="text-[30px] font-semibold leading-[1.1] tracking-tight text-titanium">{title}</h1>
      {hint && <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">{hint}</p>}
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-2xl border border-border bg-surface/40 px-5 text-[16px] font-medium tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-surface/60 transition-colors";
const textareaCls =
  "min-h-[88px] w-full rounded-2xl border border-border bg-surface/40 p-4 text-[15px] font-medium tracking-tight outline-none placeholder:text-muted-foreground/50 focus:border-primary/50 focus:bg-surface/60 transition-colors";
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

// 1 · Perfil
function S1({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero title="Vamos te conhecer" hint="O básico para calibrar a prescrição." />
      <div className="animate-fade-in space-y-5">
        <div>
          <label className={labelCls}>Nome</label>
          <input className={inputCls} value={d.first_name} maxLength={60} autoFocus
            placeholder="Como você quer ser chamado"
            onChange={(e) => setD({ ...d, first_name: e.target.value })} />
        </div>
        <div>
          <label className={labelCls}>Data de nascimento</label>
          <input type="date" className={inputCls} value={d.birth_date}
            onChange={(e) => setD({ ...d, birth_date: e.target.value })} />
          {d.birth_date !== "" && !isAtLeast16(d.birth_date) && (
            <p className="mt-2 text-[12px] font-medium text-destructive">
              É necessário ter pelo menos {MIN_AGE} anos para usar o PM Hybrid.
            </p>
          )}
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
      </div>
    </div>
  );
}

// 2 · Objetivo
function S2({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero title="Qual é o seu foco?" hint="Escolha o objetivo principal e, se quiser, até 3 secundários." />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Objetivo principal</label>
          <div className="grid gap-2">
            {PRIMARY_GOAL_OPTIONS.map((g) => (
              <BigChoice key={g.v} active={d.primary_goal === g.v} title={g.label} hint={g.hint}
                onClick={() => setD({ ...d, primary_goal: g.v })} />
            ))}
          </div>
        </div>
        <Multi label="Objetivos secundários (opcional)" items={SECONDARY_GOALS} selected={d.secondary_goals} max={3}
          onToggle={(v) => setD({ ...d, secondary_goals: toggleArr(d.secondary_goals, v, 3) })} />
      </div>
    </div>
  );
}

// 3 · Experiência + disponibilidade
function S3({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero title="Sua rotina de treino" hint="Experiência e quando você consegue treinar." />
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

// 4 · Cardio + esportes
function S4({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero title="Cardio e outras atividades" hint="Define se o programa terá corrida e como considerar seus outros esportes." />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Como a corrida entra no seu plano?</label>
          <div className="grid gap-2">
            {RUNNING_MODES.map((r) => (
              <BigChoice key={r.v} active={d.running_mode === r.v} title={r.label} hint={r.hint}
                onClick={() => setD({ ...d, running_mode: r.v })} />
            ))}
          </div>
        </div>

        {d.running_mode !== "" && d.running_mode !== "desabilitado" && (
          <div className="space-y-5">
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
              <label className={labelCls}>Quanto tempo corre contínuo hoje</label>
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

        <Multi label="Outros esportes que pratica (opcional)" items={SPORTS_OPTIONS} selected={d.sports}
          onToggle={(v) => setD({ ...d, sports: toggleArr(d.sports, v) })} />
      </div>
    </div>
  );
}

// 5 · Saúde + lesões
function S5({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero title="Saúde e lesões" hint="Tudo confidencial — usado apenas para adaptar exercícios." />
      <div className="animate-fade-in space-y-6">
        <Multi label="Diagnósticos médicos" items={MEDICAL_CONDITIONS}
          selected={d.medical_conditions}
          onToggle={(v) => setD({ ...d, medical_conditions: toggleArr(d.medical_conditions, v) })} />

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

        <div>
          <label className={labelCls}>Algo importante a saber? (opcional)</label>
          <textarea className={textareaCls} value={d.health_notes} maxLength={500}
            placeholder="Ex: cirurgia de menisco em 2022, uso losartana..."
            onChange={(e) => setD({ ...d, health_notes: e.target.value })} />
        </div>
      </div>
    </div>
  );
}

// 6 · Local + equipamentos
function S6({ d, setD }: SP) {
  const g = d.gym_setup;
  const setG = (patch: Partial<GymSetup>) =>
    setD({ ...d, gym_setup: { ...g, ...patch } });

  const selectLocation = (loc: string) => {
    setD({ ...d, gym_setup: { ...EMPTY_GYM_SETUP, location: loc } });
  };

  return (
    <div className="space-y-6">
      <Hero title="Onde você treina?" hint="Só vamos prescrever exercícios que você consegue executar." />

      <div className="animate-fade-in space-y-6">
        <div className="grid gap-2">
          {TRAINING_LOCATION_OPTIONS.map((o) => (
            <RowChoice key={o} active={g.location === o} onClick={() => selectLocation(o)}>{o}</RowChoice>
          ))}
        </div>

        {g.location === "Academia Completa" && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className={labelCls}>Sua academia tem equipamentos comuns?</label>
              <div className="grid gap-2">
                {FULL_GYM_COMPLETENESS.map((o) => (
                  <RowChoice key={o} active={g.full_gym_completeness === o}
                    onClick={() => setG({ full_gym_completeness: o, full_gym_missing: [] })}>{o}</RowChoice>
                ))}
              </div>
            </div>
            {g.full_gym_completeness === "Algumas máquinas não existem" && (
              <Multi label="Quais NÃO existem?" items={FULL_GYM_MISSING_OPTIONS}
                selected={g.full_gym_missing}
                onToggle={(v) => setG({ full_gym_missing: toggleArr(g.full_gym_missing, v) })} />
            )}
          </div>
        )}

        {g.location === "Academia de Condomínio / Prédio" && (
          <Multi label="Equipamentos disponíveis" items={CONDO_GYM_EQUIPMENT}
            selected={g.condo_equipment}
            onToggle={(v) => setG({ condo_equipment: toggleArr(g.condo_equipment, v) })} />
        )}

        {g.location === "Casa" && (
          <Multi label="Equipamentos que você tem em casa" items={HOME_EQUIPMENT}
            selected={g.home_equipment}
            onToggle={(v) => setG({ home_equipment: toggleArr(g.home_equipment, v) })} />
        )}

        {g.location === "Box de CrossFit" && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className={labelCls}>Seu box é completo?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {BOX_COMPLETENESS.map((o) => (
                  <PillChoice key={o} active={g.box_completeness === o}
                    onClick={() => setG({ box_completeness: o, box_equipment: [] })}>{o}</PillChoice>
                ))}
              </div>
            </div>
            {g.box_completeness === "Não" && (
              <Multi label="Marque o que existe no seu box" items={BOX_EQUIPMENT}
                selected={g.box_equipment}
                onToggle={(v) => setG({ box_equipment: toggleArr(g.box_equipment, v) })} />
            )}
          </div>
        )}

        {g.location === "Misto" && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <label className={labelCls}>Onde treina com mais frequência?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {MIXED_PRIMARY_LOCATIONS.map((o) => (
                  <PillChoice key={o} active={g.mixed_primary === o}
                    onClick={() => setG({ mixed_primary: o })}>{o}</PillChoice>
                ))}
              </div>
            </div>
            <Multi label="Outros locais que usa" items={MIXED_PRIMARY_LOCATIONS.filter((l) => l !== g.mixed_primary)}
              selected={g.mixed_other_locations}
              onToggle={(v) => setG({ mixed_other_locations: toggleArr(g.mixed_other_locations, v) })} />

            {(g.mixed_primary === "Condomínio" || g.mixed_other_locations.includes("Condomínio")) && (
              <Multi label="Equipamentos no condomínio" items={CONDO_GYM_EQUIPMENT}
                selected={g.condo_equipment}
                onToggle={(v) => setG({ condo_equipment: toggleArr(g.condo_equipment, v) })} />
            )}
            {(g.mixed_primary === "Casa" || g.mixed_other_locations.includes("Casa")) && (
              <Multi label="Equipamentos em casa" items={HOME_EQUIPMENT}
                selected={g.home_equipment}
                onToggle={(v) => setG({ home_equipment: toggleArr(g.home_equipment, v) })} />
            )}
            {(g.mixed_primary === "Box" || g.mixed_other_locations.includes("Box")) && (
              <Multi label="Equipamentos no box" items={BOX_EQUIPMENT}
                selected={g.box_equipment}
                onToggle={(v) => setG({ box_equipment: toggleArr(g.box_equipment, v) })} />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// 7 · Preferências
function S7({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero title="Como você gosta de treinar?" hint="Última etapa — tudo opcional." />
      <div className="animate-fade-in space-y-6">
        <Multi label="O que mais gosta" items={PREFERENCES_OPTIONS}
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
