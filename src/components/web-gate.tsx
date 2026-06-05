import { useEffect, useState, type ReactNode } from "react";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return true; // SSR: don't block render
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (typeof cap?.getPlatform === "function") {
    const p = cap.getPlatform();
    if (p === "ios" || p === "android") return true;
  }
  // Allow forcing access via ?web=1 for testing
  try {
    if (new URLSearchParams(window.location.search).get("web") === "1") return true;
    if (sessionStorage.getItem("pm_allow_web") === "1") return true;
  } catch { /* noop */ }
  return false;
}

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

function DownloadAppScreen() {
  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 py-12">
      <div className="w-full max-w-[420px] flex flex-col items-center text-center gap-6">
        <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center shadow-2xl">
          <span className="text-3xl font-bold tracking-tight">PM</span>
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-semibold tracking-tight">PM Hybrid</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            O PM Hybrid agora é exclusivo no app para iPhone.
            Baixe pelo TestFlight para continuar treinando.
          </p>
        </div>

        <a
          href="https://testflight.apple.com/"
          className="w-full inline-flex items-center justify-center rounded-2xl bg-foreground text-background font-semibold py-3.5 text-sm hover:opacity-90 transition-opacity"
        >
          Baixar no TestFlight
        </a>

        <p className="text-[11px] text-muted-foreground/70 leading-relaxed">
          Versão Android em breve. Para suporte, fale com a equipe PM Hybrid.
        </p>
      </div>
    </main>
  );
}
