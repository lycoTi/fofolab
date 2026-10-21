# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** Este arquivo é o índice mestre de contexto rápido (~400 tokens). Leia-o no início de cada sessão de 10 minutos. Não despeje especificações longas aqui; detalhes técnicos ficam em `docs/specs/`.

## 📌 Status Global
- **Objetivo Imediato:** Uso pessoal nos estudos da **CGU** e **BACEN**, com exportação gratuita de pacotes (`.fofopack`) para familiares e amigos.
- **Stack:** Tauri v2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS + Vitest + SQLite Local + Roteador IA (Gemini Free ➔ DeepSeek Fallback).
- **Fase Atual:** `Fatia 4 Concluída` ➔ Próxima: `Fatia 5 (Leitor de PDF Virtualizado & Cadernos Markdown com Busca)`.

---

## 🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)

### [DONE] Fatia 1 — Fundação, Arquitetura & Esqueleto da Bancada
- [x] Definição do Blueprint, Contrato SQLite (`docs/specs/01-database-schema.sql`) e Specs modulares.
- [x] Setup inicial React + TypeScript + Vite + Tailwind CSS com mascote FofoLab (`public/favicon-fofolab.svg`).
- [x] Protótipo navegável da **Bancada de Estudos por Tópico**.
- [x] Repositório Git inicializado e publicado no GitHub (`lycoTi/fofolab`).

### [DONE] Fatia 2 — Inicialização do Tauri v2 + Banco SQLite Real
- [x] Rodar `npm install` + `npx tauri init` (após garantir Rust instalado no PC) + ativar Graphify com git hooks.
- [x] Conectar o schema `docs/specs/01-database-schema.sql` ao SQLite local (`src/lib/database.ts`).
- [x] CRUD real de **Planos de Estudo (CGU / BACEN)**, **Disciplinas** e **Tópicos Verticalizados** (`src/components/CurriculumManagerModal.tsx`).

### [DONE] Fatia 3 — Motor Matemático do Ciclo (Score + Pizza + Mapa de Calor) & Pomodoro
- [x] Motor de Relevância (`src/lib/cycleEngine.ts`) com **Orçamento Semanal Fixo (Soma Zero)** e **Proteção de 1º Contato no Estudo Reverso**.
- [x] Visualização em **Gráfico Pizza/Donut Interativo** + **Mapa de Calor de Tópicos (Heatmap)** + **Sugestões Não-Invasivas para o Próximo Ciclo** (`src/components/CycleDashboard.tsx`).
- [x] Preview de subtópicos reais para calibrar Base Inicial (1–4) e Afinidade (1–3).
- [x] Cronômetro Pomodoro integrado (`src/components/PomodoroWidget.tsx`) gravando na tabela `study_sessions` e medindo fricção comportamental.

### [DONE] Fatia 4 — Questões + Estudo Reverso IA + Suíte de Testes (Vitest) & Limpeza de UX
- [x] Bancada de questões (`src/components/QuestionWorkbench.tsx`) com filtros por escopo/banca/complexidade/busca, indicador 4D de complexidade e navegação.
- [x] Roteador e Tutor de Estudo Reverso (`src/lib/aiRouter.ts`) com aprofundamento em 1 clique, chat contextual e botão "Salvar Aula no Caderno".
- [x] Suíte de testes automatizados (`src/__tests__/`) + Rules/Skills de TDD e UX Limpa (`.agents/rules/`, `.agents/skills/`).

### [NEXT_10_MIN] Fatia 5 — Leitor de PDF Local Virtualizado (Proteção Autoral) & Cadernos Markdown
- [ ] Visualizador de PDF leve (`pdfjs-dist` virtualizado / seletor de arquivo local) lendo os PDFs do próprio estudante sem upload de material autoral.
- [ ] Persistência automática da página atual, % de leitura e grifos no banco local.
- [ ] Editor de Cadernos rico em Markdown com busca instantânea.

### [BACKLOG] Fatia 6 — Grafo de Micro-tópicos & Pacotes `.fofopack` (Google Drive)
- [ ] Visualização interativa em grafo conectando Tópicos, Cadernos e Pré-requisitos de questões.
- [ ] Exportação/Importação em 1 clique do pacote `.fofopack` (sem PDFs autorais) para backup no Google Drive e envio para amigos/sobrinhos.

---

## 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo)
- [ ] **Catálogo de Trilhas Prontas:** Mapeamento Federal, Estadual, Municipal, Tribunais, TI e Direito (`🟢 Catalogado` vs `🟡 No Radar`).
- [ ] **Dossiês de Pesquisa Profunda & Matriz de Complexidade de Questões:** Classificação por 4 dimensões (densidade de tópicos, carga linguística, profundidade normativa e fricção empírica).
- [ ] **Blueprint de Bancas (DOM Snapshot):** Verificador de integridade estrutural das páginas da FGV, Cebraspe, FCC e Cesgranrio.
- [ ] **Crawler Sob Demanda (Playwright/Crawlee):** Extração automatizada de provas anteriores, gabaritos definitivos pós-recurso e questões anuladas.
