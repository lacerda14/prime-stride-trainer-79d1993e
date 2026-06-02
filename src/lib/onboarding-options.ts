// Catálogos de opções do onboarding/perfil (pt-BR)

// ============================================================
// Etapa 2 — Objetivo principal
// ============================================================
export const PRIMARY_GOAL_OPTIONS = [
  { v: "emagrecimento", label: "Emagrecimento", hint: "Perda de gordura com saúde" },
  { v: "hipertrofia", label: "Hipertrofia", hint: "Ganho de massa muscular" },
  { v: "ganho_forca", label: "Ganho de força", hint: "Mais força em levantamentos" },
  { v: "condicionamento", label: "Melhorar condicionamento", hint: "Capacidade física geral" },
  { v: "correr_5k", label: "Correr 5 km", hint: "Foco em corrida de 5 km" },
  { v: "correr_10k", label: "Correr 10 km", hint: "Foco em corrida de 10 km" },
  { v: "saude_geral", label: "Saúde geral", hint: "Bem-estar e longevidade" },
  { v: "performance_hibrida", label: "Performance híbrida", hint: "Força + corrida equilibrados" },
  { v: "outro", label: "Outro objetivo", hint: "Tenho outro objetivo específico" },
] as const;

export type PrimaryGoalValue = typeof PRIMARY_GOAL_OPTIONS[number]["v"];

// ============================================================
// Etapa 3 — Objetivos secundários
// ============================================================
export const SECONDARY_GOALS = [
  "Ganhar massa muscular",
  "Perder gordura",
  "Melhorar postura",
  "Melhorar mobilidade",
  "Melhorar cardio",
  "Melhorar desempenho esportivo",
  "Aumentar disposição",
  "Reduzir dores",
  "Melhorar indicadores de saúde",
  "Aumentar flexibilidade",
  "Prevenir lesões",
] as const;

// ============================================================
// Etapa 4 — Experiência de treino
// ============================================================
export const EXPERIENCE_OPTIONS = [
  { v: "beginner", label: "Iniciante" },
  { v: "intermediate", label: "Intermediário" },
  { v: "advanced", label: "Avançado" },
] as const;

export const TRAINING_HISTORY_OPTIONS = [
  { v: "none", label: "Nunca treinei de forma consistente" },
  { v: "lt_6m", label: "Menos de 6 meses" },
  { v: "6m_2y", label: "Entre 6 meses e 2 anos" },
  { v: "2_5y", label: "Entre 2 e 5 anos" },
  { v: "gt_5y", label: "Mais de 5 anos" },
] as const;

export const HAD_STRUCTURED_PROGRAM_OPTIONS = [
  { v: "sim", label: "Sim, já tive planilha ou personal trainer" },
  { v: "nao", label: "Não, sempre treinei por conta própria" },
  { v: "nunca", label: "Nunca treinei com regularidade" },
] as const;

// ============================================================
// Etapa 5 — Disponibilidade
// ============================================================
export const DAYS_PER_WEEK = [3, 4, 5, 6] as const;
export const MINUTES_PER_SESSION = [30, 45, 60, 75, 90] as const;
export const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"] as const;
export const PREFERRED_TIMES = ["Manhã", "Almoço", "Tarde", "Noite"] as const;

// ============================================================
// Etapa 6 — Local de treino e equipamentos
// ============================================================
export const TRAINING_LOCATION_OPTIONS = [
  "Academia Completa",
  "Academia de Condomínio / Prédio",
  "Casa",
  "Box de CrossFit",
  "Misto",
] as const;

export type TrainingLocation = typeof TRAINING_LOCATION_OPTIONS[number];

export const FULL_GYM_COMPLETENESS = [
  "Sim, possui praticamente tudo",
  "Não tenho certeza",
  "Algumas máquinas não existem",
] as const;

export const FULL_GYM_MISSING_OPTIONS = [
  "Leg Press", "Smith", "Máquina de Cabos", "Hack Squat",
  "Cadeira Extensora", "Mesa Flexora", "Banco Ajustável",
  "Barra Olímpica", "Barra Fixa", "Outro",
];

export const CONDO_GYM_EQUIPMENT = [
  "Esteira", "Bicicleta", "Elíptico", "Banco reto", "Banco ajustável",
  "Halteres", "Barra curta", "Barra longa", "Anilhas", "Smith",
  "Máquina de Cabos", "Barra fixa", "Leg Press", "Cadeira Extensora",
  "Mesa Flexora", "Kettlebells", "Faixas elásticas", "Bola suíça",
  "Step", "Remo", "Air Bike",
];

