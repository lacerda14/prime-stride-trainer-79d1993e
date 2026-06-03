# Plano: PM Hybrid → App iOS nativo + Apple Watch

App nativo via **Capacitor** (wrapper) + targets Swift para Watch e HealthKit. Lovable prepara tudo que é web/config; o trabalho Swift/Xcode você roda no seu Mac (te dou todo o código pronto pra colar).

---

## Divisão de responsabilidades

| Camada | Onde é feito |
|---|---|
| App web (UI, lógica, backend) | Lovable (já existe) |
| Capacitor config, plugins, ícones, splash, safe areas | Lovable |
| Migration data (outro Supabase → este) | Lovable (se decidir migrar) |
| Targets iOS / WatchKit (Swift) | Você no Xcode com código que eu entrego |
| Assinatura, certs, TestFlight, App Store | Você (Apple Developer) |

---

## Fase 1 — Preparar o app web pra rodar nativo (Lovable)

1. **Instalar Capacitor**: `@capacitor/core`, `@capacitor/cli`, `@capacitor/ios`.
2. Criar `capacitor.config.ts` com `appId: com.pmhybrid.app`, `appName`, `webDir: dist`, `server.androidScheme: https`, splash config.
3. **Safe areas iOS**: ajustar `src/styles.css` com `env(safe-area-inset-*)` no container principal e na bottom nav (notch + home indicator).
4. **Status bar**: plugin `@capacitor/status-bar` em modo dark (combina com a paleta).
5. **Splash screen**: plugin `@capacitor/splash-screen`, ativo nativo gerado a partir do logo.
6. **Haptics**: `@capacitor/haptics` em ações chave (completar série, atingir PR, finalizar treino).
7. **Deep link auth**: ajustar Supabase redirect pra `com.pmhybrid.app://auth/callback` (pra Google OAuth funcionar no app nativo via ASWebAuthenticationSession).
8. **Ícones + splash**: gerar set completo (todos tamanhos iOS + Watch) via `@capacitor/assets` a partir de um master 1024×1024.
9. **PWA / web**: continua funcionando no navegador. Capacitor só adiciona, não remove.

**Entrega**: projeto Lovable buildando com `ios/` pronto pra `npx cap open ios`.

---

## Fase 2 — HealthKit (Swift no Xcode)

HealthKit não tem plugin Capacitor oficial bom. Vamos com **plugin custom** (entrego o Swift):

1. Plugin Swift `HealthKitPlugin.swift` no target iOS com métodos: `requestAuthorization`, `readHeartRate`, `readWorkouts`, `writeWorkout`, `startWorkoutSession`, `observeHeartRate`.
2. Bridge TS em `src/integrations/healthkit/` com tipos.
3. Adicionar capability `HealthKit` no target iOS + `NSHealthShareUsageDescription` e `NSHealthUpdateUsageDescription` no `Info.plist`.
4. Telas no app que usam: home (FC repouso/HRV), tela de treino (calorias estimadas), pós-treino (escreve workout no Health).

---

## Fase 3 — Apple Watch app (Tracking ativo)

Target separado **WatchKit App + Extension** em SwiftUI (entrego todos os arquivos):

1. **Estrutura SwiftUI**: `WorkoutListView` → `WorkoutDetailView` → `ActiveSetView` → `RestTimerView` → `SummaryView`.
2. **WatchConnectivity**: iPhone manda o treino do dia pro Watch; Watch manda logs de série de volta em tempo real.
3. **HKWorkoutSession**: inicia treino real no Watch, lê FC ao vivo, salva no Health no fim.
4. **Digital Crown**: ajustar reps/peso com a coroa.
5. **Haptics**: feedback no fim do descanso (alarme tátil mesmo com tela apagada).
6. **Always-on display**: timer de descanso visível com tela escurecida.
7. **Complications** (fase 2): treino do dia no mostrador.

Você precisa abrir o Xcode e: **File → New → Target → Watch App**, depois colar os arquivos Swift que eu vou entregar num documento separado.

---

## Fase 4 — Backend (decisão pendente)

Você marcou "Manter backend atual", mas tinha um Supabase paralelo (`tkpnghmpylkptkrsywkh`) com dados que você queria migrar. Duas opções:

- **A**: Manter só este backend (Lovable Cloud) e começar limpo. Mais rápido.
- **B**: Eu rodo `schema.sql` + `data.sql` aqui no backend deste projeto antes do launch (resolve o problema de conexão local que você não conseguiu, porque rodo direto via tool de migration, sem psql).

Decidir antes de submeter à App Store.

---

## Fase 5 — Publicação

1. Bundle ID registrado no Apple Developer (`com.pmhybrid.app`).
2. App Store Connect: criar app, screenshots (iPhone 6.7" + 6.1" + Watch), descrição, política de privacidade (precisa URL pública — usar o site publicado).
3. Privacy nutrition labels: declarar HealthKit, dados de saúde, dados de uso.
4. **HealthKit review**: Apple revisa uso de HealthKit com critério extra; descrever bem nas usage strings.
5. Build via Xcode → Archive → upload → TestFlight → submissão.

---

## Riscos / pontos de atenção

- **Google OAuth no app nativo**: precisa ASWebAuthenticationSession + deep link configurado, senão o popup quebra. Vou configurar.
- **Apple review com HealthKit**: descrições genéricas = rejeição. Vou escrever usage strings específicas.
- **WatchConnectivity**: só funciona com Watch pareado ao iPhone (sem standalone). Fine pro MVP.
- **Sem hot reload no Watch**: cada mudança Swift exige rebuild no Xcode. Compensa fechar bem o design da Watch app antes.

---

## Próximos passos depois deste plano

Quando aprovar:

1. **Eu**: faço Fase 1 inteira (Capacitor + safe areas + splash + ícones + deep link auth) num único turno.
2. **Eu**: entrego um doc/skill com o código Swift completo (HealthKit plugin + Watch app SwiftUI) pra você colar no Xcode.
3. **Você**: roda `npm i && npx cap add ios && npx cap sync && npx cap open ios` no Mac, cola os arquivos Swift no lugar certo, configura signing.
4. **Juntos**: iteramos via TestFlight.

---

## Detalhe técnico (só pra referência)

```text
pm-hybrid/
├── src/                          ← app web (Lovable edita)
├── ios/                          ← gerado pelo Capacitor
│   └── App/
│       ├── App/                  ← target iPhone
│       │   ├── HealthKitPlugin.swift   ← entrego
│       │   └── Info.plist        ← usage strings
│       ├── PMHybridWatch/        ← target Watch (você cria no Xcode)
│       │   ├── PMHybridWatchApp.swift
│       │   ├── Views/
│       │   ├── Models/
│       │   ├── WorkoutManager.swift    (HKWorkoutSession)
│       │   └── ConnectivityManager.swift (WatchConnectivity)
│       └── Shared/               ← código compartilhado iPhone↔Watch
└── capacitor.config.ts
```

Plugins Capacitor a instalar na Fase 1:
`@capacitor/core @capacitor/cli @capacitor/ios @capacitor/status-bar @capacitor/splash-screen @capacitor/haptics @capacitor/app @capacitor/preferences @capacitor/assets`
