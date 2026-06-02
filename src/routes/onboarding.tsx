import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  completeOnboarding,
  getProfile,
  registerProgressPhoto,
  saveOnboardingData,
} from "@/lib/profile.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getLocalToday } from "@/lib/local-today";
import { supabase } from "@/integrations/supabase/client";
import pmLogo from "@/assets/pm-logo.png.asset.json";
import {
  PRIMARY_GOAL_OPTIONS,
  SECONDARY_GOALS,
  TRAINING_HISTORY_OPTIONS,
  HAD_STRUCTURED_PROGRAM_OPTIONS,
  TRAINING_LOCATION_OPTIONS,
  DAYS_PER_WEEK,
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
  HAD_SURGERY_OPTIONS,
  LAST_CHECKUP_OPTIONS,
  PAIN_REGIONS,
  PAST_INJURIES,
  UNCOMFORTABLE_MOVEMENTS,
  PREFERENCES_OPTIONS,
  TRAINING_STYLES,
  MOTIVATIONS_OPTIONS,
  LIFTS_DONE,
  EXPERIENCE_OPTIONS,
  FULL_GYM_COMPLETENESS,
  FULL_GYM_MISSING_OPTIONS,
  CONDO_GYM_EQUIPMENT,
  HOME_EQUIPMENT,
  BOX_COMPLETENESS,
  BOX_EQUIPMENT,
  MIXED_PRIMARY_LOCATIONS,
  PROFESSIONAL_ACTIVITY_OPTIONS,
  SLEEP_HOURS_OPTIONS,
  WATER_INTAKE_OPTIONS,
  ALCOHOL_FREQUENCY_OPTIONS,
} from "@/lib/onboarding-options";

// ============================================================
// Types
// ============================================================

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

type Sex = "male" | "female" | "other" | "prefer_not_to_say";
type Experience = "beginner" | "intermediate" | "advanced";

interface Data {
  // Etapa 1 — Perfil pessoal
  first_name: string;
  last_name: string;
  birth_date: string;
  sex: Sex | "";
  height_cm: number | "";
  weight_kg: number | "";
  phone: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
  waist_cm: number | "";
  hip_cm: number | "";
  chest_cm: number | "";
  arm_cm: number | "";
  thigh_cm: number | "";
  // Etapa 2 — Objetivo principal
  primary_goal: string;
  primary_goal_other: string;
  // Etapa 3 — Objetivos secundários
  secondary_goals: string[];
  // Etapa 4 — Experiência
  experience_level: Experience | "";
  training_history: string;
  had_structured_program: string;
  // Etapa 5 — Disponibilidade
  available_days: number | "";
  available_minutes: number | "";
  available_days_list: string[];
  preferred_time: string;
  // Etapa 6 — Local e equipamentos
  gym_setup: GymSetup;
  // Etapa 7 — Corrida e cardio
  running_mode: string;
  running_level: string;
  running_continuous_minutes: string;
  running_goals: string[];
  running_preferred_days: string[];
  cardio_preference: string;
  // Etapa 8 — Esportes
  sports: string[];
  sports_frequency: Record<string, number>;
  sports_notes: string;
  // Etapa 9 — Hábitos
  professional_activity: string;
  sleep_hours: string;
  water_intake: string;
  smokes: boolean;
  alcohol_frequency: string;
  // Etapa 10 — Saúde
  medical_conditions: string[];
  medications: string;
  had_surgery: string;
  medical_restrictions: string;
  last_medical_checkup: string;
  // Etapa 11 — Lesões e dores
  current_pain_level: number;
  pain_regions: string[];
  pain_intensity: Record<string, number>;
  past_injuries: string[];
  uncomfortable_movements: string[];
  limitations_notes: string;
  // Etapa 12 — Preferências
  preferences: string[];
  training_style: string;
  motivations: string[];
  // Etapa 13 — Performance
  perf_max_pushups: number | "";
  perf_max_squats: number | "";
  perf_max_plank_seconds: number | "";
  perf_max_run_minutes: number | "";
  perf_longest_run_km: number | "";
  perf_lifts_done: string[];
}

// ============================================================
// Constants
// ============================================================

const TOTAL_ETAPAS = 14; // steps 1–14 (step 0 = splash)
const TOTAL_STEPS = TOTAL_ETAPAS + 1; // + splash

const INITIAL_DATA: Data = {
  first_name: "", last_name: "", birth_date: "", sex: "",
  height_cm: "", weight_kg: "",
  phone: "", emergency_contact_name: "", emergency_contact_phone: "",
  waist_cm: "", hip_cm: "", chest_cm: "", arm_cm: "", thigh_cm: "",
  primary_goal: "", primary_goal_other: "",
  secondary_goals: [],
  experience_level: "", training_history: "", had_structured_program: "",
  available_days: "", available_minutes: "",
  available_days_list: [], preferred_time: "",
  gym_setup: { ...EMPTY_GYM_SETUP },
  running_mode: "", running_level: "", running_continuous_minutes: "",
  running_goals: [], running_preferred_days: [], cardio_preference: "",
  sports: [], sports_frequency: {}, sports_notes: "",
  professional_activity: "", sleep_hours: "", water_intake: "",
  smokes: false, alcohol_frequency: "",
  medical_conditions: [], medications: "", had_surgery: "",
  medical_restrictions: "", last_medical_checkup: "",
  current_pain_level: 0, pain_regions: [], pain_intensity: {},
  past_injuries: [], uncomfortable_movements: [], limitations_notes: "",
  preferences: [], training_style: "", motivations: [],
  perf_max_pushups: "", perf_max_squats: "", perf_max_plank_seconds: "",
  perf_max_run_minutes: "", perf_longest_run_km: "", perf_lifts_done: [],
};

// ============================================================
// Equipment derivation
// ============================================================

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
        if (loc === "Academia") {
          ["Rack", "Barra olímpica", "Halteres", "Máquina de cabos", "Leg Press", "Banco ajustável"].forEach((e) => set.add(e));
        }
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

// ============================================================
// Route
// ============================================================

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Avaliação · PM Hybrid" }] }),
  component: OnboardingPage,
});

// ============================================================
// Main component
// ============================================================

