import { defineConfig, devices } from "@playwright/test";

// E2E roda contra o app DEPLOYADO por padrão (smoke público + gate de auth, sem
// precisar de Supabase local). Para os fluxos AUTENTICADOS (onboarding→treino),
// subir Supabase local e setar E2E_BASE_URL=http://localhost:3000 + auth injetada
// (ver e2e/README — expansão documentada).
const baseURL = process.env.E2E_BASE_URL ?? "https://pm-hybrid.pedrolacerda-m.workers.dev";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
