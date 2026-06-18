import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { Watch, Bell, User, Database, Smartphone, RotateCcw, Loader2, Activity, Heart, ChevronRight, X, Check } from "lucide-react";
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
          <Row label="Plano" value="Adaptativo" hint="Evolui a cada semana com seus treinos, recuperação e evolução" />
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

type HealthSync = { ts: number; count: number; present?: string[] };
type HealthErr = { ts: number; msg: string };
const HEALTH_SYNC_KEY = "pm_health_last_sync";
const HEALTH_ERR_KEY = "pm_health_last_err";

const HEALTH_METRICS: Array<{ key: string; label: string }> = [
  { key: "sleep_duration_min", label: "Sono" },
  { key: "resting_hr", label: "FC de repouso" },
  { key: "hrv_ms", label: "HRV" },
  { key: "steps", label: "Passos" },
  { key: "active_energy_kcal", label: "Energia" },
  { key: "exercise_minutes", label: "Exercício" },
];

function readHealthSync(): HealthSync | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(HEALTH_SYNC_KEY); return v ? JSON.parse(v) as HealthSync : null; }
  catch { return null; }
}
function readHealthErr(): HealthErr | null {
  if (typeof window === "undefined") return null;
  try { const v = localStorage.getItem(HEALTH_ERR_KEY); return v ? JSON.parse(v) as HealthErr : null; }
  catch { return null; }
}
function relTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.round(diff / 60000);
  if (min < 1) return "agora";
  if (min < 60) return `há ${min} min`;
  const today = new Date(); const d = new Date(ts);
  const hhmm = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  if (d.toDateString() === today.toDateString()) return `hoje às ${hhmm}`;
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }) + ` às ${hhmm}`;
}

function DeviceHealthRow() {
  // iOS lê Apple Saúde; Android lê Health Connect. Os dois incluem o que o
  // Garmin Connect sincroniza no telefone. Web: indisponível.
  const available = dailyHealthAvailable();
  const label = dailyHealthLabel();
  const [syncing, setSyncing] = useState(false);
  const [lastSync, setLastSync] = useState<HealthSync | null>(() => readHealthSync());
  const [showDiag, setShowDiag] = useState(false);

  const sync = async () => {
    setSyncing(true);
    try {
      const { synced, present } = await syncDailyHealthMetrics(14);
      if (synced > 0) {
        const rec: HealthSync = { ts: Date.now(), count: synced, present };
        try { localStorage.setItem(HEALTH_SYNC_KEY, JSON.stringify(rec)); localStorage.removeItem(HEALTH_ERR_KEY); } catch { /* ignore */ }
        setLastSync(rec);
        toast.success(`Sincronizado · ${synced} dia${synced > 1 ? "s" : ""} importado${synced > 1 ? "s" : ""}`, {
          description: "Sono, FC, passos e treinos atualizados.",
        });
      } else {
        toast.message("Conectado, mas sem dados novos", {
          description: `Verifique se o ${label} tem permissão de leitura (sono, FC, passos) em Ajustes do telefone.`,
        });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : "erro desconhecido";
      try { localStorage.setItem(HEALTH_ERR_KEY, JSON.stringify({ ts: Date.now(), msg })); } catch { /* ignore */ }
      toast.error("Não foi possível sincronizar", {
        description: `Verifique sua conexão e as permissões do ${label}. Toque para tentar de novo.`,
      });
    } finally {
      setSyncing(false);
    }
  };

  // Sub-linha = estado atual da integração (visibilidade do status do sistema).
  const desc = !available
    ? "Disponível no app (iOS/Android)"
    : lastSync
      ? `Última sincronização: ${relTime(lastSync.ts)} · ${lastSync.count} dia${lastSync.count > 1 ? "s" : ""}`
      : "Sono, FC, passos e treinos · inclui Garmin pelo telefone";

  return (
    <>
      <div className="flex items-center justify-between py-3.5">
        <button
          onClick={() => available && setShowDiag(true)}
          disabled={!available}
          className="min-w-0 pr-3 text-left disabled:cursor-default"
        >
          <div className="flex items-center gap-1.5 text-[14px] font-medium tracking-tight">
            {label}
            {available && <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />}
          </div>
          <div className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</div>
        </button>
        {available ? (
          <button
            onClick={sync}
            disabled={syncing}
            className="shrink-0 rounded-full border border-primary/50 bg-primary/10 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-primary disabled:opacity-60"
          >
            {syncing ? "Sincronizando…" : lastSync ? "Atualizar" : "Sincronizar"}
          </button>
        ) : (
          <button disabled className="shrink-0 rounded-full border border-border bg-surface/60 px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] text-muted-foreground/70">
            Em breve
          </button>
        )}
      </div>
      {showDiag && (
        <HealthDiagnosticsModal label={label} lastSync={lastSync} syncing={syncing} onSync={sync} onClose={() => setShowDiag(false)} />
      )}
    </>
  );
}

// Diagnóstico da integração de saúde (status, última sync, categorias, erro).
function HealthDiagnosticsModal({ label, lastSync, syncing, onSync, onClose }: {
  label: string; lastSync: HealthSync | null; syncing: boolean; onSync: () => void; onClose: () => void;
}) {
  const err = readHealthErr();
  const present = new Set(lastSync?.present ?? []);
  const status = lastSync ? "Conectado" : err ? "Erro na última tentativa" : "Pronto para sincronizar";
  const statusColor = lastSync ? "text-primary" : err ? "text-destructive" : "text-muted-foreground";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div className="w-full max-w-[440px] rounded-t-3xl border border-border/60 bg-background p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:rounded-3xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Heart className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[16px] font-semibold tracking-tight">{label}</div>
              <div className={`text-[11.5px] font-medium ${statusColor}`}>{status}</div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 space-y-2 text-[13px]">
          <div className="flex justify-between"><span className="text-muted-foreground">Última sincronização</span><span className="font-medium">{lastSync ? relTime(lastSync.ts) : "—"}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">Dias importados</span><span className="font-medium">{lastSync?.count ?? 0}</span></div>
        </div>

        <div className="mt-5">
          <div className="mb-2 text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground">Dados encontrados</div>
          <div className="space-y-1.5">
            {HEALTH_METRICS.map((m) => {
              const ok = present.has(m.key);
              return (
                <div key={m.key} className="flex items-center justify-between text-[13.5px]">
                  <span>{m.label}</span>
                  {ok
                    ? <span className="flex items-center gap-1 text-primary"><Check className="h-3.5 w-3.5" /> Recebendo</span>
                    : <span className="text-muted-foreground/70">{lastSync ? "Sem dados" : "—"}</span>}
                </div>
              );
            })}
          </div>
          {lastSync && (
            <p className="mt-2.5 text-[11.5px] leading-relaxed text-muted-foreground">
              "Sem dados" pode ser falta de permissão de leitura ou ausência de registros. Ajuste em Ajustes do telefone → {label}.
            </p>
          )}
        </div>

        {err && !lastSync && (
          <div className="mt-4 rounded-2xl bg-destructive/10 px-3.5 py-2.5 text-[12px] text-destructive">
            Último erro: {err.msg}
          </div>
        )}

        <button
          onClick={onSync}
          disabled={syncing}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99] disabled:opacity-60"
        >
          {syncing ? <><Loader2 className="h-4 w-4 animate-spin" /> Sincronizando…</> : <><RotateCcw className="h-4 w-4" /> Sincronizar agora</>}
        </button>
      </div>
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
    "Em breve";

  const desc =
    state === "ready"
      ? "Abra um treino para enviá-lo ao relógio"
      : state === "web"
        ? "Chegando no app iOS"
        : "Em desenvolvimento · chegando nas próximas versões";

  const badgeClass =
    state === "ready"
      ? "border-primary/50 bg-primary/10 text-primary"
      : "border-border bg-surface/60 text-muted-foreground/70";

  const [showModal, setShowModal] = useState(false);
  const comingSoon = state !== "ready" && state !== "loading";

  // Linha tocável quando "em breve" → abre o roadmap.
  const content = (
    <>
      <div>
        <div className="text-[14px] font-medium tracking-tight">Apple Watch</div>
        <div className="mt-0.5 text-[11.5px] text-muted-foreground">{desc}</div>
      </div>
      <span className={`rounded-full border px-3 py-1 text-[10.5px] font-medium uppercase tracking-[0.14em] ${badgeClass}`}>
        {label}
      </span>
    </>
  );

  return (
    <>
      {comingSoon ? (
        <button onClick={() => setShowModal(true)} className="flex w-full items-center justify-between py-3.5 text-left active:opacity-70">
          {content}
        </button>
      ) : (
        <div className="flex items-center justify-between py-3.5">{content}</div>
      )}
      {showModal && <WatchRoadmapModal onClose={() => setShowModal(false)} />}
    </>
  );
}

