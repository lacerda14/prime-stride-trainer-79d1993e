# Engine v2 — Geração Rolante & Coach que Aprende

> **Status:** PROPOSTA DE ARQUITETURA (para revisão de Pedro + esposa antes de implementar).
> Não é rewrite — é evolução do que já existe. Escrito em 19/jun/2026.
> Referências de código no formato `arquivo:linha` são do estado atual do repo.

---

## 1. Visão (do Pedro)

1. **Sair do programa fixo de 48 semanas** → gerar **semana a semana** conforme o aluno treina e interage.
2. **Coach aprende continuamente** com o progresso do aluno.
3. **Histórico do atleta compartilhado** — toda evolução de marca/PR/ajuste fica disponível para **qualquer coach** a que o aluno tenha acesso.
4. **Treino do dia:** sugerir o próximo com base no anterior, mas **deixar o aluno escolher** livremente.
5. (já feito) Onboarding por **contagem de dias** (2–6) em vez de dias da semana.

---

## 2. Arquitetura atual (estado real)

```
Perfil (onboarding) ──► generatePlan() ──► persistProgram() ──► 48 semanas ASSADAS no DB
                         (determinístico)    (insere TUDO)        (macro→meso→weeks→
                                                                   training_days→session_exercises)
        Aluno treina ──► workout_sessions / workout_set_logs / personal_records
                         │
                         ▼
        computeReadinessForSession() ──► readiness_scores (score + signals + DECISION)
                         │
                         └──►  ✗  a DECISION NÃO realimenta a geração. Fim do fluxo.
```

**Componentes (todos já existem):**
- **PM Engine** (`src/lib/engine/pm-engine.server.ts`) — `generatePlan()` gera **48 semanas determinísticas** (volume FB 12/12/24, mesociclos, deloads). Soberano em periodização/volume/frequência/segurança/lesões/equipamento.
- **persistProgram** (`pm-engine.server.ts:1361`) — grava o programa **inteiro de uma vez**: `training_programs:1403` → `macrocycles:1437` → `mesocycles:1459` → `weeks:1487` → `training_days`/`session_exercises` em batches (`:1551`). ~50k `session_exercises` por usuário. Rollback (delete do programa) no erro.
- **Autoregulação** (`autoregulation.server.ts` + `autoregulation.functions.ts`) — `computeReadinessForSession` lê a sessão + sets + 28 dias de histórico, roda `computeReadiness()` → `decide()` (ajuste de carga %, volume acessório, deload, mensagem) e **persiste em `readiness_scores`**. **É ADVISORY**: mostra a mensagem mas **não altera** os `session_exercises` futuros.
- **Coach Layer** (`coach-layer.server.ts`) — Methodology Pack determinístico + guardrails (REP_FLOOR, RPE_CAP, etc.) + RAG por tags. Ajusta **prescrição** (reps/descanso/RPE/notas) SOBRE a estrutura do motor; nunca volume/frequência/lesões.
- **Avanço** (`program.queries.ts`) — `active_week`/`active_day` caminham pelas semanas pré-assadas; `ensureValidActiveProgram:144` só regenera em `regenerate_plan` (read-only nas leituras — corrigido em jun).

---

## 3. O gap central

O loop de feedback está **ABERTO**. O motor sabe COMO ajustar (a autoregulação já calcula), mas **nada aplica** o ajuste, porque as 48 semanas já estão assadas. O programa é **estático**: o aluno da semana 1 e o da semana 30 recebem o que foi decidido no dia do onboarding.

**Engine v2 = fechar esse loop + tornar a geração rolante, sem quebrar nada.**

---

## 4. Arquitetura v2 proposta

### 4.1 Princípio inegociável: a periodização se MANTÉM; só o conteúdo adapta
**A estrutura de macrociclo / mesociclo / microciclo NÃO muda.** O esqueleto periodizado
(fases de volume, blocos, posição dos deloads) continua sendo do `pm-engine`. O v2 **não
remove os ciclos** — ele **adapta o CONTEÚDO dentro deles** (carga, volume acessório,
prescrição) conforme o **feedback do aluno**.

Geração rolante **NÃO** é "coach gera treino livre". O `pm-engine` continua dono da
periodização, volume, frequência, segurança, lesões e equipamento. O que muda é **QUANDO**
(materialização incremental, não 48 de uma vez) e **COM QUAL ESTADO** (alimentado pelo
feedback acumulado) a geração roda — sempre dentro da estrutura macro/meso/micro existente.

### 4.2 Geração rolante (rolling window)
- Em vez de gerar `w = 1..48` no onboarding, gerar uma **janela** (ex.: próximas 1–2 semanas) **on-demand**, quando o aluno se aproxima do fim do que já existe.
- A geração da semana `W` lê o **estado acumulado do atleta** (PRs, decisões de autoregulação, tendências, frequência efetiva) e produz a semana **ajustada**.
- Continua **determinística e seedável** (reprodutibilidade), mas **parametrizada pelo estado**, não só pelo perfil estático do onboarding.
- A periodização macro (fases de volume, posição de deload) continua planejada — só a **materialização** das semanas é incremental.

### 4.3 Fechar o loop (o coração do v2)
- Introduzir um **`athlete_adjustment_state`** (jsonb por programa/usuário): carga relativa atual por padrão, volume acessório atual, flag de deload pendente, etc.
- **A autoregulação ATUALIZA** esse estado (hoje ela só guarda a decisão em `readiness_scores`).
- **A geração da próxima semana CONSOME** esse estado → aplica `load_adjust_pct`, `accessory_volume_adjust`, `deload_recommended` na prescrição.
- Resultado: "muito pesado + falhou" na semana N **rebaixa** a semana N+1. Loop fechado.

