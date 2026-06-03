# PRs & Performance — Centro Oficial de Recordes

Antes de começar: o build atual está quebrado pelas mudanças anteriores (volume ao vivo, troca de exercícios, reordenação). Preciso primeiro **fechar essa frente** (terminar `StrengthView`, montar os sheets em `treino.tsx`) e só depois iniciar essa nova feature, senão nada renderiza para testar.

---

## Visão

Uma **única fonte de verdade** (`personal_records`) consumida por Home, Perfil, Evolução, Histórico, Conquistas e rankings futuros. Nada de PRs duplicados em cada tela.

## 1. Schema (migração)

**Nova tabela `personal_records`** (substitui o cálculo on-the-fly atual em `evolution.functions`):

```
personal_records
- id, user_id
- exercise_code text         -- 'back_squat', 'front_squat', 'deadlift', 'bench_press',
                                'strict_military_press', 'strict_pull_up',
                                'run_5k', 'run_1k', 'best_pace', 'distance_30min'
- category text              -- 'strength' | 'running'
- metric_type text           -- 'weight_load' | 'reps' | 'time_seconds' | 'distance_km' | 'pace_seconds_km'
- value numeric              -- valor principal
- secondary_value numeric    -- ex: reps usadas para estimar 1RM, ou pace médio
- estimated_1rm numeric      -- só para strength weight_load (Epley)
- achieved_at timestamptz
- previous_value numeric     -- para cálculo de evolução %
- source_session_id uuid     -- workout_session ou run_session
- created_at
```

Índice único `(user_id, exercise_code)` — guardamos só o **PR atual**; histórico vive em `pr_history`:

```
pr_history
- id, user_id, exercise_code
- value, secondary_value, estimated_1rm
- achieved_at, source_session_id
```

Cada novo PR: update em `personal_records` + insert em `pr_history`.

**Tipos de exercício no `exercise_pool`:** adicionar coluna `metric_type` com os 4 tipos (`weight_reps`, `bodyweight_reps`, `distance_time`, `duration_hold`) — backfill: tudo é `weight_reps` exceto isométricos detectados por nome (Plank, Hollow Hold, Wall Sit, Side Plank) → `duration_hold`.

GRANTs e RLS escopados por `auth.uid()`.

## 2. Detecção e gravação de PRs

Server function `detectAndUpsertPRs(sessionId)`:
- Roda ao concluir treino (`finishWorkoutSession`) e ao concluir corrida (`finishRunSession`).
- Para cada `workout_set_log` do tipo `weight_reps`: calcula 1RM Epley (`load × (1 + reps/30)`), compara com `personal_records.estimated_1rm` do `exercise_code` mapeado. Se maior, grava novo PR + history + evento XP (`pr_strength`, 100–250 XP conforme % de melhora).
- Para `bodyweight_reps` (Strict Pull-Up): compara reps absolutas.
- Para `duration_hold` (isométricos): **não gera PR** (regra explícita do usuário).
- Para corrida: extrai 5k/1k/best pace/30min distance dos `running_session_logs` e compara.

Mapeamento `exercise_code` → `exercise_pool.code` ou nome canônico. Lista fechada: apenas os 6 exercícios de força listados + 4 métricas de corrida aparecem na área de PRs.

## 3. Telas

**Nova rota `/_authenticated/performance`** — Dashboard "Minha Performance":
- Header com nível/XP (reaproveita `levelProgress`).
- Tabs: **Força** | **Corrida**.
- Cards por exercício/métrica com: valor atual, data, evolução % vs anterior, mini-gráfico de `pr_history` (sparkline), filtro 30d / 90d / 1a.
- Visual inspirado em Apple Fitness/Whoop: cards escuros com gradiente sutil, números grandes monoespaçados, ícone categórico.

**Aba no perfil**: `/_authenticated/perfil` ganha link "PRs & Performance" → leva para `/performance`.

**Home (`hoje.tsx`)**: card "PRs Recentes" passa a chamar `getRecentPRs({ limit: 3 })` (lê `pr_history` ordenado por `achieved_at desc`).

**Evolução (`evolucao.tsx`)**: seção "Recordes pessoais" lê de `personal_records` em vez de calcular. Adicionar card "Performance de Corrida" com os 4 PRs.

