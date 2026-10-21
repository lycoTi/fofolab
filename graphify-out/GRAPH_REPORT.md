# Graph Report - fofolab  (2026-10-21)

## Corpus Check
- 83 files · ~70,592 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 644 nodes · 1348 edges · 49 communities (43 shown, 6 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51c0830c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_01-database-schema.sql|01-database-schema.sql]]
- [[_COMMUNITY_package.json|package.json]]
- [[_COMMUNITY_typesdatabase.ts|types/database.ts]]
- [[_COMMUNITY_libdatabase.ts|lib/database.ts]]
- [[_COMMUNITY_tauri.conf.json|tauri.conf.json]]
- [[_COMMUNITY_tailwindcss|tailwindcss]]
- [[_COMMUNITY_Database|Database]]
- [[_COMMUNITY_🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGUBACEN)|🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)]]
- [[_COMMUNITY_PomodoroWidget.tsx|PomodoroWidget.tsx]]
- [[_COMMUNITY_QuestionWorkbench.tsx|QuestionWorkbench.tsx]]
- [[_COMMUNITY_default.json|default.json]]
- [[_COMMUNITY_rulesgraphify|rules/graphify.md]]
- [[_COMMUNITY_workflowsgraphify|workflows/graphify.md]]
- [[_COMMUNITY_lib.rs|lib.rs]]
- [[_COMMUNITY_main.rs|main.rs]]
- [[_COMMUNITY_app|app]]
- [[_COMMUNITY_Diretrizes de UXUI Limpa & Desenvolvimento Orientado a Testes (TDD)|Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)]]
- [[_COMMUNITY_Suíte de Testes & TDD (FofoLab)|Suíte de Testes & TDD (FofoLab)]]
- [[_COMMUNITY_Design System & UXUI Limpa (FofoLab)|Design System & UX/UI Limpa (FofoLab)]]
- [[_COMMUNITY_Community 25|Community 25]]
- [[_COMMUNITY_Community 26|Community 26]]
- [[_COMMUNITY_Community 27|Community 27]]
- [[_COMMUNITY_Community 28|Community 28]]
- [[_COMMUNITY_Community 29|Community 29]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_Community 31|Community 31]]
- [[_COMMUNITY_Community 33|Community 33]]
- [[_COMMUNITY_Community 34|Community 34]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_Community 36|Community 36]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Community 38|Community 38]]
- [[_COMMUNITY_Community 39|Community 39]]
- [[_COMMUNITY_Community 40|Community 40]]
- [[_COMMUNITY_Community 41|Community 41]]
- [[_COMMUNITY_Community 42|Community 42]]
- [[_COMMUNITY_Community 43|Community 43]]
- [[_COMMUNITY_Community 44|Community 44]]
- [[_COMMUNITY_Community 47|Community 47]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 39 edges
2. `Topic` - 25 edges
3. `persistDatabase()` - 21 edges
4. `queryOne()` - 19 edges
5. `Subject` - 19 edges
6. `StudyPlan` - 18 edges
7. `compilerOptions` - 16 edges
8. `queryAll()` - 13 edges
9. `newId()` - 13 edges
10. `calculateDynamicStudyCycle()` - 11 edges

## Surprising Connections (you probably didn't know these)
- `cycleFor()` --calls--> `calculateDynamicStudyCycle()`  [EXTRACTED]
  src/__tests__/dailyPlannerAndExplainability.test.ts → src/lib/cycleEngine.ts
- `BackupPanelProps` --references--> `BackupEntry`  [EXTRACTED]
  src/components/BackupPanel.tsx → src/lib/storage.ts
- `CurriculumManagerModalProps` --references--> `BackupEntry`  [EXTRACTED]
  src/components/CurriculumManagerModal.tsx → src/lib/storage.ts
- `CurriculumManagerModalProps` --references--> `StudyPlan`  [EXTRACTED]
  src/components/CurriculumManagerModal.tsx → src/types/database.ts
- `CurriculumManagerModalProps` --references--> `Subject`  [EXTRACTED]
  src/components/CurriculumManagerModal.tsx → src/types/database.ts

## Import Cycles
- None detected.

## Communities (49 total, 6 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.08
Nodes (49): AiCopilotDockPanel(), AiCopilotDockPanelProps, describeDiagnosisHint(), DIAGNOSIS_BUTTONS, DiagnosisSubmission, QuestionWorkbench(), QuestionWorkbenchProps, resolveAnswerState() (+41 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 2 - "01-database-schema.sql"
Cohesion: 0.06
Nodes (32): BackupPanel(), BackupPanelProps, describeStorage(), LABELS, formatTime(), SaveStatusIndicator(), SaveStatusIndicatorProps, InitDatabaseOptions (+24 more)

### Community 3 - "package.json"
Cohesion: 0.05
Nodes (38): dependencies, clsx, lucide-react, react, react-dom, sql.js, @tauri-apps/api, @tauri-apps/plugin-fs (+30 more)

### Community 4 - "types/database.ts"
Cohesion: 0.09
Nodes (34): ConfirmOptions, useConfirmDialog(), ResizeHandle(), ResizeHandleProps, useResizableWidth(), SEED_ADMIN_BLUEPRINTS, SEED_AI_DISSECTIONS, SEED_CAREER_TRACKS (+26 more)

### Community 5 - "lib/database.ts"
Cohesion: 0.07
Nodes (82): applyRecommendedCycleAllocations(), closeDatabase(), countDependents(), createFreshDatabase(), createSafetyBackup(), createStudyPlan(), createSubject(), createTopic() (+74 more)

### Community 6 - "tauri.conf.json"
Cohesion: 0.10
Nodes (19): debugApplicationIdSuffix, app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl (+11 more)

### Community 9 - "tailwindcss"
Cohesion: 0.11
Nodes (28): BOARD_ALIASES, canonicalBoardName(), excerptOf(), findOptionBlockStart(), ImportIssue, isAlphabeticRun(), normalizeJsonOptions(), OptionStart (+20 more)

### Community 11 - "Database"
Cohesion: 0.33
Nodes (5): Database, ImportMetaEnv, QueryExecResult, SqlJsConfig, SqlJsStatic

### Community 12 - "🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)"
Cohesion: 0.20
Nodes (10): 1. Ferramentas Base, 2. Ferramentas de Contexto & Automação (Opcionais mas Recomendadas), 🚀 Como Rodar o Projeto (Passo a Passo), 🗂️ Estrutura de Pastas, 🐹🧪 FofoLab — Bancada Inteligente de Estudos, No PC de Casa (Primeira vez após clonar), Para empacotar ou rodar como Janela Desktop Nativa (`.exe` via Tauri v2), 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini) (+2 more)

### Community 13 - "PomodoroWidget.tsx"
Cohesion: 0.13
Nodes (20): CurriculumManagerModal(), CurriculumManagerModalProps, CurriculumSection, getSampleSubtopicsForCalibration(), AiProviderUsed, BlueprintHealthStatus, CareerSphere, CatalogStatus (+12 more)

### Community 14 - "QuestionWorkbench.tsx"
Cohesion: 0.14
Nodes (17): CycleDashboard(), MetricExplainer(), MetricExplainerProps, QuestionComplexityProfile, calculateSampleConfidencePercent(), CycleSuggestion, sampleSaturationK(), STRATEGY_LABELS (+9 more)

### Community 15 - "default.json"
Cohesion: 0.16
Nodes (14): calculateDynamicStudyCycle(), calculateMemoryDecayBoost(), composeSubjectScore(), composeTopicHeat(), startOfWeek(), STRATEGY_FACTORS, SubjectScoreBreakdown, TopicHeatBreakdown (+6 more)

### Community 16 - "rules/graphify.md"
Cohesion: 0.12
Nodes (15): 1. Design Tokens JSON (`design-tokens.json`), 2. CSS Variables File (`design-system.css`), 3. Design System Specification (`design-system.md`), 4. HTML Preview Page (`design-system-preview.html`), Design System Builder, File Organization, Input Detection, Output Structure (+7 more)

### Community 17 - "workflows/graphify.md"
Cohesion: 0.12
Nodes (15): 1.1. O que havia sido validado positivamente, 1.2. Os 5 Gargalos Identificados na Avaliação v1, Alerta de Segurança em `VITE_DEEPSEEK_API_KEY` + Limpeza de Ternários Aninhados, 🧠 Auditoria de Sócio — Comparativo v1 (Pré-Skills) vs. v2 (Pós-Skills), Da "Regra das 3 Questões" para Saturação Contínua BM25 + Regressão de Meia-Vida (Duolingo HLR), De "God Component" (`App.tsx` com 781 linhas) para Bancada Dupla (Split View) Componentizada, De Prompt Genérico para "Eliminação Contrastiva + Regra de Abstenção", 🚀 Mudança 1 (Lente: `education-learning-science` — Kapur, 2016 & Kornell, 2009) (+7 more)

### Community 19 - "lib.rs"
Cohesion: 0.18
Nodes (8): getUserVersion(), Migration, MIGRATIONS, SchemaPreparationResult, SchemaTooNewError, SEED_DISSECTION_IDS, setUserVersion(), tableExists()

### Community 20 - "main.rs"
Cohesion: 0.24
Nodes (10): CycleDashboardProps, DailyFocusViewProps, CycleCalculationResult, OnboardingProfile, OnboardingWizardModal(), OnboardingWizardModalProps, STRATEGY_FOR_MOMENT, StudyMoment (+2 more)

### Community 21 - "app"
Cohesion: 0.29
Nodes (9): BADGE_STYLES, DailyFocusView(), formatDailyBudget(), CostBenefitBadge, DailyPlan, describeReason(), pickBadge(), planDailyBlocks() (+1 more)

### Community 22 - "Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)"
Cohesion: 0.18
Nodes (10): 1. Risco de perder dados, 2. O ciclo principal não funcionava com conteúdo real, 3. Bugs que distorciam as métricas, 4. Processo, Decisões tomadas com o usuário, O que a Fatia 5.5 entregou, O que está bom (manter), Problemas encontrados (por gravidade) (+2 more)

### Community 23 - "Suíte de Testes & TDD (FofoLab)"
Cohesion: 0.20
Nodes (9): Brainstorming, First: What Do You Actually Know?, Play It Back, Red Flags, Size the Work, The Conversation, The Written Design, Visual Companion (+1 more)

### Community 24 - "Design System & UX/UI Limpa (FofoLab)"
Cohesion: 0.22
Nodes (9): 🎯 1. O Problema & A Visão Humana, 🧙‍♂️ 2. O Onboarding Wizard ("Pegar pela Mão"), 📅 3. A Visão "Meu Dia de Hoje" (Modo Essencial), 💡 4. Explicabilidade Discreta sob Demanda (`?` / `ⓘ`), 📺 5. Módulo de Vídeo / Navegador Gran & YouTube (Backlog Futuro), Como o "Meu Dia" escolhe os blocos (`src/lib/dailyPlanner.ts`), Como o Wizard age de verdade (implementado na Fatia 5.5), Estratégias de Custo-Benefício (Passo 4): (+1 more)

### Community 25 - "Community 25"
Cohesion: 0.29
Nodes (5): PomodoroSessionResult, PomodoroWidget(), PomodoroWidgetProps, SessionContext, TimerMode

### Community 26 - "Community 26"
Cohesion: 0.25
Nodes (4): 1. Roteador de IA Transparente (Zero Config + Grounding Anti-Alucinação), 2. Política de PDFs Locais (Estratégia / Gran Cursos — Direitos Autorais), 3. Estudo Reverso & Motor de Pontuação estilo Elasticsearch (`Relevance Score`), 🤖 Roteador IA, Estudo Reverso, Score estilo Elasticsearch & Anti-Alucinação

### Community 27 - "Community 27"
Cohesion: 0.25
Nodes (8): 1. Onde os estudos ficam, 2. Quando grava (`src/lib/database.ts`), 3. Versões do banco (`src/lib/migrations.ts`), 4. Cópias de segurança, 5. Importação de questões (`src/lib/questionImport.ts`), 6. Importação do conteúdo programático (`src/lib/syllabusImport.ts`), 7. Próximo passo planejado: importação por PDF (Fatia 7), 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo

### Community 28 - "Community 28"
Cohesion: 0.38
Nodes (4): AdminFactoryView(), AdminFactoryViewProps, AdminBoardBlueprint, CareerTrack

### Community 29 - "Community 29"
Cohesion: 0.29
Nodes (6): 🏠 Checklist no PC de casa (antes do merge na `main`), ✅ Definição de Pronto, 🎯 Estado real por área, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), 🔜 Próximas fatias, 📌 Status Global

