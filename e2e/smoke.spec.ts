import { test, expect } from "@playwright/test";

// Smoke E2E contra o app deployado: prova que o SSR + roteamento + gate de auth
// funcionam ponta-a-ponta (pega quebra de deploy/auth). Read-only, sem mutação.
test.describe("smoke — app deployado", () => {
  test("a tela de login (/auth) carrega com Google sign-in", async ({ page }) => {
    await page.goto("/auth");
    await expect(page).toHaveTitle(/PM Hybrid/i);
    await expect(page.getByText("Continuar com Google")).toBeVisible();
  });

  test("gate de auth: rota protegida sem sessão → redireciona pro /auth", async ({ page }) => {
    await page.goto("/perfil");
    await expect(page).toHaveURL(/\/auth/, { timeout: 15_000 });
    await expect(page.getByText("Continuar com Google")).toBeVisible();
  });
});
