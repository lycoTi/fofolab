# Graph Report - fofolab  (2026-10-22)

## Corpus Check
- 144 files · ~170,161 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1108 nodes · 2249 edges · 73 communities (69 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 1 edges (avg confidence: 0.8)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `318f0ce9`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- [[_COMMUNITY_aiRouter.ts|aiRouter.ts]]
- [[_COMMUNITY_compilerOptions|compilerOptions]]
- [[_COMMUNITY_explainabilityEngine.ts|explainabilityEngine.ts]]
- [[_COMMUNITY_dependencies|dependencies]]
- [[_COMMUNITY_Community 4|Community 4]]
- [[_COMMUNITY_Community 5|Community 5]]
- [[_COMMUNITY_tauri.conf.json|tauri.conf.json]]
- [[_COMMUNITY_Community 9|Community 9]]
- [[_COMMUNITY_Database|Database]]
- [[_COMMUNITY_🐹🧪 FofoLab — Bancada Inteligente de Estudos|🐹🧪 FofoLab — Bancada Inteligente de Estudos]]
- [[_COMMUNITY_devDependencies|devDependencies]]
- [[_COMMUNITY_Topic|Topic]]
- [[_COMMUNITY_🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela Bom dia|🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia"]]
- [[_COMMUNITY_typesdatabase.ts|types/database.ts]]
- [[_COMMUNITY_Community 17|Community 17]]
- [[_COMMUNITY_Design System Builder|Design System Builder]]
- [[_COMMUNITY_Community 20|Community 20]]
- [[_COMMUNITY_Community 21|Community 21]]
- [[_COMMUNITY_editalParser.ts|editalParser.ts]]
- [[_COMMUNITY_Community 23|Community 23]]
- [[_COMMUNITY_schema-v1.sql|schema-v1.sql]]
- [[_COMMUNITY_permissions|permissions]]
- [[_COMMUNITY_🛠️ Modo Administrador (A Fábrica) Trilhas, Complexidade de Questões e Crawler|🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler]]
- [[_COMMUNITY_Revisão do estado do projeto — 21102026|Revisão do estado do projeto — 21/10/2026]]
- [[_COMMUNITY_Brainstorming|Brainstorming]]
- [[_COMMUNITY_🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)|🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)]]
- [[_COMMUNITY_Community 30|Community 30]]
- [[_COMMUNITY_FofoLab — guia para o Claude Code|FofoLab — guia para o Claude Code]]
- [[_COMMUNITY_bancada.spec.ts|bancada.spec.ts]]
- [[_COMMUNITY_studyBlockMachine.ts|studyBlockMachine.ts]]
- [[_COMMUNITY_💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo|💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo]]
- [[_COMMUNITY_Community 35|Community 35]]
- [[_COMMUNITY_PdfReaderStage.tsx|PdfReaderStage.tsx]]
- [[_COMMUNITY_Community 37|Community 37]]
- [[_COMMUNITY_Education & Learning Science (GarethManningeducation-agent-skills)|Education & Learning Science (GarethManning/education-agent-skills)]]
- [[_COMMUNITY_Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)|Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)]]
- [[_COMMUNITY_README|README.md]]
- [[_COMMUNITY_Diretrizes de UXUI Limpa & Desenvolvimento Orientado a Testes (TDD)|Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)]]
- [[_COMMUNITY_Shannon — Defensive Security & TypeScript Engineering Craft|Shannon — Defensive Security & TypeScript Engineering Craft]]
- [[_COMMUNITY_Design System & UXUI Limpa (FofoLab)|Design System & UX/UI Limpa (FofoLab)]]
- [[_COMMUNITY_Community 46|Community 46]]
- [[_COMMUNITY_Community 47|Community 47]]
- [[_COMMUNITY_Community 49|Community 49]]
- [[_COMMUNITY_Community 50|Community 50]]
- [[_COMMUNITY_Community 51|Community 51]]
- [[_COMMUNITY_Community 52|Community 52]]
- [[_COMMUNITY_Community 53|Community 53]]
- [[_COMMUNITY_Community 55|Community 55]]
- [[_COMMUNITY_Community 56|Community 56]]
- [[_COMMUNITY_Community 57|Community 57]]
- [[_COMMUNITY_Community 58|Community 58]]
- [[_COMMUNITY_Community 59|Community 59]]
- [[_COMMUNITY_Community 60|Community 60]]
- [[_COMMUNITY_Community 62|Community 62]]
- [[_COMMUNITY_Community 63|Community 63]]
- [[_COMMUNITY_Community 64|Community 64]]
- [[_COMMUNITY_Community 65|Community 65]]
- [[_COMMUNITY_Community 66|Community 66]]
- [[_COMMUNITY_Community 67|Community 67]]
- [[_COMMUNITY_Community 68|Community 68]]
- [[_COMMUNITY_Community 69|Community 69]]
- [[_COMMUNITY_Community 70|Community 70]]
- [[_COMMUNITY_Community 71|Community 71]]
- [[_COMMUNITY_Community 72|Community 72]]

