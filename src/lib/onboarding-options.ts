// Shared onboarding/profile option catalogs (pt-BR)

export const PRIMARY_GOAL_OPTIONS = [
  { v: "emagrecimento", label: "Emagrecimento", hint: "Perda de gordura" },
  { v: "hipertrofia", label: "Hipertrofia", hint: "Ganho de massa muscular" },
  { v: "ganho_forca", label: "Ganho de força", hint: "Mais força em levantamentos" },
  { v: "condicionamento", label: "Melhorar condicionamento", hint: "Capacidade física geral" },
  { v: "correr_5k", label: "Correr 5 km", hint: "Foco em corrida de 5 km" },
  { v: "correr_10k", label: "Correr 10 km", hint: "Foco em corrida de 10 km" },
  { v: "saude_geral", label: "Saúde geral", hint: "Bem-estar e longevidade" },
  { v: "performance_hibrida", label: "Performance híbrida", hint: "Força + corrida" },
  { v: "outro", label: "Outro", hint: "Tenho outro objetivo" },
] as const;

export const SECONDARY_GOALS = [
  "Ganhar massa muscular", "Perder gordura", "Melhorar postura", "Melhorar mobilidade",
  "Melhorar cardio", "Melhorar desempenho esportivo", "Aumentar disposição",
  "Reduzir dores", "Melhorar indicadores de saúde",
];

export const TRAINING_HISTORY_OPTIONS = [
  { v: "none", label: "Nunca treinei" },
  { v: "lt_6m", label: "Menos de 6 meses" },
  { v: "6m_2y", label: "Entre 6 meses e 2 anos" },
  { v: "2_5y", label: "Entre 2 e 5 anos" },
  { v: "gt_5y", label: "Mais de 5 anos" },
] as const;

export const TRAINING_LOCATION_OPTIONS = [
  "Academia Completa",
  "Academia de Condomínio / Prédio",
  "Casa",
  "Box de CrossFit",
  "Misto",
] as const;

export type TrainingLocation = typeof TRAINING_LOCATION_OPTIONS[number];

export const TRAINING_LOCATION_DB_VALUE: Record<TrainingLocation, string> = {
  "Academia Completa":               "gym",
  "Academia de Condomínio / Prédio": "home_gym",
  "Casa":                            "home",
  "Box de CrossFit":                 "crossfit_box",
  "Misto":                           "home_gym",
};

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

export const DAYS_PER_WEEK = [3, 4, 5, 6] as const;
export const MINUTES_PER_SESSION = [30, 45, 60, 75, 90] as const;

export const EXPERIENCE_OPTIONS = [
  { v: "beginner", label: "Iniciante" },
  { v: "intermediate", label: "Intermediário" },
  { v: "advanced", label: "Avançado" },
] as const;

export const SPORTS_OPTIONS = [
  "Nenhum", "Corrida", "CrossFit", "Futebol", "Basquete", "Jiu-Jitsu", "Muay Thai",
  "Natação", "Ciclismo", "Tênis", "Triathlon", "Vôlei", "Outro",
];

export const RUNNING_MODES = [
  {
    v: "desabilitado", label: "Não quero corrida",
    hint: "O plano será composto apenas por musculação.",
  },
  {
    v: "opcional", label: "Quero corrida apenas como sugestão",
    hint: "Sessões de cardio sugeridas, não obrigatórias.",
  },
  {
    v: "integrado", label: "Quero corrida integrada ao plano",
    hint: "A corrida fará parte do programa semanal.",
  },
  {
    v: "principal", label: "Meu principal objetivo envolve corrida",
    hint: "Corrida prioridade, musculação complementar.",
  },
] as const;

export const RUNNING_LEVEL = ["Nunca corri", "Iniciante", "Intermediário", "Avançado"];

export const RUNNING_CONTINUOUS = [
  "Menos de 5 minutos", "Entre 5 e 15 minutos", "Entre 15 e 30 minutos",
  "Entre 30 e 60 minutos", "Mais de 60 minutos",
];

