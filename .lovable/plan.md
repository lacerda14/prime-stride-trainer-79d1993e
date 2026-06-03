# Plano — Treino mais flexível e inteligente

Três frentes para a tela de treino (`/treino`) e a tela de resumo (`/treino/concluido/:id`).

## 1. Volume total que soma ao vivo

Hoje o "Volume total" só aparece no resumo, calculado a partir dos `workout_set_logs` já persistidos. Durante o treino não há acumulador, e séries não confirmadas (sem `actual_load_kg` × `actual_reps`) ficam de fora.

**O que muda**
- Em `treino.tsx`, manter um acumulador derivado do estado local de séries marcadas como concluídas: `Σ (actual_load_kg ?? planned_load_kg) × (actual_reps ?? planned_reps_min)`.
- Exibir no header da sessão: "Volume: 2.340 kg" ao lado de tempo/calorias, atualizando a cada set confirmado.
- Persistir cada set imediatamente no `workout_set_logs` (upsert por `session_id, exercise_index, set_number`) usando `saveWorkoutLogs` parcial — assim o resumo final bate com o que foi visto durante a sessão.
- Resumo (`treino.concluido`) passa a somar usando o mesmo helper compartilhado (`src/lib/workout-volume.ts`) para garantir consistência.

## 2. Sugestão de troca de exercício por biomecânica

Quando o aparelho estiver ocupado, o usuário toca em "Trocar exercício" e recebe 3–5 alternativas equivalentes.

**Critérios de similaridade (server function `suggestExerciseSwaps`)**
Filtra `exercise_pool` por:
1. Mesmo `category` (chest, back, legs, …)
2. Mesmo `movement_pattern` (push-horizontal, hinge, squat, pull-vertical, …)
3. Compatível com nível do usuário (`allowed_beginner/intermediate/advanced`)
4. Disponível no `equipment` do perfil (com fallback para peso livre)
5. Ranking: equipamento ≠ atual primeiro (resolve o problema do aparelho tomado), depois maior overlap de `primary_muscles`, depois `shoulder_safe` se exercício atual for shoulder_safe.

**UI**
- Botão "Trocar" no card do exercício atual → bottom sheet com lista de alternativas (nome + músculos + equipamento + razão da sugestão).
- Ao escolher, substitui o exercício na sessão (apenas em memória + `workout_sessions.session_data.swaps[]` para histórico). Mantém sets/reps/RPE planejados.

## 3. Reordenar exercícios durante o treino

- Modo "Reordenar" no menu do treino (ícone de listras): renderiza a lista de exercícios pendentes com drag handle (usar `@dnd-kit/sortable`, já compatível mobile com pointer/touch sensors).
- Exercícios já concluídos ficam fixos no topo (não arrastáveis).
- Nova ordem é salva em `workout_sessions.session_data.exercise_order` para retomar sessão.

## Detalhes técnicos

**Arquivos novos**
- `src/lib/workout-volume.ts` — helper puro `computeVolume(sets)`.
- `src/lib/exercise-swap.functions.ts` — server fn `suggestExerciseSwaps({ exercise_id, user_id })`.
- `src/components/exercise-swap-sheet.tsx` — bottom sheet de alternativas.
- `src/components/exercise-reorder-sheet.tsx` — modo reordenar com dnd-kit.

**Arquivos alterados**
- `src/routes/treino.tsx` — header com volume ao vivo, botão trocar por exercício, botão reordenar, autosave de set.
- `src/routes/treino.concluido.$sessionId.tsx` — usar helper compartilhado.
- `src/lib/workout-session.functions.ts` — aceitar/retornar `session_data.exercise_order` e `session_data.swaps`.

**Dependência**
- `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities` (mobile-friendly, touch-first).

**Sem migration** — usamos `session_data jsonb` já existente em `workout_sessions`.

**PDF de biomecânica anexado** — usado apenas como referência conceitual para validar que `movement_pattern` + `primary_muscles` cobrem os critérios de troca; sem leitura/parse em runtime.

Posso seguir?
