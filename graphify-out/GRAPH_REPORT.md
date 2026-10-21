# Graph Report - fofolab  (2026-10-21)

## Corpus Check
- 84 files · ~70,675 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 733 nodes · 1581 edges · 55 communities (39 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `290e0e9d`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- types/database.ts
- compilerOptions
- CurriculumManagerModal.tsx
- scripts
- storage.ts
- lib/database.ts
- tauri.conf.json
- questionImport.ts
- Database
- 🐹🧪 FofoLab — Bancada Inteligente de Estudos
- devDependencies
- explainabilityEngine.ts
- questionWorkbenchAndRouter.test.tsx
- Topic
- cycleEngine.ts
- Design System Builder
- 🔬 Parte 2: Reavaliação v2 (O que mudou no "Córtex" após instalar as 6 Skills!)
- migrations.ts
- NotebookDockPanel.tsx
- 01-database-schema.sql
- schema-v1.sql
- permissions
- README.md
- Revisão do estado do projeto — 21/10/2026
- Brainstorming
- 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)
- 🧭 Spec 05 — Onboarding Wizard, Visão "Meu Dia de Hoje" & Explicabilidade sob Demanda
- FofoLab — guia para o Claude Code
- OnboardingWizardModal.tsx
- 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo
- PomodoroWidget.tsx
- notebookDraftAndLayout.test.tsx
- AdminFactoryView.tsx
- Education & Learning Science (GarethManning/education-agent-skills)
- Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)
- 🤖 Roteador IA, Estudo Reverso, Score estilo Elasticsearch & Anti-Alucinação
- Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)
- Shannon — Defensive Security & TypeScript Engineering Craft
- Suíte de Testes & TDD (FofoLab)
- Microfrontend & Dockable Workbench Architecture (FofoLab)
- Design System & UX/UI Limpa (FofoLab)
- definition-of-done.md
- rules/graphify.md
- grill-me/SKILL.md
- workflows/graphify.md
- app

