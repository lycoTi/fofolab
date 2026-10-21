# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** Este arquivo é o índice mestre de contexto rápido (~400 tokens). Leia-o no início de cada sessão de 10 minutos. Não despeje especificações longas aqui; detalhes técnicos ficam em `docs/specs/`.

## 📌 Status Global
- **Objetivo Imediato:** Uso pessoal nos estudos da **CGU** e **BACEN**, com exportação gratuita de pacotes (`.fofopack`) para familiares e amigos.
- **Stack:** Tauri v2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS + SQLite Local + Roteador IA (Gemini Free ➔ DeepSeek Fallback).
- **Fase Atual:** `Fatia 2 Concluída` ➔ Próxima: `Fatia 3 (Motor Matemático do Ciclo de Estudos & Pomodoro)`.

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

### [NEXT_10_MIN] Fatia 3 — Motor Matemático do Ciclo de Estudos & Pomodoro
- [ ] Calculadora automática de horas por disciplina baseada em: `Dias até a prova`, `Peso/Dificuldade inicial (1-5)`, `Afinidade (1-3)` e `Domínio medido`.
- [ ] Recálculo em tempo real ao aumentar/diminuir horas disponíveis na semana.
- [ ] Cronômetro Pomodoro integrado que grava a sessão direto no tópico estudado e mede fricção comportamental.

### [BACKLOG] Fatia 4 — Questões + Destrinchador IA (Roteador Gemini ➔ DeepSeek)
- [ ] Tela de resolução de questões com filtro por disciplina/tópico/banca.
- [ ] Integração com **Roteador IA** (Cache SQLite ➔ Google AI Studio Free ➔ Fallback DeepSeek API).
- [ ] Botões de **Diagnóstico Pós-Questão (1 Clique)** sem viés (`🟢 Dominei/Revisei`, `🟡 Na dúvida`, `🟠 Pegadinha da Banca`, `🔴 Lacuna de Base`).
- [ ] Botão "Salvar Aula no Caderno do Tópico" e vinculação de pré-requisitos.

### [BACKLOG] Fatia 5 — Leitor de PDF Virtualizado & Cadernos Markdown
- [ ] Visualizador de PDF leve (`pdfjs-dist` virtualizado) ancorado ao tópico.
- [ ] Persistência automática da página atual, % de leitura e grifos no SQLite.
- [ ] Editor de Cadernos rico em Markdown com busca instantânea.

### [BACKLOG] Fatia 6 — Grafo de Micro-tópicos & Pacotes `.fofopack` (Google Drive)
- [ ] Visualização interativa em grafo conectando Tópicos, Cadernos e Pré-requisitos de questões.
- [ ] Exportação/Importação em 1 clique do banco/pacote `.fofopack` para backup no Google Drive e envio para amigos/sobrinhos.

---

## 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo)
- [ ] **Catálogo de Trilhas Prontas:** Mapeamento Federal, Estadual, Municipal, Tribunais, TI e Direito (`🟢 Catalogado` vs `🟡 No Radar`).
- [ ] **Dossiês de Pesquisa Profunda:** Agente de mapeamento inicial de editais, órgãos, cargos e matérias básicas/específicas.
- [ ] **Blueprint de Bancas (DOM Snapshot):** Verificador de integridade estrutural das páginas da FGV, Cebraspe, FCC e Cesgranrio.
- [ ] **Crawler Sob Demanda (Playwright/Crawlee):** Extração automatizada de provas anteriores, gabaritos definitivos pós-recurso e questões anuladas.
