// OAuth web flow usando Supabase diretamente (sem dependência do Lovable)
import type { Provider } from "@supabase/supabase-js";
import { supabase } from "../supabase/client";

type LovableProvider = "google" | "apple" | "microsoft" | "lovable";

type SignInOptions = {
  redirect_uri?: string;
  extraParams?: Record<string, string>;
};

function toSupabaseProvider(p: LovableProvider): Provider {
  if (p === "lovable" || p === "google") return "google";
  if (p === "apple") return "apple";
  if (p === "microsoft") return "azure";
  return "google";
}

export const lovable = {
  auth: {
    signInWithOAuth: async (provider: LovableProvider, opts?: SignInOptions) => {
      const redirectTo =
        opts?.redirect_uri ?? (typeof window !== "undefined" ? window.location.origin : undefined);

      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: toSupabaseProvider(provider),
        options: {
          redirectTo,
          queryParams: opts?.extraParams,
          skipBrowserRedirect: false,
        },
      });

      if (error) return { error };
      if (data?.url) {
        window.location.href = data.url;
        return { redirected: true };
      }
      return { redirected: false };
    },
  },
};
