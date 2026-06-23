# PM Hybrid — Technical Handoff

> Documento de transferência técnica. Estado em 2026-06-18.
> Objetivo: permitir que qualquer dev assuma o projeto sem contexto prévio.

---

## 1. Visão geral

**PM Hybrid** é um app de treino híbrido (força + corrida + condicionamento) com
programação **adaptativa**, coaches de IA com RAG, integrações de saúde
(Apple Saúde / Health Connect / Garmin) e assinatura (IAP).

São **dois repositórios**:

| Repo | Caminho local | O que é |
|---|---|---|
| **Frontend** | `~/Desktop/PM Hybrid/app` | App TanStack Start (SSR) + Capacitor (iOS/Android). É o que roda no navegador e dentro do app nativo. |
| **Backend** | `~/Desktop/PM Hybrid/backend` | Supabase: edge functions (Deno), Postgres (+ pgvector), migrations, scripts de ingestão. |

---

## 2. Stack

### Frontend (`Hybrid Flow`)
- **TanStack Start** (React + SSR) + **TanStack Router** + **TanStack Query**.
- **Cloudflare Workers** (deploy via Nitro/wrangler).
- **Capacitor 8** — empacota o web em apps nativos. **iOS e Android carregam a URL REMOTA**
  (`capacitor.config` → `server.url = https://pm-hybrid.pedrolacerda-m.workers.dev`).
  → **deploy web reflete no app na hora, sem rebuild nativo.** Rebuild nativo só é
  necessário quando muda **código nativo** (plugins Swift/Kotlin) ou config do app.
- **Tailwind** + componentes estilo shadcn (`src/components/ui`).
- **Supabase JS** — usado **só para auth** no cliente (`signInWithOAuth`, `signInWithPassword`,
  `getSession`). **Os dados do app vão por TanStack server functions** (`createServerFn` +
  middleware `requireSupabaseAuth`), que rodam no Worker com acesso ao Supabase.
- **RevenueCat** (`@revenuecat/purchases-capacitor`) para IAP.

### Backend (`fitness-ai-backend`)
- **Supabase**: Postgres + Auth + Storage + Edge Functions (Deno/TypeScript).
- **pgvector** para RAG (`knowledge_documents` + `knowledge_chunks`, RPC `match_knowledge_chunks`).
- **Anthropic** (Claude) para chat dos coaches e geração de treino.
- Project ref: `tkpnghmpylkptkrsywkh`.

---

## 3. Como rodar / buildar / deployar

### Web (produção)
```bash
cd "~/Desktop/PM Hybrid/app"
./deploy.sh         # bun run build + fix do compatibility_date + wrangler deploy
```
`deploy.sh` corrige o `compatibility_date` do worker para >= 2025-04-01 (senão os
secrets não populam `process.env` e o app zera tudo). URL: `pm-hybrid.pedrolacerda-m.workers.dev`.

### Edge functions (backend)
```bash
cd ~/Desktop/PM Hybrid/backend
supabase functions deploy <nome> --project-ref tkpnghmpylkptkrsywkh
# funções chamadas por browser/webhook (sem JWT) → adicionar --no-verify-jwt
```

### DDL / migrations
**Porta Postgres 5432 é bloqueada neste ambiente.** Aplicar DDL **manualmente pelo
Supabase SQL Editor** (colar o conteúdo do arquivo em `supabase/migrations/`).
`supabase functions deploy`, `supabase gen types` e secrets funcionam por HTTPS normalmente.

### Regenerar tipos do banco
```bash
supabase gen types typescript --project-id tkpnghmpylkptkrsywkh > "Hybrid Flow/src/integrations/supabase/types.ts"
```

