import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { CreditCard } from "lucide-react";

export const Route = createFileRoute("/assinaturas")({
  component: AssinaturasPage,
  head: () => ({ meta: [{ title: "Assinatura · PM Hybrid" }] }),
});

function AssinaturasPage() {
  return (
    <AppShell title="Assinatura" eyebrow="Plano">
      <div className="glass rounded-2xl p-6 text-center">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-surface-elevated ring-1 ring-white/10">
          <CreditCard className="h-5 w-5 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-semibold tracking-tight">Em breve</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Gerenciamento de assinatura estará disponível em breve.
        </p>
      </div>
    </AppShell>
  );
}
