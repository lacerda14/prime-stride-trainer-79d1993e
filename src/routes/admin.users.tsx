import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { AppShell } from "@/components/app-shell";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Loader2, ShieldAlert, Trash2, Flame, Zap, Crown } from "lucide-react";
import { TierCrown } from "@/components/tier-crown";
import { TIERS, tierFromPlan } from "@/lib/tiers";
import { getMyRole } from "@/lib/exercise-media.functions";
import {
  listAllUsers,
  deleteUserById,
  grantPremiumToUser,
  revokePremiumFromUser,
  type AdminUserDTO,
} from "@/lib/admin-users.functions";

// Opções de duração do premium concedido.
const PREMIUM_DURATIONS: { label: string; days: number | null }[] = [
  { label: "1 mês", days: 30 },
  { label: "3 meses", days: 90 },
  { label: "6 meses", days: 180 },
  { label: "1 ano", days: 365 },
  { label: "Vitalício", days: null },
];

function formatPremiumUntil(iso: string | null): string {
  if (!iso) return "vitalício";
  return `até ${new Date(iso).toLocaleDateString("pt-BR")}`;
}

export const Route = createFileRoute("/admin/users")({
  head: () => ({
    meta: [
      { title: "Usuários · Admin · PM Hybrid" },
      { name: "robots", content: "noindex,nofollow" },
    ],
  }),
  component: AdminUsersPage,
});

function AdminUsersPage() {
  const fetchRole = useServerFn(getMyRole);
  const { data: role, isLoading } = useQuery({
    queryKey: ["my-role"],
    queryFn: () => fetchRole(),
  });

  if (isLoading) {
    return (
      <AppShell title="Usuários" eyebrow="Admin">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      </AppShell>
    );
  }
  if (!role?.isAdmin) {
    return (
      <AppShell title="Restrito">
        <div className="flex h-64 flex-col items-center justify-center gap-3 px-6 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Esta área é restrita a administradores.</p>
        </div>
      </AppShell>
    );
  }
  return <UsersBoard />;
}