## God Nodes (most connected - your core abstractions)
1. `getDb()` - 46 edges
2. `Topic` - 38 edges
3. `persistDatabase()` - 25 edges
4. `formatDuration()` - 24 edges
5. `Subject` - 24 edges
6. `queryOne()` - 22 edges
7. `StudyPlan` - 18 edges
8. `App()` - 17 edges
9. `compilerOptions` - 16 edges
10. `queryAll()` - 15 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `useResizableWidth()`  [EXTRACTED]
  src/App.tsx → src/components/ResizeHandle.tsx
- `App()` --calls--> `describeRecalibrationHint()`  [EXTRACTED]
  src/App.tsx → src/lib/recalibrationHint.ts
- `App()` --calls--> `formatDuration()`  [EXTRACTED]
  src/App.tsx → src/lib/timeFormat.ts
- `App()` --calls--> `useNotebookDraft()`  [EXTRACTED]
  src/App.tsx → src/features/notebook-dock/useNotebookDraft.ts
- `App()` --calls--> `useDailyRoutine()`  [EXTRACTED]
  src/App.tsx → src/features/routine/useDailyRoutine.ts

## Import Cycles
- None detected.

## Communities (73 total, 4 thin omitted)

### Community 0 - "aiRouter.ts"
Cohesion: 0.05
Nodes (66): MetricExplainer(), MetricExplainerProps, ResizeHandle(), ResizeHandleProps, useResizableWidth(), CATEGORY_TITLES, CycleGroup, formatPoints() (+58 more)

### Community 1 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowImportingTsExtensions, isolatedModules, jsx, lib, module, moduleDetection, moduleResolution (+9 more)

### Community 2 - "explainabilityEngine.ts"
Cohesion: 0.19
Nodes (19): AiReply, AiResponder, AiStatus, callAiProviders(), callDeepSeek(), callGateway(), callGemini(), callGroq() (+11 more)

### Community 3 - "dependencies"
Cohesion: 0.07
Nodes (47): createEditalDraft(), draftToPlanInput(), draftWeights(), EditalDraft, roleNeedsChoice(), EditalImportModal(), ImportState, EditalPreview() (+39 more)

### Community 4 - "Community 4"
Cohesion: 0.19
Nodes (13): QuestionImportModal(), QuestionImportModalProps, BlueprintHealthStatus, CareerSphere, CatalogStatus, ImportQuestionItem, StudyPlan, StudySessionType (+5 more)

### Community 5 - "Community 5"
Cohesion: 0.19
Nodes (10): clearLegacyLocalStorageDatabase(), createDefaultStorage(), createIndexedDbStorage(), createTauriFileStorage(), getLocalStorageSafe(), isTauriRuntime(), makeBackupId(), parseBackupId() (+2 more)

### Community 6 - "tauri.conf.json"
Cohesion: 0.10
Nodes (19): debugApplicationIdSuffix, app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl (+11 more)

