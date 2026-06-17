import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Watch, Bell, User, Database, Smartphone, RotateCcw, Loader2, Activity, Heart, ChevronRight } from "lucide-react";
import { useState, useEffect } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient, useQuery, useMutation } from "@tanstack/react-query";
import { resetOnboarding } from "@/lib/profile.functions";
import { getGarminStatus, startGarminConnect, disconnectGarmin } from "@/lib/garmin.functions";
import { dailyHealthAvailable, dailyHealthLabel, syncDailyHealthMetrics } from "@/lib/healthkit";
import { toast } from "sonner";
import { Capacitor } from "@capacitor/core";
import { WatchBridge } from "@/lib/watch-bridge";

export const Route = createFileRoute("/configuracoes")({
  head: () => ({
    meta: [
      { title: "Configurações · PM Hybrid" },
      { name: "description", content: "Preferências, integrações com wearables e privacidade." },
    ],
  }),
  component: ConfigPage,
});

const HEALTH_PLATFORMS = [
  { name: "Samsung Health", desc: "Galaxy · Samsung Account", status: "Em breve" },
];

const WEARABLES = [
  { name: "Coros", desc: "Pace · Apex · Vertix", status: "Em breve" },
  { name: "Polar", desc: "Pacer · Vantage · Grit", status: "Em breve" },
];

function ConfigPage() {
  return (
    <AppShell eyebrow="Sistema" title="Configurações">
      <div className="space-y-5 px-5 pb-28 pt-4">
        <PerfilLink />

        <Section icon={Heart} title="Saúde" description="Sincronize seus dados de saúde">
          <DeviceHealthRow />
          {HEALTH_PLATFORMS.map((p) => (
            <IntegrationRow key={p.name} name={p.name} desc={p.desc} status={p.status} />
          ))}
        </Section>

        <Section icon={Watch} title="Wearables" description="Conecte seus dispositivos">
          <AppleWatchRow />
          <GarminRow />
          {WEARABLES.map((w) => (
            <IntegrationRow key={w.name} name={w.name} desc={w.desc} status={w.status} />
          ))}
        </Section>

        <Section icon={Activity} title="Treino">
          <Row label="Programa" value="PM Hybrid · 48 semanas" />
          <Row label="Sincronização" value="Local" hint="Em breve: sincronização em nuvem" />
        </Section>

        <Section icon={Bell} title="Notificações">
          <Toggle label="Lembrete diário de treino" defaultOn />
          <Toggle label="Resumo semanal" defaultOn />
          <Toggle label="Alerta de deload" />
        </Section>

        <Section icon={Smartphone} title="Aplicativo">
          <Row label="Versão" value="1.0.0" />
          <Row label="Tema" value="Premium Black" />
        </Section>

        <Section icon={Database} title="Dados">
          <Row label="Exportar dados" value={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
          <Row label="Política de privacidade" value={<ChevronRight className="h-4 w-4 text-muted-foreground" />} />
        </Section>

        <DevSection />
      </div>
    </AppShell>
  );
}

function PerfilLink() {
  return (
    <Link to="/perfil" className="glass flex items-center justify-between rounded-3xl p-5 active:scale-[0.99] transition-transform">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-titanium">
          <User className="h-5 w-5 text-primary-foreground" />
        </div>
        <div>
          <div className="text-[15px] font-semibold tracking-tight">Editar Perfil</div>
          <div className="text-[12px] text-muted-foreground">Objetivo · medidas · preferências</div>
        </div>
      </div>
      <ChevronRight className="h-5 w-5 text-muted-foreground" />
    </Link>
  );
}

function DeviceHealthRow() {
  // iOS lê Apple Saúde; Android lê Health Connect. Os dois incluem o que o
  // Garmin Connect sincroniza no telefone. Web: indisponível.
  const available = dailyHealthAvailable();
  const label = dailyHealthLabel();
  const [syncing, setSyncing] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const { synced } = await syncDailyHealthMetrics(14);
      if (synced > 0) toast.success(`${label} sincronizado (${synced} dia${synced > 1 ? "s" : ""}).`);
      else toast.message("Nada novo pra sincronizar", { description: `Confirme as permissões do ${label}.` });
    } catch {
      toast.error(`Não consegui sincronizar com o ${label}.`);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <div className="text-[14px] font-medium tracking-tight">{label}</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {available ? "Sono, FC, passos · inclui Garmin pelo telefone" : "Disponível no app (iOS/Android)"}
        </div>
      </div>
      {available ? (
        <button
          onClick={sync}
          disabled={syncing}
          className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-primary disabled:opacity-60"
        >
          {syncing ? "..." : "Sincronizar"}
        </button>
      ) : (
        <button disabled className="rounded-full border border-border bg-surface/60 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
          Em breve
        </button>
      )}
    </div>
  );
}

function AppleWatchRow() {
  // Estados: loading → checando; web → não-nativo; ready → plugin nativo ativo; off → indisponível.
  const [state, setState] = useState<"loading" | "web" | "ready" | "off">("loading");

  useEffect(() => {
    let cancel = false;
    (async () => {
      if (!Capacitor.isNativePlatform()) {
        if (!cancel) setState("web");
        return;
      }
      try {
        const { supported } = await WatchBridge.isSupported();
        if (!cancel) setState(supported ? "ready" : "off");
      } catch {
        if (!cancel) setState("off");
      }
    })();
    return () => {
      cancel = true;
    };
  }, []);

  const label =
    state === "loading" ? "..." :
    state === "ready" ? "Conectado" :
    state === "web" ? "Em breve" : "Indisponível";

  const desc =
    state === "ready"
      ? "Abra um treino para enviá-lo ao relógio"
      : state === "web"
        ? "Disponível no app iOS"
        : "watchOS 10+";

  const badgeClass =
    state === "ready"
      ? "border-primary/50 bg-primary/10 text-primary"
      : "border-border bg-surface/60 text-muted-foreground/70";

  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <div className="text-[14px] font-medium tracking-tight">Apple Watch</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      <button disabled className={`rounded-full border px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] ${badgeClass}`}>
        {label}
      </button>
    </div>
  );
}