### iOS (TestFlight) — pipeline por CLI
```bash
cd "~/Desktop/PM Hybrid/app/ios/App"
# 1. bump CURRENT_PROJECT_VERSION no App.xcodeproj/project.pbxproj
# 2. archive
xcodebuild -scheme App -configuration Release -destination 'generic/platform=iOS' \
  -archivePath build/App.xcarchive archive -allowProvisioningUpdates
# 3. export (ExportOptions.plist: method app-store-connect, team F638H3RCYR, automatic)
xcodebuild -exportArchive -archivePath build/App.xcarchive -exportPath build/export \
  -exportOptionsPlist ExportOptions.plist -allowProvisioningUpdates
# 4. upload
xcrun altool --upload-app -f build/export/App.ipa -t ios \
  --apiKey A3NSY26ZDJ --apiIssuer 8b6c4c58-c23e-4ed0-9d7f-0c6d9a83d7ab
```
- ASC API key (`.p8`) em `~/.appstoreconnect/private_keys/AuthKey_A3NSY26ZDJ.p8` (segredo, só no Mac).
- Team `F638H3RCYR`, bundle `com.pmhybrid.app`, há um target Watch App embutido.
- Build atual no TestFlight: **11**.

### Android (APK sideload)
```bash
cd "~/Desktop/PM Hybrid/app"
export JAVA_HOME="/Applications/Android Studio.app/Contents/jbr/Contents/Home"  # JDK 17
export ANDROID_HOME="$HOME/Library/Android/sdk"
npx cap sync android
cd android && ./gradlew assembleDebug --no-daemon
# APK: android/app/build/outputs/apk/debug/app-debug.apk
```
- Login Google no Android precisa do **SHA-1 da keystore de debug** registrado no
  OAuth client Android do Google Cloud. SHA-1 debug atual:
  `21:1E:16:1A:69:F1:7F:F7:B7:25:7F:15:FC:E1:B0:BB:97:B4:D3:FE`
- minSdk **26** (exigência do Health Connect), compileSdk/targetSdk 36.

---

## 4. ⚠️ Gotchas críticos (LEIA antes de mexer)

1. **`npx cap sync ios` QUEBRA o login Google.** Ele regenera
   `ios/App/CapApp-SPM/Package.swift` ("DO NOT MODIFY") e **remove o GoogleSignIn**,
   quebrando `GoogleAuthPlugin.swift` ("No such module 'GoogleSignIn'"). Depois de
   QUALQUER `cap sync ios`, re-adicionar 2 linhas em `CapApp-SPM/Package.swift`:
   - dep: `.package(url: "https://github.com/google/GoogleSignIn-iOS.git", from: "8.0.0"),`
   - produto no target: `.product(name: "GoogleSignIn", package: "GoogleSignIn-iOS"),`
   Validar: `xcodebuild -resolvePackageDependencies`. **Como o iOS carrega a URL remota,
   normalmente NÃO é preciso rodar `cap sync ios`** — só faça se mudou plugin nativo.
2. **Postgres 5432 bloqueado** → DDL só pelo SQL Editor (ver §3).
3. **`SUPABASE_SERVICE_ROLE_KEY` do `.env.local` local é inválido** ("Invalid API key").
   Para leituras/uploads autenticados em scripts, use um JWT de usuário (password grant).
   As edge functions usam o service role do ambiente do Supabase (válido).
4. **Auth Google web**: o fluxo é `supabase.auth.signInWithOAuth`. Site URL + Redirect URLs
   no Supabase (Authentication → URL Configuration) **devem** conter
   `https://pm-hybrid.pedrolacerda-m.workers.dev/**`. (Já configurado.)
5. **Onboarding** mexe em `src/routes/onboarding.tsx` — fluxo de 6 etapas (S1–S6); S7
   (estilo/motivação) e "horário preferido" foram **adiados** (definidos mas fora do fluxo,
   `TOTAL_STEPS=7` conta o splash). Reativar = re-renderizar `S7` e subir `TOTAL_STEPS`.

---

## 5. Modelo de dados (treino)

