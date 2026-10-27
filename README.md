# 🐹🧪 FofoLab — Bancada Inteligente de Estudos

Aplicação desktop ultraleve (`.exe`), local-first e gratuita para estudo ativo de concursos públicos (CGU, BACEN, Tribunais, TI) e cursos densos. Inspirada no conceito de *NotebookLM*, onde cada **Disciplina e Tópico do Edital** funciona como uma bancada completa reunindo **Cadernos, Leitor de PDF com progresso, Banco de Questões destrinchadas por IA, Ciclo de Estudos Dinâmico, Pomodoro e Grafo de Conhecimento**.

---

## 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini)
Antes de alterar qualquer código:
1. Leia **[`docs/handoff/2026-10-24-estado-e-proxima-ia.md`](./docs/handoff/2026-10-24-estado-e-proxima-ia.md)** (onde paramos) e **[`BACKLOG.md`](./BACKLOG.md)** — estado **real** de cada área, definição de pronto e próximas fatias. (Claude Code: [`CLAUDE.md`](./CLAUDE.md) resume as regras; Antigravity: [`.agents/rules/`](./.agents/rules/).)
2. Consulte apenas a especificação necessária dentro de **[`docs/specs/`](./docs/specs/)**:
   - [`01-database-schema.sql`](./docs/specs/01-database-schema.sql) — Contrato do banco local (mudanças exigem migração em `src/lib/migrations.ts` e subir `LATEST_SCHEMA_VERSION`).
   - [`02-ai-router-and-metrics.md`](./docs/specs/02-ai-router-and-metrics.md) — Roteador de IA (hoje: gateway ➔ Groq ➔ Gemini ➔ DeepSeek), modo demonstração e cálculo de Domínio sem viés.
   - [`03-admin-tracks-and-crawler.md`](./docs/specs/03-admin-tracks-and-crawler.md) — Modo Admin, Trilhas Prontas, Dossiês e Crawler (não implementado).
   - [`05-onboarding-wizard-and-daily-focus.md`](./docs/specs/05-onboarding-wizard-and-daily-focus.md) — Wizard, estratégias e "Meu Dia de Hoje".
   - [`06-importacao-e-persistencia.md`](./docs/specs/06-importacao-e-persistencia.md) — Onde os dados ficam, backups, migrações e formatos de importação.
   - [`07`](./docs/specs/07-edital-ciclo-e-situacao.md) edital real e ciclo pela nota mínima • [`08`](./docs/specs/08-mapa-de-incidencia-das-bancas.md) mapa de incidência (rascunho) • [`09`](./docs/specs/09-bancada-roteiro-e-revisao.md) bancada, roteiro e Revisão do dia • [`10`](./docs/specs/10-fofodoro-e-resumo-do-dia.md) FofoDoro • [`11`](./docs/specs/11-fofoia.md) FofoIA • [`12`](./docs/specs/12-minerador-cebraspe.md) minerador da Cebraspe ([`12c`](./docs/specs/12c-acervo-no-app.md) acervo no app) • [`13`](./docs/specs/13-plano-de-estudo.md) plano de estudo.
3. Decisões e diagnóstico: [`docs/reviews/`](./docs/reviews/). Regras dos agentes: [`.agents/rules/`](./.agents/rules/).
4. Se a pasta `graphify-out/` existir, use `graphify query` antes de buscas amplas — e rode `graphify update .` depois de mudar código.

---

## 💻 Stack de Desenvolvimento & Pré-requisitos (Checklist de Ambiente)

Para continuar desenvolvendo no **PC de casa** ou no **PC do trabalho**, confira se os itens abaixo estão instalados.

### 1. Ferramentas Base
| Ferramenta | Versão Recomendada | Como verificar no terminal | Como instalar (Windows) |
| :--- | :--- | :--- | :--- |
| **Git** | `>= 2.40` | `git --version` | `winget install Git.Git` |
| **NVM for Windows** | `>= 1.1.12` | `nvm version` | `winget install CoreyButler.NVMforWindows` |
| **Node.js (via NVM)** | **`v22.x` (LTS)** | `node -v` | `nvm install 22.21.1` e depois `nvm use 22.21.1` |
| **Rust & Cargo** *(p/ Tauri v2)* | `stable` | `rustc -V` e `cargo -V` | `winget install Rustlang.Rustup` |
| **C++ Build Tools** *(p/ compilar Rust no Windows)* | VS 2022 Build Tools | Verificar `cl.exe` ou VS Installer | `winget install Microsoft.VisualStudio.2022.BuildTools` *(Marcar a workload "Desenvolvimento para Desktop com C++")* |
| **Microsoft Edge WebView2** | Nativo Win 10/11 | Já vem no Windows 10/11 | Pré-instalado no Windows |

