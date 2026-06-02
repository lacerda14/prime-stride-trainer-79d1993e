## Visão geral

Transformar o PM Hybrid Performance System em uma plataforma gamificada (estilo Duolingo + Strava + Whoop), preservando toda a arquitetura mobile-first e a periodização atual carregada de `program-data.json`. A entrega será em **5 fases incrementais**, cada uma funcional por si só — assim podemos validar antes de seguir.

Recomendo aprovar fase a fase. Esta é a Fase 1 + estrutura de banco. As fases 2–5 vêm depois.

---

## Fase 1 — Fundação (esta entrega)

### A. Schema de banco (Lovable Cloud)

Migration única criando tudo que sustenta o produto novo. Tabelas:

- **`profiles`** (estender existente): `phone`, `age`, `gender`, `weight_kg`, `height_cm`, `experience_level`, `main_goal`, `available_days` (int[]), `onboarding_completed_at`, `username`, `friend_code`, `xp_total`, `level`, `streak_current`, `streak_longest`, `streak_last_date`, `avatar_url`
- **`weight_history`** — id, user_id, weight_kg, recorded_at
- **`workout_sessions`** — id, user_id, week_number, day_key (A/B/C/D/E), scheduled_date, completed_at, duration_min, notes
- **`run_sessions`** — id, user_id, week_number, scheduled_date, completed_at, distance_km, duration_min, pace
- **`week_plans`** — id, user_id, week_number, days_distribution (jsonb: {monday: "A", tuesday: null, …}), created_at
- **`xp_events`** — id, user_id, event_type, xp_amount, source_id, created_at
- **`achievements`** — catálogo estático (code, title, description, icon, xp_reward, criteria_json)
- **`user_achievements`** — user_id, achievement_code, unlocked_at
- **`friendships`** — id, requester_id, addressee_id, status (pending/accepted/blocked), created_at, accepted_at
- **Preparação futura** (criar vazias, sem UI): `challenges`, `groups`, `group_members`

RLS estrita por `auth.uid()` em tudo. GRANTs para `authenticated` + `service_role`. Trigger `handle_new_user` já existente será atualizada para gerar `username` e `friend_code` únicos.

Seed de `achievements` na própria migration: Primeiro treino, 7/30/100 dias de streak, 100 treinos, primeiros 100km, semana completa, primeiro PR, etc.

### B. Onboarding (10 passos)

Nova rota `/onboarding` (pública para usuário logado mas sem `onboarding_completed_at`). Guard global redireciona para lá após login até completar.

- Layout mobile-first, 1 pergunta por tela, barra de progresso no topo, botão "Continuar" thumb-friendly fixo no rodapé.
- Passos: nome → telefone → idade → sexo → peso → altura → experiência → objetivo → dias disponíveis → resumo/finalizar.
- Salva em `profiles` via server function `completeOnboarding`.
- Cria primeiro registro em `weight_history`.

### C. Home gamificada

Reescrever `src/routes/index.tsx`:

- **Card hero**: Nível + XP (com barra para o próximo nível), 🔥 streak atual.
- **Progresso triplo**: barras de Semana / Mesociclo / Macrociclo (XX% concluída).
- **Próximo treino** (mantém o que já existe, refinado).
- **Conquistas recentes** (3 últimos badges).
- Calculado a partir de `workout_sessions` + `xp_events` + `profiles`.

Fórmula de nível: `level = floor(sqrt(xp_total / 100)) + 1` (curva suave estilo Duolingo).

### D. Sistema de XP + Streak (server-side)

Server function `recordWorkoutComplete(sessionId)`:
1. marca `workout_sessions.completed_at`
2. insere `xp_events` (+50)
3. atualiza streak (`+1` se ontem treinou, `=1` se gap, mantém se hoje)
4. checa achievements desbloqueados
5. retorna `{ xpGained, newLevel?, newAchievements[], streakUpdated }`

Equivalente para corrida (+30 XP), PR (+100), semana completa (+250).

---

## Fases seguintes (resumo — aprovação separada)

- **Fase 2 — Planejador semanal flexível**: modal ao abrir nova semana, distribuição A/B/C/D/E pelos dias escolhidos, reagenda `workout_sessions`.
- **Fase 3 — Perfil editável + histórico de peso**: rota `/perfil` com gráfico de evolução, upload de foto via Storage.
- **Fase 4 — Amigos**: busca por username/friend_code, QR code, aceitar/recusar convites.
- **Fase 5 — Ranking social**: leaderboard semanal entre amigos por XP/aderência/streak/corridas.

---

## O que NÃO muda

- `program-data.json` continua sendo a fonte da periodização (semanas 1–48, exercícios, descansos).
- Mobile-first absoluto (container `max-w-[480px]`, bottom nav, cards verticais).
- Paleta PM Hybrid (champagne gold sobre preto profundo).
- Login Google + email/senha já existentes.

## Detalhes técnicos

- Server functions em `src/lib/*.functions.ts` com `requireSupabaseAuth`.
- Achievements/streak calculados server-side para evitar trapaça.
- `username` autogerado (`atleta_xxxx`) editável depois; `friend_code` 6 chars alfanuméricos únicos.
- Guard de onboarding em `__root.tsx` via `onAuthStateChange` + consulta a `profiles.onboarding_completed_at`.

Posso começar pela **Fase 1** assim que aprovado? A migration vem primeiro (precisa do seu OK), depois implemento onboarding + home gamificada + XP no mesmo turno.