### Community 9 - "Community 9"
Cohesion: 0.06
Nodes (95): AdminFactoryView(), AdminFactoryViewProps, applyRecommendedCycleAllocations(), clearDailyPlan(), closeDatabase(), countDependents(), createFreshDatabase(), createPlanFromEdital() (+87 more)

### Community 11 - "Database"
Cohesion: 0.33
Nodes (5): Database, ImportMetaEnv, QueryExecResult, SqlJsConfig, SqlJsStatic

### Community 12 - "🐹🧪 FofoLab — Bancada Inteligente de Estudos"
Cohesion: 0.20
Nodes (10): 1. Ferramentas Base, 2. Ferramentas de Contexto & Automação (Opcionais mas Recomendadas), 🚀 Como Rodar o Projeto (Passo a Passo), 🗂️ Estrutura de Pastas, 🐹🧪 FofoLab — Bancada Inteligente de Estudos, No PC de Casa (Primeira vez após clonar), Para empacotar ou rodar como Janela Desktop Nativa (`.exe` via Tauri v2), 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini) (+2 more)

### Community 13 - "devDependencies"
Cohesion: 0.05
Nodes (40): dependencies, clsx, lucide-react, pdfjs-dist, react, react-dom, sql.js, @tauri-apps/api (+32 more)

### Community 14 - "Topic"
Cohesion: 0.13
Nodes (23): BOARD_ALIASES, canonicalBoardName(), excerptOf(), findOptionBlockStart(), ImportIssue, isAlphabeticRun(), normalizeJsonOptions(), OptionStart (+15 more)

### Community 15 - "🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia""
Cohesion: 0.11
Nodes (37): formatClock(), formatDuration(), PeekBanner(), PeekInfo, peekKind, usePeek(), StudyBlockCard(), targetLabel() (+29 more)

### Community 16 - "types/database.ts"
Cohesion: 0.12
Nodes (16): 10. Depois deste projeto, 1. Por que agora, 2. Objetivos, não objetivos e anti-objetivos, 3. O edital real (fonte de verdade para testes), 4. Ponto de partida do dono (para semear a autoavaliação e validar o ciclo), 5.1 Importar o edital, 5.2 Autoavaliação no Wizard, 5.3 Ciclo pela nota mínima (+8 more)

### Community 17 - "Community 17"
Cohesion: 0.22
Nodes (8): 9a — Casca da Bancada: Implementation Plan, Global Constraints, Review Focus, Task 1: Painel lateral que recolhe em trilho, Task 2: Coluna da direita com abas Copiloto | Caderno, Task 3: Cabeçalho de ponta a ponta, Task 4: Montar a casca no App, Task 5: Verificação ponta a ponta

### Community 19 - "Design System Builder"
Cohesion: 0.12
Nodes (15): 1.1. O que havia sido validado positivamente, 1.2. Os 5 Gargalos Identificados na Avaliação v1, Alerta de Segurança em `VITE_DEEPSEEK_API_KEY` + Limpeza de Ternários Aninhados, 🧠 Auditoria de Sócio — Comparativo v1 (Pré-Skills) vs. v2 (Pós-Skills), Da "Regra das 3 Questões" para Saturação Contínua BM25 + Regressão de Meia-Vida (Duolingo HLR), De "God Component" (`App.tsx` com 781 linhas) para Bancada Dupla (Split View) Componentizada, De Prompt Genérico para "Eliminação Contrastiva + Regra de Abstenção", 🚀 Mudança 1 (Lente: `education-learning-science` — Kapur, 2016 & Kornell, 2009) (+7 more)

### Community 20 - "Community 20"
Cohesion: 0.34
Nodes (10): RoutineItem, TopicGroup, CurrentBlockExtras, RoutineBlockItem(), RoutineMaterials, topicLabel(), RoutineColumnProps, label() (+2 more)