### Community 30 - "Community 30"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 31 - "Community 31"
Cohesion: 0.33
Nodes (5): Antes de mexer, Comandos, FofoLab — guia para o Claude Code, Mapa rápido do código, Regras do projeto

### Community 33 - "Community 33"
Cohesion: 0.60
Nodes (5): SubjectCycleAllocation, DailyFocusBlock, SyllabusTreeDock(), SyllabusTreeDockProps, Subject

### Community 34 - "Community 34"
Cohesion: 0.40
Nodes (4): 1. Learning Analytics & The Small-Sample Trap (Mandinach & Gummer, 2016; Wiliam, 2011), 2. Spaced Repetition & Forgetting Curve (Ebbinghaus, 1885; Cepeda et al., 2006; Settles & Meeder, 2016), 3. Productive Failure & Desirable Difficulty in Reverse Study (Kapur, 2008/2016; Kornell et al., 2009), Education & Learning Science (GarethManning/education-agent-skills)

### Community 35 - "Community 35"
Cohesion: 0.40
Nodes (4): 1. Grounding & Anti-Hallucination (RAG / Context Anchoring), 2. Structured Decomposition (Chain-of-Thought + Elimination), 3. Token Economy & Caching Architecture, Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)

### Community 36 - "Community 36"
Cohesion: 0.40
Nodes (4): 1. Catálogo de Trilhas de Estudos Prontas, 2. Matriz de Complexidade e Catalogação Cross-Trilhas das Questões, 3. Verificador de Blueprint das Bancas (DOM Drift Detection), 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler

### Community 37 - "Community 37"
Cohesion: 0.50
Nodes (3): 1. Proibição de Jargão Técnico na Interface (UX/UI Foco no Estudante), 2. Qualidade & Suíte de Testes Obrigatória, Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)

### Community 38 - "Community 38"
Cohesion: 0.50
Nodes (3): 1. Defensive Security Audit (5-Phase Mindset for Desktop & Web Apps), 2. TypeScript Code Craft (Shannon Standards), Shannon — Defensive Security & TypeScript Engineering Craft

### Community 39 - "Community 39"
Cohesion: 0.50
Nodes (3): 1. Camadas de Teste, 2. Comandos de Verificação, Suíte de Testes & TDD (FofoLab)

## Knowledge Gaps
- **215 isolated node(s):** `name`, `private`, `version`, `description`, `type` (+210 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **6 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Topic` connect `types/database.ts` to `Community 33`, `lib/database.ts`, `tailwindcss`, `PomodoroWidget.tsx`, `QuestionWorkbench.tsx`, `default.json`, `main.rs`, `app`?**
  _High betweenness centrality (0.013) - this node is a cross-community bridge._
- **Why does `StudyPlan` connect `main.rs` to `Community 33`, `types/database.ts`, `lib/database.ts`, `tailwindcss`, `PomodoroWidget.tsx`, `QuestionWorkbench.tsx`, `default.json`, `app`?**
  _High betweenness centrality (0.006) - this node is a cross-community bridge._
- **Why does `Subject` connect `Community 33` to `types/database.ts`, `lib/database.ts`, `tailwindcss`, `PomodoroWidget.tsx`, `default.json`, `main.rs`, `app`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **What connects `name`, `private`, `version` to the rest of the system?**
  _215 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07597895967270601 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `01-database-schema.sql` be split into smaller, more focused modules?**
  _Cohesion score 0.06382978723404255 - nodes in this community are weakly interconnected._