## God Nodes (most connected - your core abstractions)
1. `App()` - 47 edges
2. `getDb()` - 39 edges
3. `Topic` - 25 edges
4. `queryOne()` - 22 edges
5. `persistDatabase()` - 22 edges
6. `Subject` - 19 edges
7. `StudyPlan` - 18 edges
8. `initDatabase()` - 16 edges
9. `compilerOptions` - 16 edges
10. `calculateDynamicStudyCycle()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `cycleFor()` --calls--> `calculateDynamicStudyCycle()`  [EXTRACTED]
  src/__tests__/dailyPlannerAndExplainability.test.ts → src/lib/cycleEngine.ts
- `OnboardingWizardModalProps` --references--> `StudyPlan`  [EXTRACTED]
  src/features/onboarding-wizard/OnboardingWizardModal.tsx → src/types/database.ts
- `App()` --calls--> `useResizableWidth()`  [EXTRACTED]
  src/App.tsx → src/components/ResizeHandle.tsx
- `App()` --calls--> `generateQuestionDissection()`  [EXTRACTED]
  src/App.tsx → src/lib/aiRouter.ts
- `App()` --calls--> `getAiStatus()`  [EXTRACTED]
  src/App.tsx → src/lib/aiRouter.ts

## Import Cycles
- None detected.

## Communities (55 total, 7 thin omitted)

### Community 0 - "types/database.ts"
Cohesion: 0.07
Nodes (56): describeDiagnosisHint(), describeDisabledReason(), DIAGNOSIS_BUTTONS, DiagnosisSubmission, QuestionWorkbench(), QuestionWorkbenchProps, resolveAnswerState(), AiCopilotDockPanel() (+48 more)

### Community 1 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+13 more)

### Community 2 - "CurriculumManagerModal.tsx"
Cohesion: 0.09
Nodes (32): BackupPanel(), BackupPanelProps, describeBackupLabel(), describeStorage(), formatDate(), LABELS, CurriculumManagerModal(), CurriculumManagerModalProps (+24 more)

### Community 3 - "scripts"
Cohesion: 0.07
Nodes (29): clsx, lucide-react, dependencies, clsx, lucide-react, react, react-dom, sql.js (+21 more)

### Community 4 - "storage.ts"
Cohesion: 0.09
Nodes (20): InitDatabaseOptions, clearLegacyLocalStorageDatabase(), createDefaultStorage(), createIndexedDbStorage(), createTauriFileStorage(), DatabaseStorage, getLocalStorageSafe(), isTauriRuntime() (+12 more)

### Community 5 - "lib/database.ts"
Cohesion: 0.07
Nodes (90): RFC-4122, App(), AppMode, DeletableKind, DELETE_LABELS, describeDependents(), ExperienceMode, localDateStamp() (+82 more)

### Community 6 - "tauri.conf.json"
Cohesion: 0.08
Nodes (24): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, debugApplicationIdSuffix, app, security (+16 more)

### Community 9 - "questionImport.ts"
Cohesion: 0.12
Nodes (30): IMPORT_TEXT_EXAMPLE, QuestionImportModal(), QuestionImportModalProps, buildDemoTutorReply(), BOARD_ALIASES, canonicalBoardName(), excerptOf(), findOptionBlockStart() (+22 more)

### Community 11 - "Database"
Cohesion: 0.15
Nodes (6): Database, ImportMetaEnv, QueryExecResult, sql.js, SqlJsConfig, SqlJsStatic

### Community 12 - "🐹🧪 FofoLab — Bancada Inteligente de Estudos"
Cohesion: 0.20
Nodes (10): 1. Ferramentas Base, 2. Ferramentas de Contexto & Automação (Opcionais mas Recomendadas), 🚀 Como Rodar o Projeto (Passo a Passo), 🗂️ Estrutura de Pastas, 🐹🧪 FofoLab — Bancada Inteligente de Estudos, No PC de Casa (Primeira vez após clonar), Para empacotar ou rodar como Janela Desktop Nativa (`.exe` via Tauri v2), 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini) (+2 more)

### Community 13 - "devDependencies"
Cohesion: 0.06
Nodes (31): autoprefixer, fake-indexeddb, jsdom, devDependencies, autoprefixer, fake-indexeddb, jsdom, @playwright/test (+23 more)

### Community 14 - "explainabilityEngine.ts"
Cohesion: 0.16
Nodes (20): CycleDashboard(), getHeatBadgeClass(), getSuggestionCardClass(), MetricExplainer(), MetricExplainerProps, BADGE_STYLES, DailyFocusView(), formatDailyBudget() (+12 more)

### Community 15 - "questionWorkbenchAndRouter.test.tsx"
Cohesion: 0.16
Nodes (17): SEED_ADMIN_BLUEPRINTS, SEED_AI_DISSECTIONS, SEED_CAREER_TRACKS, SEED_NOTEBOOKS, SEED_PDF_SOURCES, SEED_QUESTIONS, SEED_STUDY_PLANS, SEED_SUBJECTS (+9 more)

### Community 16 - "Topic"
Cohesion: 0.20
Nodes (17): CycleDashboardProps, DailyFocusViewProps, SyllabusTreeDock(), SyllabusTreeDockProps, CycleCalculationResult, SubjectCycleAllocation, CostBenefitBadge, DailyFocusBlock (+9 more)

### Community 17 - "cycleEngine.ts"
Cohesion: 0.21
Nodes (15): calculateDynamicStudyCycle(), calculateMemoryDecayBoost(), calculateSampleConfidencePercent(), calculateStrategyMultiplier(), composeSubjectScore(), composeTopicHeat(), getSampleSubtopicsForCalibration(), pickDominantReason() (+7 more)

### Community 19 - "Design System Builder"
Cohesion: 0.12
Nodes (15): 1. Design Tokens JSON (`design-tokens.json`), 2. CSS Variables File (`design-system.css`), 3. Design System Specification (`design-system.md`), 4. HTML Preview Page (`design-system-preview.html`), Design System Builder, File Organization, Input Detection, Output Structure (+7 more)

### Community 20 - "🔬 Parte 2: Reavaliação v2 (O que mudou no "Córtex" após instalar as 6 Skills!)"
Cohesion: 0.12
Nodes (15): 1.1. O que havia sido validado positivamente, 1.2. Os 5 Gargalos Identificados na Avaliação v1, Alerta de Segurança em `VITE_DEEPSEEK_API_KEY` + Limpeza de Ternários Aninhados, 🧠 Auditoria de Sócio — Comparativo v1 (Pré-Skills) vs. v2 (Pós-Skills), Da "Regra das 3 Questões" para Saturação Contínua BM25 + Regressão de Meia-Vida (Duolingo HLR), De "God Component" (`App.tsx` com 781 linhas) para Bancada Dupla (Split View) Componentizada, De Prompt Genérico para "Eliminação Contrastiva + Regra de Abstenção", 🚀 Mudança 1 (Lente: `education-learning-science` — Kapur, 2016 & Kornell, 2009) (+7 more)

### Community 21 - "migrations.ts"
Cohesion: 0.21
Nodes (11): detectSchemaVersion(), getUserVersion(), LATEST_SCHEMA_VERSION, Migration, MIGRATIONS, prepareSchema(), SchemaPreparationResult, SchemaTooNewError (+3 more)

### Community 22 - "NotebookDockPanel.tsx"
Cohesion: 0.24
Nodes (11): NotebookDockPanelProps, PdfFilePicker(), PdfFrame(), PdfPageControls(), PdfProgressUpdate, PdfReaderStage(), DraftOwner, NotebookDraftStatus (+3 more)

### Community 23 - "01-database-schema.sql"
Cohesion: 0.36
Nodes (12): admin_board_blueprints, ai_dissections, career_tracks, notebooks, pdf_sources, question_attempts, questions, study_plans (+4 more)

### Community 24 - "schema-v1.sql"
Cohesion: 0.36
Nodes (12): admin_board_blueprints, ai_dissections, career_tracks, notebooks, pdf_sources, question_attempts, questions, study_plans (+4 more)

### Community 25 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, fs:allow-appdata-meta-recursive, fs:allow-appdata-read-recursive, fs:allow-appdata-write-recursive, fs:default, main, description, identifier (+3 more)

### Community 26 - "README.md"
Cohesion: 0.25
Nodes (4): 1. Catálogo de Trilhas de Estudos Prontas, 2. Matriz de Complexidade e Catalogação Cross-Trilhas das Questões, 3. Verificador de Blueprint das Bancas (DOM Drift Detection), 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler

### Community 27 - "Revisão do estado do projeto — 21/10/2026"
Cohesion: 0.18
Nodes (10): 1. Risco de perder dados, 2. O ciclo principal não funcionava com conteúdo real, 3. Bugs que distorciam as métricas, 4. Processo, Decisões tomadas com o usuário, O que a Fatia 5.5 entregou, O que está bom (manter), Problemas encontrados (por gravidade) (+2 more)

### Community 28 - "Brainstorming"
Cohesion: 0.20
Nodes (9): Brainstorming, First: What Do You Actually Know?, Play It Back, Red Flags, Size the Work, The Conversation, The Written Design, Visual Companion (+1 more)

### Community 29 - "🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)"
Cohesion: 0.29
Nodes (6): 🏠 Checklist no PC de casa (antes do merge na `main`), ✅ Definição de Pronto, 🎯 Estado real por área, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), 🔜 Próximas fatias, 📌 Status Global

### Community 30 - "🧭 Spec 05 — Onboarding Wizard, Visão "Meu Dia de Hoje" & Explicabilidade sob Demanda"
Cohesion: 0.22
Nodes (9): 🎯 1. O Problema & A Visão Humana, 🧙‍♂️ 2. O Onboarding Wizard ("Pegar pela Mão"), 📅 3. A Visão "Meu Dia de Hoje" (Modo Essencial), 💡 4. Explicabilidade Discreta sob Demanda (`?` / `ⓘ`), 📺 5. Módulo de Vídeo / Navegador Gran & YouTube (Backlog Futuro), Como o "Meu Dia" escolhe os blocos (`src/lib/dailyPlanner.ts`), Como o Wizard age de verdade (implementado na Fatia 5.5), Estratégias de Custo-Benefício (Passo 4): (+1 more)

### Community 31 - "FofoLab — guia para o Claude Code"
Cohesion: 0.33
Nodes (5): Antes de mexer, Comandos, FofoLab — guia para o Claude Code, Mapa rápido do código, Regras do projeto

### Community 33 - "OnboardingWizardModal.tsx"
Cohesion: 0.31
Nodes (8): ONBOARDING_COMPLETED_KEY, OnboardingProfile, OnboardingWizardModal(), OnboardingWizardModalProps, profileFromPlan(), STRATEGY_FOR_MOMENT, StudyMoment, StudyStrategy

### Community 34 - "💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo"
Cohesion: 0.25
Nodes (8): 1. Onde os estudos ficam, 2. Quando grava (`src/lib/database.ts`), 3. Versões do banco (`src/lib/migrations.ts`), 4. Cópias de segurança, 5. Importação de questões (`src/lib/questionImport.ts`), 6. Importação do conteúdo programático (`src/lib/syllabusImport.ts`), 7. Próximo passo planejado: importação por PDF (Fatia 7), 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo

### Community 35 - "PomodoroWidget.tsx"
Cohesion: 0.29
Nodes (5): PomodoroSessionResult, PomodoroWidget(), PomodoroWidgetProps, SessionContext, TimerMode

### Community 36 - "notebookDraftAndLayout.test.tsx"
Cohesion: 0.32
Nodes (6): ResizeHandle(), ResizeHandleProps, useResizableWidth(), NOTEBOOK_AUTOSAVE_MS, saveMock, [topicA, topicB]

### Community 37 - "AdminFactoryView.tsx"
Cohesion: 0.48
Nodes (6): AdminFactoryView(), AdminFactoryViewProps, getCatalogStatusClass(), getCatalogStatusLabel(), AdminBoardBlueprint, CareerTrack

### Community 38 - "Education & Learning Science (GarethManning/education-agent-skills)"
Cohesion: 0.40
Nodes (4): 1. Learning Analytics & The Small-Sample Trap (Mandinach & Gummer, 2016; Wiliam, 2011), 2. Spaced Repetition & Forgetting Curve (Ebbinghaus, 1885; Cepeda et al., 2006; Settles & Meeder, 2016), 3. Productive Failure & Desirable Difficulty in Reverse Study (Kapur, 2008/2016; Kornell et al., 2009), Education & Learning Science (GarethManning/education-agent-skills)

### Community 39 - "Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)"
Cohesion: 0.40
Nodes (4): 1. Grounding & Anti-Hallucination (RAG / Context Anchoring), 2. Structured Decomposition (Chain-of-Thought + Elimination), 3. Token Economy & Caching Architecture, Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)

### Community 40 - "🤖 Roteador IA, Estudo Reverso, Score estilo Elasticsearch & Anti-Alucinação"
Cohesion: 0.40
Nodes (4): 1. Roteador de IA Transparente (Zero Config + Grounding Anti-Alucinação), 2. Política de PDFs Locais (Estratégia / Gran Cursos — Direitos Autorais), 3. Estudo Reverso & Motor de Pontuação estilo Elasticsearch (`Relevance Score`), 🤖 Roteador IA, Estudo Reverso, Score estilo Elasticsearch & Anti-Alucinação

### Community 41 - "Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)"
Cohesion: 0.50
Nodes (3): 1. Proibição de Jargão Técnico na Interface (UX/UI Foco no Estudante), 2. Qualidade & Suíte de Testes Obrigatória, Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)

### Community 42 - "Shannon — Defensive Security & TypeScript Engineering Craft"
Cohesion: 0.50
Nodes (3): 1. Defensive Security Audit (5-Phase Mindset for Desktop & Web Apps), 2. TypeScript Code Craft (Shannon Standards), Shannon — Defensive Security & TypeScript Engineering Craft

### Community 43 - "Suíte de Testes & TDD (FofoLab)"
Cohesion: 0.50
Nodes (3): 1. Camadas de Teste, 2. Comandos de Verificação, Suíte de Testes & TDD (FofoLab)

## Knowledge Gaps
- **232 isolated node(s):** `admin_board_blueprints`, `name`, `private`, `version`, `description` (+227 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 293 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Topic` connect `Topic` to `types/database.ts`, `CurriculumManagerModal.tsx`, `lib/database.ts`, `questionImport.ts`, `explainabilityEngine.ts`, `questionWorkbenchAndRouter.test.tsx`, `cycleEngine.ts`, `NotebookDockPanel.tsx`?**
  _High betweenness centrality (0.010) - this node is a cross-community bridge._
- **Why does `DatabaseStorage` connect `storage.ts` to `lib/database.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `StudyPlan` connect `Topic` to `types/database.ts`, `OnboardingWizardModal.tsx`, `CurriculumManagerModal.tsx`, `lib/database.ts`, `questionImport.ts`, `explainabilityEngine.ts`, `questionWorkbenchAndRouter.test.tsx`, `cycleEngine.ts`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `admin_board_blueprints`, `name`, `private` to the rest of the system?**
  _232 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `types/database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0679563492063492 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `CurriculumManagerModal.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.08906882591093117 - nodes in this community are weakly interconnected._