## 4. Isométricos — execução por tempo

- Em `treino.tsx`: detectar `metric_type === 'duration_hold'` e renderizar `IsometricView` em vez de `StrengthView`: cronômetro regressivo do `planned_seconds`, vibração (`navigator.vibrate`) ao zerar, botões "Concluir antes" e "+15s".
- `workout_set_logs`: usar `actual_reps` como `actual_seconds` para isométricos (ou adicionar `actual_duration_seconds`; prefiro coluna nova para não confundir downstream).
- Sumário do treino: para isométricos exibir "60s" em vez de "12 reps".
- Garantir que isométricos **nunca** entram em `detectAndUpsertPRs`.

## 5. Gamificação de PR

Quando `detectAndUpsertPRs` cria um PR:
- `xp_events` com `event_type='pr_strength'` ou `'pr_running'`, XP = 100 base + bônus por % melhora (cap 300).
- Achievement check: "Primeiro PR", "5 PRs", "10 PRs", "PR em todos os 6 lifts", "Sub-30 5k", etc. — adicionar entries em `achievements`.
- Tela de conclusão (`treino.concluido`) exibe banner animado "🏆 NOVO PR — Back Squat 190kg (+5.5%)" quando há PR nesta sessão.

## 6. Arquivos

**Novos**
- `supabase/migrations/...` — tabelas, grants, RLS, seed de achievements PR
- `src/lib/personal-records.functions.ts` — `getPersonalRecords`, `getRecentPRs`, `getPRHistory(exercise_code, range)`, `detectAndUpsertPRs`
- `src/lib/pr-detection.server.ts` — lógica Epley + mapeamento + comparações
- `src/routes/_authenticated/performance.tsx` (ou `src/routes/performance.tsx` com gate inline já que o projeto não usa `_authenticated/` ainda — verificar)
- `src/components/performance/pr-card.tsx`, `pr-sparkline.tsx`, `pr-recent-list.tsx`
- `src/components/workout/isometric-view.tsx`

**Editados**
- `src/routes/treino.tsx` — finalizar StrengthView pendente + adicionar IsometricView dispatch
- `src/routes/treino.concluido.$sessionId.tsx` — banner de PR
- `src/routes/hoje.tsx` — substituir fonte de PRs recentes
- `src/routes/evolucao.tsx` — ler de `personal_records`, adicionar bloco corrida
- `src/routes/perfil.tsx` — link "PRs & Performance"
- `src/lib/workout-session.functions.ts` — chamar `detectAndUpsertPRs` em finish
- `src/lib/evolution.functions.ts` — remover cálculo de PR on-the-fly, redirecionar para nova tabela

## 7. Ordem de execução

1. **Fechar build atual** (StrengthView + montar sheets). Sem isso nada testa.
2. Migração `personal_records` + `pr_history` + `metric_type` em exercise_pool + backfill isométricos.
3. `pr-detection.server.ts` + `personal-records.functions.ts` + hook em finish.
4. Dashboard `/performance` + componentes.
5. Refatorar Home, Evolução, Perfil para consumir nova fonte.
6. IsometricView + sumário por tempo.
7. Achievements e XP de PR + banner na tela de conclusão.

## Perguntas antes de executar

1. **Confirmar lista fechada de força**: só os 6 exercícios listados geram PR? Outros lifts (Romanian Deadlift, Hip Thrust, OHP com halteres, etc.) que o usuário fizer ficam **sem PR oficial**, apenas registrados em `workout_set_logs` para volume?
2. **`metric_type` em `exercise_pool`**: posso fazer backfill automático por nome (Plank/Hold/Wall Sit → `duration_hold`, resto → `weight_reps`) ou você quer revisar manualmente depois via admin?
3. **`/performance` ou aba dentro de `/perfil`?** Você disse "Perfil → PRs & Performance" mas também "tela premium Minha Performance". Faço rota dedicada `/performance` com link a partir do perfil — ok?
4. **Fechamento do build atual**: tudo bem eu terminar primeiro a feature de volume/swap/reorder pendente nessa mesma execução? Sem isso o app não roda e não dá pra validar PR.
