# Graph Report - fofolab  (2026-10-20)

## Corpus Check
- 35 files · ~28,397 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 296 nodes · 569 edges · 25 communities (13 shown, 5 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4384da4b`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- compilerOptions
- 01-database-schema.sql
- package.json
- types/database.ts
- lib/database.ts
- tauri.conf.json
- Database
- 🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)
- PomodoroWidget.tsx
- QuestionWorkbench.tsx
- default.json
- rules/graphify.md
- workflows/graphify.md
- app
- Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)
- Suíte de Testes & TDD (FofoLab)
- Design System & UX/UI Limpa (FofoLab)

## God Nodes (most connected - your core abstractions)
1. `App()` - 31 edges
2. `getDb()` - 29 edges
3. `persistDatabase()` - 19 edges
4. `queryOne()` - 19 edges
5. `compilerOptions` - 16 edges
6. `topics` - 10 edges
7. `queryAll()` - 10 edges
8. `Topic` - 10 edges
9. `StudyPlan` - 9 edges
10. `scripts` - 8 edges

## Surprising Connections (you probably didn't know these)
- `App()` --calls--> `calculateDynamicStudyCycle()`  [EXTRACTED]
  src/App.tsx → src/lib/cycleEngine.ts
- `TopicHeatItem` --references--> `Topic`  [EXTRACTED]
  src/lib/cycleEngine.ts → src/types/database.ts
- `SubjectCycleAllocation` --references--> `Subject`  [EXTRACTED]
  src/lib/cycleEngine.ts → src/types/database.ts
- `App()` --calls--> `applyRecommendedCycleAllocations()`  [EXTRACTED]
  src/App.tsx → src/lib/database.ts
- `App()` --calls--> `createStudyPlan()`  [EXTRACTED]
  src/App.tsx → src/lib/database.ts

## Import Cycles
- None detected.

## Communities (25 total, 5 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.07
Nodes (27): autoprefixer, jsdom, devDependencies, autoprefixer, jsdom, postcss, tailwindcss, @tauri-apps/cli (+19 more)

### Community 1 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+13 more)

### Community 2 - "01-database-schema.sql"
Cohesion: 0.36
Nodes (12): admin_board_blueprints, ai_dissections, career_tracks, notebooks, pdf_sources, question_attempts, questions, study_plans (+4 more)

### Community 3 - "package.json"
Cohesion: 0.08
Nodes (24): clsx, lucide-react, dependencies, clsx, lucide-react, react, react-dom, sql.js (+16 more)

### Community 4 - "types/database.ts"
Cohesion: 0.09
Nodes (43): CurriculumManagerModal(), CurriculumManagerModalProps, CycleDashboard(), CycleDashboardProps, SEED_ADMIN_BLUEPRINTS, SEED_AI_DISSECTIONS, SEED_CAREER_TRACKS, SEED_NOTEBOOKS (+35 more)

### Community 5 - "lib/database.ts"
Cohesion: 0.20
Nodes (40): App(), AppMode, WorkbenchTab, applyRecommendedCycleAllocations(), base64ToUint8(), createStudyPlan(), createSubject(), createTopic() (+32 more)

### Community 6 - "tauri.conf.json"
Cohesion: 0.08
Nodes (24): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, debugApplicationIdSuffix, app, security (+16 more)

### Community 11 - "Database"
Cohesion: 0.18
Nodes (5): Database, QueryExecResult, sql.js, SqlJsConfig, SqlJsStatic

### Community 12 - "🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)"
Cohesion: 0.06
Nodes (27): [BACKLOG] Fatia 6 — Grafo de Micro-tópicos & Pacotes `.fofopack` (Google Drive), 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo), [DONE] Fatia 1 — Fundação, Arquitetura & Esqueleto da Bancada, [DONE] Fatia 2 — Inicialização do Tauri v2 + Banco SQLite Real, [DONE] Fatia 3 — Motor Matemático do Ciclo (Score + Pizza + Mapa de Calor) & Pomodoro, [DONE] Fatia 4 — Questões + Estudo Reverso IA + Suíte de Testes (Vitest) & Limpeza de UX, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), [NEXT_10_MIN] Fatia 5 — Leitor de PDF Local Virtualizado (Proteção Autoral) & Cadernos Markdown (+19 more)

### Community 14 - "QuestionWorkbench.tsx"
Cohesion: 0.32
Nodes (10): QuestionWorkbench(), QuestionWorkbenchProps, askReverseStudyTutor(), ChatTurn, getQuestionComplexityProfile(), QuestionComplexityProfile, AiDissection, AiProviderUsed (+2 more)

### Community 15 - "default.json"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

### Community 22 - "Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)"
Cohesion: 0.50
Nodes (3): 1. Proibição de Jargão Técnico na Interface (UX/UI Foco no Estudante), 2. Qualidade & Suíte de Testes Obrigatória, Diretrizes de UX/UI Limpa & Desenvolvimento Orientado a Testes (TDD)

### Community 23 - "Suíte de Testes & TDD (FofoLab)"
Cohesion: 0.50
Nodes (3): 1. Camadas de Teste, 2. Comandos de Verificação, Suíte de Testes & TDD (FofoLab)

## Knowledge Gaps
- **113 isolated node(s):** `admin_board_blueprints`, `name`, `private`, `version`, `description` (+108 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 133 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **5 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `admin_board_blueprints`, `name`, `private` to the rest of the system?**
  _113 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.07407407407407407 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._
- **Should `types/database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08897959183673469 - nodes in this community are weakly interconnected._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._