import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import pmLogo from "@/assets/pm-logo.png.asset.json";

export const Route = createFileRoute("/auth")({
  validateSearch: (s: Record<string, unknown>) => ({
    redirect: typeof s.redirect === "string" ? s.redirect : "/",
  }),
  component: AuthPage,
  head: () => ({ meta: [{ title: "Entrar · PM Hybrid Performance" }] }),
});

const emailSchema = z.string().trim().email("Email inválido").max(255);
const passwordSchema = z.string().min(6, "Mínimo 6 caracteres").max(72);
const nameSchema = z.string().trim().min(1, "Informe seu nome").max(80);

function AuthPage() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { redirect } = Route.useSearch();

  useEffect(() => {
    if (!authLoading && user) {
      navigate({ to: redirect || "/", replace: true });
    }
  }, [authLoading, user, navigate, redirect]);

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-background px-4 py-10">
      <div className="pointer-events-none absolute inset-0 grid-fade opacity-60" />
      <div className="relative w-full max-w-md">
        <div className="mb-8 flex flex-col items-center text-center">
          <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-elevated ring-1 ring-white/10 overflow-hidden">
            <img src={pmLogo.url} alt="PM Hybrid" className="h-10 w-10 object-contain" />
          </div>
          <span className="text-[11px] font-medium uppercase tracking-[0.22em] text-muted-foreground">
            PM Hybrid
          </span>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Performance System</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Acesse seu programa de 48 semanas
          </p>
        </div>

        <div className="glass rounded-2xl p-6">
          <Tabs defaultValue="signin" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Criar conta</TabsTrigger>
            </TabsList>
            <TabsContent value="signin" className="mt-5">
              <SignInForm />
            </TabsContent>
            <TabsContent value="signup" className="mt-5">
              <SignUpForm />
            </TabsContent>
          </Tabs>

          <div className="my-5 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-widest text-muted-foreground">ou</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <GoogleButton />
        </div>
      </div>
    </div>
  );
}

function SignInForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) {
      toast.error(error.message === "Invalid login credentials" ? "Email ou senha inválidos" : error.message);
      return;
    }
    toast.success("Bem-vindo de volta");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="si-email">Email</Label>
        <Input id="si-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="si-pass">Senha</Label>
        <Input id="si-pass" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Entrar
      </Button>
    </form>
  );
}

function SignUpForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      nameSchema.parse(name);
      emailSchema.parse(email);
      passwordSchema.parse(password);
    } catch (err) {
      if (err instanceof z.ZodError) {
        toast.error(err.issues[0].message);
        return;
      }
    }
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { display_name: name },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message === "User already registered" ? "Este email já está cadastrado" : error.message);
      return;
    }
    toast.success("Conta criada! Verifique seu email para confirmar.");
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="su-name">Nome</Label>
        <Input id="su-name" value={name} onChange={(e) => setName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-email">Email</Label>
        <Input id="su-email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="su-pass">Senha</Label>
        <Input id="su-pass" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <p className="text-[11px] text-muted-foreground">Mínimo 6 caracteres</p>
      </div>
      <Button type="submit" className="w-full" disabled={busy}>
        {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Criar conta
      </Button>
    </form>
  );
}

function GoogleButton() {
  const [busy, setBusy] = useState(false);
  const onClick = async () => {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Falha ao entrar com Google");
      return;
    }
    if (result.redirected) return;
    // tokens set, useAuth listener will redirect
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="group relative flex w-full items-center justify-center gap-3 rounded-xl border border-border/70 bg-[#050505] px-4 py-3.5 text-[15px] font-medium tracking-tight text-foreground shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] transition-all duration-200 hover:border-border hover:bg-[#0a0a0a] hover:-translate-y-[1px] hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.6)] active:translate-y-0 active:bg-[#030303] disabled:cursor-not-allowed disabled:opacity-60"
    >
      <span className="flex h-5 w-5 shrink-0 items-center justify-center">
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        ) : (
          <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden="true">
            <path fill="#EA4335" d="M12 10.2v3.92h5.45c-.24 1.4-1.7 4.1-5.45 4.1-3.28 0-5.96-2.71-5.96-6.06s2.68-6.06 5.96-6.06c1.87 0 3.12.8 3.84 1.48l2.62-2.52C16.78 3.52 14.6 2.5 12 2.5 6.76 2.5 2.5 6.76 2.5 12S6.76 21.5 12 21.5c6.07 0 10.08-4.27 10.08-10.27 0-.69-.07-1.22-.16-1.74H12z"/>
            <path fill="#4285F4" d="M22.08 11.23c0-.69-.07-1.22-.16-1.74H12v3.92h5.66c-.11.94-.73 2.36-2.1 3.32l.02.13 3.05 2.36.21.02c1.94-1.79 3.06-4.43 3.06-7.55"/>
            <path fill="#FBBC05" d="M5.92 13.5a5.8 5.8 0 0 1-.32-1.9c0-.66.12-1.3.31-1.9l-.01-.13-3.09-2.4-.1.05A9.5 9.5 0 0 0 1.5 12c0 1.54.37 2.99 1.02 4.27z"/>
            <path fill="#34A853" d="M12 21.5c2.7 0 4.96-.89 6.62-2.42l-3.16-2.45c-.85.59-1.98 1-3.46 1-2.65 0-4.9-1.74-5.7-4.16l-.12.01-3.21 2.49-.04.12C4.74 19.16 8.08 21.5 12 21.5"/>
            <path fill="#EA4335" d="M12 5.94c1.88 0 3.14.8 3.86 1.49l2.82-2.75C16.97 3.16 14.7 2.5 12 2.5 8.08 2.5 4.74 4.84 3.93 8.41l3.36 2.6C8.1 8.5 9.84 5.94 12 5.94"/>
          </svg>
        )}
      </span>
      <span>Continuar com Google</span>
    </button>
  );
}
