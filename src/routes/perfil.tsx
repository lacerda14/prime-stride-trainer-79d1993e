import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useServerFn } from "@tanstack/react-start";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  getProfile,
  updateProfile,
  setUsername,
  getCompletedWorkoutCount,
} from "@/lib/profile.functions";
import { UsernameInput } from "@/components/username-input";
import { AvatarUpload } from "@/components/avatar-upload";
import { FREQUENCY_OPTIONS, isFrequencyLocked, isIntenseFrequency } from "@/lib/training-frequency";
import { SPORTS_OPTIONS, PREFERENCES_OPTIONS, MOTIVATIONS_OPTIONS } from "@/lib/onboarding-options";
import { toast } from "sonner";
import {
  Loader2,
  Save,
  User,
  Target,
  Calendar,
  Heart,
  Shield,
  ChevronRight,
  Trophy,
} from "lucide-react";
import { useIsAdmin } from "@/hooks/use-is-admin";

export const Route = createFileRoute("/perfil")({
  head: () => ({ meta: [{ title: "Perfil · PM Hybrid" }] }),
  component: PerfilPage,
});

type Goal = "fat_loss" | "hypertrophy" | "general_health" | "conditioning" | "run_5k" | "hybrid";

const GOAL_OPTIONS: { v: Goal; label: string }[] = [
  { v: "fat_loss", label: "Perda de gordura" },
  { v: "hypertrophy", label: "Ganho de massa" },
  { v: "general_health", label: "Saúde geral" },
  { v: "conditioning", label: "Condicionamento" },
  { v: "run_5k", label: "Correr 5 km" },
  { v: "hybrid", label: "Performance híbrida" },
];

// Listas reaproveitadas do onboarding (PT-BR) — mantêm Perfil ↔ Onboarding consistentes.
const SPORTS = SPORTS_OPTIONS;
const PREFERENCES = PREFERENCES_OPTIONS;
const MOTIVATIONS = MOTIVATIONS_OPTIONS;

function PerfilPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const fetch = useServerFn(getProfile);
  const save = useServerFn(updateProfile);
  const isAdmin = useIsAdmin();

  const { data: p, isLoading } = useQuery({
    queryKey: ["profile-edit"],
    queryFn: () => fetch(),
  });
  const fetchWorkoutCount = useServerFn(getCompletedWorkoutCount);
  const { data: completedWorkouts = 0 } = useQuery({
    queryKey: ["completed-workout-count"],
    queryFn: () => fetchWorkoutCount(),
  });
  const experience = (p?.experience_level as string | null) ?? null;

  const [form, setForm] = useState({
    name: "",
    weight_kg: "" as number | "",
    height_cm: "" as number | "",
    goal: "" as Goal | "",
    available_days: "" as 2 | 3 | 4 | 5 | 6 | "",
    available_minutes: "" as 30 | 45 | 60 | 90 | "",
    sports: [] as string[],
    preferences: [] as string[],
    motivations: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [regen, setRegen] = useState(false);

  useEffect(() => {
    if (p) {
      setForm({
        name: (p.name as string) ?? "",
        weight_kg: p.weight_kg ? Number(p.weight_kg) : "",
        height_cm: p.height_cm ? Number(p.height_cm) : "",
        goal: (p.goal as Goal) ?? "",
        available_days: (p.available_days as 2 | 3 | 4 | 5 | 6) ?? "",
        available_minutes: (p.available_minutes as 30 | 45 | 60 | 90) ?? "",
        sports: (p.sports as string[]) ?? [],
        preferences: (p.preferences as string[]) ?? [],
        motivations: (p.motivations as string[]) ?? [],
      });
    }
  }, [p]);

  const toggle = (k: "sports" | "preferences" | "motivations", v: string) => {
    setForm((cur) => ({
      ...cur,
      [k]: cur[k].includes(v) ? cur[k].filter((x) => x !== v) : [...cur[k], v],
    }));
  };

  const onSave = async () => {
    setSaving(true);
    try {
      await save({
        data: {
          name: form.name.trim() || undefined,
          weight_kg: typeof form.weight_kg === "number" ? form.weight_kg : undefined,
          height_cm: typeof form.height_cm === "number" ? form.height_cm : undefined,
          goal: form.goal || undefined,
          available_days: form.available_days || undefined,
          available_minutes: form.available_minutes || undefined,
          sports: form.sports,
          preferences: form.preferences,
          motivations: form.motivations,
          regenerate_plan: regen,
        },
      });
      await qc.invalidateQueries({ queryKey: ["profile"] });
      await qc.invalidateQueries({ queryKey: ["profile-edit"] });
      toast.success(regen ? "Perfil salvo e programa regenerado." : "Perfil atualizado.");
      if (regen) navigate({ to: "/" });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) {
    return (
      <AppShell eyebrow="Perfil" title="Carregando">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell eyebrow="Conta" title="Perfil">
      <div className="space-y-5 px-5 pb-32 pt-4">
        {/* Foto de perfil — toque para trocar (upload pro bucket avatars) */}
        <div className="flex flex-col items-center gap-3 pt-1">
          <AvatarUpload
            uid={p?.id}
            currentUrl={p?.avatar_url}
            name={p?.name}
            onUpdated={() => {
              qc.invalidateQueries({ queryKey: ["profile-edit"] });
              qc.invalidateQueries({ queryKey: ["profile"] });
              qc.invalidateQueries({ queryKey: ["dashboard"] });
            }}
          />
          <div className="text-center">
            <div className="text-[16px] font-semibold tracking-tight">{p?.name ?? "Atleta"}</div>
            <div className="text-[11.5px] text-muted-foreground">Toque na foto para trocar</div>
          </div>
        </div>

        <Link
          to="/performance"
          className="glass flex items-center justify-between rounded-3xl p-5 transition-colors hover:bg-surface/60"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[15px] font-semibold tracking-tight">PRs & Performance</div>
              <div className="text-[12px] text-muted-foreground">
                Seus recordes de força e corrida
              </div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </Link>

        <Card icon={User} title="Dados pessoais">
          <Field label="Nome">
            <input
              className={inputCls}
              value={form.name}
              maxLength={80}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </Field>
          <UsernameEditor current={(p?.username as string | null) ?? null} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Peso · kg">
              <input
                type="number"
                step="0.1"
                className={inputCls}
                value={form.weight_kg}
                onChange={(e) =>
                  setForm({
                    ...form,
                    weight_kg: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </Field>
            <Field label="Altura · cm">
              <input
                type="number"
                className={inputCls}
                value={form.height_cm}
                onChange={(e) =>
                  setForm({
                    ...form,
                    height_cm: e.target.value === "" ? "" : Number(e.target.value),
                  })
                }
              />
            </Field>
          </div>
        </Card>

        <Card icon={Target} title="Objetivo">
          <div className="grid gap-1.5">
            {GOAL_OPTIONS.map((g) => (
              <Row
                key={g.v}
                active={form.goal === g.v}
                onClick={() => {
                  setForm({ ...form, goal: g.v });
                  setRegen(true);
                }}
              >
                {g.label}
              </Row>
            ))}
          </div>
        </Card>

        <Card icon={Calendar} title="Agenda">
          <Field label="Dias por semana">
            <div className="grid grid-cols-5 gap-1.5">
              {FREQUENCY_OPTIONS.map((n) => {
                const locked = isFrequencyLocked(n, experience, completedWorkouts);
                const intense = isIntenseFrequency(n);
                const active = form.available_days === n && !locked;
                return (
                  <button
                    key={n}
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      setForm({ ...form, available_days: n });
                      setRegen(true);
                    }}
                    className={`h-11 rounded-xl border text-[13px] font-semibold transition active:scale-[0.97] ${
                      active
                        ? intense
                          ? "border-red-500/60 bg-red-500/15 text-red-400"
                          : "border-primary/60 bg-primary/[0.10] text-foreground"
                        : locked
                          ? "cursor-not-allowed border-border/40 bg-surface/20 text-muted-foreground/40"
                          : intense
                            ? "border-red-500/30 bg-surface/40 text-red-400/90"
                            : "border-border bg-surface/40 text-muted-foreground"
                    }`}
                  >
                    {n}x
                  </button>
                );
              })}
            </div>
            {experience === "beginner" && completedWorkouts < 20 && (
              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                <span className="text-red-400">5x e 6x</span> liberam após 20 treinos (
                {completedWorkouts}/20).
              </p>
            )}
          </Field>
          <Field label="Tempo por treino">
            <div className="grid grid-cols-4 gap-1.5">
              {([30, 45, 60, 90] as const).map((n) => (
                <Pill
                  key={n}
                  active={form.available_minutes === n}
                  onClick={() => setForm({ ...form, available_minutes: n })}
                >
                  {n}min
                </Pill>
              ))}
            </div>
          </Field>
        </Card>

        <Card icon={Heart} title="Personalização">
          <Multi
            label="Esportes"
            items={SPORTS}
            selected={form.sports}
            onToggle={(v) => toggle("sports", v)}
          />
          <Multi
            label="Preferências"
            items={PREFERENCES}
            selected={form.preferences}
            onToggle={(v) => toggle("preferences", v)}
          />
          <Multi
            label="Motivação"
            items={MOTIVATIONS}
            selected={form.motivations}
            onToggle={(v) => toggle("motivations", v)}
          />
        </Card>

        {isAdmin && (
          <Card icon={Shield} title="Admin">
            <Link
              to="/admin/exercise-media"
              className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-surface/60"
            >
              <span>Curador de Vídeos</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
            <Link
              to="/admin/users"
              className="flex items-center justify-between rounded-xl border border-border bg-surface/40 px-4 py-3 text-[14px] font-medium text-foreground transition-colors hover:bg-surface/60"
            >
              <span>Gerenciar Usuários</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" />
            </Link>
          </Card>
        )}

        {regen && (
          <div className="rounded-2xl border border-primary/40 bg-primary/[0.06] p-4 text-[13px] text-foreground">
            Você mudou o objetivo ou a agenda — seu programa será regenerado ao salvar.
          </div>
        )}

        <button
          onClick={onSave}
          disabled={saving}
          className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-titanium text-[15px] font-semibold text-primary-foreground shadow-glow disabled:opacity-60 active:scale-[0.99]"
        >
          {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
          {saving ? "Salvando..." : "Salvar alterações"}
        </button>
      </div>
    </AppShell>
  );
}

const inputCls =
  "h-12 w-full rounded-xl border border-border bg-surface/40 px-4 text-[15px] font-medium outline-none focus:border-primary/50 transition-colors";

// Placeholder = username auto-gerado no signup (atleta_<hash>) ou ainda vazio.
function isPlaceholderUsername(u: string | null): boolean {
  return !u || /^atleta_/.test(u);
}

// Editor de @username pra quem já passou do onboarding (placeholder/NULL).
// Salva isolado do "Salvar alterações" do perfil — tem unicidade + checagem própria.
function UsernameEditor({ current }: { current: string | null }) {
  const qc = useQueryClient();
  const saveFn = useServerFn(setUsername);
  const placeholder = isPlaceholderUsername(current);
  const [value, setValue] = useState(placeholder ? "" : (current ?? ""));
  const [available, setAvailable] = useState(false);

  const m = useMutation({
    mutationFn: () => saveFn({ data: { username: value } }),
    onSuccess: (res) => {
      toast.success(`@${res.username} salvo!`);
      void qc.invalidateQueries({ queryKey: ["profile"] });
      void qc.invalidateQueries({ queryKey: ["profile-edit"] });
      void qc.invalidateQueries({ queryKey: ["friends-overview"] });
    },
    onError: (e: Error) =>
      toast.error(
        e.message === "username_taken" ? "Esse @ já está em uso." : "Não foi possível salvar.",
      ),
  });

  const changed = value.toLowerCase() !== (current ?? "").toLowerCase();
  const canSave = available && changed && !m.isPending;

  return (
    <Field label="Nome de usuário">
      {placeholder && (
        <p className="mb-2 text-[12px] text-muted-foreground">
          Você ainda não escolheu um @. Crie um pros amigos te encontrarem.
        </p>
      )}
      <UsernameInput value={value} onChange={setValue} onStatusChange={setAvailable} />
      <button
        type="button"
        disabled={!canSave}
        onClick={() => m.mutate()}
        className="mt-2.5 inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-[13px] font-semibold text-primary-foreground transition active:scale-[0.99] disabled:opacity-40"
      >
        {m.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
        Salvar @
      </button>
    </Field>
  );
}

function Card({
  icon: Icon,
  title,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="glass animate-fade-in rounded-3xl p-5 space-y-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div className="text-[15px] font-semibold tracking-tight">{title}</div>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      {children}
    </div>
  );
}

function Row({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`w-full rounded-xl border px-4 py-3 text-left text-[14px] font-medium transition-all active:scale-[0.99] ${
        active
          ? "border-primary/60 bg-primary/[0.10] text-foreground"
          : "border-border bg-surface/40 text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Pill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`h-11 rounded-xl border text-[13px] font-medium transition-all ${
        active
          ? "border-primary/60 bg-primary/[0.10] text-foreground"
          : "border-border bg-surface/40 text-muted-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Multi({
  label,
  items,
  selected,
  onToggle,
}: {
  label: string;
  items: string[];
  selected: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div>
      <div className="mb-2 text-[10px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
        {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.map((v) => {
          const on = selected.includes(v);
          return (
            <button
              key={v}
              onClick={() => onToggle(v)}
              className={`rounded-full border px-3.5 py-1.5 text-[12.5px] font-medium transition-all ${
                on
                  ? "border-primary/60 bg-primary/[0.12] text-foreground"
                  : "border-border bg-surface/40 text-muted-foreground"
              }`}
            >
              {v}
            </button>
          );
        })}
      </div>
    </div>
  );
}
