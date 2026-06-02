# Migração para o Motor de Personalização PM Hybrid v1.0

## Contexto

A app hoje roda em cima de `src/lib/program-data.json` (planilha fixa) com schema já estabelecido em Supabase (`profiles`, `workout_sessions`, `xp_events`, `achievements`, `friendships`, `week_plans`, etc.).

O novo modelo exige:
- 8+ tabelas novas (`training_programs`, `macrocycles`, `mesocycles`, `weeks`, `training_days`, `exercise_pool`, `session_exercises`, `running_protocols`)
- Um engine de geração que aplique ~30 regras (universais, por objetivo, por disponibilidade, regra de ouro, manguito, panturrilha, etc.)
- Pool de exercícios extraído das 2 planilhas anexas + documento PM Motor
- Onboarding atualizado (campos novos: `sex` em vez de `gender`, enums novos para `goal` e `experience_level`, `available_days` agora discreto 3/4/5)
- Renderização dinâmica em todas as telas (hoje, semanas, treino, corrida, progressão)

Implementar isso num único turno quebra a app inteira. Proponho 5 fases, cada uma entregável e reversível.

## Decisões que preciso confirmar antes de começar

1. **Compatibilidade com dados existentes**: usuários já cadastrados têm `gender` (4 valores) e `main_goal` (5 valores). O novo schema usa `sex` e `goal` com enums diferentes. Posso (a) renomear colunas via migration e mapear valores, ou (b) manter as antigas e adicionar as novas em paralelo, ou (c) limpar tudo (drop & recreate) — você está em dev então isso é viável.

2. **Pool de exercícios**: vou extrair de `PM_INICIANTES_48S.xlsx` e `PM_IDOSOS_60-70_48S.xlsx` e popular `exercise_pool` via seed. Confirma que essas planilhas são a fonte canônica do pool?

3. **Tela `/semanas` e `WeekDistributionModal`**: a distribuição manual de dias que acabamos de construir vira incompatível — o novo motor gera dias já atribuídos. Tudo bem remover esse modal?

4. **Gamificação (Fase 1 atual)**: XP/streak/achievements ficam intactos; só mudam as funções de "recordWorkout" para apontar para `training_days` em vez de `workout_sessions` legado.

## Fases

### Fase A — Schema base (1 migration)
- Drop colunas antigas `gender`, `main_goal` em `profiles`; cria `sex`, `goal` com novos enums; renomeia `available_days` para aceitar 3/4/5; adiciona `name`, `onboarding_completed` (boolean) substituindo `display_name`/`onboarding_completed_at`.
- Cria tabelas: `training_programs`, `macrocycles`, `mesocycles`, `weeks`, `training_days`, `exercise_pool`, `session_exercises`, `running_protocols`.
- RLS por `auth.uid()` via `training_programs.user_id`.
- Mantém `workout_sessions`, `xp_events`, `achievements`, `user_achievements`, `friendships`, `weight_history` (gamificação não muda).
- Remove `week_plans` (não faz mais sentido com geração dinâmica).

### Fase B — Seed do exercise_pool
- Script Python lê as 2 planilhas + tabelas do PM Motor (seção 6).
- Insere ~80–120 exercícios com `category`, `equipment`, `movement_pattern`, flags `allowed_beginner/intermediate/advanced`, `shoulder_safe`, `lower_body_pattern`.
- Migration de seed (INSERT bulk).

### Fase C — ProgramGenerationEngine (servidor)
Arquivo: `src/lib/program-engine.server.ts` + `src/lib/program-engine.functions.ts`.

Funções principais:
- `calcReferenceVelocity(profile)` — V_ref baseado em peso/idade/sexo (doc seção 8).
- `buildMacroPlan(goal, available_days)` — devolve os 6 mesos com modificadores de objetivo (seções 5.1–5.4) e disponibilidade (seção 9).
- `selectExercisesForDay(week, dayType, pool, history)` — rotação indexada respeitando: Regra de Ouro (≤2x/meso), SEG≠QUA≠SEX, TER≠QUI, Back≠Front Squat, manguito ≤1/sessão e ≤3/semana, panturrilha 2–3x/semana, core ao final, proibidos sem 1–12.
- `generateProgram(userId)` — orquestra: cria `training_programs` + 4 macros + 6 mesos + 48 weeks + ~240 training_days + session_exercises + running_protocols.
- `validateProgram(program)` — checklist seção 10; rejeita e regera se falhar.

