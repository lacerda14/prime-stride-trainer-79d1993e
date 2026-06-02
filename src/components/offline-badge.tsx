import { useOnlineStatus, usePendingSyncCount } from "@/lib/offline-sync";
import { CloudOff, RefreshCw, WifiOff } from "lucide-react";

/**
 * Pequeno selo que mostra:
 *  • Offline (sem internet)
 *  • Sincronizando (online + fila pendente)
 *  • Nada (online + tudo sincronizado)
 */
export function OfflineBadge({ className = "" }: { className?: string }) {
  const online = useOnlineStatus();
  const pending = usePendingSyncCount();

  if (online && pending === 0) return null;

  if (!online) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-muted-foreground backdrop-blur ${className}`}
      >
        <WifiOff className="h-3 w-3" /> Offline
        {pending > 0 && (
          <span className="num ml-1 rounded-full bg-foreground/10 px-1.5 py-0.5 text-[9px] text-foreground">
            {pending}
          </span>
        )}
      </div>
    );
  }

  // online com pendências → sincronizando
  return (
    <div
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-primary backdrop-blur ${className}`}
    >
      <RefreshCw className="h-3 w-3 animate-spin" /> Sincronizando
      <span className="num ml-1 rounded-full bg-primary/20 px-1.5 py-0.5 text-[9px]">
        {pending}
      </span>
    </div>
  );
}

/**
 * Variante completa para mostrar em telas vazias / histórico.
 */
export function OfflineNotice() {
  const online = useOnlineStatus();
  if (online) return null;
  return (
    <div className="glass flex items-start gap-3 rounded-2xl border border-border p-4">
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-surface-elevated">
        <CloudOff className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="text-xs leading-relaxed text-muted-foreground">
        <div className="text-sm font-semibold text-foreground">Você está offline</div>
        Seu progresso continua sendo salvo no aparelho. Assim que voltar à internet,
        sincronizamos tudo automaticamente.
      </div>
    </div>
  );
}
