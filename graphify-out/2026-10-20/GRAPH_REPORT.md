# Graph Report - fofolab  (2026-10-20)

## Corpus Check
- 20 files · ~12,415 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 158 nodes · 158 edges · 22 communities (12 shown, 3 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `51d474d3`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- devDependencies
- compilerOptions
- 01-database-schema.sql
- package.json
- dependencies
- App.tsx
- tauri.conf.json
- icon
- README.md
- 🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)
- 🐹🧪 FofoLab — Bancada Inteligente de Estudos
- default.json
- rules/graphify.md
- workflows/graphify.md
- app

## God Nodes (most connected - your core abstractions)
1. `compilerOptions` - 16 edges
2. `topics` - 10 edges
3. `subjects` - 7 edges
4. `🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)` - 7 edges
5. `scripts` - 6 edges
6. `icon` - 6 edges
7. `questions` - 5 edges
8. `build` - 5 edges
9. `bundle` - 5 edges
10. `🐹🧪 FofoLab — Bancada Inteligente de Estudos` - 5 edges

## Surprising Connections (you probably didn't know these)
- None detected - all connections are within the same source files.

## Import Cycles
- None detected.

## Communities (22 total, 3 thin omitted)

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
Cohesion: 0.17
Nodes (11): description, name, private, scripts, build, dev, preview, tauri:build (+3 more)

### Community 4 - "dependencies"
Cohesion: 0.22
Nodes (9): clsx, lucide-react, dependencies, clsx, lucide-react, react, react-dom, react (+1 more)

### Community 5 - "App.tsx"
Cohesion: 0.40
Nodes (4): App(), AppMode, INITIAL_SUBJECTS, WorkbenchTab

### Community 6 - "tauri.conf.json"
Cohesion: 0.14
Nodes (13): app, security, windows, build, beforeBuildCommand, beforeDevCommand, devUrl, frontendDist (+5 more)

### Community 11 - "icon"
Cohesion: 0.18
Nodes (11): icons/128x128@2x.png, icons/128x128.png, icons/32x32.png, icons/icon.icns, icons/icon.ico, debugApplicationIdSuffix, bundle, active (+3 more)

### Community 12 - "README.md"
Cohesion: 0.20
Nodes (6): 1. Roteador de IA Transparente (Zero Config para o Usuário Final), 2. Cálculo de Domínio e Afinidade Sem Penalizar o Uso da IA, 🤖 Roteador Inteligente de IA & Métricas Sem Viés, 1. Catálogo de Trilhas de Estudos Prontas, 2. Verificador de Blueprint das Bancas (DOM Drift Detection), 🛠️ Modo Administrador ("A Fábrica"): Trilhas, Dossiês e Crawler de Bancas

### Community 13 - "🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)"
Cohesion: 0.20
Nodes (10): [BACKLOG] Fatia 3 — Motor Matemático do Ciclo de Estudos & Pomodoro, [BACKLOG] Fatia 4 — Questões + Destrinchador IA (Roteador Gemini ➔ DeepSeek), [BACKLOG] Fatia 5 — Leitor de PDF Virtualizado & Cadernos Markdown, [BACKLOG] Fatia 6 — Grafo de Micro-tópicos & Pacotes `.fofopack` (Google Drive), 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo), [DONE] Fatia 1 — Fundação, Arquitetura & Esqueleto da Bancada, 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA), [NEXT_10_MIN] Fatia 2 — Inicialização do Tauri v2 + Banco SQLite Real (+2 more)

### Community 14 - "🐹🧪 FofoLab — Bancada Inteligente de Estudos"
Cohesion: 0.22
Nodes (9): 1. Ferramentas Base, 2. Ferramentas de Contexto & Automação (Opcionais mas Recomendadas), 🚀 Como Rodar o Projeto (Passo a Passo), 🗂️ Estrutura de Pastas, 🐹🧪 FofoLab — Bancada Inteligente de Estudos, No PC de Casa (Primeira vez após clonar), Para empacotar ou rodar como Janela Desktop Nativa (`.exe` via Tauri v2), 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini) (+1 more)

### Community 15 - "default.json"
Cohesion: 0.25
Nodes (7): core:default, main, description, identifier, permissions, $schema, windows

## Knowledge Gaps
- **89 isolated node(s):** `admin_board_blueprints`, `name`, `private`, `version`, `description` (+84 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 101 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **3 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `devDependencies` connect `devDependencies` to `package.json`?**
  _High betweenness centrality (0.043) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`?**
  _High betweenness centrality (0.022) - this node is a cross-community bridge._
- **What connects `admin_board_blueprints`, `name`, `private` to the rest of the system?**
  _89 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `devDependencies` be split into smaller, more focused modules?**
  _Cohesion score 0.10526315789473684 - nodes in this community are weakly interconnected._
- **Should `compilerOptions` be split into smaller, more focused modules?**
  _Cohesion score 0.09090909090909091 - nodes in this community are weakly interconnected._
- **Should `tauri.conf.json` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._