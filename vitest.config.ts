import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Config dedicada de testes (não usa o vite-tanstack-config p/ não arrastar
// nitro/SSR). Ambiente node — cobrimos lógica PURA (sem React/DOM).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
