# 🐹🧪 FofoLab — Bancada Inteligente de Estudos

Aplicação desktop ultraleve (`.exe`), local-first e gratuita para estudo ativo de concursos públicos (CGU, BACEN, Tribunais, TI) e cursos densos. Inspirada no conceito de *NotebookLM*, onde cada **Disciplina e Tópico do Edital** funciona como uma bancada completa reunindo **Cadernos, Leitor de PDF com progresso, Banco de Questões destrinchadas por IA, Ciclo de Estudos Dinâmico, Pomodoro e Grafo de Conhecimento**.

---

## 🧭 Para IAs (Antigravity, Claude, Cursor, Gemini)
Antes de alterar qualquer código em sessões de 10 minutos:
1. Leia o arquivo **[`BACKLOG.md`](./BACKLOG.md)** (menos de 80 linhas) para identificar a tarefa atual (`[NEXT_10_MIN]`).
2. Consulte apenas a especificação necessária dentro de **[`docs/specs/`](./docs/specs/)**:
   - [`docs/specs/01-database-schema.sql`](./docs/specs/01-database-schema.sql) — Contrato fixo do banco SQLite local.
   - [`docs/specs/02-ai-router-and-metrics.md`](./docs/specs/02-ai-router-and-metrics.md) — Roteador Gemini Free ➔ DeepSeek V3 e cálculo de Domínio/Afinidade sem viés.
   - [`docs/specs/03-admin-tracks-and-crawler.md`](./docs/specs/03-admin-tracks-and-crawler.md) — Modo Admin, Trilhas Prontas, Dossiês e Crawler com Blueprint de Bancas.
3. Se a pasta `graphify-out/` existir, consulte `graphify-out/GRAPH_REPORT.md` antes de fazer buscas amplas no código.

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
* **Playwright (Apenas para o Modo Admin / Crawler de Bancas futuro):**
  - Será instalado sob demanda via `npx playwright install chromium` quando formos trabalhar no módulo Admin.

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
├── BACKLOG.md                  # Índice ultracompacto de progresso (leitura obrigatória p/ IA)
├── README.md                   # Este guia de setup e arquitetura
├── docs/
│   └── specs/                  # Especificações técnicas isoladas por módulo
│       ├── 01-database-schema.sql
│       ├── 02-ai-router-and-metrics.md
│       └── 03-admin-tracks-and-crawler.md
├── public/
│   └── favicon-fofolab.svg     # Mascote oficial do ecossistema Fofo (Hamster)
└── src/
    ├── types/                  # Contratos TypeScript espelhando o SQLite
    ├── data/                   # Dados iniciais de exemplo (Edital CGU / Questões)
    ├── components/             # Componentes modulares da Bancada e do Modo Admin
    ├── App.tsx                 # Shell principal da Bancada FofoLab
    └── main.tsx                # Entrypoint React
```
