# Graph Report - fofolab  (2026-10-21)

## Corpus Check
- 99 files · ~84,301 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 853 nodes · 1856 edges · 61 communities (44 shown, 8 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.85)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `8f9fe2da`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- aiRouter.ts
- compilerOptions
- explainabilityEngine.ts
- dependencies
- storage.ts
- lib/database.ts
- tauri.conf.json
- questionImport.ts
- Database
- 🐹🧪 FofoLab — Bancada Inteligente de Estudos
- devDependencies
- Topic
- 🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia"
- types/database.ts
- cycleEngine.ts
- Design System Builder
- 🔬 Parte 2: Reavaliação v2 (O que mudou no "Córtex" após instalar as 6 Skills!)
- initialSeed.ts
- editalParser.ts
- 01-database-schema.sql
- schema-v1.sql
- permissions
- 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler
- Revisão do estado do projeto — 21/10/2026
- Brainstorming
- 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)
- 🧭 Spec 05 — Onboarding Wizard, Visão "Meu Dia de Hoje" & Explicabilidade sob Demanda
- FofoLab — guia para o Claude Code
- bancada.spec.ts
- migrations.ts
- 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo
- PomodoroWidget.tsx
- PdfReaderStage.tsx
- OnboardingWizardModal.tsx
- Education & Learning Science (GarethManning/education-agent-skills)
- Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)
- README.md
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
- BackupPanel.tsx
- AdminFactoryView.tsx
- DatabaseStorage
- database.test.ts
- saveStatus.ts

