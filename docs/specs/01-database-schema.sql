-- ============================================================================
-- FofoLab — Contrato Oficial do Banco de Dados Local (SQLite)
-- Versão do contrato: 4 (PRAGMA user_version). Sempre a versão MAIS RECENTE.
-- Bancos existentes são atualizados pelas migrações em src/lib/migrations.ts:
-- toda mudança aqui exige uma migração equivalente (há teste comparando os dois caminhos).
-- Arquivo: fofolab.db (Tauri: pasta de dados do app; navegador: armazenamento interno).
-- ============================================================================

PRAGMA foreign_keys = ON;

-- 1. Catálogo de Trilhas de Carreira (Federal, Tribunais, TI, Direito, Estadual, Municipal)
CREATE TABLE IF NOT EXISTS career_tracks (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,                    -- Ex: "Trilha Federal — Controle & Auditoria"
    sphere TEXT NOT NULL,                  -- 'FEDERAL', 'ESTADUAL', 'MUNICIPAL', 'TRIBUNAIS', 'TI', 'DIREITO'
    catalog_status TEXT DEFAULT 'RADAR',   -- 'CATALOGED' (Verde), 'PARTIAL' (Amarelo), 'RADAR' (Mapeado)
    dossier_markdown TEXT,                 -- Dossiê gerado na Pesquisa Profunda (Modo Admin)
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. Planos de Estudo / Editais Ativos do Usuário (Ex: CGU, BACEN)
CREATE TABLE IF NOT EXISTS study_plans (
    id TEXT PRIMARY KEY,
    track_id TEXT REFERENCES career_tracks(id) ON DELETE SET NULL,
    title TEXT NOT NULL,                   -- Ex: "CGU — Auditor Federal de Finanças e Controle"
    organ TEXT,                            -- Ex: "CGU", "BACEN"
    exam_board TEXT,                       -- Ex: "FGV", "Cebraspe"
    role_title TEXT,                       -- Cargo alvo
    exam_date DATE,                        -- Data da prova (para cálculo de dias restantes)
    weekly_hours_target REAL DEFAULT 28.0, -- Ex: 4h/dia * 7 = 28h semanais
    is_active INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- [v2] Escolhas do Wizard "Pegar pela Mão" (NULL = ainda não escolhido / estratégia neutra)
    strategy_mode TEXT,                    -- 'BASE_COMUM', 'MAIS_COBRADOS', 'ALTO_PESO_CURTO'
    study_moment TEXT,                     -- 'PRE_EDITAL', 'POS_EDITAL'
    -- [v4] Lidos do edital (docs/specs/07)
    registration_deadline DATE,            -- Último dia de inscrição
    min_total_score REAL,                  -- Nota mínima no conjunto das provas objetivas
    selected_role TEXT,                    -- Cargo/especialidade escolhido no edital
    -- [v8] Revisão do dia ao abrir o app (1 = ligada; o estudante pode desligar na calibragem)
    daily_review_enabled INTEGER NOT NULL DEFAULT 1,
    -- [v9] FofoIA: aquecimento/convite antes da aula num tópico nunca tentado (0 = "Tenho meu método")
    productive_failure_hints INTEGER NOT NULL DEFAULT 1,
    -- [v11] Plano de estudo (spec 13): minutos de cada dia, seg–dom, em JSON (0 = folga fixa; NULL = horas ÷ 7)
    weekday_minutes_json TEXT,
    -- [v11] Dias da reta final antes da prova (só revisão e questões)
    final_stretch_days INTEGER NOT NULL DEFAULT 14
);

-- [v11] Exceções de horas por data: "hoje tenho menos tempo", "hoje não vou estudar" e semana atípica (spec 13 §4.1)
CREATE TABLE IF NOT EXISTS plan_day_overrides (
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    date TEXT NOT NULL,                    -- Data local 'YYYY-MM-DD'
    minutes INTEGER NOT NULL,
    PRIMARY KEY (plan_id, date)
);

-- [v4] Provas objetivas do edital (P1, P2, P3…) com pontuação e nota mínima eliminatória
CREATE TABLE IF NOT EXISTS exam_parts (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    code TEXT NOT NULL,                    -- Ex: "P1"
    name TEXT NOT NULL,                    -- Ex: "Conhecimentos básicos"
    item_count INTEGER NOT NULL,
    points_per_item REAL DEFAULT 1,        -- Cebraspe: o erro desconta o mesmo valor
    min_score REAL,                        -- Nota líquida mínima (NULL = sem mínimo)
    sort_order INTEGER DEFAULT 0
);

-- 3. Disciplinas / Matérias do Edital
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    category TEXT DEFAULT 'ESPECIFICO',    -- 'BASICO', 'GERAL', 'ESPECIFICO'
    name TEXT NOT NULL,                    -- Ex: "Auditoria Governamental", "TI - Desenvolvimento"
    color TEXT DEFAULT '#f97316',
    -- Parâmetros de Partida a Frio (Dia 1)
    initial_knowledge_level INTEGER DEFAULT 2, -- 1 (Nunca vi) a 4 (Avançado)
    initial_affinity_level INTEGER DEFAULT 2,  -- 1 (Pavor/Sono), 2 (Neutro), 3 (Gosto)
    exam_weight REAL DEFAULT 1.0,              -- Peso da matéria na prova/edital
    -- Parâmetros Calculados Dinamicamente pelo FofoLab (Dia 2+)
    measured_mastery_score REAL DEFAULT 0.0,   -- 0 a 100%
    behavioral_friction_score REAL DEFAULT 0.0,-- Medido por pausas/pulos no Pomodoro
    cycle_allocated_minutes INTEGER DEFAULT 60, -- Minutos alocados no ciclo atual
    exam_part_id TEXT REFERENCES exam_parts(id) ON DELETE SET NULL -- [v4] Prova em que a matéria cai
);