```
training_programs (user_id, active_week, total_weeks, goal, archived_at)
  └─ weeks (program_id, week_number)
       └─ training_days (day_number 1-7, day_name, session_type[full_body|run_upper|run|rest],
                         objective, duration_minutes, completed_at)
            ├─ session_exercises (slot, sets, reps, rpe_target, rest_seconds, exercise_id→exercise_pool)
            └─ running_protocols (protocol_type[z2|vo2|tempo|intervals|recovery|threshold],
                                  total_duration_minutes, …)
exercise_pool (catálogo público; category = grupo muscular: chest/back/core/…)
```
- O **calendário mapeia dia-da-semana fixo → training_day** via `program_start_date`
  (`weekFromStartDate` em `program.queries.ts`). Não existe "deslizar" treino;
  reorganizar = trocar `session_type` dos dias.
- Edição de treino tem **dois blocos**: FORÇA (`session_exercises`) e CORRIDA
  (`running_protocols`). Coaches editam só o(s) bloco(s) do seu domínio; Pedro edita tudo.
- **Schema "Lovable"**: `profiles` keyed por `id` (não `user_id`); sessão concluída =
  `completed_at` not null. Tabelas que NÃO existem: `exercises`, `performance_scores`,
  `assigned_workouts`, `health_questionnaire`, `ai_interactions`.

---

## 6. Coaches de IA + RAG

- **`ai_coaches`** (DB) é a fonte única: persona, name, specialty, tone, system_prompt,
  `knowledge_tags[]`, is_premium, avatar_url, sort_order, preferred/fallback_model.
  **11 coaches**: general=Pedro (free, 🧭), strength=Alex, cardio=Maya, corrida=Bia,
  nutrition=Nut, recovery=Carlos, mindset=Max, lpo=Yuri, calistenia=Léo, crossfit=Cris, casa=Théo.
  Nomes = só primeiro nome (sem "Coach"). **Nada de "IA"/"AI" no texto do produto.**
- **RAG**: `knowledge_documents` + `knowledge_chunks` (pgvector). `match_knowledge_chunks`
  filtra por interseção de tags (`&&`). Pedro → todo o corpus (filter NULL); específicos →
  `[...tags, 'geral']`. Taxonomia em `supabase/functions/_shared/knowledge-taxonomy.ts`.
- **Edge functions**: `ai-coach-chat` (chat, contexto completo do atleta, quick-replies via
  marcador `[[opcoes: ...]]`, tool `propose_workout_change`), `generate-workout-ai`,
  `classify-knowledge` (auto-tag dos docs via Haiku).
- **Alteração de treino**: coach propõe via tool → **prévia (antes→depois)** → atleta confirma →
  `apply-workout-change` escreve (usa client do usuário; RLS garante ownership; revalida domínio).
  Mudanças estruturais são "alinhadas com o Pedro" (orquestrador). Específicos achados em
  `_shared/workout-change.ts` (mapa coach→blocos editáveis).
- **Limites**: free = só Pedro, 5/dia · trial (`trialing`) = 30/dia (reset diário) ·
  premium (`premium_ai`+`active`) = ilimitado · owner (`pedrolacerda.m@gmail.com`)/admin = ilimitado.
- Modelos: Haiku (`claude-haiku-4-5-20251001`) chat/classify; Sonnet (`claude-sonnet-4-6`) geração.

---

## 7. Integrações de saúde

| Plataforma | Como | Estado |
|---|---|---|
| **Apple Saúde (iOS)** | Plugin Swift custom `HealthKitPlugin.swift` (jsName "HealthKit"). Método `readDailyMetrics` lê passos/FC/HRV/sono/energia/exercício por dia. `src/lib/healthkit.ts` → `syncDailyHealthMetrics()` → `ingest-healthkit-batch`. | ✅ no build 10/11; ativa após instalar build novo + permissões |
| **Health Connect (Android)** | Plugin Kotlin custom `HealthConnectPlugin.kt` (registrado como "HealthKit" → mesmo JS). Lê do Health Connect. | ✅ compila no APK; ativa com permissões no device |
| **Garmin** | Migration 49 + `garmin_connections`/`garmin_oauth_states` + 4 edge functions (`garmin-connect-start`, `garmin-oauth-callback`, `garmin-webhook`, `garmin-push-workout`) + UI em Configurações. | ⚠️ **scaffolding, NÃO testado** — inerte até aprovação no Garmin Developer Program + secrets `GARMIN_CLIENT_ID/SECRET/REDIRECT_URI`. Endpoints marcados "confirmar na doc". |