export const HOME_EQUIPMENT = [
  "Peso corporal apenas", "Faixas elásticas", "Mini band", "Halteres",
  "Kettlebells", "Barra fixa", "Banco", "Banco ajustável",
  "Barra olímpica", "Anilhas", "Rack", "Bicicleta", "Esteira",
  "Air Bike", "Remo", "Caixa para salto", "TRX", "Corda",
  "Bola suíça", "Colchonete",
];

export const BOX_COMPLETENESS = ["Sim", "Não"] as const;

export const BOX_EQUIPMENT = [
  "Remo", "Bike", "SkiErg", "Barra olímpica", "Anilhas bumper",
  "Caixa de salto", "Kettlebells", "Dumbbells", "Corda", "Argolas",
  "Barra fixa", "GHD", "Wall Ball", "Trenó", "Outro",
];

export const MIXED_PRIMARY_LOCATIONS = [
  "Academia", "Condomínio", "Casa", "Box",
] as const;

// ============================================================
// Etapa 7 — Corrida e cardio
// ============================================================
export const RUNNING_MODES = [
  {
    v: "desabilitado",
    label: "Não quero corrida",
    hint: "O plano será composto apenas por musculação.",
  },
  {
    v: "opcional",
    label: "Corrida apenas como sugestão",
    hint: "Sessões de cardio sugeridas, não obrigatórias.",
  },
  {
    v: "integrado",
    label: "Corrida integrada ao plano",
    hint: "A corrida fará parte do programa semanal.",
  },
  {
    v: "principal",
    label: "Corrida como objetivo principal",
    hint: "Corrida é prioridade; musculação é complementar.",
  },
] as const;

export const RUNNING_LEVEL = ["Nunca corri", "Iniciante", "Intermediário", "Avançado"] as const;

export const RUNNING_CONTINUOUS = [
  "Menos de 5 minutos",
  "Entre 5 e 15 minutos",
  "Entre 15 e 30 minutos",
  "Entre 30 e 60 minutos",
  "Mais de 60 minutos",
] as const;

export const RUNNING_GOALS_OPTIONS = [
  "Completar meus primeiros 5 km",
  "Melhorar meu tempo nos 5 km",
  "Completar 10 km",
  "Melhorar meu tempo nos 10 km",
  "Melhorar resistência aeróbia",
  "Melhorar condicionamento geral",
  "Emagrecer com corrida",
  "Não possuo objetivo específico com corrida",
] as const;

export const CARDIO_OPTIONS = [
  "Caminhada", "Bicicleta", "Remo", "Air Bike",
  "Elíptico", "Escada", "Não gosto de cardio",
] as const;

// ============================================================
// Etapa 8 — Esportes e atividades
// ============================================================
export const SPORTS_OPTIONS = [
  "Corrida", "CrossFit", "Futebol", "Basquete", "Jiu-Jitsu", "Muay Thai",
  "Natação", "Ciclismo", "Tênis", "Triathlon", "Vôlei", "Surfe",
  "Escalada", "Yoga", "Pilates", "Artes marciais", "Outro",
] as const;

// ============================================================
// Etapa 9 — Hábitos e estilo de vida
// ============================================================
export const PROFESSIONAL_ACTIVITY_OPTIONS = [
  { v: "sedentario", label: "Sedentário (escritório, home office)" },
  { v: "leve", label: "Leve (caminho bastante, fico de pé às vezes)" },
  { v: "moderado", label: "Moderado (trabalho ativo, uso escadas)" },
  { v: "intenso", label: "Intenso (trabalho físico, em pé o dia todo)" },
] as const;

export const SLEEP_HOURS_OPTIONS = [
  { v: "lt5", label: "Menos de 5h" },
  { v: "5_6", label: "Entre 5h e 6h" },
  { v: "6_7", label: "Entre 6h e 7h" },
  { v: "7_8", label: "Entre 7h e 8h" },
  { v: "gt8", label: "Mais de 8h" },
] as const;

export const WATER_INTAKE_OPTIONS = [
  { v: "lt1", label: "Menos de 1L" },
  { v: "1_2", label: "Entre 1L e 2L" },
  { v: "2_3", label: "Entre 2L e 3L" },
  { v: "gt3", label: "Mais de 3L" },
] as const;

export const ALCOHOL_FREQUENCY_OPTIONS = [
  { v: "nunca", label: "Nunca" },
  { v: "social", label: "Socialmente (menos de 1x/semana)" },
  { v: "semanal", label: "1 a 2x por semana" },
  { v: "frequente", label: "3x ou mais por semana" },
] as const;

// ============================================================
// Etapa 10 — Histórico de saúde
// ============================================================
export const MEDICAL_CONDITIONS = [
  "Hipertensão",
  "Diabetes tipo 1",
  "Diabetes tipo 2",
  "Doença cardíaca",
  "Asma",
  "Bronquite crônica",
  "Colesterol elevado",
  "Obesidade",
  "Hipotireoidismo",
  "Hipertireoidismo",
  "Síndrome metabólica",
  "Ansiedade / Depressão",
  "Nenhuma das anteriores",
] as const;

