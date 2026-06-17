import { useEffect, useRef, useState, type ReactNode } from "react";

function isNativeApp(): boolean {
  if (typeof window === "undefined") return true;
  const cap = (window as any).Capacitor;
  if (cap?.isNativePlatform?.()) return true;
  if (typeof cap?.getPlatform === "function") {
    const p = cap.getPlatform();
    if (p === "ios" || p === "android") return true;
  }
  return false;
}

const APP_SCHEME = "pmhybrid://";

function tryOpenApp() {
  const path = window.location.pathname + window.location.search;
  window.location.href = APP_SCHEME + path.replace(/^\//, "");
}

function AppBanner({ onDismiss }: { onDismiss: () => void }) {
  const triedRef = useRef(false);

  useEffect(() => {
    if (triedRef.current) return;
    triedRef.current = true;
    setTimeout(tryOpenApp, 300);
  }, []);

  return (
    <div className="flex items-center justify-between gap-3 bg-zinc-900 border-b border-white/10 px-4 py-2.5">
      <div className="flex items-center gap-2">
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-zinc-700 to-zinc-900 border border-white/10 flex items-center justify-center shrink-0">
          <span className="text-xs font-bold text-white">PM</span>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold leading-none">PM Hybrid</div>
          <div className="text-[10px] text-zinc-400 mt-0.5">Melhor experiência no app</div>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={tryOpenApp}
          className="text-xs font-semibold bg-white text-black px-3 py-1.5 rounded-full whitespace-nowrap"
        >
          Abrir app
        </button>
        <button
          onClick={onDismiss}
          className="text-zinc-400 text-lg leading-none w-6 h-6 flex items-center justify-center"
          aria-label="Fechar"
        >
          ×
        </button>
      </div>
    </div>
  );
}

export function WebGate({ children }: { children: ReactNode }) {
  const [native, setNative] = useState(true);
  const [ready, setReady] = useState(false);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  useEffect(() => {
    setNative(isNativeApp());
    setReady(true);
  }, []);

  const showBanner = ready && !native && !bannerDismissed;

  return (
    <>
      {showBanner && <AppBanner onDismiss={() => setBannerDismissed(true)} />}
      {children}
    </>
  );
}
