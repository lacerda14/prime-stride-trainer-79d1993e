# Motor de Autorregulação Inteligente

Hoje o app só coleta um RPE geral e um `duration_feedback`. Vamos transformar isso num **motor de decisão multifatorial** que combina feedback subjetivo, cargas executadas vs planejadas, taxa de conclusão e histórico — sem nunca quebrar a periodização das 48 semanas.

---

## 1. Coleta de dados (o que já temos vs o que falta)

Já gravamos em `workout_set_logs`: `planned_reps`, `actual_reps`, `planned_load_kg`, `actual_load_kg`, `planned_rpe`, `actual_rpe`. Já gravamos `completed_summary.perceived_effort` (0–10) e `duration_feedback` na sessão.

**Falta um campo claro de feedback global em 5 níveis** (Muito leve / Leve / Ideal / Pesado / Muito pesado). Vamos adicionar `completed_summary.session_feedback` (texto enum) — sem migração, é JSONB.

**Falta marcar séries falhadas explicitamente.** Hoje uma série não-completada some. Vamos adicionar à série um status no log: `set_status` ∈ `completed | failed | skipped` (nova coluna `text` em `workout_set_logs`, default `completed`).

---

## 2. Tela de conclusão (UI)

Substituir o slider 0–10 atual por **5 botões grandes** (mobile-first, thumb-friendly):

```
😴 Muito leve   |  😌 Leve  |  🙂 Ideal  |  😤 Pesado  |  💀 Muito pesado
```

Mantemos o RPE por série como opcional (avançado). O `duration_feedback` continua igual. Por baixo, exibir o **Training Readiness Score** calculado da última sessão para o usuário entender o ajuste.

Na execução do treino (`/treino`), adicionar um toggle por série: ✅ Concluída / ❌ Falhei → grava `set_status`.

---

## 3. Motor de decisão (`src/lib/engine/autoregulation.server.ts`)

Função pura, server-side, que roda **ao concluir uma sessão**. Recebe sessão + últimas 4–8 semanas de logs do usuário. Calcula sinais e devolve ajustes.

### Sinais computados por sessão

| Sinal | Fórmula |
|---|---|
| `feedback_score` | mapa: muito_leve=-2, leve=-1, ideal=0, pesado=+1, muito_pesado=+2 |
| `load_delta_pct` | média ponderada `(actual_load - planned_load) / planned_load` por exercício força |
| `rep_delta_pct` | média `(actual_reps - planned_reps_min) / planned_reps_min` |
| `completion_rate` | séries completed ÷ total |
| `failure_rate` | séries failed ÷ total |
| `pr_count` | PRs batidos nesta sessão |

### Sinais de tendência (4 e 8 semanas)

- `trend_load_4w` / `trend_load_8w` — slope linear de `actual_load_kg` por exercício principal
- `trend_failure_4w` — variação de `failure_rate`
- `consistency_4w` — sessões concluídas ÷ planejadas

### Training Readiness Score (0–100)

```
readiness = 50
  + 15 * sign(trend_load_4w)         // progredindo +15, regredindo -15
  - 25 * failure_rate                 // muitas falhas penaliza
  + 10 * (completion_rate - 0.8)*5    // alta conclusão bonifica
  - 8  * max(0, feedback_score)       // pesado/muito pesado puxa
  + 5  * pr_count
  + 10 * (consistency_4w - 0.7)*3
```

Clamp em [0, 100]. Persistido em `readiness_scores` (nova tabela: `user_id, session_id, score int, signals jsonb, created_at`).

### Regras de ajuste (decisão)

A função devolve `{ load_adjust_pct, accessory_volume_adjust, deload_recommended, monitor_only, message }`:

| Cenário | Regra |
|---|---|
| feedback=muito_pesado **mas** PR + completion=100% + load_delta>0 | `monitor_only=true` (Exemplo 1) — não reduz |
| feedback=ideal **mas** failure_rate>0.3 + load_delta<0 | `load_adjust=-5%`, `accessory_volume=-1 série` (Exemplo 2) |
| feedback=muito_leve + load_delta>0 + failure=0 | `load_adjust=+5%`, `accessory_volume=+1 série` (Exemplo 3) |
| trend_failure_4w↑ + readiness<35 por 2 semanas | `deload_recommended=true` |
| trend_load_4w plano por 3 semanas + feedback≠pesado | `load_adjust=+2.5%` (microprogressão) |

**Regra de segurança:** os ajustes só alteram `suggested_load_kg`, séries de acessórios, descansos e exercícios opcionais — **nunca** estrutura semanal, push/pull, anterior/posterior, periodização macro.

---

## 4. Aplicação dos ajustes

Quando o usuário abre `/hoje` ou `/treino`, o motor lê o último `readiness_score` + ajuste e:

1. Sugere carga = `planned_load * (1 + load_adjust_pct)` (mostrada como "Sugestão IA" ao lado da prescrita)
2. Em exercícios marcados `accessory=true` no `exercise_pool`, soma/subtrai séries
3. Se `deload_recommended`, mostra banner: "Sua IA sugere semana mais leve — reduzir volume em 30%?" (usuário aceita)

Nada é aplicado automaticamente sem o usuário ver. Transparência total.

---

## 5. UI extra

- **Card "Readiness" no /hoje** — mostra score + 1 linha de explicação ("Você está progredindo bem, mantendo o ritmo")
- **Aba "IA" no /evolucao** — gráfico do readiness ao longo das semanas + log das decisões tomadas

---

## Arquivos

**Novos**
- `src/lib/engine/autoregulation.server.ts` — sinais, score, decisão (puro)
- `src/lib/engine/autoregulation.functions.ts` — `computeReadinessForSession`, `getLatestReadiness`
- `src/components/readiness-card.tsx` — card mobile

**Migrações**
- add `set_status text default 'completed'` em `workout_set_logs`
- create table `readiness_scores`

**Editados**
- `src/routes/treino.concluido.$sessionId.tsx` — 5 botões + exibir readiness após salvar
- `src/lib/workout-logs.functions.ts` — gravar `set_status` e `session_feedback`; ao final, chamar `computeReadinessForSession`
- `src/routes/treino.tsx` — toggle falha por série + leitura de sugestão IA
- `src/routes/hoje.tsx` — `ReadinessCard`
- `src/routes/evolucao.tsx` — aba IA

---

## Fora de escopo (fica para fase 2)

- Ajuste automático de descansos por HRV/wearables
- Predição de 1RM por velocity tracking
- Recomendação de exercícios alternativos baseada em fadiga muscular

---

## Como vou implementar

Se você aprovar, faço em **3 PRs internos** dentro deste turno:
1. **Schema + engine puro** (migrações + autoregulation.server.ts + testes mentais com os 3 exemplos do brief)
2. **Server fns + integração no save** (workout-logs grava feedback novo + dispara score)
3. **UI mobile** (5 botões, ReadinessCard, sugestão de carga na tela de treino)

Confirma que quer assim? Posso seguir.