### Community 21 - "Community 21"
Cohesion: 0.14
Nodes (12): CostBenefitBadge, DailyFocusBlock, DailyPlan, describeReason(), pickBadge(), planDailyBlocks(), roundTo5(), store (+4 more)

### Community 22 - "editalParser.ts"
Cohesion: 0.18
Nodes (10): 1. Risco de perder dados, 2. O ciclo principal não funcionava com conteúdo real, 3. Bugs que distorciam as métricas, 4. Processo, Decisões tomadas com o usuário, O que a Fatia 5.5 entregou, O que está bom (manter), Problemas encontrados (por gravidade) (+2 more)

### Community 23 - "Community 23"
Cohesion: 0.60
Nodes (3): column(), currentSubject(), items()

### Community 24 - "schema-v1.sql"
Cohesion: 0.20
Nodes (9): 🎯 1. O Problema & A Visão Humana, 🧙‍♂️ 2. O Onboarding Wizard ("Pegar pela Mão"), 📅 3. A Visão "Meu Dia de Hoje" (Modo Essencial), 💡 4. Explicabilidade Discreta sob Demanda (`?` / `ⓘ`), 📺 5. Módulo de Vídeo / Navegador Gran & YouTube (Backlog Futuro), Como o "Meu Dia" escolhe os blocos (`src/lib/dailyPlanner.ts`), Como o Wizard age de verdade (implementado na Fatia 5.5), Estratégias de Custo-Benefício (Passo 4): (+1 more)

### Community 25 - "permissions"
Cohesion: 0.20
Nodes (9): 1. A ideia, nas palavras do dono, 2. Por que vale (hipótese a validar), 3. Conceitos (rascunho), 4. De onde vêm os dados, 5. Como aparece para o estudante (rascunho), 6. Não objetivos (por enquanto), 7. Perguntas abertas (roteiro do brainstorm), 8. Dependências (+1 more)

### Community 26 - "🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler"
Cohesion: 0.25
Nodes (8): 1. Onde os estudos ficam, 2. Quando grava (`src/lib/database.ts`), 3. Versões do banco (`src/lib/migrations.ts`), 4. Cópias de segurança, 5. Importação de questões (`src/lib/questionImport.ts`), 6. Importação do conteúdo programático (`src/lib/syllabusImport.ts`), 7. Importação por PDF, 💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo

### Community 27 - "Revisão do estado do projeto — 21/10/2026"
Cohesion: 0.33
Nodes (5): description, identifier, permissions, $schema, windows

### Community 28 - "Brainstorming"
Cohesion: 0.10
Nodes (23): ConfirmOptions, useConfirmDialog(), routineGroup(), App(), describeDependents(), localDateStamp(), AppHeader(), AppHeaderProps (+15 more)

### Community 29 - "🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)"
Cohesion: 0.29
Nodes (6): 🏠 Checklist do app desktop (pendente — juntado na `main` antes, por decisão do dono), ✅ Definição de Pronto, 🎯 Estado real por área, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), 🔜 Próximas fatias, 📌 Status Global

### Community 30 - "Community 30"
Cohesion: 0.18
Nodes (13): CycleCalculationResult, OnboardingProfile, OnboardingWizardModal(), OnboardingWizardModalProps, STRATEGY_FOR_MOMENT, initialSelfAssessment(), KNOWLEDGE_LEVELS, SelfAssessmentState (+5 more)

### Community 31 - "FofoLab — guia para o Claude Code"
Cohesion: 0.29
Nodes (7): Antes de mexer, Comandos, FofoLab — guia para o Claude Code, Mapa rápido do código, Outras regras, Regras do projeto (carregadas sempre — fonte única em `.agents/rules/`, também usada pelo Antigravity), Skills — leia o SKILL.md ANTES de começar o trabalho correspondente

### Community 32 - "bancada.spec.ts"
Cohesion: 0.25
Nodes (3): openCurriculum(), routineColumn(), TEST_PDF