export const HAD_SURGERY_OPTIONS = [
  { v: "nao", label: "Não, nunca fiz cirurgia" },
  { v: "ortopedica", label: "Sim — ortopédica (joelho, ombro, coluna…)" },
  { v: "abdominal", label: "Sim — abdominal ou digestiva" },
  { v: "cardiaca", label: "Sim — cardíaca" },
  { v: "outra", label: "Sim — outro tipo" },
] as const;

export const LAST_CHECKUP_OPTIONS = [
  { v: "lt6m", label: "Há menos de 6 meses" },
  { v: "6m_1y", label: "Entre 6 meses e 1 ano" },
  { v: "1_2y", label: "Entre 1 e 2 anos" },
  { v: "gt2y", label: "Há mais de 2 anos" },
  { v: "nunca", label: "Nunca fiz checkup médico" },
] as const;

// ============================================================
// Etapa 11 — Lesões, dores e limitações
// ============================================================
export const PAIN_REGIONS = [
  "Pescoço",
  "Ombro direito",
  "Ombro esquerdo",
  "Cotovelo direito",
  "Cotovelo esquerdo",
  "Punho / mão direita",
  "Punho / mão esquerda",
  "Coluna torácica",
  "Lombar",
  "Quadril",
  "Joelho direito",
  "Joelho esquerdo",
  "Tornozelo direito",
  "Tornozelo esquerdo",
  "Pés",
] as const;

export const PAST_INJURIES = [
  "Hérnia de disco cervical",
  "Hérnia de disco lombar",
  "Lesão do manguito rotador",
  "Lesão de LCA",
  "Lesão de LCP",
  "Lesão de menisco",
  "Tendinite patelar",
  "Tendinite aquiliana",
  "Fascite plantar",
  "Fratura por estresse",
  "Epicondilite (cotovelo do tenista)",
  "Outra lesão",
] as const;

export const UNCOMFORTABLE_MOVEMENTS = [
  "Agachamento livre",
  "Leg Press",
  "Avanço / Passada",
  "Corrida",
  "Saltos / Pliometria",
  "Supino reto",
  "Desenvolvimento (ombros)",
  "Exercícios acima da cabeça",
  "Puxadas / Barra fixa",
  "Remadas",
  "Deadlift",
  "Nenhum movimento específico",
] as const;

// ============================================================
// Etapa 12 — Preferências de treino
// ============================================================
export const PREFERENCES_OPTIONS = [
  "Levantamento de peso",
  "Musculação tradicional",
  "Treino funcional",
  "HIIT",
  "Corrida",
  "CrossFit",
  "Yoga / Mobilidade",
  "Treino em circuito",
  "Trabalho de core",
  "Treino ao ar livre",
] as const;

export const TRAINING_STYLES = [
  "Curto e intenso (até 45 min)",
  "Equilibrado (45–60 min)",
  "Mais longo e completo (60–90 min)",
] as const;

export const MOTIVATIONS_OPTIONS = [
  "Estética / Aparência",
  "Saúde e longevidade",
  "Performance esportiva",
  "Competição",
  "Consistência / Disciplina",
  "Energia no dia a dia",
  "Saúde mental",
  "Reduzir dores",
] as const;

// ============================================================
// Etapa 13 — Avaliação de performance
// ============================================================
export const LIFTS_DONE = [
  "Back Squat (Agachamento com barra)",
  "Front Squat",
  "Deadlift (Levantamento terra)",
  "Romanian Deadlift",
  "Bench Press (Supino com barra)",
  "Overhead Press",
  "Pull-Up / Barra fixa",
  "Programas de corrida",
  "Snatch (Arranque)",
  "Clean & Jerk",
  "Nenhum dos anteriores",
] as const;

// ============================================================
// Equipamentos disponíveis (compilado)
// ============================================================
export const EQUIPMENT_OPTIONS = [
  "Academia completa", "Rack", "Barra olímpica", "Anilhas", "Halteres",
  "Banco ajustável", "Leg Press", "Máquina de cabos", "Barra fixa",
  "Kettlebells", "Faixas elásticas", "Esteira", "Remo", "Air Bike",
  "Bicicleta ergométrica", "Apenas peso corporal",
];

// ============================================================
// Chaves que, quando alteradas, sugerem regeneração do plano
// ============================================================
export const PLAN_IMPACTING_KEYS = [
  "primary_goal", "secondary_goals", "running_mode", "available_days",
  "available_minutes", "equipment", "training_location", "experience_level",
  "pain_regions", "past_injuries", "uncomfortable_movements",
] as const;
