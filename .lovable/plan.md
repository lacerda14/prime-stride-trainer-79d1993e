# PM HYBRID — Onboarding Inteligente v2

Este é um plano grande. Vou implementar em **3 entregas sequenciais** para manter qualidade e te permitir validar etapa por etapa.

---

## Entrega 1 — Banco de dados (migração)

Expandir `profiles` com todos os novos campos e criar tabelas auxiliares.

**Novos campos em `profiles`:**
- `first_name`, `last_name`, `birth_date` (date), `sex` (já existe)
- `waist_cm`, `hip_cm`, `chest_cm`, `arm_cm`, `thigh_cm` (numeric, opcionais)
- `primary_goal` (text — substitui semanticamente `goal`, mas mantemos `goal` para compat com engine atual; primary_goal é mapeado para goal)
- `secondary_goals` (text[])
- `training_history` (já existe), `training_location` (já existe), `available_minutes` (já existe), `available_days` (já existe)
- `sports` (já existe), `sports_frequency` (jsonb — `{ corrida: 2, futebol: 1 }`)
- `running_mode` (text: desabilitado | opcional | integrado | principal)
- `running_level` (text), `running_continuous_minutes` (text bucket), `running_goals` (text[]), `running_preferred_days` (text[])
- `cardio_preference` (text)
- `available_days_list` (text[] — dias da semana), `preferred_time` (text)
- `medical_conditions` (text[]), `medications` (text), `surgeries` (jsonb), `medical_restrictions` (text)
- `current_pain_level` (int 0-10), `pain_regions` (text[]), `past_injuries` (text[]), `uncomfortable_movements` (text[])
- `equipment` (text[])
- `preferences` (já existe — favoritos), `training_style` (text), `motivations` (já existe)
- `perf_max_pushups`, `perf_max_squats`, `perf_max_plank_seconds`, `perf_max_run_minutes` (int, opcionais)
- `perf_lifts_done` (text[])

**Nova tabela `progress_photos`:**
- `id`, `user_id`, `photo_type` (frente/lado/costas), `storage_path`, `uploaded_at`
- RLS: usuário só vê/insere/deleta as suas
- Storage bucket `progress-photos` (privado)

**Mapeamento `primary_goal → goal` (engine atual):**
- emagrecimento → fat_loss
- hipertrofia, ganho_forca → hypertrophy
- correr_5k, correr_10k → run_5k
- condicionamento → conditioning
- saude_geral → general_health
- performance_hibrida → hybrid
- outro → general_health

---

## Entrega 2 — Fluxo de onboarding (13 seções)

Reescrever `src/routes/onboarding.tsx` como um **wizard premium mobile-first**:

**Estrutura:**
- Container `max-w-[480px]`, barra de progresso fixa no topo (13 passos)
- Animações suaves de transição entre seções (framer-motion já no projeto? verificar; senão CSS transitions)
- Cards grandes, botões thumb-friendly, ícones lucide-react para perguntas visuais
- Cada seção é um componente local: `SectionProfile`, `SectionPrimaryGoal`, ..., `SectionPhotos`
- Estado central via `useState` com o objeto completo; persistência só no submit final (e parcial em localStorage como rascunho)
- Validação leve por seção; obrigatórios marcados, opcionais com botão "Pular"
- Botões "Voltar" / "Continuar"; último passo "Finalizar e gerar meu programa"

**Seções implementadas exatamente como especificado** (1–13). Idade calculada da data de nascimento. Upload de fotos em Storage no passo 13.

**No submit:**
1. UPDATE em `profiles` com todos os campos
2. Marca `onboarding_completed = true`
3. Chama `generateProgramForCurrentUser()` (engine atual respeita goal/available_days)
4. Redireciona para `/hoje` com toast de sucesso

---

## Entrega 3 — Perfil editável + recálculo

**Reescrever `/perfil`** (ou criar `/perfil/editar`) em formato de seções/accordions com os mesmos blocos do onboarding.

- Cada bloco pode ser editado isoladamente (botão "Editar" → modal/sheet com os campos)
- Quando o usuário edita campos que impactam o plano (`primary_goal`, `secondary_goals`, `running_mode`, `available_days`, `available_minutes`, `equipment`, `training_location`, `experience_level`, `pain_regions`, `past_injuries`, `uncomfortable_movements`), exibir banner:
  > "Alterar estas informações poderá gerar uma nova periodização."
  
  Com botão **"Recalcular meu programa"** que chama `generateProgramForCurrentUser()`.

---

## Observações técnicas

- **Engine PM**: não vou alterar `pm-engine.server.ts` agora. As novas dimensões (running_mode, equipment, injuries, sports_frequency) ficam salvas no perfil e prontas para a próxima evolução do engine. O engine atual continua consumindo `goal` + `available_days` + `experience_level`.
- **Português BR**: todos os textos, opções e mensagens 100% em pt-BR.
- **Paleta PM Hybrid v2** mantida (preto/grafite/titânio, sem dourado/laranja).
- Não vou tocar em `client.ts`, `types.ts`, `auth-middleware.ts`, `client.server.ts`.

---

## Próximo passo

Se aprovado, começo pela **Entrega 1 (migração)** — ela precisa do teu OK no diff SQL antes de rodar. Depois sigo direto com Entrega 2 e 3.

Posso seguir?