### Community 33 - "studyBlockMachine.ts"
Cohesion: 0.40
Nodes (4): 1. Roteador de IA Transparente (Zero Config + Grounding Anti-Alucinação), 2. Política de PDFs Locais (Estratégia / Gran Cursos — Direitos Autorais), 3. Estudo Reverso & Motor de Pontuação estilo Elasticsearch (`Relevance Score`), 🤖 Roteador IA, Estudo Reverso, Score estilo Elasticsearch & Anti-Alucinação

### Community 34 - "💾 Spec 06 — Persistência, Cópias de Segurança e Importação de Conteúdo"
Cohesion: 0.50
Nodes (3): 1. Proibição de Jargão Técnico na Interface (UX/UI Foco no Estudante), 2. Qualidade & Suíte de Testes Obrigatória, Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)

### Community 35 - "Community 35"
Cohesion: 0.22
Nodes (13): SEED_QUESTIONS, askContextualStudyCopilot(), askReverseStudyTutor(), buildDemoCopilotReply(), buildDemoTutorReply(), buildDissectionPrompt(), buildQuestionXml(), buildReverseStudyPrompt() (+5 more)

### Community 36 - "PdfReaderStage.tsx"
Cohesion: 0.12
Nodes (16): AGENT SKILLS STANDARD FIELDS (v2), Cognitive Load Analyser, Cognitive Load Analysis, Evidence Foundation, Example Output, EXISTING FIELDS, Expertise Reversal Check, Input Schema (+8 more)

### Community 37 - "Community 37"
Cohesion: 0.14
Nodes (15): BackupPanel(), BackupPanelProps, describeStorage(), LABELS, formatTime(), SaveStatusIndicator(), SaveStatusIndicatorProps, getSaveStatus() (+7 more)

### Community 38 - "Education & Learning Science (GarethManning/education-agent-skills)"
Cohesion: 0.12
Nodes (16): AGENT SKILLS STANDARD FIELDS (v2), Correct Version (Teacher Reference), Erroneous Example 1: "Sam's Solution", Erroneous Example 2: "Priya's Solution", Erroneous Example 3: "Marcus's Solution", Erroneous Example Designer, Erroneous Examples: Adding Fractions With Different Denominators, Evidence Foundation (+8 more)

### Community 39 - "Prompt Engineering Guide (DAIR.AI Synthesis for FofoLab)"
Cohesion: 0.12
Nodes (16): AGENT SKILLS STANDARD FIELDS (v2), Cognitive Offloading Risks, Desirable Difficulties Embedded, Evidence Foundation, Example Output, EXISTING FIELDS, Failure Safeguards, Input Schema (+8 more)

### Community 40 - "README.md"
Cohesion: 0.25
Nodes (4): 1. Catálogo de Trilhas de Estudos Prontas, 2. Matriz de Complexidade e Catalogação Cross-Trilhas das Questões, 3. Verificador de Blueprint das Bancas (DOM Drift Detection), 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Complexidade de Questões e Crawler

### Community 46 - "Community 46"
Cohesion: 0.12
Nodes (15): Adaptation Rules, AGENT SKILLS STANDARD FIELDS (v2), Algorithm Explanation (Teacher-Friendly), Evidence Foundation, Example Output, EXISTING FIELDS, Forgetting Risk Analysis, Implementation Tips (+7 more)

### Community 47 - "Community 47"
Cohesion: 0.12
Nodes (15): AGENT SKILLS STANDARD FIELDS (v2), Decision Rules, Design Rationale, Dialogue Architecture, Dialogue Move Library, Evidence Foundation, Example Dialogue, Example Output (+7 more)

### Community 49 - "Community 49"
Cohesion: 0.12
Nodes (15): AGENT SKILLS STANDARD FIELDS (v2), Evidence Foundation, Example Output, EXISTING FIELDS, Input Schema, Interleaved Lesson Sequence, Interleaved Unit Plan: Year 8 Mathematics — Area of 2D Shapes, Interleaving Rationale (+7 more)

