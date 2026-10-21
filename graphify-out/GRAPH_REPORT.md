# Graph Report - fofolab  (2026-10-20)

## Corpus Check
- 28 files · ~24,726 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 264 nodes · 492 edges · 21 communities (10 shown, 4 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `42344350`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- compilerOptions
- 01-database-schema.sql
- package.json
- lib/database.ts
- App.tsx
- tauri.conf.json
- Database
- 🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)
- PomodoroWidget.tsx
- default.json
- rules/graphify.md
- workflows/graphify.md
- app

## God Nodes (most connected - your core abstractions)
1. `App()` - 30 edges
2. `getDb()` - 28 edges
3. `queryOne()` - 19 edges
4. `persistDatabase()` - 18 edges
5. `compilerOptions` - 16 edges
6. `topics` - 10 edges
7. `queryAll()` - 10 edges
8. `StudyPlan` - 9 edges
9. `initDatabase()` - 8 edges
10. `updateTopic()` - 8 edges

## Surprising Connections (you probably didn't know these)
- `TopicHeatItem` --references--> `Topic`  [EXTRACTED]
  src/lib/cycleEngine.ts → src/types/database.ts
- `SubjectCycleAllocation` --references--> `Subject`  [EXTRACTED]
  src/lib/cycleEngine.ts → src/types/database.ts
- `App()` --calls--> `calculateDynamicStudyCycle()`  [EXTRACTED]
  src/App.tsx → src/lib/cycleEngine.ts
- `App()` --calls--> `applyRecommendedCycleAllocations()`  [EXTRACTED]
  src/App.tsx → src/lib/database.ts
- `App()` --calls--> `createStudyPlan()`  [EXTRACTED]
  src/App.tsx → src/lib/database.ts

## Import Cycles
- None detected.

## Communities (21 total, 4 thin omitted)

### Community 0 - "devDependencies"
Cohesion: 0.11
Nodes (19): autoprefixer, devDependencies, autoprefixer, postcss, tailwindcss, @tauri-apps/cli, @types/react, @types/react-dom (+11 more)

### Community 1 - "compilerOptions"
Cohesion: 0.09
Nodes (21): DOM, DOM.Iterable, ES2022, src, compilerOptions, allowImportingTsExtensions, isolatedModules, jsx (+13 more)

### Community 2 - "01-database-schema.sql"
Cohesion: 0.36
Nodes (12): admin_board_blueprints, ai_dissections, career_tracks, notebooks, pdf_sources, question_attempts, questions, study_plans (+4 more)

### Community 3 - "package.json"
Cohesion: 0.09
Nodes (22): clsx, lucide-react, dependencies, clsx, lucide-react, react, react-dom, sql.js (+14 more)

### Community 4 - "lib/database.ts"
Cohesion: 0.08
Nodes (49): CurriculumManagerModal(), CurriculumManagerModalProps, CycleDashboard(), CycleDashboardProps, SEED_ADMIN_BLUEPRINTS, SEED_AI_DISSECTIONS, SEED_CAREER_TRACKS, SEED_NOTEBOOKS (+41 more)

### Community 5 - "App.tsx"
Cohesion: 0.18
Nodes (37): App(), AppMode, WorkbenchTab, calculateDynamicStudyCycle(), applyRecommendedCycleAllocations(), createStudyPlan(), createSubject(), createTopic() (+29 more)

### Community 6 - "tauri.conf.json"
Cohesion: 0.08
Nodes (24): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, debugApplicationIdSuffix, app, security (+16 more)

### Community 11 - "Database"
Cohesion: 0.18
Nodes (5): Database, QueryExecResult, sql.js, SqlJsConfig, SqlJsStatic

### Community 12 - "🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)"
Cohesion: 0.06
Nodes (27): [BACKLOG] Fatia 5 — Leitor de PDF Local Virtualizado (Proteção Autoral) & Cadernos Markdown, [BACKLOG] Fatia 6 — Grafo de Micro-tópicos & Pacotes `.fofopack` (Google Drive), 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo), [DONE] Fatia 1 — Fundação, Arquitetura & Esqueleto da Bancada, [DONE] Fatia 2 — Inicialização do Tauri v2 + Banco SQLite Real, [DONE] Fatia 3 — Motor Matemático do Ciclo (Score Elasticsearch + Pizza + Mapa de Calor) & Pomodoro, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), [NEXT_10_MIN] Fatia 4 — Questões + Destrinchador IA (Roteador Gemini ➔ DeepSeek + Grounding) (+19 more)

### Community 15 - "default.json"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

## Knowledge Gaps
- **102 isolated node(s):** `admin_board_blueprints`, `name`, `private`, `version`, `description` (+97 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 119 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `admin_board_blueprints`, `name`, `private` to the rest of the system?**
  _102 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `package.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08695652173913043 - nodes in this community are weakly interconnected._
- **Should `lib/database.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08417508417508418 - nodes in this community are weakly interconnected._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.08 - nodes in this community are weakly interconnected._