function GarminRow() {
  const qc = useQueryClient();
  const status = useServerFn(getGarminStatus);
  const start = useServerFn(startGarminConnect);
  const disconnect = useServerFn(disconnectGarmin);

  const { data, isLoading } = useQuery({
    queryKey: ["garmin-status"],
    queryFn: () => status(),
  });
  const connected = !!data?.connected;

  // Toast de retorno do OAuth (?garmin=ok|erro) e limpa a query string.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const p = new URLSearchParams(window.location.search);
    const g = p.get("garmin");
    if (!g) return;
    if (g === "ok") {
      toast.success("Garmin conectado!");
      qc.invalidateQueries({ queryKey: ["garmin-status"] });
    } else if (g === "erro") {
      toast.error(`Falha ao conectar o Garmin${p.get("motivo") ? ` (${p.get("motivo")})` : ""}.`);
    }
    p.delete("garmin"); p.delete("motivo");
    const qs = p.toString();
    window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
  }, [qc]);

  const connectMut = useMutation({
    mutationFn: () => start({ data: { redirect_to: `${window.location.origin}/configuracoes?garmin=ok` } }),
    onSuccess: (res) => {
      if (res.ok && res.url) {
        window.location.href = res.url; // vai pro consent do Garmin
      } else if (res.code === "garmin_not_configured") {
        toast.message("Garmin em breve", { description: "A integração está sendo liberada. Volte logo." });
      } else {
        toast.error(res.error ?? "Não consegui iniciar a conexão com o Garmin.");
      }
    },
    onError: () => toast.error("Não consegui iniciar a conexão com o Garmin."),
  });

  const disconnectMut = useMutation({
    mutationFn: () => disconnect(),
    onSuccess: () => {
      toast.success("Garmin desconectado.");
      qc.invalidateQueries({ queryKey: ["garmin-status"] });
    },
    onError: () => toast.error("Não consegui desconectar agora."),
  });

  const busy = connectMut.isPending || disconnectMut.isPending;

  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <div className="text-[14px] font-medium tracking-tight">Garmin</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">
          {connected ? "Conectado · sono, HRV e atividades" : "Forerunner · Fenix · Epix"}
        </div>
      </div>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : connected ? (
        <button
          onClick={() => disconnectMut.mutate()}
          disabled={busy}
          className="rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-primary disabled:opacity-60"
        >
          {disconnectMut.isPending ? "..." : "Conectado"}
        </button>
      ) : (
        <button
          onClick={() => connectMut.mutate()}
          disabled={busy}
          className="rounded-full border border-border bg-surface/60 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-foreground disabled:opacity-60"
        >
          {connectMut.isPending ? "..." : "Conectar"}
        </button>
      )}
    </div>
  );
}

function IntegrationRow({ name, desc, status }: { name: string; desc: string; status: string }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <div className="text-[14px] font-medium tracking-tight">{name}</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      <button disabled className="rounded-full border border-border bg-surface/60 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
        {status}
      </button>
    </div>
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
    <section className="rounded-3xl border border-border/50 bg-surface/30 p-5">
      <div className="flex items-center gap-2.5 pb-3">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-muted">
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
        </div>
        <div>
          <div className="text-[13px] font-semibold tracking-tight">Admin / Dev</div>
          <div className="text-[11px] text-muted-foreground">Ferramentas de teste.</div>
        </div>
      </div>
      <button onClick={handleReset} disabled={loading}
        className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface/60 px-4 py-2.5 text-[12.5px] font-medium disabled:opacity-60">
        {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        Reset Onboarding
      </button>
    </section>
  );
}

function Section({ icon: Icon, title, description, children }: { icon: React.ComponentType<{ className?: string }>; title: string; description?: string; children: React.ReactNode }) {
  return (
    <section className="glass animate-fade-in rounded-3xl p-5">
      <div className="flex items-start gap-2.5 pb-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-primary/10">
          <Icon className="h-4 w-4 text-primary" />
        </div>
        <div>
          <div className="text-[14px] font-semibold tracking-tight">{title}</div>
          {description && <div className="mt-0.5 text-[11.5px] text-muted-foreground">{description}</div>}
        </div>
      </div>
      <div className="divide-y divide-border/40">{children}</div>
    </section>
  );
}

function Row({ label, value, hint }: { label: string; value: React.ReactNode; hint?: string }) {
  return (
    <div className="flex items-center justify-between py-3.5">
      <div>
        <div className="text-[14px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[11px] text-muted-foreground">{hint}</div>}
      </div>
      <div className="text-[13px] text-muted-foreground">{value}</div>
    </div>
  );
}

function Toggle({ label, defaultOn }: { label: string; defaultOn?: boolean }) {
  return (
    <label className="flex cursor-pointer items-center justify-between py-3.5">
      <span className="text-[14px] font-medium">{label}</span>
      <input type="checkbox" defaultChecked={defaultOn} className="peer sr-only" />
      <span className="relative h-6 w-11 rounded-full bg-surface-elevated transition-colors peer-checked:bg-primary">
        <span className="absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-foreground transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
