# PM Hybrid — Project Audit

> Auditoria de estado, UX, integrações e dívidas. 2026-06-18.
> Complementa o `TECHNICAL_HANDOFF.md` (arquitetura/como rodar).

---

## 1. Estado por área

| Área | Estado | Observação |
|---|---|---|
| Onboarding | ✅ Live | Adaptativo, enxuto (6 etapas), com contexto e seletor de data por rolagem. |
| Home / treino do dia | ✅ Live | Nunca bloqueia treino (dia de descanso tem ação). "Ajustar minha semana". |
| Coaches IA + RAG | ✅ Live | 11 coaches, RAG por domínio, quick-replies, alteração de treino com prévia. |
| Geração de treino | ✅ Live | `generate-workout-ai` adaptado ao schema real. |
| Apple Saúde (iOS) | ✅ Live (build) | Ativa após instalar build 10/11 + conceder permissões. |
| Health Connect (Android) | ✅ Compila | Ativa no APK + permissões no device. |
| Garmin (API direta) | ⚠️ Scaffolding | **Não testado.** Inerte até aprovação no programa + secrets. |
| Assinatura / IAP | ⏳ Bloqueado | Depende de "Apps Pagos" virar Ativo (Apple). |
| Web | ✅ Live | Cloudflare Workers; reflete no app nativo (URL remota). |
| iOS TestFlight | ✅ Build 11 | Enviado por CLI. |
| Android | ✅ APK | Sideload; Play Store = follow-up. |

---

## 2. Auditoria de UX — achados e ações

### Resolvido nesta rodada
1. **Onboarding repetitivo (corrida/cardio).** *Princípio:* reconhecer em vez de
   memorizar; reduzir carga cognitiva. → Fluxo **adaptativo**: se o objetivo já é corrida,
   não pergunta de novo; se não quer cardio, as perguntas somem.
2. **Consequência oculta dos "dias de treino".** O usuário achava que escolhia preferência;
   o sistema travava nos demais dias. → Texto explica que é **programação inicial** e que
   pode treinar em qualquer dia.
3. **Dia de descanso = beco sem saída.** *Princípio:* liberdade/controle do usuário. →
   Botão **"Treinar mesmo assim"** + **"Ajustar minha semana"**.
4. **Scroll caía pro fim a cada etapa.** → Reset pro topo ao trocar de etapa.
5. **Seletor de data lento (calendário).** → **DateWheel** (Dia/Mês/Ano).
6. **Falta de contexto no onboarding.** *Princípio:* visibilidade do status. →
   "Por que perguntamos isso?" por etapa + "Passo X de 6 · Montando seu plano".
7. **Onboarding longo.** → Estilo/motivação e horário **adiados** pro perfil (primeiro valor mais rápido).
8. **Apple Saúde com mensagens vagas / sem confiança.** → **Estados claros** (última sync,
   nº de dias, erro com causa) + **tela de diagnóstico** (categorias com dados ✅/sem-dados).
9. **Apple Watch "Indisponível" (assustava).** → "Em breve / Em desenvolvimento" + **modal
   de roadmap** + "Avise-me quando disponível".
10. **"48 semanas" comunicava cronograma fechado.** → **"Plano Adaptativo · evolui a cada
    semana"** (Configurações/Assinaturas) e header "Semana XX" (sem "de 48").
11. **Reorganização da semana.** → "Ajustar minha semana": **Pular o próximo treino**
    (mutação segura) + **Reorganizar com o Pedro** (remontagem com prévia).

### Pendente / limitações conhecidas
- **Matriz exata de permissões de saúde (✅Sono ❌FC).** *Limitação técnica do iOS:* não
  expõe permissões de leitura concedidas. O diagnóstico infere por presença de dados —
  não dá pra mostrar "permissão negada" com certeza.
- **Página `/semanas`** ainda usa o enquadramento "48 semanas" (reframe pendente, média prioridade).
- **Reorganização automática "de verdade"** (trocar `session_type` dos dias preservando volume)
  **não** foi implementada por decisão: mexeria na saída do engine. Roteamos pelo Pedro (com prévia).
- **Push de treino pro relógio** (Apple Watch / Garmin Training API) não implementado
  (Watch = roadmap; Garmin = depende de aprovação).

---

## 3. Riscos & dívidas técnicas

| Risco | Impacto | Mitigação |
|---|---|---|
| `cap sync ios` apaga GoogleSignIn | Build iOS quebra ("No such module") | Documentado; evitar o sync (URL remota) ou reaplicar 2 linhas. **Ideal: script pós-sync.** |
| Garmin não testado | Integração pode não funcionar na 1ª ativação | Validar contra a doc do programa aprovado; ajustar endpoints/schema da Training API. |
| Postgres 5432 bloqueado | DDL manual, propenso a erro | Sempre aplicar migrations pelo SQL Editor e versionar o `.sql`. |
| `pbxproj`/projeto iOS parcialmente fora do git | Bump de build pode não versionar | Verificar `git status` do `ios/` ao subir build. |
| IAP depende de "Apps Pagos" Apple | Receita travada | Acompanhar status; testar compra quando Ativo. |
| Health Connect minSdk 26 | Exclui Android < 8 (~1%) | Aceitável; documentado. |
| Sem CI | Deploys/builds manuais | Considerar pipeline (lint+typecheck+deploy) como follow-up. |
| `total_weeks`/dead-code em `index.tsx` | Lint hints | Limpeza pontual quando conveniente. |

---

## 4. Backlog priorizado (sugestão)

**Alto impacto**
1. Garmin: concluir aprovação (pessoa física) + setar secrets + validar fluxo real (OAuth, webhook, push).
2. IAP: destravar "Apps Pagos" e validar compra/limites (free 5 · trial 30/dia · premium ilimitado).
3. Script pós-`cap sync ios` que reaplica o GoogleSignIn automaticamente.

**Médio**
4. Reframe completo da página `/semanas` (linguagem adaptativa).
5. Tela "adaptação visível" na home ("Plano ajustado há X dias com base em frequência/recuperação").
6. Android: decidir Play Store (Closed/Internal) + billing via RevenueCat.

**Baixo / futuro**
7. Reorganização automática real da semana (preservando volume) — exige sign-off no engine.
8. Apple Watch app (Connect IQ não; watchOS nativo) — roadmap do modal.
9. CI (typecheck + deploy), testes e2e do onboarding/coach.
10. Limpeza de dead-code e hints de lint.

---

## 5. Verificação rápida (smoke test manual)

- [ ] Login Google web funciona (navegador externo).
- [ ] Onboarding: 6 etapas, data por rolagem, "por que", sem repetição de cardio se objetivo = corrida.
- [ ] Home: dia de descanso mostra "Treinar mesmo assim"; "Ajustar minha semana" abre o sheet.
- [ ] Coach (premium/owner): pedir alteração → vê **prévia** → Aplicar reflete no treino.
- [ ] Configurações: Apple Saúde/Health Connect → "Sincronizar" → diagnóstico mostra categorias.
- [ ] Apple Watch: toque abre modal de roadmap + "avise-me".
- [ ] TestFlight build 11 instala e abre.