### Community 50 - "Community 50"
Cohesion: 0.12
Nodes (15): Actionable Patterns, AGENT SKILLS STANDARD FIELDS (v2), Data Interpretation: Year 10 GCSE Geography Mock Exam, Evidence Foundation, Example Output, EXISTING FIELDS, Input Schema, Known Limitations (+7 more)

### Community 51 - "Community 51"
Cohesion: 0.13
Nodes (14): AGENT SKILLS STANDARD FIELDS (v2), Evidence Foundation, Example Output, EXISTING FIELDS, Input Schema, Known Limitations, Prompt, Review Activity Suggestions (+6 more)

### Community 52 - "Community 52"
Cohesion: 0.13
Nodes (14): AGENT SKILLS STANDARD FIELDS (v2), Evidence Foundation, Example Output, EXISTING FIELDS, Input Schema, Known Limitations, Prompt, Recommended Strategies (Ranked by Evidence) (+6 more)

### Community 53 - "Community 53"
Cohesion: 0.14
Nodes (13): AGENT SKILLS STANDARD FIELDS (v2), Answer Notes, Evidence Foundation, Example Output, EXISTING FIELDS, Implementation Script, Input Schema, Known Limitations (+5 more)

### Community 55 - "Community 55"
Cohesion: 0.14
Nodes (19): NotebookDockPanel(), NotebookDockPanelProps, DraftOwner, NotebookDraftStatus, notebookTitle(), useNotebookDraft(), emptyStateMessage(), PdfProgressUpdate (+11 more)

### Community 56 - "Community 56"
Cohesion: 0.22
Nodes (8): AGENT SKILLS STANDARD FIELDS (v2), Confidence Calibration Check, DOMAIN 20 FIELDS, Evidence Foundation, Example Transcript, Known Limitations, System Prompt, What This Skill Does

### Community 57 - "Community 57"
Cohesion: 0.22
Nodes (8): AGENT SKILLS STANDARD FIELDS (v2), DOMAIN 20 FIELDS, Evidence Foundation, Example Transcript, Known Limitations, Progressive Hint Ladder, System Prompt, What This Skill Does

### Community 58 - "Community 58"
Cohesion: 0.25
Nodes (7): Arquitetura (regra autoral de componentes em ~/.agents/AGENTS.md), Especificidades do FofoLab para as skills globais, Interface (impeccable, frontend-ui-engineering, ux-ui-clean), Pedagogia — decisões do FofoLab (skills originais do GarethManning em `.agents/skills/`), Prompts de IA (regra autoral de prompts em ~/.agents/AGENTS.md), Segurança (security-and-hardening), Testes (test-driven-development, tdd-suite, playwright-best-practices)

### Community 59 - "Community 59"
Cohesion: 0.20
Nodes (9): 08:59 | fatia-7-edital-ciclo, 09:19 | fatia-7-edital-ciclo, 10:16 | fatia-7-edital-ciclo, 10:40-10:57 | fatia-7-edital-ciclo, 11:34 | fatia-7-edital-ciclo, 11:58-12:08 | fatia-7-edital-ciclo, 14:30 | fatia-7-edital-ciclo, 15:18-15:36 | fatia-7-edital-ciclo (+1 more)

### Community 62 - "Community 62"
Cohesion: 0.14
Nodes (13): 1. Intenção, 2. Objetivos, não-objetivos e anti-objetivos, 3. Restrições, 4. Abordagens consideradas (escolhida: 1), 5.1 Entrega 9a — Casca (layout e movimento; sem mudança de dados), 5.2 Entrega 9b — Roteiro na coluna esquerda, 5.3.1 Respostas à revisão do construtor (decisões do Claude, salvo onde indicado), 5.3 Entrega 9c — Revisão do dia (topo do "Bom dia") (+5 more)

### Community 63 - "Community 63"
Cohesion: 0.13
Nodes (18): buildRoutine(), freezeDailyPlan(), pickExtraBlock(), routineProfileKey(), RoutineStatus, localDateKey(), useDailyRoutine(), blocks (+10 more)

