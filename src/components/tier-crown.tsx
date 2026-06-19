// src/components/tier-crown.tsx
// =============================================================================
// Coroa de tier — indicador ÚNICO de status de assinatura (White/Silver/Gold).
// Reusar em paywall, locked states, perfil, ranking, grupos, desafios, etc.
// Não criar outros badges/medalhas/símbolos.
// =============================================================================

import { Crown } from "lucide-react";
import { TIERS, type TierId } from "@/lib/tiers";
import { cn } from "@/lib/utils";

export function TierCrown({ tier, className }: { tier: TierId; className?: string }) {
  const meta = TIERS[tier];
  return (
    <Crown
      className={cn("h-4 w-4 shrink-0", meta.crownClass, className)}
      aria-label={`Coroa ${meta.name}`}
    />
  );
}

/** Coroa + nome do tier (ex.: chip em perfil/ranking). */
export function TierBadge({ tier, className }: { tier: TierId; className?: string }) {
  const meta = TIERS[tier];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        meta.accentClass,
        className,
      )}
    >
      <TierCrown tier={tier} className="h-3 w-3" />
      {meta.name}
    </span>
  );
}
