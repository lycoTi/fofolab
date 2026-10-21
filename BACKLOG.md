# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** Este arquivo é o índice mestre de contexto rápido (~400 tokens). Leia-o no início de cada sessão de 10 minutos. Não despeje especificações longas aqui; detalhes técnicos ficam em `docs/specs/`.

## 📌 Status Global
- **Objetivo Imediato:** Uso pessoal nos estudos da **CGU** e **BACEN**, com exportação gratuita de pacotes (`.fofopack`) para familiares e amigos.
- **Stack:** Tauri v2 (Rust) + React 19 + TypeScript + Vite + Tailwind CSS + Vitest + SQLite Local + Roteador IA (Gateway ➔ Gemini Free ➔ DeepSeek Fallback ➔ Tutor Contextual).
- **Fase Atual:** `Fatia 5 Concluída` ➔ Próxima: `Fatia 6 (Grafo Interativo de Micro-tópicos & Importação .fofopack)`.

---

## 🎯 Sprints de 10 Minutos (Visão Estudante — MVP CGU/BACEN)

### [DONE] Fatia 1 & 2 — Fundação, Arquitetura & Banco SQLite Real
- [x] Blueprint, Contrato SQLite (`docs/specs/01-database-schema.sql`), Specs modulares e `sql.js` local (`src/lib/database.ts`).
- [x] CRUD completo de **Planos de Estudo (CGU / BACEN)**, **Disciplinas** e **Tópicos Verticalizados** (`src/components/CurriculumManagerModal.tsx`).

### [DONE] Fatia 3 — Motor Matemático do Ciclo (Curva de Confiança + HLR + Pizza + Mapa de Calor) & Pomodoro
- [x] Motor de Relevância (`src/lib/cycleEngine.ts`) com **Orçamento Semanal Fixo (Soma Zero)**, **Curva Contínua de Confiança da Amostra (estilo saturação BM25)**, **Regressão de Meia-Vida da Memória (HLR + Regra 10–20% de Cepeda)** e separação entre **Cobertura do Edital (%)** e **Domínio nos Tópicos Iniciados (%)**.
- [x] Visualização em **Gráfico Pizza/Donut Interativo** + **Mapa de Calor de Tópicos** + **Sugestões para o Próximo Ciclo** (`src/components/CycleDashboard.tsx`).
- [x] Cronômetro Pomodoro integrado (`src/components/PomodoroWidget.tsx`) gravando na tabela `study_sessions`.

### [DONE] Fatia 4 & 5 — Microfrontends (Dock Slots), Copiloto IA Contextual, Questões, Cadernos & PDF Local
- [x] **Arquitetura Micro-Modules & Painéis Expansíveis (`src/features/` + `src/App.tsx`):** Controle em 1 clique do que fica expandido na tela (`📂 Tópicos`, `🎯 Bancada Central`, `📓 Caderno & PDF`, `🐹 Copiloto IA`).
- [x] **Copiloto IA Contextual (`src/features/ai-copilot/AiCopilotDockPanel.tsx` + `src/lib/aiRouter.ts`):** IA ciente do concurso ativo, banca, cargo, domínio, confiança da amostra, tópicos fortes (para analogias) e alertas do Mapa de Calor.
- [x] **Bancada de Questões (`src/components/QuestionWorkbench.tsx`):** Proteção contra Descarga Cognitiva (Kapur, 2016) + botão *"🌱 1º Contato: Ver Explicação Base Antes de Responder"* + salvamento no caderno sem perder o índice da questão.
- [x] **Dock de Caderno, Busca Cross-Cadernos & Leitor de PDF Local (`src/features/notebook-dock/NotebookDockPanel.tsx`):** Edição/leitura lado a lado, busca instantânea em todos os cadernos e abertura de arquivo `.PDF` local com persistência de página.
- [x] **7 Skills Instaladas em `.agents/skills/`** + Auditoria Sócio v1 vs v2 (`docs/specs/04-partner-audit-snapshot.md`).

### [NEXT_10_MIN] Fatia 6 — Grafo Interativo de Micro-tópicos & Importação `.fofopack` (Google Drive)
- [ ] Visualização interativa em grafo conectando Tópicos, Cadernos e Pré-requisitos de questões com criação de vínculos na UI.
- [ ] Importação em 1 clique do pacote `.fofopack` (complementando a exportação já ativa) para sincronizar entre PCs via Google Drive e compartilhar com amigos/sobrinhos.

---

## 🧭 Épicos de Experiência Humana & Onboarding ("Pegar pela Mão")
- [ ] **Épico A — Explicabilidade Discreta sob Demanda (`?` / `ⓘ`):** Dicionário centralizado que explica em linguagem humana (e nos bastidores matemáticos para quem quiser expandir) como calculamos cada métrica (Prioridade no Ciclo, Confiança da Amostra, Domínio vs. Cobertura, Mapa de Calor e Estrelas de Complexidade).
- [ ] **Épico B — Divulgação Progressiva (*Progressive Disclosure*):** Modo Essencial para iniciantes ou usuários com pouca familiaridade digital (mostrando apenas o grosso: *Meu Cronograma*, *Ler PDF/Caderno* e *Questões*), revelando gradualmente ferramentas avançadas conforme o uso.
- [ ] **Épico C — Wizard "Pegar pela Mão" & Matchmaker de Concursos:** Entrevista guiada passo a passo (objetivo, horas disponíveis, escolaridade/formação, áreas de interesse) cruzando o perfil do estudante com concursos compatíveis por status real (*Edital Publicado*, *Banca Definida*, *Iminente*, *Autorizado*, *Homologado*).

---

## 🛠️ Backlog Modo Administrador ("A Fábrica" — Futuro/Paralelo)
- [ ] **Catálogo de Trilhas Prontas (`src/features/admin-factory/AdminFactoryView.tsx`):** Mapeamento Federal, Estadual, Municipal, Tribunais, TI e Direito (`🟢 Catalogado` vs `🟡 No Radar`).
- [ ] **Blueprint de Bancas (DOM Snapshot) & Crawler Sob Demanda:** Verificador de integridade estrutural das páginas da FGV, Cebraspe, FCC e Cesgranrio.