Server fn exposta: `generateProgramForCurrentUser()` (auth-protected).

### Fase D — Onboarding atualizado
- Reescreve `src/routes/onboarding.tsx` com as 9 etapas exatas (Nome → Telefone → Idade → Sexo → Peso → Altura → Experiência → Objetivo → Dias).
- Ao concluir: `completeOnboarding(...)` → `generateProgramForCurrentUser()` → redirect para `/`.
- Validação Zod por etapa.

### Fase E — Migração das telas para leitura dinâmica
Cada tela troca `program-data.json` por queries no programa gerado:
- `src/routes/index.tsx` (home gamificada): lê `active_week`/`active_day` do `training_programs`.
- `src/routes/hoje.tsx`: lê `training_days` + `session_exercises` + `running_protocols` do dia ativo.
- `src/routes/semanas.tsx`: lista `weeks` agrupadas por meso/macro.
- `src/routes/treino.tsx`, `/corrida`, `/progressao`, `/historico`: consomem o programa gerado.
- Deleta `src/lib/mock-data.ts` e `src/lib/program-data.json` (ou move para `_legacy/`).
- Remove `WeekDistributionModal`.

## Detalhes técnicos

### Enums (Postgres)
```sql
create type experience_level as enum ('beginner','intermediate','advanced');
create type goal as enum ('fat_loss','hypertrophy','endurance','hybrid');
create type session_type as enum ('full_body','run_upper','run','rest');
create type week_type as enum ('A','B');
create type exercise_category as enum (
  'biceps','triceps','chest','lats','back','trap','shoulder',
  'rotator_cuff','posterior_chain','anterior_chain','calf','core','plyometric'
);
```

### Tabela `training_programs` (single active per user)
- Unique constraint: `(user_id) where archived_at is null` para garantir 1 ativo.
- Coluna `active_week int` + `active_day int` cacheia o progresso atual (atualizada por trigger ao completar treino).

### Engine de geração
- Determinístico com seed `user_id + created_at` para reprodutibilidade.
- Roda inteiro em server function (não edge function) — sob nosso runtime TanStack.
- ~500–800 linhas de TS. Vou organizar em módulos: `pools.ts`, `rules.ts`, `progression.ts`, `validators.ts`, `generator.ts`.

### Migration de dados existentes
Como estamos em dev e o schema muda muito, recomendo `TRUNCATE` de `profiles` e tabelas dependentes — usuários precisarão refazer onboarding. Confirma?

## Estrutura final de arquivos (novos)
```text
src/lib/
  engine/
    pools.ts            // pool queries + filtros
    rules.ts            // validadores universais
    progression.ts      // prescrições por meso
    generator.ts        // generateProgram()
    validators.ts       // checklist seção 10
  program-engine.functions.ts   // server fns expostas
  program.queries.ts            // queries para telas
supabase/migrations/
  <ts>_motor_v1_schema.sql      // Fase A
  <ts>_motor_v1_exercise_pool_seed.sql  // Fase B
```

## O que NÃO faço nesta migração
- XP/streak/achievements (já implementados, ficam)
- Amigos/ranking/desafios (arquitetura já existe via `friendships`, sem UI)
- PRs (preparar coluna em `session_exercises.pr_at` mas sem UI)

## Próximos passos

Preciso da sua confirmação em 3 pontos antes de tocar no schema:

1. **OK para drop+recreate de `profiles` e tabelas dependentes?** (Você perde os usuários atuais — em dev é só refazer onboarding.)
2. **As 2 planilhas anexas são a fonte canônica do exercise_pool?** Ou existe uma 3ª lista mestre?
3. **Tudo bem remover `weekplans` + `WeekDistributionModal` agora?** O engine gera os dias atribuídos.

Respondendo essas 3, começo pela Fase A na próxima mensagem.
