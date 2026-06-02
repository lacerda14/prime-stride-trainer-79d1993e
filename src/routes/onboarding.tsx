import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { ArrowLeft, ArrowRight, Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { completeOnboarding, getProfile } from "@/lib/profile.functions";
import { useQuery, useQueryClient } from "@tanstack/react-query";

export const Route = createFileRoute("/onboarding")({
  head: () => ({ meta: [{ title: "Boas-vindas — PM Hybrid" }] }),
  component: OnboardingPage,
});

type Gender = "male" | "female" | "other" | "prefer_not_to_say";
type Experience = "beginner" | "intermediate" | "advanced";
type Goal = "weight_loss" | "hypertrophy" | "aerobic" | "hybrid" | "general_health";

interface OnboardingData {
  display_name: string;
  phone: string;
  age: number | "";
  gender: Gender | "";
  weight_kg: number | "";
  height_cm: number | "";
  experience_level: Experience | "";
  main_goal: Goal | "";
  available_days: number[];
}

const TOTAL_STEPS = 10;

const DAY_LABELS = [
  { v: 1, label: "Seg" },
  { v: 2, label: "Ter" },
  { v: 3, label: "Qua" },
  { v: 4, label: "Qui" },
  { v: 5, label: "Sex" },
  { v: 6, label: "Sáb" },
  { v: 0, label: "Dom" },
];

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

  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);
  const [data, setData] = useState<OnboardingData>({
    display_name: "",
    phone: "",
    age: "",
    gender: "",
    weight_kg: "",
    height_cm: "",
    experience_level: "",
    main_goal: "",
    available_days: [],
  });

  // Redireciona logado sem necessidade de onboarding
  useEffect(() => {
    if (!loading && !user) {
      navigate({ to: "/auth", search: { redirect: "/onboarding" } as never, replace: true });
    }
  }, [loading, user, navigate]);

  useEffect(() => {
    if (profileQ.data?.onboarding_completed_at) {
      navigate({ to: "/", replace: true });
    }
    if (profileQ.data && !data.display_name && profileQ.data.display_name) {
      setData((d) => ({ ...d, display_name: profileQ.data.display_name as string }));
    }
  }, [profileQ.data, navigate, data.display_name]);

  if (loading || profileQ.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  const canAdvance = (): boolean => {
    switch (step) {
      case 1: return data.display_name.trim().length > 0;
      case 2: return true; // telefone opcional
      case 3: return typeof data.age === "number" && data.age >= 10 && data.age <= 100;
      case 4: return data.gender !== "";
      case 5: return typeof data.weight_kg === "number" && data.weight_kg >= 20;
      case 6: return typeof data.height_cm === "number" && data.height_cm >= 100;
      case 7: return data.experience_level !== "";
      case 8: return data.main_goal !== "";
      case 9: return data.available_days.length > 0;
      case 10: return true;
      default: return false;
    }
  };

  const next = () => {
    if (!canAdvance()) return;
    if (step < TOTAL_STEPS) setStep(step + 1);
  };
  const back = () => step > 1 && setStep(step - 1);

  const finish = async () => {
    setSaving(true);
    try {
      await submit({
        data: {
          display_name: data.display_name.trim(),
          phone: data.phone.trim() || null,
          age: data.age as number,
          gender: data.gender as Gender,
          weight_kg: data.weight_kg as number,
          height_cm: data.height_cm as number,
          experience_level: data.experience_level as Experience,
          main_goal: data.main_goal as Goal,
          available_days: data.available_days,
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Tudo pronto! Bem-vindo ao PM Hybrid.");
      navigate({ to: "/", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  const pct = (step / TOTAL_STEPS) * 100;

  return (
    <div className="relative mx-auto flex min-h-screen w-full max-w-[480px] flex-col bg-background">
      {/* Progress */}
      <div className="sticky top-0 z-10 bg-background/90 px-5 pt-6 pb-3 backdrop-blur-xl">
        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span>Passo {step} de {TOTAL_STEPS}</span>
          <span>{Math.round(pct)}%</span>
        </div>
        <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-surface">
          <div
            className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Step content */}
      <div className="flex-1 px-5 pb-32 pt-6">
        <StepContent step={step} data={data} setData={setData} />
      </div>

      {/* Sticky footer */}
      <div className="fixed bottom-0 left-1/2 z-20 w-full max-w-[480px] -translate-x-1/2 border-t border-border/60 bg-background/95 px-5 py-4 pb-[max(env(safe-area-inset-bottom),1rem)] backdrop-blur-xl">
        <div className="flex items-center gap-3">
          {step > 1 && (
            <button
              onClick={back}
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-border bg-surface/60 active:scale-95"
              aria-label="Voltar"
            >
              <ArrowLeft className="h-5 w-5" />
            </button>
          )}
          {step < TOTAL_STEPS ? (
            <button
              onClick={next}
              disabled={!canAdvance()}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-40 disabled:shadow-none active:scale-[0.99]"
            >
              Continuar
              <ArrowRight className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={saving}
              className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-60 active:scale-[0.99]"
            >
              {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}
              {saving ? "Salvando..." : "Concluir"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================
// Step content
// ============================================================

function StepShell({ eyebrow, title, hint, children }: { eyebrow: string; title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="animate-fade-in space-y-6">
      <div>
        <div className="text-[10px] font-medium uppercase tracking-[0.22em] text-primary/80">{eyebrow}</div>
        <h1 className="mt-2 text-[26px] font-semibold leading-tight tracking-tight">{title}</h1>
        {hint && <p className="mt-2 text-[13px] text-muted-foreground">{hint}</p>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const inputCls =
  "h-14 w-full rounded-2xl border border-border bg-surface/40 px-4 text-[16px] font-medium tracking-tight outline-none placeholder:text-muted-foreground/60 focus:border-primary/60";

function StepContent({
  step,
  data,
  setData,
}: {
  step: number;
  data: OnboardingData;
  setData: React.Dispatch<React.SetStateAction<OnboardingData>>;
}) {
  if (step === 1) {
    return (
      <StepShell eyebrow="Boas-vindas" title="Como prefere ser chamado(a)?" hint="É o nome que aparecerá no seu perfil.">
        <input
          className={inputCls}
          placeholder="Ex: Pedro"
          value={data.display_name}
          onChange={(e) => setData({ ...data, display_name: e.target.value })}
          autoFocus
          maxLength={80}
        />
      </StepShell>
    );
  }
  if (step === 2) {
    return (
      <StepShell eyebrow="Contato" title="Seu telefone" hint="Opcional. Útil para notificações futuras.">
        <input
          type="tel"
          className={inputCls}
          placeholder="(11) 99999-9999"
          value={data.phone}
          onChange={(e) => setData({ ...data, phone: e.target.value })}
          maxLength={40}
        />
      </StepShell>
    );
  }
  if (step === 3) {
    return (
      <StepShell eyebrow="Sobre você" title="Qual sua idade?">
        <input
          type="number"
          inputMode="numeric"
          className={inputCls}
          placeholder="30"
          value={data.age}
          onChange={(e) => setData({ ...data, age: e.target.value === "" ? "" : Number(e.target.value) })}
          min={10}
          max={100}
        />
      </StepShell>
    );
  }
  if (step === 4) {
    const options: { v: Gender; label: string }[] = [
      { v: "male", label: "Masculino" },
      { v: "female", label: "Feminino" },
      { v: "other", label: "Outro" },
      { v: "prefer_not_to_say", label: "Prefiro não dizer" },
    ];
    return (
      <StepShell eyebrow="Sobre você" title="Sexo" hint="Usamos para personalizar mensagens.">
        <div className="grid gap-2">
          {options.map((o) => (
            <Choice key={o.v} active={data.gender === o.v} onClick={() => setData({ ...data, gender: o.v })}>
              {o.label}
            </Choice>
          ))}
        </div>
      </StepShell>
    );
  }
  if (step === 5) {
    return (
      <StepShell eyebrow="Medidas" title="Seu peso atual" hint="Em quilogramas.">
        <div className="relative">
          <input
            type="number"
            inputMode="decimal"
            className={`${inputCls} pr-14`}
            placeholder="75.0"
            value={data.weight_kg}
            onChange={(e) =>
              setData({ ...data, weight_kg: e.target.value === "" ? "" : Number(e.target.value) })
            }
            step="0.1"
            min={20}
            max={300}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">kg</span>
        </div>
      </StepShell>
    );
  }
  if (step === 6) {
    return (
      <StepShell eyebrow="Medidas" title="Sua altura" hint="Em centímetros.">
        <div className="relative">
          <input
            type="number"
            inputMode="numeric"
            className={`${inputCls} pr-14`}
            placeholder="175"
            value={data.height_cm}
            onChange={(e) =>
              setData({ ...data, height_cm: e.target.value === "" ? "" : Number(e.target.value) })
            }
            min={100}
            max={250}
          />
          <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[13px] text-muted-foreground">cm</span>
        </div>
      </StepShell>
    );
  }
  if (step === 7) {
    const options: { v: Experience; label: string; hint: string }[] = [
      { v: "beginner", label: "Iniciante", hint: "Menos de 1 ano treinando" },
      { v: "intermediate", label: "Intermediário", hint: "1–3 anos treinando" },
      { v: "advanced", label: "Avançado", hint: "Mais de 3 anos treinando" },
    ];
    return (
      <StepShell eyebrow="Experiência" title="Seu nível de treino">
        <div className="grid gap-2">
          {options.map((o) => (
            <Choice key={o.v} active={data.experience_level === o.v} onClick={() => setData({ ...data, experience_level: o.v })}>
              <div className="text-[15px] font-semibold">{o.label}</div>
              <div className="text-[12px] text-muted-foreground">{o.hint}</div>
            </Choice>
          ))}
        </div>
      </StepShell>
    );
  }
  if (step === 8) {
    const options: { v: Goal; label: string }[] = [
      { v: "weight_loss", label: "Emagrecimento" },
      { v: "hypertrophy", label: "Hipertrofia" },
      { v: "aerobic", label: "Resistência aeróbica" },
      { v: "hybrid", label: "Performance híbrida" },
      { v: "general_health", label: "Saúde geral" },
    ];
    return (
      <StepShell eyebrow="Objetivo" title="Qual seu foco principal?">
        <div className="grid gap-2">
          {options.map((o) => (
            <Choice key={o.v} active={data.main_goal === o.v} onClick={() => setData({ ...data, main_goal: o.v })}>
              {o.label}
            </Choice>
          ))}
        </div>
      </StepShell>
    );
  }
  if (step === 9) {
    const toggle = (v: number) => {
      setData({
        ...data,
        available_days: data.available_days.includes(v)
          ? data.available_days.filter((d) => d !== v)
          : [...data.available_days, v].sort(),
      });
    };
    return (
      <StepShell eyebrow="Agenda" title="Quais dias você pode treinar?" hint="Selecione os dias da sua semana.">
        <div className="grid grid-cols-4 gap-2">
          {DAY_LABELS.map((d) => {
            const active = data.available_days.includes(d.v);
            return (
              <button
                key={d.v}
                onClick={() => toggle(d.v)}
                className={`h-16 rounded-2xl border text-[13px] font-semibold transition-colors active:scale-95 ${
                  active
                    ? "border-primary/70 bg-primary/15 text-foreground"
                    : "border-border bg-surface/40 text-muted-foreground"
                }`}
              >
                {d.label}
              </button>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-muted-foreground">
          {data.available_days.length} {data.available_days.length === 1 ? "dia" : "dias"} selecionados
        </p>
      </StepShell>
    );
  }
  // step 10 — resumo
  return (
    <StepShell eyebrow="Tudo pronto" title="Vamos começar?" hint="Revise seus dados antes de finalizar.">
      <div className="space-y-2 rounded-2xl border border-border bg-surface/40 p-4">
        <SummaryRow label="Nome" value={data.display_name} />
        {data.phone && <SummaryRow label="Telefone" value={data.phone} />}
        <SummaryRow label="Idade" value={`${data.age} anos`} />
        <SummaryRow label="Peso" value={`${data.weight_kg} kg`} />
        <SummaryRow label="Altura" value={`${data.height_cm} cm`} />
        <SummaryRow label="Experiência" value={experienceLabel(data.experience_level as Experience)} />
        <SummaryRow label="Objetivo" value={goalLabel(data.main_goal as Goal)} />
        <SummaryRow label="Dias" value={`${data.available_days.length}/semana`} />
      </div>
    </StepShell>
  );
}

function Choice({ active, children, onClick }: { active: boolean; children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition-colors active:scale-[0.99] ${
        active
          ? "border-primary/70 bg-primary/15"
          : "border-border bg-surface/40 hover:bg-surface/60"
      }`}
    >
      {children}
    </button>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-border/40 py-2 text-[14px] last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

function experienceLabel(e: Experience): string {
  return { beginner: "Iniciante", intermediate: "Intermediário", advanced: "Avançado" }[e] ?? "";
}
function goalLabel(g: Goal): string {
  return {
    weight_loss: "Emagrecimento",
    hypertrophy: "Hipertrofia",
    aerobic: "Resistência aeróbica",
    hybrid: "Performance híbrida",
    general_health: "Saúde geral",
  }[g] ?? "";
}
