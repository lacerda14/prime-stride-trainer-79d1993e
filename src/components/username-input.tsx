// src/components/username-input.tsx
// Input de @username reutilizável (onboarding + perfil) com checagem de
// disponibilidade ao vivo (debounced). Reporta o status pro pai via onStatusChange
// (true = válido E livre). O componente NÃO renderiza label nem botão — quem usa
// decide o entorno (avançar no onboarding, salvar no perfil).
import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Loader2, Check } from "lucide-react";
import { checkUsername } from "@/lib/profile.functions";
import { sanitizeUsernameInput, validateUsername, usernameErrorMessage } from "@/lib/username";

export function UsernameInput({
  value,
  onChange,
  onStatusChange,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  onStatusChange?: (available: boolean) => void;
  autoFocus?: boolean;
}) {
  const check = useServerFn(checkUsername);
  const [status, setStatus] = useState<"idle" | "checking" | "available" | "error">("idle");
  const [msg, setMsg] = useState("");

  useEffect(() => {
    onStatusChange?.(status === "available");
  }, [status, onStatusChange]);

  useEffect(() => {
    if (value === "") {
      setStatus("idle");
      setMsg("");
      return;
    }
    const v = validateUsername(value);
    if (!v.ok) {
      setStatus("error");
      setMsg(usernameErrorMessage(v.reason));
      return;
    }
    setStatus("checking");
    setMsg("");
    let cancelled = false;
    const id = setTimeout(() => {
      check({ data: { username: v.value } })
        .then((res) => {
          if (cancelled) return;
          if (res.available) {
            setStatus("available");
            setMsg("");
          } else {
            setStatus("error");
            setMsg(res.reason === "taken" ? "Esse @ já está em uso." : "Nome indisponível.");
          }
        })
        .catch(() => {
          if (!cancelled) setStatus("idle");
        });
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return (
    <div>
      <div className="relative">
        <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">
          @
        </span>
        <input
          className="h-12 w-full rounded-xl border border-border bg-surface/40 pl-8 pr-10 text-[15px] font-medium outline-none transition-colors focus:border-primary/50"
          value={value}
          inputMode="text"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={20}
          autoFocus={autoFocus}
          placeholder="seu_nome"
          onChange={(e) => onChange(sanitizeUsernameInput(e.target.value))}
        />
        <span className="absolute right-3.5 top-1/2 -translate-y-1/2">
          {status === "checking" && (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          )}
          {status === "available" && <Check className="h-4 w-4 text-emerald-500" />}
        </span>
      </div>
      {msg ? (
        <p className="mt-1.5 text-[12px] font-medium text-destructive">{msg}</p>
      ) : status === "available" ? (
        <p className="mt-1.5 text-[12px] font-medium text-emerald-500">Disponível!</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted-foreground">
          Só letras, números e _. É como seus amigos te encontram.
        </p>
      )}
    </div>
  );
}
