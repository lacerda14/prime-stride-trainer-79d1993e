import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Watch, Bell, User, Database, Smartphone } from "lucide-react";

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
      <div className="mx-auto max-w-3xl space-y-6 p-6 lg:p-10">
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
      </div>
    </AppShell>
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