const WATCH_INTEREST_KEY = "pm_watch_interest";
function WatchRoadmapModal({ onClose }: { onClose: () => void }) {
  const [notified, setNotified] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return localStorage.getItem(WATCH_INTEREST_KEY) === "1"; } catch { return false; }
  });
  const features = [
    "Iniciar treinos pelo relógio",
    "Frequência cardíaca em tempo real",
    "Sincronização automática",
    "Métricas avançadas de corrida",
    "Integração completa com o Apple Saúde",
  ];
  const notify = () => {
    try { localStorage.setItem(WATCH_INTEREST_KEY, "1"); } catch { /* ignore */ }
    setNotified(true);
    toast.success("Avisaremos você", { description: "Você recebe um aviso assim que o Apple Watch estiver disponível." });
  };
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-[440px] rounded-t-3xl border border-border/60 bg-background p-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10">
              <Watch className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-[16px] font-semibold tracking-tight">Apple Watch</div>
              <div className="text-[11.5px] text-muted-foreground">Em desenvolvimento</div>
            </div>
          </div>
          <button onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-surface">
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="mt-4 text-[13px] leading-relaxed text-muted-foreground">Estamos desenvolvendo suporte para:</p>
        <div className="mt-3 space-y-2">
          {features.map((f) => (
            <div key={f} className="flex items-center gap-2.5 text-[13.5px]">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10">
                <Check className="h-3 w-3 text-primary" />
              </span>
              {f}
            </div>
          ))}
        </div>
        <button
          onClick={notify}
          disabled={notified}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[14px] font-semibold text-primary-foreground shadow-glow active:scale-[0.99] disabled:opacity-60"
        >
          {notified ? <><Check className="h-4 w-4" /> Você será avisado</> : <><Bell className="h-4 w-4" /> Avise-me quando disponível</>}
        </button>
      </div>
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