### Community 64 - "Community 64"
Cohesion: 0.17
Nodes (11): 9b — Roteiro do dia na coluna esquerda: Implementation Plan, Global Constraints, Review Focus, Task 1: Roteiro congelado no banco (migração v5), Task 2: Roteiro classificado (feito / atual / próximo), Task 3: Olhada com pausa automática, Task 4: Coluna do roteiro, Task 5: Uma tela só — ligar o roteiro no App (+3 more)

### Community 65 - "Community 65"
Cohesion: 0.40
Nodes (4): 1. Preparar o PC (uma vez), 2. Onde paramos, 3. Mensagem para colar na IA (Claude Code ou Antigravity), Continuar no outro PC — 22/10/2026

### Community 66 - "Community 66"
Cohesion: 0.21
Nodes (10): detectSchemaVersion(), getUserVersion(), Migration, MIGRATIONS, prepareSchema(), SchemaPreparationResult, SchemaTooNewError, SEED_DISSECTION_IDS (+2 more)

### Community 67 - "Community 67"
Cohesion: 0.25
Nodes (11): describeDiagnosisHint(), DIAGNOSIS_BUTTONS, DiagnosisSubmission, QuestionWorkbench(), resolveAnswerState(), AnswerState, getAllowedDiagnoses(), isDiagnosisAllowed() (+3 more)

### Community 68 - "Community 68"
Cohesion: 0.24
Nodes (7): AiCopilotDockPanel(), AiCopilotDockPanelProps, QuestionWorkbenchProps, RichText(), ChatTurn, StudentContextSnapshot, Question

### Community 69 - "Community 69"
Cohesion: 0.27
Nodes (9): CurriculumManagerModal(), CurriculumManagerModalProps, CurriculumSection, getSampleSubtopicsForCalibration(), CreateStudyPlanInput, CreateSubjectInput, CreateTopicInput, ImportTopicItem (+1 more)

### Community 70 - "Community 70"
Cohesion: 0.18
Nodes (9): InitDatabaseOptions, DatabaseStorage, MemoryStorage, bytesOfV1Database(), DatabaseModule, openDatabase(), SaveStatusModule, sqlJsConfig (+1 more)

### Community 71 - "Community 71"
Cohesion: 0.36
Nodes (7): RoutineColumn(), FORBIDDEN_JARGON, item(), owasp, props(), subject(), topic()

### Community 72 - "Community 72"
Cohesion: 0.70
Nodes (4): cleanTitle(), looksLikeHeader(), parseSyllabusTopics(), splitNumberedSegments()

## Knowledge Gaps
- **440 isolated node(s):** `TEST_PDF`, `name`, `private`, `version`, `description` (+435 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Topic` connect `Community 20` to `aiRouter.ts`, `dependencies`, `Community 4`, `Community 69`, `Community 71`, `Community 9`, `Topic`, `🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia"`, `Community 21`, `Community 55`, `Community 30`, `Community 63`?**
  _High betweenness centrality (0.019) - this node is a cross-community bridge._
- **Why does `Subject` connect `Community 4` to `aiRouter.ts`, `dependencies`, `Community 69`, `Community 71`, `Community 9`, `Community 20`, `Community 21`, `Community 55`, `Community 30`, `Community 63`?**
  _High betweenness centrality (0.008) - this node is a cross-community bridge._
- **Why does `formatDuration()` connect `🧭 Spec 07 — Edital real, ciclo pela nota mínima e tela "Bom dia"` to `aiRouter.ts`, `explainabilityEngine.ts`, `Community 35`, `Community 69`, `Community 71`, `Community 9`, `Community 20`, `Community 21`, `Brainstorming`?**
  _High betweenness centrality (0.007) - this node is a cross-community bridge._
- **What connects `TEST_PDF`, `name`, `private` to the rest of the system?**
  _440 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `aiRouter.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.05143638850889193 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._
- **Should `dependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.0671602326811211 - nodes in this community are weakly interconnected._