- **Pipeline comum**: tudo cai em `daily_health_metrics` + `health_integrations`
  (`platform` aceita `healthkit`/`health_connect`/`garmin`) → `calculate-recovery` →
  `recovery_signals` → alimenta recuperação e os coaches.
- **Garmin sem CNPJ**: o caminho que funciona já é **Garmin Connect → Apple Saúde / Health
  Connect → nossa ingestão** (não precisa da API do Garmin). A API direta (Body Battery,
  push de treino) precisa de aprovação como pessoa física.
- **Limitação iOS**: o HealthKit **não revela** quais permissões de leitura foram concedidas
  (privacidade). O diagnóstico em Configurações infere por "tem dados? então recebendo".

---

## 8. Build/distribuição & compliance

- **iOS**: TestFlight via pipeline do §3. Build 11 enviado. App Watch target embutido.
- **Android**: distribuído por **APK sideload** (decisão atual). Play Store/billing = follow-up.
- **Trava de idade 16+** no onboarding (cliente + guard no servidor).
- **W-8BEN** enviado; **Apps Pagos** (Paid Apps Agreement) em processamento — **IAP só
  funciona quando virar "Ativo"**.
- Secrets do worker necessários: `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## 9. Mapa rápido de arquivos

**Frontend**
- `src/routes/onboarding.tsx` — onboarding adaptativo (DateWheel, WhyBox, passo X/Y).
- `src/routes/index.tsx` — home (treino do dia, never-block no descanso, "Ajustar minha semana").
- `src/routes/coach-chat.tsx` — chat dos coaches (quick-replies, card de prévia de alteração).
- `src/routes/configuracoes.tsx` — integrações (Apple Saúde/Health Connect com diagnóstico, Garmin, Apple Watch modal).
- `src/lib/coach.functions.ts` / `garmin.functions.ts` / `week-adjust.functions.ts` / `healthkit.ts`.
- `src/components/week-adjust-sheet.tsx` — sheet "Ajustar minha semana".
- `src/integrations/supabase/` — client (auth) + types gerados + auth-middleware.
- `deploy.sh` — deploy web. `ios/` e `android/` — projetos nativos.

**Backend**
- `supabase/functions/ai-coach-chat`, `apply-workout-change`, `generate-workout-ai`,
  `classify-knowledge`, `ingest-healthkit-batch`, `calculate-recovery`, `garmin-*`.
- `supabase/functions/_shared/` — `workout-change.ts`, `garmin.ts`, `knowledge-taxonomy.ts`,
  `subscription.ts`, `auth.ts`, `cors.ts`.
- `supabase/migrations/` — 47 (coaches+tags), 48 (+5 coaches), 49 (garmin), + migrations Lovable.
- `scripts/ingest.py` — ingestão de conhecimento (pasta-por-coach → tag).

---

## 10. Contatos / credenciais (não-secretas)
- Supabase project: `tkpnghmpylkptkrsywkh`
- Apple Team: `F638H3RCYR` · Bundle: `com.pmhybrid.app` · ASC Key ID: `A3NSY26ZDJ`
- ASC Issuer ID: `8b6c4c58-c23e-4ed0-9d7f-0c6d9a83d7ab`
- Owner: `pedrolacerda.m@gmail.com`
- (Os segredos — `.p8`, service role, chaves Anthropic/Garmin — ficam só no ambiente, nunca no repo.)