## God Nodes (most connected - your core abstractions)
1. `App()` - 49 edges
2. `getDb()` - 42 edges
3. `Topic` - 28 edges
4. `persistDatabase()` - 24 edges
5. `queryOne()` - 23 edges
6. `Subject` - 22 edges
7. `StudyPlan` - 19 edges
8. `calculateDynamicStudyCycle()` - 16 edges
9. `initDatabase()` - 16 edges
10. `compilerOptions` - 16 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useResizableWidth()`  [EXTRACTED]
  src/App.tsx → src/components/ResizeHandle.tsx
- `App()` --calls--> `generateQuestionDissection()`  [EXTRACTED]
  src/App.tsx → src/lib/aiRouter.ts
- `App()` --calls--> `getAiStatus()`  [EXTRACTED]
  src/App.tsx → src/lib/aiRouter.ts
- `App()` --calls--> `calculateDynamicStudyCycle()`  [EXTRACTED]
  src/App.tsx → src/lib/cycleEngine.ts
- `App()` --calls--> `startOfWeek()`  [EXTRACTED]
  src/App.tsx → src/lib/cycleEngine.ts

## Import Cycles
- None detected.

## Communities (61 total, 8 thin omitted)

### Community 0 - "aiRouter.ts"
Cohesion: 0.08
Nodes (54): describeDiagnosisHint(), describeDisabledReason(), DIAGNOSIS_BUTTONS, DiagnosisSubmission, QuestionWorkbench(), QuestionWorkbenchProps, resolveAnswerState(), SEED_AI_DISSECTIONS (+46 more)

### Community 1 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+13 more)

### Community 2 - "explainabilityEngine.ts"
Cohesion: 0.18
Nodes (17): CycleDashboard(), getHeatBadgeClass(), getSuggestionCardClass(), MetricExplainer(), MetricExplainerProps, QuestionComplexityProfile, CycleSuggestion, sampleSaturationK() (+9 more)

### Community 3 - "dependencies"
Cohesion: 0.06
Nodes (31): clsx, lucide-react, dependencies, clsx, lucide-react, pdfjs-dist, react, react-dom (+23 more)

### Community 4 - "storage.ts"
Cohesion: 0.23
Nodes (10): createDefaultStorage(), createIndexedDbStorage(), createTauriFileStorage(), isTauriRuntime(), makeBackupId(), MAX_BACKUPS, parseBackupId(), promisifyRequest() (+2 more)

### Community 5 - "lib/database.ts"
Cohesion: 0.07
Nodes (98): RFC-4122, App(), AppMode, DeletableKind, DELETE_LABELS, describeDependents(), ExperienceMode, localDateStamp() (+90 more)

### Community 6 - "tauri.conf.json"
Cohesion: 0.08
Nodes (24): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, debugApplicationIdSuffix, app, security (+16 more)

### Community 9 - "questionImport.ts"
Cohesion: 0.10
Nodes (34): CurriculumManagerModal(), IMPORT_TEXT_EXAMPLE, QuestionImportModal(), buildDemoTutorReply(), BOARD_ALIASES, canonicalBoardName(), excerptOf(), findOptionBlockStart() (+26 more)

### Community 11 - "Database"
Cohesion: 0.15
Nodes (6): Database, ImportMetaEnv, QueryExecResult, sql.js, SqlJsConfig, SqlJsStatic

### Community 12 - "🐹🧪 FofoLab — Bancada Inteligente de Estudos"
Cohesion: 0.20
Nodes (10): 1. Ferramentas Base, 2. Ferramentas de Contexto & Automação (Opcionais mas Recomendadas), 🚀 Como Rodar o Projeto (Passo a Passo), 🗂️ Estrutura de Pastas, 🐹🧪 FofoLab — Bancada Inteligente de Estudos, No PC de Casa (Primeira vez após clonar), Para empacotar ou rodar como Janela Desktop Nativa (`.exe` via Tauri v2), 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini) (+2 more)

### Community 13 - "devDependencies"
Cohesion: 0.06
Nodes (33): autoprefixer, fake-indexeddb, jsdom, devDependencies, autoprefixer, fake-indexeddb, jsdom, @playwright/test (+25 more)

### Community 14 - "Topic"
Cohesion: 0.13
Nodes (27): CycleDashboardProps, BADGE_STYLES, DailyFocusView(), DailyFocusViewProps, formatDailyBudget(), QuestionImportModalProps, SyllabusTreeDock(), SyllabusTreeDockProps (+19 more)

### Community 15 - "🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia""
Cohesion: 0.12
Nodes (16): 10. Depois deste projeto, 1. Por que agora, 2. Objetivos, não objetivos e anti-objetivos, 3. O edital real (fonte de verdade para testes), 4. Ponto de partida do dono (para semear a autoavaliação e validar o ciclo), 5.1 Importar o edital, 5.2 Autoavaliação no Wizard, 5.3 Ciclo pela nota mínima (+8 more)

### Community 16 - "types/database.ts"
Cohesion: 0.13
Nodes (20): CurriculumManagerModalProps, CurriculumSection, getSampleSubtopicsForCalibration(), AiProviderUsed, BlueprintHealthStatus, CareerSphere, CatalogStatus, CreateStudyPlanInput (+12 more)

### Community 17 - "cycleEngine.ts"
Cohesion: 0.16
Nodes (18): calculateDynamicStudyCycle(), calculateMemoryDecayBoost(), calculateSampleConfidencePercent(), calculateStrategyMultiplier(), composeSubjectScore(), composeTopicHeat(), MIN_SCORE_FLOOR, pickDominantReason() (+10 more)

### Community 19 - "Design System Builder"
Cohesion: 0.12
Nodes (15): 1. Design Tokens JSON (`design-tokens.json`), 2. CSS Variables File (`design-system.css`), 3. Design System Specification (`design-system.md`), 4. HTML Preview Page (`design-system-preview.html`), Design System Builder, File Organization, Input Detection, Output Structure (+7 more)

### Community 20 - "🔬 Parte 2: Reavaliação v2 (O que mudou no "Córtex" após instalar as 6 Skills!)"
Cohesion: 0.12
Nodes (15): 1.1. O que havia sido validado positivamente, 1.2. Os 5 Gargalos Identificados na Avaliação v1, Alerta de Segurança em `VITE_DEEPSEEK_API_KEY` + Limpeza de Ternários Aninhados, 🧠 Auditoria de Sócio — Comparativo v1 (Pré-Skills) vs. v2 (Pós-Skills), Da "Regra das 3 Questões" para Saturação Contínua BM25 + Regressão de Meia-Vida (Duolingo HLR), De "God Component" (`App.tsx` com 781 linhas) para Bancada Dupla (Split View) Componentizada, De Prompt Genérico para "Eliminação Contrastiva + Regra de Abstenção", 🚀 Mudança 1 (Lente: `education-learning-science` — Kapur, 2016 & Kornell, 2009) (+7 more)

### Community 21 - "initialSeed.ts"
Cohesion: 0.44
Nodes (6): SEED_ADMIN_BLUEPRINTS, SEED_CAREER_TRACKS, SEED_STUDY_PLANS, SEED_SUBJECTS, SEED_TOPIC_LINKS, SEED_TOPICS

### Community 22 - "editalParser.ts"
Cohesion: 0.08
Nodes (44): createEditalDraft(), draftToPlanInput(), draftWeights(), EditalDraft, roleNeedsChoice(), EditalImportModal(), ImportState, EditalPreview() (+36 more)

### Community 23 - "01-database-schema.sql"
Cohesion: 0.34
Nodes (13): admin_board_blueprints, ai_dissections, career_tracks, exam_parts, notebooks, pdf_sources, question_attempts, questions (+5 more)

### Community 24 - "schema-v1.sql"
Cohesion: 0.36
Nodes (12): admin_board_blueprints, ai_dissections, career_tracks, notebooks, pdf_sources, question_attempts, questions, study_plans (+4 more)

### Community 25 - "permissions"
Cohesion: 0.17
Nodes (11): core:default, fs:allow-appdata-meta-recursive, fs:allow-appdata-read-recursive, fs:allow-appdata-write-recursive, fs:default, main, description, identifier (+3 more)

### Community 26 - "🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler"
Cohesion: 0.40
Nodes (4): 1. Catálogo de Trilhas de Estudos Prontas, 2. Matriz de Complexidade e Catalogação Cross-Trilhas das Questões, 3. Verificador de Blueprint das Bancas (DOM Drift Detection), 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler

### Community 27 - "Revisão do estado do projeto — 21/10/2026"
Cohesion: 0.18
Nodes (10): 1. Risco de perder dados, 2. O ciclo principal não funcionava com conteúdo real, 3. Bugs que distorciam as métricas, 4. Processo, Decisões tomadas com o usuário, O que a Fatia 5.5 entregou, O que está bom (manter), Problemas encontrados (por gravidade) (+2 more)

### Community 28 - "Brainstorming"
Cohesion: 0.20
Nodes (9): Brainstorming, First: What Do You Actually Know?, Play It Back, Red Flags, Size the Work, The Conversation, The Written Design, Visual Companion (+1 more)

### Community 29 - "🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)"
Cohesion: 0.29
Nodes (6): 🏠 Checklist do app desktop (pendente — juntado na `main` antes, por decisão do dono), ✅ Definição de Pronto, 🎯 Estado real por área, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), 🔜 Próximas fatias, 📌 Status Global

### Community 30 - "🧭 Spec 05 — Onboarding Wizard, Visão "Meu Dia de Hoje" & Explicabilidade sob Demanda"
Cohesion: 0.20
Nodes (9): 🎯 1. O Problema & A Visão Humana, 🧙‍♂️ 2. O Onboarding Wizard ("Pegar pela Mão"), 📅 3. A Visão "Meu Dia de Hoje" (Modo Essencial), 💡 4. Explicabilidade Discreta sob Demanda (`?` / `ⓘ`), 📺 5. Módulo de Vídeo / Navegador Gran & YouTube (Backlog Futuro), Como o "Meu Dia" escolhe os blocos (`src/lib/dailyPlanner.ts`), Como o Wizard age de verdade (implementado na Fatia 5.5), Estratégias de Custo-Benefício (Passo 4): (+1 more)

### Community 31 - "FofoLab — guia para o Claude Code"
Cohesion: 0.29
Nodes (7): Antes de mexer, Comandos, FofoLab — guia para o Claude Code, Mapa rápido do código, Outras regras, Regras do projeto (carregadas sempre — fonte única em `.agents/rules/`, também usada pelo Antigravity), Skills do projeto (`.agents/skills/`) — leia o SKILL.md ANTES de começar o trabalho correspondente

### Community 33 - "migrations.ts"
Cohesion: 0.22
Nodes (10): detectSchemaVersion(), getUserVersion(), Migration, MIGRATIONS, prepareSchema(), SchemaPreparationResult, SchemaTooNewError, SEED_DISSECTION_IDS (+2 more)

### Community 34 - "💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo"
Cohesion: 0.25
Nodes (8): 1. Onde os estudos ficam, 2. Quando grava (`src/lib/database.ts`), 3. Versões do banco (`src/lib/migrations.ts`), 4. Cópias de segurança, 5. Importação de questões (`src/lib/questionImport.ts`), 6. Importação do conteúdo programático (`src/lib/syllabusImport.ts`), 7. Importação por PDF, 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo

### Community 35 - "PomodoroWidget.tsx"
Cohesion: 0.29
Nodes (5): PomodoroSessionResult, PomodoroWidget(), PomodoroWidgetProps, SessionContext, TimerMode

### Community 36 - "PdfReaderStage.tsx"
Cohesion: 0.10
Nodes (27): ResizeHandle(), ResizeHandleProps, useResizableWidth(), NotebookDockPanel(), NotebookDockPanelProps, DraftOwner, NOTEBOOK_AUTOSAVE_MS, NotebookDraftStatus (+19 more)

### Community 37 - "OnboardingWizardModal.tsx"
Cohesion: 0.19
Nodes (14): ONBOARDING_COMPLETED_KEY, OnboardingProfile, OnboardingWizardModal(), OnboardingWizardModalProps, profileFromPlan(), STRATEGY_FOR_MOMENT, initialSelfAssessment(), KNOWLEDGE_LEVELS (+6 more)

### Community 38 - "Education & Learning Science (GarethManning/education-agent-skills)"
Cohesion: 0.40
Nodes (4): 1. Learning Analytics & The Small-Sample Trap (Mandinach & Gummer, 2016; Wiliam, 2011), 2. Spaced Repetition & Forgetting Curve (Ebbinghaus, 1885; Cepeda et al., 2006; Settles & Meeder, 2016), 3. Productive Failure & Desirable Difficulty in Reverse Study (Kapur, 2008/2016; Kornell et al., 2009), Education & Learning Science (GarethManning/education-agent-skills)

### Community 39 - "Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)"
Cohesion: 0.40
Nodes (4): 1. Grounding & Anti-Hallucination (RAG / Context Anchoring), 2. Structured Decomposition (Chain-of-Thought + Elimination), 3. Token Economy & Caching Architecture, Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)

### Community 40 - "README.md"
Cohesion: 0.25
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

### Community 54 - "BackupPanel.tsx"
Cohesion: 0.25
Nodes (12): BackupPanel(), BackupPanelProps, describeBackupLabel(), describeStorage(), formatDate(), LABELS, formatTime(), SaveStatusIndicator() (+4 more)

### Community 55 - "AdminFactoryView.tsx"
Cohesion: 0.48
Nodes (6): AdminFactoryView(), AdminFactoryViewProps, getCatalogStatusClass(), getCatalogStatusLabel(), AdminBoardBlueprint, CareerTrack

### Community 56 - "DatabaseStorage"
Cohesion: 0.22
Nodes (3): InitDatabaseOptions, DatabaseStorage, MemoryStorage

### Community 57 - "database.test.ts"
Cohesion: 0.25
Nodes (5): LATEST_SCHEMA_VERSION, LEGACY_LOCALSTORAGE_KEY, DatabaseModule, SaveStatusModule, sqlJsConfig

### Community 58 - "saveStatus.ts"
Cohesion: 0.29
Nodes (6): INITIAL_STATUS, listeners, SaveState, SaveStatus, StorageKind, openDatabase()

## Knowledge Gaps
- **265 isolated node(s):** `admin_board_blueprints`, `TEST_PDF`, `name`, `private`, `version` (+260 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 336 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **8 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Topic` connect `Topic` to `aiRouter.ts`, `PdfReaderStage.tsx`, `OnboardingWizardModal.tsx`, `lib/database.ts`, `questionImport.ts`, `types/database.ts`, `cycleEngine.ts`, `initialSeed.ts`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `DatabaseStorage` connect `DatabaseStorage` to `storage.ts`, `lib/database.ts`?**
  _High betweenness centrality (0.009) - this node is a cross-community bridge._
- **Why does `Subject` connect `Topic` to `PdfReaderStage.tsx`, `OnboardingWizardModal.tsx`, `lib/database.ts`, `types/database.ts`, `cycleEngine.ts`, `initialSeed.ts`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **What connects `admin_board_blueprints`, `TEST_PDF`, `name` to the rest of the system?**
  _265 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `aiRouter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.07615018508725542 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0625 - nodes in this community are weakly interconnected._