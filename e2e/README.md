# E2E (Playwright)

## Rodar
```bash
npm run e2e            # smoke contra o app deployado (default)
npx playwright test --ui   # modo interativo
```

## O que existe hoje — `smoke.spec.ts`
Smoke **público** contra o app deployado (`E2E_BASE_URL` default = worker de prod).
Prova ponta-a-ponta: SSR + roteamento + **gate de auth** (rota protegida sem
sessão → `/auth`). Read-only, determinístico, sem infra. Pega quebra de deploy.

## Expansão: fluxos AUTENTICADOS (onboarding → treino → entitlement)
Estes precisam de **dados + sessão**, então rodam contra **Supabase local** (não
prod). Plano (recomendação: fazer paired, é um setup focado):

1. **Subir o stack local** (docker): `cd backend && supabase start && supabase db reset`.
2. **App apontando pro local**: `vite dev` com env
   `VITE_SUPABASE_URL=http://localhost:54321`, `VITE_SUPABASE_PUBLISHABLE_KEY=<anon local>`,
   e no servidor `SUPABASE_URL` / `SUPABASE_PUBLISHABLE_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
   do local. Setar `E2E_BASE_URL=http://localhost:3000` (ou usar `webServer` no config).
3. **`global-setup.ts`** (injeta sessão, evita a UI do Google OAuth):
   - cria usuário email/senha via `auth.admin` (service role local);
   - semeia profile + programa (chama o engine server-side ou insere direto);
   - faz `signInWithPassword`, salva `storageState` (cookies/localStorage da sessão).
4. **Specs** usando `storageState`:
   - `home` carrega com o treino do dia (programa semeado);
   - `iniciar treino → logar set → concluir` (o loop core);
   - **entitlement**: free vê especialistas locked; com sub `pro` semeada, destrava.
5. Stripe (pagamento) fica **fora** do E2E — testar o paywall renderizando + o
   entitlement com sub semeada (o webhook é coberto por integração).

> Por que não agora: subir local + dev server + auth + estabilizar é um setup
> dedicado; meia-boca vira teste flaky (proibido pelo nosso bar). A lógica
> crítica (entitlement, motor, gamification) já está coberta por unit/integração.