### 4.4 Athlete Progress Profile (histórico compartilhado)
- Um snapshot **consolidado** do progresso: PRs/1RM estimado por padrão de movimento, tendências (failure rate 4s, completion rate), frequência efetiva, histórico de deload, marcas batidas.
- Fonte única, derivada de `personal_records` + `pr_history` + `readiness_scores` + `workout_set_logs` (consolidado on-demand, ou materializado numa tabela `athlete_progress` para custo).
- **Qualquer coach** (`user_ai_coaches`) lê esse profile → vira contexto do Methodology Pack + RAG + reasoning.
- É isto que realiza o ponto 3 da visão: "sempre que evolui uma marca, fica disponível pra qualquer coach".

### 4.5 Treino do dia: sugerir + escolha livre
- Hoje `getTodayTraining` serve o dia fixo do programa assado.
- v2: serve o **próximo treino sugerido** (baseado no último concluído + a janela rolante) e **lista alternativas** disponíveis da janela. O aluno escolhe.
- O "próximo pelo anterior" sai naturalmente: a janela tem N sessões; sugere a próxima na sequência, mas não trava o aluno nela.

---

## 5. Modelo de dados (mudanças — todas ADITIVAS)

| O quê | Onde | Por quê |
|---|---|---|
| `generation_cursor` (int) | `training_programs` | até qual semana já foi materializada (rolling) |
| `adjustment_state` (jsonb) | `training_programs` ou tabela própria | estado que a autoregulação atualiza e a geração lê |
| `athlete_progress` (opcional) | tabela nova | snapshot consolidado p/ coaches (ou derivar on-demand) |

**Mantém intacto:** `training_programs`/`macrocycles`/`mesocycles`/`weeks`/`training_days`/`session_exercises`. A geração rolante **insere as próximas semanas incrementalmente** em vez de tudo no onboarding. Programas atuais continuam válidos.

---

## 6. Fases de migração (sem quebrar quem está testando)

> Cada fase é **feature-flagged** (`feature_flags` já existe no schema), testável e deployável isolada.

- **Fase 0 — flag + fallback.** Flag `rolling_engine`. Caminho antigo (48 assadas) continua default. Programas existentes não mudam.
- **Fase 1 — geração rolante "por trás", MESMO output.** Em vez de assar 48, assar as próximas **K semanas** quando o aluno chega perto do fim (gatilho no fim do treino ou no `getTodayTraining`). **Sem mudar prescrição nem estrutura.** Valida que rolar não quebra o `active_week`/avanço. Risco baixo, ganho de custo (menos escrita upfront).
- **Fase 2 — fechar o loop.** Cria `adjustment_state`; autoregulação atualiza; geração da próxima semana aplica os deltas. **Aqui o feedback realimenta de verdade.**
- **Fase 2.5 — Página de feedback (o INPUT do aprendizado).** Revisar a tela de feedback da
  sessão. Hoje captura só `session_feedback` (muito_leve→muito_pesado) em `completed_summary`
  + os sets logados. O loop só aprende tão bem quanto o input → **enriquecer** o que é coletado
  (ex.: feedback por exercício/grupo muscular, dor/sono/energia, "bateu PR?"). Quanto melhor o
  sinal, melhor a adaptação da Fase 2. **(Pedro pediu explicitamente: alterar a página de feedback.)**
- **Fase 3 — Athlete Progress Profile + coach lê.** Consolida o histórico; coach layer + reasoning consomem.
- **Fase 4 — Daily suggest + escolha livre.** UI do treino do dia: sugestão + alternativas.

---

## 7. Decisões (TODAS FECHADAS por Pedro em 22/jun)

1. ✅ **DECIDIDO (Pedro, 22/jun): gerar 1 MESOCICLO à frente.** Mantém coerência de
   periodização e adapta a cada bloco. (A janela rolante materializa o próximo mesociclo
   quando o aluno se aproxima do fim do atual.)
2. ✅ **DECIDIDO: programas existentes ficam no modelo antigo até a próxima regeneração.**
   Só entra no rolante quem gerar treino novo — zero risco pra quem está treinando agora.
3. ✅ **DECIDIDO: começar pelo HEURÍSTICO** (ligar a autoregulação que já existe no próximo
   treino = fechar o loop). IA/reasoning vem DEPOIS, por cima, sempre dentro dos guardrails.
4. ✅ **DECIDIDO: manter DETERMINÍSTICO/seedável.** A adaptação vem dos DADOS (feedback do
   aluno), não de aleatoriedade. Testável (pm-engine.test.ts depende disso).

---

## 8. O que NÃO muda (garantias)

- **PM Engine soberano** — periodização, volume, frequência, segurança, lesões, equipamento.
- **Estrutura de tabelas** — só adições; nada removido.
- **Coach Layer + guardrails** — coach nunca ultrapassa os limites do motor.
- **Programas atuais** continuam funcionando (fallback + flag).
- **Determinismo/testabilidade** do motor.

---

## 9. Resumo de uma linha

> Hoje o motor **assa 48 semanas e a autoregulação só dá pitaco**. O v2 faz o motor **gerar a próxima janela consumindo o feedback acumulado** (loop fechado), com um **histórico de atleta** que qualquer coach lê — tudo em fases feature-flagged que não quebram quem está treinando.