function OnboardingPage() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const fetchProfile = useServerFn(getProfile);
  const submit = useServerFn(completeOnboarding);
  const registerPhoto = useServerFn(registerProgressPhoto);
  const saveStep = useServerFn(saveOnboardingData);
  const qc = useQueryClient();

  const profileQ = useQuery({
    queryKey: ["profile", user?.id],
    queryFn: () => fetchProfile(),
    enabled: !!user,
  });

  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [d, setD] = useState<Data>(INITIAL_DATA);

  // Redirect if not authenticated
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: "/onboarding" } as never, replace: true });
    }
  }, [loading, user, navigate]);

  // Redirect if already onboarded; pre-fill from existing profile
  useEffect(() => {
    if (profileQ.data?.onboarding_completed === true) {
      navigate({ to: "/", replace: true });
    }
    if (profileQ.data && !d.first_name) {
      const p = profileQ.data;
      const fullName = (p.name as string | null) ?? "";
      const [fn, ...rest] = fullName.split(" ");
      setD((x) => ({
        ...x,
        first_name: (p.first_name as string) || fn || "",
        last_name: (p.last_name as string) || rest.join(" ") || "",
        birth_date: (p.birth_date as string) || "",
        sex: (p.sex as Sex) || "",
        height_cm: p.height_cm ? Number(p.height_cm) : "",
        weight_kg: p.weight_kg ? Number(p.weight_kg) : "",
        phone: (p.phone as string) || "",
      }));
      // Restore step if onboarding was started
      const savedStep = typeof p.onboarding_step === "number" ? (p.onboarding_step as number) : 0;
      if (savedStep > 0) setStep(savedStep);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profileQ.data, navigate]);

  // Validation per step
  const canAdvance = useMemo<boolean>(() => {
    switch (step) {
      case 0: return true;
      case 1:
        return (
          d.first_name.trim() !== "" &&
          d.birth_date !== "" &&
          d.sex !== "" &&
          typeof d.height_cm === "number" &&
          typeof d.weight_kg === "number"
        );
      case 2: return d.primary_goal !== "";
      case 3: return true; // secundários opcionais
      case 4:
        return (
          d.experience_level !== "" &&
          d.training_history !== ""
        );
      case 5:
        return (
          d.available_days !== "" &&
          d.available_minutes !== "" &&
          d.available_days_list.length > 0 &&
          d.preferred_time !== ""
        );
      case 6: return d.gym_setup.location !== "";
      case 7: return d.running_mode !== "";
      case 8: return true; // esportes opcionais
      case 9: return true; // hábitos opcionais
      case 10: return true; // saúde opcionais
      case 11: return true; // lesões opcionais
      case 12: return true; // preferências opcionais
      case 13: return true; // performance opcionais
      case 14: return true; // fotos opcionais
      default: return false;
    }
  }, [step, d]);

  const saveAndNext = async () => {
    if (!canAdvance || step === 0) {
      if (step === 0) setStep(1);
      return;
    }
    // Save incrementally (best-effort, don't block UX)
    if (user) {
      saveStep({ data: { step, data: buildStepPatch(step, d) } }).catch(() => {});
    }
    setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));

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
          sports: d.sports,
          sports_frequency: d.sports_frequency,
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
          surgeries: [],
          medical_restrictions: d.medical_restrictions || null,
          current_pain_level: d.current_pain_level,
          pain_regions: d.pain_regions,
          past_injuries: d.past_injuries,
          uncomfortable_movements: d.uncomfortable_movements,
          equipment: deriveEquipment(d.gym_setup),
          gym_setup: d.gym_setup,
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
      toast.success("Tudo pronto! Seu programa foi gerado.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar. Tente novamente.");
    } finally {
      setSaving(false);
    }
  };

  const isLast = step === TOTAL_STEPS - 1;

  if (loading || !user || profileQ.isPending || profileQ.data?.onboarding_completed === true) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const pct = step === 0 ? 0 : (step / TOTAL_ETAPAS) * 100;

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      {/* Progress bar */}
      {step > 0 && (
        <div className="sticky top-0 z-10 bg-background/85 px-6 pt-7 pb-4 backdrop-blur-2xl">
          <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.24em] text-muted-foreground">
            <span>Etapa {step} de {TOTAL_ETAPAS}</span>
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

      {/* Content */}
      <div className="flex-1 px-6 pb-32 pt-8">
        {step === 0 && <Splash onStart={() => setStep(1)} />}
        {step === 1 && <E1 d={d} setD={setD} />}
        {step === 2 && <E2 d={d} setD={setD} />}
        {step === 3 && <E3 d={d} setD={setD} />}
        {step === 4 && <E4 d={d} setD={setD} />}
        {step === 5 && <E5 d={d} setD={setD} />}
        {step === 6 && <E6 d={d} setD={setD} />}
        {step === 7 && <E7 d={d} setD={setD} />}
        {step === 8 && <E8 d={d} setD={setD} />}
        {step === 9 && <E9 d={d} setD={setD} />}
        {step === 10 && <E10 d={d} setD={setD} />}
        {step === 11 && <E11 d={d} setD={setD} />}
        {step === 12 && <E12 d={d} setD={setD} />}
        {step === 13 && <E13 d={d} setD={setD} />}
        {step === 14 && user && <E14 userId={user.id} registerPhoto={registerPhoto} />}
      </div>

      {/* Navigation buttons */}
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
                disabled={saving || !canAdvance}
                className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-[0.99]"
              >
                {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
                {saving ? "Gerando seu programa..." : "Finalizar e gerar meu programa"}
              </button>
            ) : (
              <button
                onClick={saveAndNext}
                disabled={!canAdvance}
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

// ============================================================
// Step patch builder (for incremental save)
// ============================================================

function buildStepPatch(step: number, d: Data): Record<string, unknown> {
  switch (step) {
    case 1:
      return {
        first_name: d.first_name.trim(),
        last_name: d.last_name.trim() || null,
        birth_date: d.birth_date || null,
        sex: d.sex || null,
        height_cm: typeof d.height_cm === "number" ? d.height_cm : null,
        weight_kg: typeof d.weight_kg === "number" ? d.weight_kg : null,
        phone: d.phone.trim() || null,
        emergency_contact_name: d.emergency_contact_name.trim() || null,
        emergency_contact_phone: d.emergency_contact_phone.trim() || null,
        waist_cm: typeof d.waist_cm === "number" ? d.waist_cm : null,
        hip_cm: typeof d.hip_cm === "number" ? d.hip_cm : null,
        chest_cm: typeof d.chest_cm === "number" ? d.chest_cm : null,
        arm_cm: typeof d.arm_cm === "number" ? d.arm_cm : null,
        thigh_cm: typeof d.thigh_cm === "number" ? d.thigh_cm : null,
      };
    case 2:
      return { primary_goal: d.primary_goal };
    case 3:
      return { secondary_goals: d.secondary_goals };
    case 4:
      return {
        experience_level: d.experience_level || null,
        training_history: d.training_history || null,
        had_structured_program: d.had_structured_program || null,
      };
    case 5:
      return {
        available_days: typeof d.available_days === "number" ? d.available_days : null,
        available_minutes: typeof d.available_minutes === "number" ? d.available_minutes : null,
        available_days_list: d.available_days_list,
        preferred_time: d.preferred_time || null,
      };
    case 6:
      return {
        training_location: d.gym_setup.location || null,
        gym_setup: d.gym_setup,
        equipment: deriveEquipment(d.gym_setup),
      };
    case 7:
      return {
        running_mode: d.running_mode || null,
        running_level: d.running_level || null,
        running_continuous_minutes: d.running_continuous_minutes || null,
        running_goals: d.running_goals,
        running_preferred_days: d.running_preferred_days,
        cardio_preference: d.cardio_preference || null,
      };
    case 8:
      return {
        sports: d.sports,
        sports_frequency: d.sports_frequency,
        sports_notes: d.sports_notes || null,
      };
    case 9:
      return {
        professional_activity: d.professional_activity || null,
        sleep_hours: d.sleep_hours || null,
        water_intake: d.water_intake || null,
        smokes: d.smokes,
        alcohol_frequency: d.alcohol_frequency || null,
      };
    case 10:
      return {
        medical_conditions: d.medical_conditions,
        medications: d.medications || null,
        had_surgery: d.had_surgery || null,
        medical_restrictions: d.medical_restrictions || null,
        last_medical_checkup: d.last_medical_checkup || null,
      };
    case 11:
      return {
        current_pain_level: d.current_pain_level,
        pain_regions: d.pain_regions,
        pain_intensity: d.pain_intensity,
        past_injuries: d.past_injuries,
        uncomfortable_movements: d.uncomfortable_movements,
        limitations_notes: d.limitations_notes || null,
      };
    case 12:
      return {
        preferences: d.preferences,
        training_style: d.training_style || null,
        motivations: d.motivations,
      };
    case 13:
      return {
        perf_max_pushups: typeof d.perf_max_pushups === "number" ? d.perf_max_pushups : null,
        perf_max_squats: typeof d.perf_max_squats === "number" ? d.perf_max_squats : null,
        perf_max_plank_seconds: typeof d.perf_max_plank_seconds === "number" ? d.perf_max_plank_seconds : null,
        perf_max_run_minutes: typeof d.perf_max_run_minutes === "number" ? d.perf_max_run_minutes : null,
        perf_longest_run_km: typeof d.perf_longest_run_km === "number" ? d.perf_longest_run_km : null,
        perf_lifts_done: d.perf_lifts_done,
      };
    default:
      return {};
  }
}

// ============================================================
// Primitives
// ============================================================

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
        Em poucos minutos respondemos 14 perguntas e geramos uma periodização única para você — força, corrida e condicionamento em equilíbrio.
      </p>
      <button
        onClick={onStart}
        className="mt-12 flex h-14 w-full max-w-[280px] items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99]"
      >
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
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border px-5 py-4 text-left transition-all active:scale-[0.99] ${
        active ? "border-primary/60 bg-primary/[0.08] shadow-glow" : "border-border bg-surface/40 hover:bg-surface/60"
      }`}
    >
      <div className="text-[15.5px] font-semibold tracking-tight">{title}</div>
      <div className="mt-0.5 text-[12.5px] text-muted-foreground">{hint}</div>
    </button>
  );
}

function RowChoice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3.5 text-left text-[14px] font-medium transition-all active:scale-[0.99] ${
        active ? "border-primary/60 bg-primary/[0.08] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function PillChoice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`h-12 rounded-xl border px-3 text-[13px] font-medium transition-all ${
        active ? "border-primary/60 bg-primary/[0.10] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Chip({ on, children, onClick }: { on: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
        on ? "border-primary/60 bg-primary/[0.12] text-foreground" : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Multi({ label, items, selected, onToggle, max }: {
  label: string;
  items: readonly string[];
  selected: string[];
  onToggle: (v: string) => void;
  max?: number;
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

function ToggleSwitch({ on, onToggle, label }: { on: boolean; onToggle: () => void; label: string }) {
  return (
    <button
      onClick={onToggle}
      className={`flex items-center justify-between w-full rounded-2xl border px-5 py-4 transition-all ${
        on ? "border-primary/60 bg-primary/[0.08]" : "border-border bg-surface/40"
      }`}
    >
      <span className="text-[15px] font-medium">{label}</span>
      <div className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-primary" : "bg-border"}`}>
        <div className={`absolute top-0.5 h-5 w-5 rounded-full bg-primary-foreground shadow transition-all ${on ? "left-5" : "left-0.5"}`} />
      </div>
    </button>
  );
}

const toggleArr = (arr: string[], v: string, max?: number) => {
  if (arr.includes(v)) return arr.filter((x) => x !== v);
  if (max && arr.length >= max) return arr;
  return [...arr, v];
};

type SP = { d: Data; setD: React.Dispatch<React.SetStateAction<Data>> };

// ============================================================
// Etapa 1 — Perfil pessoal
// ============================================================

function E1({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="1 / 14 · Perfil pessoal"
        title="Vamos te conhecer"
        hint="Esses dados calibram cada prescrição do seu plano."
      />
      <div className="animate-fade-in space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Nome</label>
            <input
              className={inputCls}
              value={d.first_name}
              maxLength={60}
              autoFocus
              placeholder="Ex: Pedro"
              onChange={(e) => setD({ ...d, first_name: e.target.value })}
            />
          </div>
          <div>
            <label className={labelCls}>Sobrenome</label>
            <input
              className={inputCls}
              value={d.last_name}
              maxLength={80}
              placeholder="Ex: Silva"
              onChange={(e) => setD({ ...d, last_name: e.target.value })}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Data de nascimento</label>
          <input
            type="date"
            className={inputCls}
            value={d.birth_date}
            onChange={(e) => setD({ ...d, birth_date: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>Sexo</label>
          <div className="grid grid-cols-2 gap-1.5">
            {([
              ["male", "Masculino"],
              ["female", "Feminino"],
              ["other", "Outro"],
              ["prefer_not_to_say", "Prefiro não dizer"],
            ] as const).map(([v, label]) => (
              <PillChoice key={v} active={d.sex === v} onClick={() => setD({ ...d, sex: v })}>
                {label}
              </PillChoice>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Altura · cm</label>
            <input
              type="number"
              inputMode="numeric"
              className={inputCls}
              placeholder="175"
              value={d.height_cm}
              min={100}
              max={250}
              onChange={(e) => setD({ ...d, height_cm: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </div>
          <div>
            <label className={labelCls}>Peso · kg</label>
            <input
              type="number"
              inputMode="decimal"
              className={inputCls}
              placeholder="75"
              value={d.weight_kg}
              step="0.1"
              min={20}
              max={300}
              onChange={(e) => setD({ ...d, weight_kg: e.target.value === "" ? "" : Number(e.target.value) })}
            />
          </div>
        </div>

        <div>
          <label className={labelCls}>Telefone · opcional</label>
          <input
            type="tel"
            className={inputCls}
            placeholder="(11) 99999-9999"
            value={d.phone}
            onChange={(e) => setD({ ...d, phone: e.target.value })}
            maxLength={40}
          />
        </div>

        <details className="rounded-2xl border border-border/60 bg-surface/30 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground">
            Contato de emergência (opcional)
          </summary>
          <div className="mt-4 space-y-3">
            <div>
              <label className={labelCls}>Nome do contato</label>
              <input
                className={inputCls}
                placeholder="Nome completo"
                value={d.emergency_contact_name}
                onChange={(e) => setD({ ...d, emergency_contact_name: e.target.value })}
                maxLength={80}
              />
            </div>
            <div>
              <label className={labelCls}>Telefone do contato</label>
              <input
                type="tel"
                className={inputCls}
                placeholder="(11) 99999-9999"
                value={d.emergency_contact_phone}
                onChange={(e) => setD({ ...d, emergency_contact_phone: e.target.value })}
                maxLength={40}
              />
            </div>
          </div>
        </details>

        <details className="rounded-2xl border border-border/60 bg-surface/30 px-4 py-3">
          <summary className="cursor-pointer text-[13px] font-medium text-muted-foreground">
            Circunferências (opcional)
          </summary>
          <div className="mt-4 grid grid-cols-2 gap-3">
            {([
              ["waist_cm", "Cintura"],
              ["hip_cm", "Quadril"],
              ["chest_cm", "Peito"],
              ["arm_cm", "Braço"],
              ["thigh_cm", "Coxa"],
            ] as const).map(([k, label]) => (
              <div key={k}>
                <label className={labelCls}>{label} · cm</label>
                <input
                  type="number"
                  inputMode="decimal"
                  className={inputCls}
                  step="0.1"
                  value={d[k] as number | ""}
                  onChange={(e) =>
                    setD({ ...d, [k]: e.target.value === "" ? "" : Number(e.target.value) } as Data)
                  }
                />
              </div>
            ))}
          </div>
        </details>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 2 — Objetivo principal
// ============================================================

function E2({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="2 / 14 · Objetivo principal"
        title="Qual é o seu foco?"
        hint="Escolha apenas um — é a direção principal do seu programa."
      />
      <div className="animate-fade-in grid gap-2">
        {PRIMARY_GOAL_OPTIONS.map((g) => (
          <BigChoice
            key={g.v}
            active={d.primary_goal === g.v}
            title={g.label}
            hint={g.hint}
            onClick={() => setD({ ...d, primary_goal: g.v })}
          />
        ))}
      </div>
      {d.primary_goal === "outro" && (
        <div className="animate-fade-in">
          <label className={labelCls}>Descreva seu objetivo</label>
          <textarea
            className={textareaCls}
            placeholder="Ex: quero melhorar meu desempenho em escalada..."
            value={d.primary_goal_other}
            maxLength={300}
            onChange={(e) => setD({ ...d, primary_goal_other: e.target.value })}
          />
        </div>
      )}
    </div>
  );
}

// ============================================================
// Etapa 3 — Objetivos secundários
// ============================================================

function E3({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="3 / 14 · Objetivos secundários"
        title="O que mais te interessa?"
        hint="Selecione até 3 — opcional."
      />
      <div className="animate-fade-in">
        <Multi
          label="Objetivos adicionais"
          items={SECONDARY_GOALS}
          selected={d.secondary_goals}
          max={3}
          onToggle={(v) => setD({ ...d, secondary_goals: toggleArr(d.secondary_goals, v, 3) })}
        />
      </div>
    </div>
  );
}

// ============================================================
// Etapa 4 — Experiência de treino
// ============================================================

function E4({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="4 / 14 · Experiência de treino"
        title="Qual é sua experiência?"
        hint="Seja honesto — isso define a intensidade inicial do seu programa."
      />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Nível de experiência</label>
          <div className="grid grid-cols-3 gap-1.5">
            {EXPERIENCE_OPTIONS.map((o) => (
              <PillChoice
                key={o.v}
                active={d.experience_level === o.v}
                onClick={() => setD({ ...d, experience_level: o.v })}
              >
                {o.label}
              </PillChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Há quanto tempo treina com regularidade?</label>
          <div className="grid gap-1.5">
            {TRAINING_HISTORY_OPTIONS.map((o) => (
              <RowChoice
                key={o.v}
                active={d.training_history === o.v}
                onClick={() => setD({ ...d, training_history: o.v })}
              >
                {o.label}
              </RowChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Já teve planilha ou personal trainer?</label>
          <div className="grid gap-1.5">
            {HAD_STRUCTURED_PROGRAM_OPTIONS.map((o) => (
              <RowChoice
                key={o.v}
                active={d.had_structured_program === o.v}
                onClick={() => setD({ ...d, had_structured_program: o.v })}
              >
                {o.label}
              </RowChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 5 — Disponibilidade
// ============================================================

function E5({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="5 / 14 · Disponibilidade"
        title="Quando você pode treinar?"
        hint="Isso define a estrutura semanal do seu programa."
      />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Quantos dias por semana?</label>
          <div className="grid grid-cols-4 gap-1.5">
            {DAYS_PER_WEEK.map((n) => (
              <PillChoice
                key={n}
                active={d.available_days === n}
                onClick={() => setD({ ...d, available_days: n })}
              >
                {n} dias
              </PillChoice>
            ))}
          </div>
        </div>
        <div>
          <label className={labelCls}>Quanto tempo por treino?</label>
          <div className="grid grid-cols-5 gap-1.5">
            {MINUTES_PER_SESSION.map((n) => (
              <PillChoice
                key={n}
                active={d.available_minutes === n}
                onClick={() => setD({ ...d, available_minutes: n })}
              >
                {n}min
              </PillChoice>
            ))}
          </div>
        </div>
        <Multi
          label="Dias da semana disponíveis"
          items={WEEK_DAYS}
          selected={d.available_days_list}
          onToggle={(v) => setD({ ...d, available_days_list: toggleArr(d.available_days_list, v) })}
        />
        <div>
          <label className={labelCls}>Horário preferido</label>
          <div className="grid grid-cols-2 gap-1.5">
            {PREFERRED_TIMES.map((o) => (
              <PillChoice
                key={o}
                active={d.preferred_time === o}
                onClick={() => setD({ ...d, preferred_time: o })}
              >
                {o}
              </PillChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 6 — Local e equipamentos
// ============================================================

function E6({ d, setD }: SP) {
  const g = d.gym_setup;
  const setG = (patch: Partial<GymSetup>) =>
    setD({ ...d, gym_setup: { ...g, ...patch } });

  const selectLocation = (loc: string) => {
    setD({ ...d, gym_setup: { ...EMPTY_GYM_SETUP, location: loc } });
  };

  return (
    <div className="space-y-6">
      <Hero
        eyebrow="6 / 14 · Local e equipamentos"
        title="Onde você treina?"
        hint="Vamos prescrever apenas exercícios que você consegue executar."
      />
      <div className="animate-fade-in space-y-6">
        <div className="grid gap-2">
          {TRAINING_LOCATION_OPTIONS.map((o) => (
            <RowChoice key={o} active={g.location === o} onClick={() => selectLocation(o)}>
              {o}
            </RowChoice>
          ))}
        </div>

        {/* Academia completa */}
        {g.location === "Academia Completa" && (
          <div className="space-y-5 pt-2 animate-fade-in">
            <div>
              <label className={labelCls}>Sua academia possui equipamentos comuns?</label>
              <div className="grid gap-2">
                {FULL_GYM_COMPLETENESS.map((o) => (
                  <RowChoice
                    key={o}
                    active={g.full_gym_completeness === o}
                    onClick={() => setG({ full_gym_completeness: o, full_gym_missing: [], full_gym_missing_other: "" })}
                  >
                    {o}
                  </RowChoice>
                ))}
              </div>
            </div>
            {g.full_gym_completeness === "Algumas máquinas não existem" && (
              <div className="space-y-3 animate-fade-in">
                <Multi
                  label="Quais equipamentos NÃO existem?"
                  items={FULL_GYM_MISSING_OPTIONS}
                  selected={g.full_gym_missing}
                  onToggle={(v) => setG({ full_gym_missing: toggleArr(g.full_gym_missing, v) })}
                />
                {g.full_gym_missing.includes("Outro") && (
                  <div>
                    <label className={labelCls}>Outros equipamentos ausentes</label>
                    <textarea
                      className={textareaCls}
                      value={g.full_gym_missing_other}
                      maxLength={300}
                      placeholder="Descreva"
                      onChange={(e) => setG({ full_gym_missing_other: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Condomínio */}
        {g.location === "Academia de Condomínio / Prédio" && (
          <div className="space-y-4 pt-2 animate-fade-in">
            <Multi
              label="Marque os equipamentos disponíveis"
              items={CONDO_GYM_EQUIPMENT}
              selected={g.condo_equipment}
              onToggle={(v) => setG({ condo_equipment: toggleArr(g.condo_equipment, v) })}
            />
            <div>
              <label className={labelCls}>Algum equipamento importante não listado?</label>
              <textarea
                className={textareaCls}
                value={g.condo_other}
                maxLength={300}
                placeholder="Ex: Tem um Hack Squat..."
                onChange={(e) => setG({ condo_other: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Casa */}
        {g.location === "Casa" && (
          <div className="space-y-4 pt-2 animate-fade-in">
            <Multi
              label="Equipamentos disponíveis em casa"
              items={HOME_EQUIPMENT}
              selected={g.home_equipment}
              onToggle={(v) => setG({ home_equipment: toggleArr(g.home_equipment, v) })}
            />
            <div>
              <label className={labelCls}>Algum equipamento não listado?</label>
              <textarea
                className={textareaCls}
                value={g.home_other}
                maxLength={300}
                placeholder="Descreva, se houver"
                onChange={(e) => setG({ home_other: e.target.value })}
              />
            </div>
          </div>
        )}

        {/* Box */}
        {g.location === "Box de CrossFit" && (
          <div className="space-y-5 pt-2 animate-fade-in">
            <div>
              <label className={labelCls}>Seu box possui equipamentos completos?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {BOX_COMPLETENESS.map((o) => (
                  <PillChoice
                    key={o}
                    active={g.box_completeness === o}
                    onClick={() => setG({ box_completeness: o, box_equipment: [], box_other: "" })}
                  >
                    {o}
                  </PillChoice>
                ))}
              </div>
            </div>
            {g.box_completeness === "Não" && (
              <div className="space-y-3 animate-fade-in">
                <Multi
                  label="Marque o que existe no seu box"
                  items={BOX_EQUIPMENT}
                  selected={g.box_equipment}
                  onToggle={(v) => setG({ box_equipment: toggleArr(g.box_equipment, v) })}
                />
                {g.box_equipment.includes("Outro") && (
                  <div>
                    <label className={labelCls}>Outros equipamentos</label>
                    <textarea
                      className={textareaCls}
                      value={g.box_other}
                      maxLength={300}
                      placeholder="Descreva"
                      onChange={(e) => setG({ box_other: e.target.value })}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Misto */}
        {g.location === "Misto" && (
          <div className="space-y-5 pt-2 animate-fade-in">
            <div>
              <label className={labelCls}>Onde você treina com mais frequência?</label>
              <div className="grid grid-cols-2 gap-1.5">
                {MIXED_PRIMARY_LOCATIONS.map((o) => (
                  <PillChoice
                    key={o}
                    active={g.mixed_primary === o}
                    onClick={() => setG({ mixed_primary: o })}
                  >
                    {o}
                  </PillChoice>
                ))}
              </div>
            </div>
            <Multi
              label="Outros locais que utiliza"
              items={MIXED_PRIMARY_LOCATIONS.filter((l) => l !== g.mixed_primary)}
              selected={g.mixed_other_locations}
              onToggle={(v) => setG({ mixed_other_locations: toggleArr(g.mixed_other_locations, v) })}
            />
            {(g.mixed_primary === "Condomínio" || g.mixed_other_locations.includes("Condomínio")) && (
              <Multi
                label="Equipamentos no condomínio"
                items={CONDO_GYM_EQUIPMENT}
                selected={g.condo_equipment}
                onToggle={(v) => setG({ condo_equipment: toggleArr(g.condo_equipment, v) })}
              />
            )}
            {(g.mixed_primary === "Casa" || g.mixed_other_locations.includes("Casa")) && (
              <Multi
                label="Equipamentos em casa"
                items={HOME_EQUIPMENT}
                selected={g.home_equipment}
                onToggle={(v) => setG({ home_equipment: toggleArr(g.home_equipment, v) })}
              />
            )}
            {(g.mixed_primary === "Box" || g.mixed_other_locations.includes("Box")) && (
              <Multi
                label="Equipamentos no box"
                items={BOX_EQUIPMENT}
                selected={g.box_equipment}
                onToggle={(v) => setG({ box_equipment: toggleArr(g.box_equipment, v) })}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================
// Etapa 7 — Corrida e cardio
// ============================================================

function E7({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="7 / 14 · Corrida e cardio"
        title="Como a corrida entra no seu plano?"
        hint="Esta resposta define se o programa terá ou não corrida."
      />
      <div className="animate-fade-in space-y-6">
        <div className="grid gap-2">
          {RUNNING_MODES.map((r) => (
            <BigChoice
              key={r.v}
              active={d.running_mode === r.v}
              title={r.label}
              hint={r.hint}
              onClick={() => setD({ ...d, running_mode: r.v })}
            />
          ))}
        </div>

        {d.running_mode !== "" && d.running_mode !== "desabilitado" && (
          <div className="space-y-5 pt-2 animate-fade-in">
            <div>
              <label className={labelCls}>Seu nível atual de corrida</label>
              <div className="grid grid-cols-2 gap-1.5">
                {RUNNING_LEVEL.map((o) => (
                  <PillChoice
                    key={o}
                    active={d.running_level === o}
                    onClick={() => setD({ ...d, running_level: o })}
                  >
                    {o}
                  </PillChoice>
                ))}
              </div>
            </div>
            <div>
              <label className={labelCls}>Quanto tempo consegue correr contínuo hoje?</label>
              <div className="grid gap-1.5">
                {RUNNING_CONTINUOUS.map((o) => (
                  <RowChoice
                    key={o}
                    active={d.running_continuous_minutes === o}
                    onClick={() => setD({ ...d, running_continuous_minutes: o })}
                  >
                    {o}
                  </RowChoice>
                ))}
              </div>
            </div>
            <Multi
              label="Objetivos com corrida"
              items={RUNNING_GOALS_OPTIONS}
              selected={d.running_goals}
              onToggle={(v) => setD({ ...d, running_goals: toggleArr(d.running_goals, v) })}
            />
            <Multi
              label="Dias preferidos para correr"
              items={WEEK_DAYS}
              selected={d.running_preferred_days}
              onToggle={(v) => setD({ ...d, running_preferred_days: toggleArr(d.running_preferred_days, v) })}
            />
          </div>
        )}

        <div>
          <label className={labelCls}>Se não quiser correr, qual cardio prefere?</label>
          <div className="grid grid-cols-2 gap-1.5">
            {CARDIO_OPTIONS.map((o) => (
              <PillChoice
                key={o}
                active={d.cardio_preference === o}
                onClick={() => setD({ ...d, cardio_preference: o })}
              >
                {o}
              </PillChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 8 — Esportes e atividades
// ============================================================

function E8({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="8 / 14 · Esportes e atividades"
        title="Outras atividades físicas"
        hint="Vamos considerar a carga esportiva total na sua periodização."
      />
      <div className="animate-fade-in space-y-5">
        <Multi
          label="Esportes ou atividades praticadas"
          items={SPORTS_OPTIONS}
          selected={d.sports}
          onToggle={(v) => {
            const next = toggleArr(d.sports, v);
            const freq = { ...d.sports_frequency };
            if (!next.includes(v)) delete freq[v];
            setD({ ...d, sports: next, sports_frequency: freq });
          }}
        />
        {d.sports.length > 0 && (
          <div className="space-y-3">
            <label className={labelCls}>Frequência semanal por atividade</label>
            {d.sports.map((s) => (
              <div
                key={s}
                className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3"
              >
                <span className="text-[14px] font-medium">{s}</span>
                <input
                  type="number"
                  min={0}
                  max={14}
                  inputMode="numeric"
                  className="h-10 w-20 rounded-lg border border-border bg-background px-3 text-center text-[14px] font-semibold outline-none focus:border-primary/50"
                  value={d.sports_frequency[s] ?? ""}
                  placeholder="0"
                  onChange={(e) =>
                    setD({
                      ...d,
                      sports_frequency: { ...d.sports_frequency, [s]: Number(e.target.value) || 0 },
                    })
                  }
                />
              </div>
            ))}
          </div>
        )}
        <div>
          <label className={labelCls}>Observações sobre esportes (opcional)</label>
          <textarea
            className={textareaCls}
            placeholder="Ex: Jogo futebol aos domingos, intensidade alta..."
            value={d.sports_notes}
            maxLength={400}
            onChange={(e) => setD({ ...d, sports_notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 9 — Hábitos e estilo de vida
// ============================================================

function E9({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="9 / 14 · Hábitos e estilo de vida"
        title="Sua rotina fora do treino"
        hint="Alimentação, sono e rotina diária impactam diretamente nos resultados."
      />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>Atividade profissional</label>
          <div className="grid gap-1.5">
            {PROFESSIONAL_ACTIVITY_OPTIONS.map((o) => (
              <RowChoice
                key={o.v}
                active={d.professional_activity === o.v}
                onClick={() => setD({ ...d, professional_activity: o.v })}
              >
                {o.label}
              </RowChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Horas de sono por noite</label>
          <div className="grid grid-cols-3 gap-1.5">
            {SLEEP_HOURS_OPTIONS.map((o) => (
              <PillChoice
                key={o.v}
                active={d.sleep_hours === o.v}
                onClick={() => setD({ ...d, sleep_hours: o.v })}
              >
                {o.label}
              </PillChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Consumo de água por dia</label>
          <div className="grid grid-cols-2 gap-1.5">
            {WATER_INTAKE_OPTIONS.map((o) => (
              <PillChoice
                key={o.v}
                active={d.water_intake === o.v}
                onClick={() => setD({ ...d, water_intake: o.v })}
              >
                {o.label}
              </PillChoice>
            ))}
          </div>
        </div>

        <ToggleSwitch
          on={d.smokes}
          onToggle={() => setD({ ...d, smokes: !d.smokes })}
          label="Fumante"
        />

        <div>
          <label className={labelCls}>Frequência de consumo de álcool</label>
          <div className="grid gap-1.5">
            {ALCOHOL_FREQUENCY_OPTIONS.map((o) => (
              <RowChoice
                key={o.v}
                active={d.alcohol_frequency === o.v}
                onClick={() => setD({ ...d, alcohol_frequency: o.v })}
              >
                {o.label}
              </RowChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 10 — Histórico de saúde
// ============================================================

function E10({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="10 / 14 · Histórico de saúde"
        title="Saúde e histórico médico"
        hint="Tudo confidencial — usado apenas para adaptar seu plano com segurança."
      />
      <div className="animate-fade-in space-y-6">
        <Multi
          label="Diagnósticos médicos"
          items={MEDICAL_CONDITIONS}
          selected={d.medical_conditions}
          onToggle={(v) => setD({ ...d, medical_conditions: toggleArr(d.medical_conditions, v) })}
        />

        <div>
          <label className={labelCls}>Usa medicamentos continuamente? Quais?</label>
          <textarea
            className={textareaCls}
            value={d.medications}
            maxLength={500}
            placeholder="Ex: Losartana 50mg, vitamina D, metformina..."
            onChange={(e) => setD({ ...d, medications: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>Já realizou alguma cirurgia?</label>
          <div className="grid gap-1.5">
            {HAD_SURGERY_OPTIONS.map((o) => (
              <RowChoice
                key={o.v}
                active={d.had_surgery === o.v}
                onClick={() => setD({ ...d, had_surgery: o.v })}
              >
                {o.label}
              </RowChoice>
            ))}
          </div>
        </div>

        <div>
          <label className={labelCls}>Restrição médica para exercícios físicos</label>
          <textarea
            className={textareaCls}
            value={d.medical_restrictions}
            maxLength={500}
            placeholder="Descreva, se houver. Ex: não pode fazer impacto, não pode levantar acima de 15 kg..."
            onChange={(e) => setD({ ...d, medical_restrictions: e.target.value })}
          />
        </div>

        <div>
          <label className={labelCls}>Último checkup médico</label>
          <div className="grid gap-1.5">
            {LAST_CHECKUP_OPTIONS.map((o) => (
              <RowChoice
                key={o.v}
                active={d.last_medical_checkup === o.v}
                onClick={() => setD({ ...d, last_medical_checkup: o.v })}
              >
                {o.label}
              </RowChoice>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 11 — Lesões, dores e limitações
// ============================================================

function E11({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="11 / 14 · Lesões e limitações"
        title="Como você se sente fisicamente?"
        hint="Vamos adaptar ou substituir exercícios para proteger seu corpo."
      />
      <div className="animate-fade-in space-y-6">
        <div>
          <label className={labelCls}>
            Nível geral de dor / desconforto agora · {d.current_pain_level} / 10
          </label>
          <input
            type="range"
            min={0}
            max={10}
            value={d.current_pain_level}
            onChange={(e) => setD({ ...d, current_pain_level: Number(e.target.value) })}
            className="w-full accent-titanium"
          />
          <div className="mt-1 flex justify-between text-[10px] uppercase tracking-wider text-muted-foreground">
            <span>Sem dor</span>
            <span>Dor intensa</span>
          </div>
        </div>

        <div>
          <label className={labelCls}>Regiões com dor ou lesão ativa</label>
          <div className="flex flex-wrap gap-1.5">
            {PAIN_REGIONS.map((r) => {
              const on = d.pain_regions.includes(r);
              return (
                <button
                  key={r}
                  onClick={() => {
                    const next = toggleArr(d.pain_regions, r);
                    const intensity = { ...d.pain_intensity };
                    if (!next.includes(r)) delete intensity[r];
                    setD({ ...d, pain_regions: next, pain_intensity: intensity });
                  }}
                  className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                    on
                      ? "border-primary/60 bg-primary/[0.12] text-foreground"
                      : "border-border bg-surface/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r}
                </button>
              );
            })}
          </div>
        </div>

        {d.pain_regions.length > 0 && (
          <div className="space-y-3 animate-fade-in">
            <label className={labelCls}>Intensidade da dor por região (0–10)</label>
            {d.pain_regions.map((r) => (
              <div key={r} className="rounded-xl border border-border bg-surface/40 px-4 py-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[13px] font-medium">{r}</span>
                  <span className="num text-[13px] font-semibold text-muted-foreground">
                    {d.pain_intensity[r] ?? 0} / 10
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={10}
                  value={d.pain_intensity[r] ?? 0}
                  onChange={(e) =>
                    setD({
                      ...d,
                      pain_intensity: { ...d.pain_intensity, [r]: Number(e.target.value) },
                    })
                  }
                  className="w-full accent-titanium"
                />
              </div>
            ))}
          </div>
        )}

        <Multi
          label="Lesões anteriores"
          items={PAST_INJURIES}
          selected={d.past_injuries}
          onToggle={(v) => setD({ ...d, past_injuries: toggleArr(d.past_injuries, v) })}
        />

        <Multi
          label="Movimentos que causam desconforto"
          items={UNCOMFORTABLE_MOVEMENTS}
          selected={d.uncomfortable_movements}
          onToggle={(v) => setD({ ...d, uncomfortable_movements: toggleArr(d.uncomfortable_movements, v) })}
        />

        <div>
          <label className={labelCls}>Outras limitações ou observações</label>
          <textarea
            className={textareaCls}
            value={d.limitations_notes}
            maxLength={500}
            placeholder="Descreva qualquer limitação não listada acima..."
            onChange={(e) => setD({ ...d, limitations_notes: e.target.value })}
          />
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Etapa 12 — Preferências de treino
// ============================================================

function E12({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="12 / 14 · Preferências de treino"
        title="Como você gosta de treinar?"
        hint="Isso torna o programa mais alinhado com o que você curte."
      />
      <div className="animate-fade-in space-y-6">
        <Multi
          label="O que você mais gosta"
          items={PREFERENCES_OPTIONS}
          selected={d.preferences}
          onToggle={(v) => setD({ ...d, preferences: toggleArr(d.preferences, v) })}
        />
        <div>
          <label className={labelCls}>Estilo de treino preferido</label>
          <div className="grid gap-1.5">
            {TRAINING_STYLES.map((o) => (
              <RowChoice
                key={o}
                active={d.training_style === o}
                onClick={() => setD({ ...d, training_style: o })}
              >
                {o}
              </RowChoice>
            ))}
          </div>
        </div>
        <Multi
          label="O que mais te motiva"
          items={MOTIVATIONS_OPTIONS}
          selected={d.motivations}
          onToggle={(v) => setD({ ...d, motivations: toggleArr(d.motivations, v) })}
        />
      </div>
    </div>
  );
}

// ============================================================
// Etapa 13 — Avaliação inicial de performance
// ============================================================

function E13({ d, setD }: SP) {
  return (
    <div className="space-y-6">
      <Hero
        eyebrow="13 / 14 · Avaliação de performance"
        title="Seus números atuais"
        hint="Tudo opcional — quanto mais informar, melhor a estimativa de cargas iniciais."
      />
      <div className="animate-fade-in space-y-5">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Máx. flexões seguidas</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              placeholder="Ex: 20"
              value={d.perf_max_pushups}
              onChange={(e) =>
                setD({ ...d, perf_max_pushups: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={labelCls}>Máx. agachamentos livres</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              placeholder="Ex: 30"
              value={d.perf_max_squats}
              onChange={(e) =>
                setD({ ...d, perf_max_squats: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={labelCls}>Prancha máx · segundos</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              placeholder="Ex: 60"
              value={d.perf_max_plank_seconds}
              onChange={(e) =>
                setD({ ...d, perf_max_plank_seconds: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
          <div>
            <label className={labelCls}>Maior corrida contínua · min</label>
            <input
              type="number"
              inputMode="numeric"
              min={0}
              className={inputCls}
              placeholder="Ex: 30"
              value={d.perf_max_run_minutes}
              onChange={(e) =>
                setD({ ...d, perf_max_run_minutes: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
          <div className="col-span-2">
            <label className={labelCls}>Maior distância corrida · km</label>
            <input
              type="number"
              inputMode="decimal"
              min={0}
              step="0.1"
              className={inputCls}
              placeholder="Ex: 5.0"
              value={d.perf_longest_run_km}
              onChange={(e) =>
                setD({ ...d, perf_longest_run_km: e.target.value === "" ? "" : Number(e.target.value) })
              }
            />
          </div>
        </div>
        <Multi
          label="Já executou algum destes movimentos:"
          items={LIFTS_DONE}
          selected={d.perf_lifts_done}
          onToggle={(v) => setD({ ...d, perf_lifts_done: toggleArr(d.perf_lifts_done, v) })}
        />
      </div>
    </div>
  );
}

// ============================================================
// Etapa 14 — Fotos de progresso
// ============================================================

function E14({
  userId,
  registerPhoto,
}: {
  userId: string;
  registerPhoto: (opts: {
    data: { photo_type: "frente" | "lado" | "costas"; storage_path: string };
  }) => Promise<unknown>;
}) {
  const [uploading, setUploading] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<Record<string, boolean>>({});

  const upload = async (type: "frente" | "lado" | "costas", file: File) => {
    setUploading(type);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${userId}/${type}-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from("progress-photos")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error) throw error;
      await registerPhoto({ data: { photo_type: type, storage_path: path } });
      setUploaded((u) => ({ ...u, [type]: true }));
      toast.success(`Foto (${type}) enviada com sucesso.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha no upload.");
    } finally {
      setUploading(null);
    }
  };

  const PHOTO_LABELS: Record<string, string> = {
    frente: "Frente",
    lado: "Lateral",
    costas: "Costas",
  };

  return (
    <div className="space-y-6">
      <Hero
        eyebrow="14 / 14 · Fotos de progresso"
        title="Registre seu ponto de partida"
        hint="Opcional e 100% privado. Só você consegue ver. Poderá comparar sua evolução ao longo do programa."
      />
      <div className="animate-fade-in grid gap-3">
        {(["frente", "lado", "costas"] as const).map((type) => (
          <label
            key={type}
            className={`flex cursor-pointer items-center justify-between rounded-2xl border px-5 py-4 transition-all ${
              uploaded[type]
                ? "border-primary/60 bg-primary/[0.08]"
                : "border-border bg-surface/40 hover:bg-surface/60"
            }`}
          >
            <div>
              <div className="text-[15px] font-semibold">{PHOTO_LABELS[type]}</div>
              <div className="text-[12px] text-muted-foreground">
                {uploaded[type] ? "Enviada" : "Toque para selecionar uma foto"}
              </div>
            </div>
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-titanium text-primary-foreground">
              {uploading === type ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : uploaded[type] ? (
                <Check className="h-4 w-4" />
              ) : (
                <Upload className="h-4 w-4" />
              )}
            </div>
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) upload(type, f);
              }}
            />
          </label>
        ))}
      </div>
      <p className="text-center text-[12px] text-muted-foreground">
        Pode pular esta etapa agora e enviar as fotos depois no seu perfil.
      </p>
    </div>
  );
}
