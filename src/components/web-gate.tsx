import { useEffect, useRef, useState, type ReactNode } from "react";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return true;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (typeof cap?.getPlatform === "function") {
    const p = cap.getPlatform();
    if (p === "ios" || p === "android") return true;
  }
  try {
    if (new URLSearchParams(window.location.search).get("web") === "1") return true;
    if (sessionStorage.getItem("pm_allow_web") === "1") return true;
  } catch {/* noop */}
  return false;
}

const APP_SCHEME = "pmhybrid://";
const TESTFLIGHT_URL = "https://testflight.apple.com/";

export function WebGate({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [native, setNative] = useState(true);

  useEffect(() => {
    setNative(isNativeApp());
    setReady(true);
  }, []);

  if (!ready) return null;
  if (native) return <>{children}</>;
  return <DownloadAppScreen />;
}

function tryOpenApp(path: string) {
  // Tenta abrir o app via custom scheme. Se não estiver instalado, nada acontece
  // e o usuário continua na landing.
  const url = APP_SCHEME + path.replace(/^\//, "");
  window.location.href = url;
}

function DownloadAppScreen() {
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    // Tentativa automática 1x ao abrir
    const path = window.location.pathname + window.location.search;
    setTimeout(() => tryOpenApp(path), 300);
  }, []);

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px] flex flex-col items-center text-center gap-6">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl">
          <span className="text-3xl font-bold tracking-tight">PM</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">PM Hybrid</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O PM Hybrid é exclusivo no app. Abra no seu iPhone — se ainda não
            instalou, baixe pelo TestFlight.
          </p>
        </div>

        <div className="w-full flex flex-col gap-2.5">
          <button
            onClick={() => {
              const path = window.location.pathname + window.location.search;
              tryOpenApp(path);
            }}
            className="w-full inline-flex items-center justify-center rounded-2xl bg-foreground text-background font-semibold py-3.5 text-sm hover:opacity-90 transition-opacity"
          >
            Abrir no app
          </button>
          <a
            href={TESTFLIGHT_URL}
            className="w-full inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/[0.03] text-foreground font-medium py-3.5 text-sm hover:bg-white/[0.06] transition-colors"
          >
            Baixar no TestFlight
          </a>
        </div>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Versão Android em breve.
        </p>
      </div>
    </main>
  );
}