-- 4. Tópicos e Subtópicos Verticalizados do Edital
CREATE TABLE IF NOT EXISTS topics (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
    code TEXT,                             -- Ex: "1.2.1"
    title TEXT NOT NULL,
    mastery_score REAL DEFAULT 0.0,        -- 0 a 100% calculado sem viés
    status TEXT DEFAULT 'PENDING',         -- 'PENDING', 'STUDYING', 'REVIEW', 'MASTERED'
    last_studied_at DATETIME,
    initial_knowledge_level INTEGER        -- [v4] Autoavaliação do tópico (1..4); NULL = herda da matéria
);

-- 5. Grafo de Conhecimento (Conexões entre Micro-tópicos e Pré-requisitos)
CREATE TABLE IF NOT EXISTS topic_links (
    id TEXT PRIMARY KEY,
    source_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    target_topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    relation_type TEXT DEFAULT 'PREREQUISITE', -- 'PREREQUISITE', 'RELATED', 'JURISPRUDENCE'
    notes TEXT
);

-- 6. Cadernos Inteligentes (Estilo NotebookLM vinculado ao Tópico/Disciplina)
CREATE TABLE IF NOT EXISTS notebooks (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    content_markdown TEXT DEFAULT '',
    ai_summary_markdown TEXT,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 7. Fontes de PDF & Progresso de Leitura
CREATE TABLE IF NOT EXISTS pdf_sources (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    file_path TEXT NOT NULL,
    current_page INTEGER DEFAULT 1,
    total_pages INTEGER DEFAULT 1,
    highlights_json TEXT DEFAULT '[]',     -- Coordenadas e notas ancoradas
    last_opened_at DATETIME,
    read_pages_json TEXT DEFAULT '[]'      -- Páginas que ficaram 15 s na tela (ou marcadas à mão)
);

-- 8. Banco Local de Questões de Provas Anteriores
CREATE TABLE IF NOT EXISTS questions (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
    exam_board TEXT NOT NULL,              -- Ex: "FGV", "Cebraspe"
    exam_year INTEGER NOT NULL,
    organ TEXT,                            -- Ex: "CGU", "TCU", "BACEN"
    statement TEXT NOT NULL,               -- Enunciado completo
    options_json TEXT NOT NULL,            -- JSON com alternativas A-E ou Certo/Errado
    preliminary_answer TEXT,               -- Gabarito preliminar
    final_answer TEXT NOT NULL,            -- Gabarito definitivo pós-recurso
    is_annulled INTEGER DEFAULT 0,         -- 1 se anulada pela banca pós-recurso
    annulment_reason TEXT,
    -- [v12] Cópia de um item do acervo da Cebraspe (spec 12c §5.5): entra no 1º uso que grava algo
    acervo_item_id TEXT,                   -- Id do item no acervo; NULL = questão própria (importada por texto/JSON)
    source_label TEXT,                     -- Procedência: "Cebraspe · ANATEL 2024 · item 40"
    acervo_uncertain INTEGER NOT NULL DEFAULT 0 -- 1 = classificação incerta (pesa metade no domínio)
);
-- [v12] Uma cópia por matéria: `subject_id` apaga em cascata, e o mesmo item pode estar em matérias de planos diferentes
CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_acervo_item ON questions(subject_id, acervo_item_id) WHERE acervo_item_id IS NOT NULL;

-- [v12] Ligação tópico ↔ assunto do vocabulário do acervo (spec 12c §5.3). O acervo fica num banco à parte.
CREATE TABLE IF NOT EXISTS acervo_links (
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    assunto_id TEXT NOT NULL,              -- Id do assunto no vocabulário (ex: "direito-administrativo>atos")
    origin TEXT NOT NULL,                  -- 'NAME' (pelo nome) ou 'AI' (pela IA)
    vocab_version INTEGER NOT NULL,        -- Versão do vocabulário usada na ligação
    disabled INTEGER NOT NULL DEFAULT 0,   -- 1 = "Desligar este assunto" (não volta nas importações seguintes)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (topic_id, assunto_id)
);

-- [v12] Itens do acervo tirados de um tópico ("Não é deste tópico"; desfazível)
CREATE TABLE IF NOT EXISTS acervo_exclusions (
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    acervo_item_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (topic_id, acervo_item_id)
);

-- 9. Destrinchamentos da IA Persistidos (Cache Definitivo = Economia Total de Tokens)
CREATE TABLE IF NOT EXISTS ai_dissections (
    id TEXT PRIMARY KEY,
    question_id TEXT UNIQUE NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    provider_used TEXT NOT NULL,           -- 'GEMINI_FREE', 'DEEPSEEK_FALLBACK', 'GATEWAY' ou 'EXAMPLE' (exemplo escrito à mão)
    dissection_markdown TEXT NOT NULL,     -- Explicação completa + alternativas comentadas
    prerequisites_json TEXT DEFAULT '[]',  -- Micro-tópicos pré-requisitos identificados
    chat_history_json TEXT DEFAULT '[]',   -- Dúvidas extras tiradas pelo estudante nessa questão
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Histórico de Resoluções & Diagnóstico Pós-Questão de 1 Clique (Sem Viés de IA)
CREATE TABLE IF NOT EXISTS question_attempts (
    id TEXT PRIMARY KEY,
    question_id TEXT NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
    selected_option TEXT NOT NULL,
    is_correct INTEGER NOT NULL,
    used_ai_review INTEGER DEFAULT 0,      -- Apenas informativo (NÃO reduz nota!)
    -- Diagnóstico de 1 clique do aluno:
    -- 'MASTERED' (🟢 Dominei/Só revisei)
    -- 'DOUBT' (🟡 Acertei na dúvida)
    -- 'BOARD_TRAP' (🟠 Pegadinha da banca / Desatenção -> não reduz base teórica)
    -- 'BASE_GAP' (🔴 Lacuna de base -> aumenta peso de teoria no Ciclo)
    -- [spec 11] 'LUCKY_GUESS' (acertou no chute: conta na amostra, não como domínio)
    -- [spec 11] 'MISCONCEPTION' (confundiu com outra coisa: lacuna que pesa mais no calor)
    self_diagnosis TEXT NOT NULL,
    time_spent_seconds INTEGER DEFAULT 0,
    attempted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    confidence TEXT,                       -- [v8] Confiança antes de responder: 'SURE', 'THINK', 'GUESS' (só na revisão)
    source TEXT,                           -- [v8] 'DAILY_REVIEW' quando veio da Revisão do dia
    mastery_delta REAL                     -- [v10] Delta de domínio realmente aplicado (já cortado em 0..100)
);

-- 11. Sessões de Estudo (Ciclo & Pomodoro)
CREATE TABLE IF NOT EXISTS study_sessions (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE SET NULL,
    duration_minutes INTEGER NOT NULL,
    session_type TEXT DEFAULT 'POMODORO',  -- 'PDF_READING', 'QUESTIONS', 'REVIEW', 'POMODORO'
    pauses_count INTEGER DEFAULT 0,        -- Usado para medir Fricção Comportamental
    was_skipped INTEGER DEFAULT 0,
    started_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11b. [v5] Roteiro do dia congelado (spec 09): os blocos de hoje não mudam conforme se estuda
CREATE TABLE IF NOT EXISTS daily_plans (
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    date TEXT NOT NULL,                    -- Data local 'YYYY-MM-DD'
    blocks_json TEXT NOT NULL,             -- FrozenBlock[] (matéria, tópico, duração, motivo)
    profile_key TEXT,                      -- [v6] Assinatura do perfil (horas, estratégia, autoavaliação, ciclo) quando foi congelado
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan_id, date)
);

-- 11c. [v7] Questões resolvidas fora do app (outro site, caderno de provas): só números, nunca o conteúdo
CREATE TABLE IF NOT EXISTS question_logs (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT REFERENCES topics(id) ON DELETE CASCADE,
    total INTEGER NOT NULL,
    correct INTEGER NOT NULL,
    blank INTEGER NOT NULL DEFAULT 0,      -- Em branco (Cebraspe permite deixar sem responder)
    source TEXT NOT NULL DEFAULT 'EXTERNAL',
    mastery_before REAL,                   -- Domínio antes do registro (para "Desfazer")
    logged_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 11d. [v8] Revisão do dia congelada (spec 09 §5.3): os tópicos sorteados não mudam ao longo do dia
CREATE TABLE IF NOT EXISTS daily_reviews (
    plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE,
    date TEXT NOT NULL,                    -- Data local 'YYYY-MM-DD'
    items_json TEXT NOT NULL,              -- ReviewItem[] (tópico, questão ou pergunta aberta, motivo)
    skipped INTEGER NOT NULL DEFAULT 0,    -- "Pular a revisão de hoje" (sem penalidade)
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (plan_id, date)
);

-- 11e. [v8] Autoavaliação da pergunta aberta ("O que você lembra de…?"): conta como revisão, com peso menor
CREATE TABLE IF NOT EXISTS recall_checks (
    id TEXT PRIMARY KEY,
    subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
    topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
    rating TEXT NOT NULL,                  -- 'GOOD' (lembrei bem), 'PARTIAL' (em parte), 'FORGOT' (não lembrei)
    checked_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 12. [MODO ADMIN] Blueprints de Layout das Bancas Examinadoras (DOM Drift Detection)
CREATE TABLE IF NOT EXISTS admin_board_blueprints (
    id TEXT PRIMARY KEY,
    board_name TEXT UNIQUE NOT NULL,       -- Ex: "FGV", "CEBRASPE", "FCC", "CESGRANRIO"
    target_url TEXT NOT NULL,
    expected_selectors_json TEXT NOT NULL, -- Seletores CSS/XPath esperados para provas e gabaritos
    last_dom_hash TEXT,                    -- Hash estrutural da última verificação válida
    health_status TEXT DEFAULT 'OK',       -- 'OK' (🟢), 'DRIFT_DETECTED' (🔴 Layout mudou)
    last_checked_at DATETIME
);