function UsersBoard() {
  const qc = useQueryClient();
  const fetchUsers = useServerFn(listAllUsers);
  const deleteFn = useServerFn(deleteUserById);
  const grantFn = useServerFn(grantPremiumToUser);
  const revokeFn = useServerFn(revokePremiumFromUser);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => fetchUsers(),
  });

  const [target, setTarget] = useState<AdminUserDTO | null>(null);
  const [premiumTarget, setPremiumTarget] = useState<AdminUserDTO | null>(null);
  const [grantPlan, setGrantPlan] = useState<"plus" | "pro">("pro");

  const del = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { targetUserId: id } }),
    onSuccess: () => {
      toast.success("Conta excluída");
      setTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grant = useMutation({
    mutationFn: (v: { id: string; days: number | null; plan: "plus" | "pro" }) =>
      grantFn({ data: { targetUserId: v.id, durationDays: v.days, plan: v.plan } }),
    onSuccess: () => {
      toast.success("Premium concedido 👑");
      setPremiumTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: (id: string) => revokeFn({ data: { targetUserId: id } }),
    onSuccess: () => {
      toast.success("Premium removido");
      setPremiumTarget(null);
      qc.invalidateQueries({ queryKey: ["admin-users"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <AppShell title="Usuários" eyebrow="Admin">
      <div className="space-y-4 px-4 pb-8 pt-3">
        <div className="flex items-center gap-2">
          <Link
            to="/admin/exercise-media"
            className="rounded-full border border-border/60 bg-surface/40 px-3 py-1.5 text-[11px] font-medium text-muted-foreground hover:text-foreground"
          >
            ← Curador de Vídeos
          </Link>
        </div>

        <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
          {data?.length ?? 0} usuários
        </div>

        {isLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ul className="space-y-2">
            {(data ?? []).map((u) => (
              <li key={u.id} className="rounded-2xl border border-border/60 bg-surface/40 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="truncate text-[14px] font-semibold">{u.name || "—"}</span>
                      {u.plan !== "free" && (
                        <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-foreground">
                          <TierCrown tier={tierFromPlan(u.plan)} className="h-2.5 w-2.5" />
                          {TIERS[tierFromPlan(u.plan)].name} · {formatPremiumUntil(u.premium_until)}
                        </span>
                      )}
                    </div>
                    <div className="truncate text-[11px] text-muted-foreground">
                      {u.email ?? u.id}
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Flame className="h-3 w-3 text-orange-400" />
                        {u.streak_current}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Zap className="h-3 w-3 text-primary" />
                        Nv {u.level} · {u.xp_total.toLocaleString("pt-BR")} XP
                      </span>
                      {u.created_at && (
                        <span>{new Date(u.created_at).toLocaleDateString("pt-BR")}</span>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className={`shrink-0 ${u.plan !== "free" ? "text-amber-400 hover:bg-amber-400/10" : "text-muted-foreground hover:bg-surface hover:text-amber-400"}`}
                    onClick={() => setPremiumTarget(u)}
                    title="Gerenciar Premium"
                  >
                    <Crown className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={() => setTarget(u)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Dialog open={!!target} onOpenChange={(open) => !open && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Excluir conta</DialogTitle>
            <DialogDescription>
              Esta ação é irreversível. Deseja excluir{" "}
              <span className="font-semibold text-foreground">
                {target?.name || target?.email || target?.id}
              </span>
              ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTarget(null)} disabled={del.isPending}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={() => target && del.mutate(target.id)}
              disabled={del.isPending}
            >
              {del.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir conta"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Conceder / remover Premium */}
      <Dialog open={!!premiumTarget} onOpenChange={(open) => !open && setPremiumTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Crown className="h-5 w-5 text-amber-400" /> Premium
            </DialogTitle>
            <DialogDescription>
              {premiumTarget && premiumTarget.plan !== "free" ? (
                <>
                  <span className="font-semibold text-foreground">
                    {premiumTarget?.name || premiumTarget?.email}
                  </span>{" "}
                  já é Premium ({formatPremiumUntil(premiumTarget?.premium_until ?? null)}). Escolha
                  uma nova duração ou remova.
                </>
              ) : (
                <>
                  Conceder Premium gratuito a{" "}
                  <span className="font-semibold text-foreground">
                    {premiumTarget?.name || premiumTarget?.email}
                  </span>
                  . Escolha a duração:
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          {/* Nível do plano */}
          <div className="flex gap-2 py-1">
            {(["plus", "pro"] as const).map((p) => (
              <button
                key={p}
                onClick={() => setGrantPlan(p)}
                className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-semibold transition-colors ${
                  grantPlan === p
                    ? "border-primary/50 bg-primary/10 text-foreground"
                    : "border-border/60 text-muted-foreground hover:text-foreground"
                }`}
              >
                <TierCrown tier={p} className="h-4 w-4" /> {TIERS[p].name}
              </button>
            ))}
          </div>

          <p className="px-1 text-[11px] text-muted-foreground">
            Conceder <span className="font-medium text-foreground">{TIERS[grantPlan].name}</span> —
            escolha a duração:
          </p>

          <div className="grid grid-cols-2 gap-2 py-1">
            {PREMIUM_DURATIONS.map((d) => (
              <Button
                key={d.label}
                variant="outline"
                disabled={grant.isPending || revoke.isPending}
                onClick={() =>
                  premiumTarget &&
                  grant.mutate({ id: premiumTarget.id, days: d.days, plan: grantPlan })
                }
                className="justify-center"
              >
                {grant.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : d.label}
              </Button>
            ))}
          </div>

          <DialogFooter className="sm:justify-between">
            {premiumTarget && premiumTarget.plan !== "free" ? (
              <Button
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                disabled={grant.isPending || revoke.isPending}
                onClick={() => premiumTarget && revoke.mutate(premiumTarget.id)}
              >
                {revoke.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  "Remover Premium"
                )}
              </Button>
            ) : (
              <span />
            )}
            <Button variant="ghost" onClick={() => setPremiumTarget(null)}>
              Fechar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
