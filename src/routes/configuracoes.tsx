import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Watch, Bell, User, Database, Smartphone, RotateCcw, Loader2 } from "lucide-react";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { resetOnboarding } from "@/lib/profile.functions";
import { toast } from "sonner";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · PM Hybrid" },
      { name: "description", content: "Preferências e integrações com smartwatches." },
    ],
  }),
  component: ConfigPage,
});

const watches = [
  { name: "Apple Watch", status: "Pronto para conectar" },
  { name: "Garmin", status: "Pronto para conectar" },
  { name: "Coros", status: "Pronto para conectar" },
  { name: "Polar", status: "Pronto para conectar" },
  { name: "Samsung Watch", status: "Pronto para conectar" },
];

function ConfigPage() {
  return (
    <AppShell eyebrow="Sistema" title="Configurações">
      <div className="mx-auto max-w-3xl space-y-6 p-4 sm:p-6">
        <Section icon={User} title="Perfil" description="Informações pessoais e biometria">
          <Row label="Nome" value="PM Athlete" />
          <Row label="Peso" value="78 kg" />
          <Row label="Altura" value="178 cm" />
          <Row label="Bloco atual" value="Build · Meso 2 · Semana 07" />
        </Section>

        <Section icon={Watch} title="Smartwatches" description="Integração desacoplada — pronta para ativação futura">
          {watches.map((w) => (
            <Row
              key={w.name}
              label={w.name}
              value={
                <button className="rounded-full border border-border bg-surface/60 px-3 py-1 text-[11px] font-medium text-muted-foreground hover:bg-surface-elevated hover:text-foreground">
                  Conectar
                </button>
              }
              hint={w.status}
            />
          ))}
        </Section>

        <Section icon={Bell} title="Notificações" description="Lembretes de treino e recovery">
          <Toggle label="Lembrete diário de treino" defaultOn />
          <Toggle label="Resumo semanal" defaultOn />
          <Toggle label="Alerta de deload" />
        </Section>

        <Section icon={Database} title="Dados">
          <Row label="Programa" value="Híbrido 48 semanas" />
          <Row label="Sincronização" value="Local" hint="Em breve: sincronização em nuvem" />
        </Section>

        <Section icon={Smartphone} title="Aplicativo">
          <Row label="Versão" value="1.0.0" />
          <Row label="Tema" value="Dark Premium" />
        </Section>

        <DevSection />
      </div>
    </AppShell>
  );
}

function DevSection() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const reset = useServerFn(resetOnboarding);
  const [loading, setLoading] = useState(false);

  const handleReset = async () => {
    if (!confirm("Refazer o onboarding? Seu programa atual será arquivado.")) return;
    setLoading(true);
    try {
      await reset();
      await qc.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Onboarding resetado.");
      navigate({ to: "/onboarding", replace: true });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erro ao resetar.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="glass animate-fade-in rounded-2xl p-6">
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
          <RotateCcw className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">Admin / Dev</div>
          <div className="mt-0.5 text-xs text-muted-foreground">Ferramentas de teste — use com cautela.</div>
        </div>
      </div>
      <div className="mt-4">
        <button
          onClick={handleReset}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-2.5 text-[13px] font-medium hover:bg-surface-elevated disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
          Reset Onboarding
        </button>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Marca <code>onboarding_completed = false</code> e arquiva o programa atual, forçando o fluxo novamente.
        </p>
      </div>
    </section>
  );
}

function Section({ icon: Icon, title, description, children }: any) {
  return (
    <section className="glass animate-fade-in rounded-2xl p-6">
      <div className="flex items-start gap-3 border-b border-border pb-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-sm font-semibold tracking-tight">{title}</div>
          {description && <div className="mt-0.5 text-xs text-muted-foreground">{description}</div>}
        </div>
      </div>
      <div className="mt-2 divide-y divide-border/60">{children}</div>
    </section>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="text-sm text-muted-foreground">{value}</div>
    </div>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-3.5">
      <span className="text-sm font-medium">{label}</span>
      <input type="checkbox" defaultChecked={defaultOn} className="peer sr-only" />
      <span className="relative h-6 w-11 rounded-full bg-surface-elevated transition-colors peer-checked:bg-primary">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
