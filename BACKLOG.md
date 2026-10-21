# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** Este arquivo é o índice mestre de contexto rápido (~400 tokens). Leia-o no início de cada sessão de 10 minutos. Não despeje especificações longas aqui; detalhes técnicos ficam em `docs/specs/`.

## 📌 Status Global
- **Objetivo Imediato:** Uso pessoal nos estudos da **CGU** e **BACEN**, com exportação gratuita de pacotes (`.fofopack`) para familiares e amigos.
- **Stack:** Tauri v2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS + SQLite Local + Roteador IA (Gemini Free ➔ DeepSeek Fallback).
- **Fase Atual:** `Fatia 3 Concluída` ➔ Próxima: `Fatia 4 (Questões + Destrinchador IA com Grounding Anti-Alucinação)`.

---

## 🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)

### [DONE] Fatia 1 — Fundação, Arquitetura & Esqueleto da Bancada
- [x] Definição do Blueprint, Contrato SQLite (`docs/specs/01-database-schema.sql`) e Specs modulares.
- [x] Setup inicial React + TypeScript + Vite + Tailwind CSS com mascote FofoLab (`public/favicon-fofolab.svg`).
- [x] Protótipo navegável da **Bancada de Estudos por Tópico** (Cadernos, Questões + Diagnóstico 1-Clique, PDFs, Ciclo e Modo Admin).
- [x] Repositório Git inicializado e publicado no GitHub (`lycoTi/fofolab`).

### [DONE] Fatia 2 — Inicialização do Tauri v2 + Banco SQLite Real
- [x] Rodar `npm install` + `npx tauri init` (após garantir Rust instalado no PC) + ativar Graphify com git hooks.
- [x] Conectar o schema `docs/specs/01-database-schema.sql` ao SQLite local (`src/lib/database.ts` via `sql.js` WASM + exportação `.sqlite`).
- [x] CRUD real de **Planos de Estudo (CGU / BACEN)**, **Disciplinas** e **Tópicos Verticalizados** (`src/components/CurriculumManagerModal.tsx`).

### [DONE] Fatia 3 — Motor Matemático do Ciclo (Score Elasticsearch + Pizza + Mapa de Calor) & Pomodoro
- [x] Motor de Relevância (`_score` estilo Elasticsearch em `src/lib/cycleEngine.ts`) com **Orçamento Semanal Fixo (Soma Zero)** e **Proteção de 1º Contato no Estudo Reverso**.
- [x] Visualização em **Gráfico Pizza/Donut Interativo** + **Mapa de Calor de Tópicos (Heatmap)** + **Sugestões Não-Invasivas para o Próximo Ciclo** (`src/components/CycleDashboard.tsx`).
- [x] Preview de subtópicos reais para calibrar Base Inicial (1–4) e Afinidade (1–3).
- [x] Cronômetro Pomodoro integrado (`src/components/PomodoroWidget.tsx`) gravando na tabela `study_sessions` e medindo fricção comportamental.

### [NEXT_10_MIN] Fatia 4 — Questões + Destrinchador IA (Roteador Gemini ➔ DeepSeek + Grounding)
- [ ] Tela de resolução de questões com filtro por disciplina/tópico/banca e indicador multidimensional de complexidade.
- [ ] Integração com **Roteador IA** (Cache SQLite ➔ Google AI Studio Free ➔ Fallback DeepSeek API) e **Chat de Estudo Reverso com Grounding Anti-Alucinação**.
- [ ] Botão "Salvar Aula no Caderno do Tópico" e vinculação de pré-requisitos.

### [BACKLOG] Fatia 5 — Leitor de PDF Local Virtualizado (Proteção Autoral) & Cadernos Markdown
- [ ] Visualizador de PDF leve (`pdfjs-dist` virtualizado) lendo os PDFs locais do próprio estudante (Estratégia/Gran) sem upload de material autoral.
- [ ] Persistência automática da página atual, % de leitura e grifos no SQLite.
- [ ] Editor de Cadernos rico em Markdown com busca instantânea.

### [BACKLOG] Fatia 6 — Grafo de Micro-tópicos & Pacotes `.fofopack` (Google Drive)
- [ ] Visualização interativa em grafo conectando Tópicos, Cadernos e Pré-requisitos de questões.
- [ ] Exportação/Importação em 1 clique do banco/pacote `.fofopack` (sem PDFs autorais) para backup no Google Drive e envio para amigos/sobrinhos.

---

## 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo)
- [ ] **Catálogo de Trilhas Prontas:** Mapeamento Federal, Estadual, Municipal, Tribunais, TI e Direito (`🟢 Catalogado` vs `🟡 No Radar`).
- [ ] **Dossiês de Pesquisa Profunda & Matriz de Complexidade de Questões:** Classificação por 4 dimensões (densidade de tópicos, carga linguística, profundidade normativa e fricção empírica).
- [ ] **Blueprint de Bancas (DOM Snapshot):** Verificador de integridade estrutural das páginas da FGV, Cebraspe, FCC e Cesgranrio.
- [ ] **Crawler Sob Demanda (Playwright/Crawlee):** Extração automatizada de provas anteriores, gabaritos definitivos pós-recurso e questões anuladas.