### 2. Ferramentas de Contexto & Automação (Opcionais mas Recomendadas)
* **Graphify (Grafo de Contexto para IA):**
  - Requer Python `>= 3.10`.
  - Verificar: `python -c "import graphify; print('OK')"`
  - Instalar: `pip install graphifyy`
* **Playwright (testes E2E):**
  - Já vem no `npm install` e usa o **Microsoft Edge** instalado no Windows (mesmo motor do WebView2 do `.exe`), sem baixar navegador.
  - Em outro sistema: `npx playwright install chromium` e rode com `PLAYWRIGHT_CHANNEL=chromium npm run test:e2e`.

---

## 🚀 Como Rodar o Projeto (Passo a Passo)

### No PC de Casa (Primeira vez após clonar)
```powershell
# 1. Clonar o repositório
git clone https://github.com/lycoTi/fofolab.git
cd fofolab

# 2. Garantir que o Node 20+ ou 22+ está ativo no NVM
nvm use 22.21.1

# 3. Instalar as dependências do frontend
npm install

# 4. Rodar a Bancada em modo desenvolvimento (super rápido no navegador/Vite)
npm run dev
```

### Testes e IA
```powershell
npm test            # Vitest: regras, componentes e o banco real rodando no Node
npm run test:e2e    # Playwright no Microsoft Edge instalado (sobe o npm run dev sozinho)
npm run build       # Checagem de tipos + build de produção

# IA (opcional): sem variáveis o app roda em modo demonstração, com respostas marcadas como simulação
copy .env.example .env.local   # e preencha a chave ou o gateway
```
> Os dados do `npm run dev` ficam no armazenamento interno do navegador; os do `.exe`, em `%APPDATA%\com.fofolab.desktop\fofolab.db`. Para levar estudos de um PC para outro: **Organizar Edital → Backup & Segurança → Fazer Backup** e, no outro PC, **Restaurar de um arquivo de backup**.

### Para empacotar ou rodar como Janela Desktop Nativa (`.exe` via Tauri v2)
*(Após instalar o `Rustup` e o `VS C++ Build Tools` da tabela acima)*:
```powershell
# Rodar janela desktop em modo dev
npm run tauri:dev

# Gerar o instalador .exe otimizado (5-10 MB) para enviar aos amigos/sobrinhos
npm run tauri:build
```

---

## 🗂️ Estrutura de Pastas

```text
fofolab/
├── BACKLOG.md                  # Estado real + próximas fatias (leitura obrigatória p/ IA)
├── CLAUDE.md                   # Regras e mapa rápido para o Claude Code
├── README.md                   # Este guia de setup e arquitetura
├── .env.example                # Variáveis da IA (copie para .env.local)
├── docs/
│   ├── specs/                  # Especificações técnicas por módulo (01 banco … 06 persistência/importação)
│   └── reviews/                # Revisões de estado e decisões tomadas
├── e2e/                        # Testes de ponta a ponta (Playwright)
├── src-tauri/                  # App desktop (Rust): plugin de arquivos e permissões
├── public/
│   └── favicon-fofolab.svg     # Mascote oficial do ecossistema Fofo (Hamster)
└── src/
    ├── lib/                    # Regras: banco, armazenamento, migrações, ciclo, IA, importadores
    ├── components/             # Componentes da Bancada (questões, ciclo, backup, diálogos…)
    ├── features/               # Módulos de tela (Meu Dia, Wizard, caderno/PDF, copiloto, importação…)
    ├── types/                  # Contratos TypeScript espelhando o banco
    ├── data/                   # Exemplo inicial (CGU + BACEN)
    ├── __tests__/              # Testes Vitest
    ├── App.tsx                 # Shell principal da Bancada FofoLab
    └── main.tsx                # Entrypoint React
```