export const RUNNING_GOALS_OPTIONS = [
  "Completar meus primeiros 5 km", "Melhorar meu tempo nos 5 km",
  "Completar 10 km", "Melhorar meu tempo nos 10 km",
  "Melhorar resistência", "Melhorar condicionamento",
  "Emagrecer", "Não possuo objetivo com corrida",
];

export const WEEK_DAYS = ["Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado", "Domingo"];

export const CARDIO_OPTIONS = [
  "Caminhada", "Bicicleta", "Remo", "Air Bike",
  "Elíptico", "Escada", "Não gosto de cardio",
];

export const PREFERRED_TIMES = ["Manhã", "Almoço", "Tarde", "Noite"];

export const MEDICAL_CONDITIONS = [
  "Hipertensão", "Diabetes", "Doença cardíaca", "Asma",
  "Bronquite", "Colesterol elevado", "Obesidade", "Nenhuma",
];

export const PAIN_REGIONS = [
  "Pescoço", "Ombros", "Cotovelos", "Punhos", "Coluna torácica",
  "Lombar", "Quadril", "Joelhos", "Tornozelos", "Pés",
];

export const PAST_INJURIES = [
  "Hérnia de disco", "Lesão do manguito rotador", "Lesão de LCA",
  "Lesão de menisco", "Tendinite", "Fascite plantar", "Outra",
];

export const UNCOMFORTABLE_MOVEMENTS = [
  "Agachamento", "Corrida", "Saltos", "Exercícios acima da cabeça",
  "Puxadas", "Empurradas", "Nenhum",
];

export const EQUIPMENT_OPTIONS = [
  "Academia completa", "Rack", "Barra olímpica", "Anilhas", "Halteres",
  "Banco ajustável", "Leg Press", "Máquina de cabos", "Barra fixa",
  "Kettlebells", "Faixas elásticas", "Esteira", "Remo", "Air Bike",
  "Bicicleta ergométrica", "Apenas peso corporal",
];

export const PREFERENCES_OPTIONS = [
  "Força", "Hipertrofia", "Cardio", "Mobilidade", "Corrida", "Treino misto",
];

export const TRAINING_STYLES = ["Curto e intenso", "Equilibrado", "Mais longo"];

export const MOTIVATIONS_OPTIONS = [
  "Estética", "Saúde", "Performance", "Competição", "Consistência",
];

export const LIFTS_DONE = [
  "Back Squat", "Front Squat", "Deadlift", "Bench Press",
  "Pull Up", "Programas de corrida", "Nenhum",
];

export const HAD_STRUCTURED_PROGRAM_OPTIONS = [
  "Não", "Sim, por pouco tempo", "Sim, por vários meses", "Sim, por anos",
] as const;

export const HAD_SURGERY_OPTIONS = ["Não", "Sim"] as const;

export const LAST_CHECKUP_OPTIONS = [
  "Nos últimos 6 meses", "Entre 6 meses e 1 ano",
  "Entre 1 e 2 anos", "Há mais de 2 anos", "Nunca fiz",
] as const;

export const PROFESSIONAL_ACTIVITY_OPTIONS = [
  "Sedentária (escritório, home office)",
  "Moderadamente ativa (em pé, caminhando)",
  "Muito ativa (trabalho físico intenso)",
] as const;

export const SLEEP_HOURS_OPTIONS = [
  "Menos de 5h", "5–6h", "6–7h", "7–8h", "Mais de 8h",
] as const;

export const WATER_INTAKE_OPTIONS = [
  "Ruim (menos de 1L)", "Regular (1–1,5L)", "Boa (1,5–2L)", "Excelente (mais de 2L)",
] as const;

export const ALCOHOL_FREQUENCY_OPTIONS = [
  "Não consumo", "Raramente", "Semanalmente", "Frequentemente",
] as const;

// keys that, when changed, suggest the plan should be regenerated.
export const PLAN_IMPACTING_KEYS = [
  "primary_goal", "secondary_goals", "running_mode", "available_days",
  "available_minutes", "equipment", "training_location", "experience_level",
  "pain_regions", "past_injuries", "uncomfortable_movements",
] as const;
