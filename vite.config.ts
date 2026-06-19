// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - tanstackStart, viteReact, tailwindcss, tsConfigPaths, nitro (build-only using cloudflare as a default target),
//     componentTagger (dev-only), VITE_* env injection, @ path alias, React/TanStack dedupe,
//     error logger plugins, and sandbox detection (port/host/strictPort).
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  tanstackStart: {
    server: { entry: "server" },
  },
  // nitro: {} FORÇA o plugin de deploy Nitro (Cloudflare Worker) → gera
  // .output/server/wrangler.json (sem isso o build cai em dist/ e o deploy falha).
  // O prerender de "/" foi removido de propósito (retornava 404 e a opção não é
  // tipada pelo wrapper) — a rota é SSR em runtime.
  nitro: {},
  // Vendor splitting: quebra o chunk monolítico (~617KB) em pedaços cacheáveis
  // e baixados em paralelo. Reduz o JS inicial e melhora o cache entre deploys
  // (vendor muda raramente). Só afeta o build do cliente.
  vite: {
    build: {
      rollupOptions: {
        output: {
          manualChunks(id: string) {
            if (!id.includes("node_modules")) return;
            if (id.includes("lucide-react")) return "vendor-icons";
            if (id.includes("@supabase")) return "vendor-supabase";
            if (id.includes("@stripe") || id.includes("@revenuecat")) return "vendor-payments";
            if (id.includes("zod")) return "vendor-zod";
            // react, react-dom e @tanstack são fortemente acoplados — mantê-los
            // no MESMO chunk evita o "circular chunk" (que pode dar tela branca).
            if (
              id.includes("react-dom") ||
              id.includes("@tanstack") ||
              /node_modules[\\/]react[\\/]/.test(id) ||
              /node_modules[\\/]scheduler[\\/]/.test(id)
            ) {
              return "vendor-react";
            }
          },
        },
      },
    },
  },
});
