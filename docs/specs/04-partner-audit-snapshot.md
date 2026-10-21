# 🧠 Auditoria de Sócio — Comparativo v1 (Pré-Skills) vs. v2 (Pós-Skills)

> **Propósito deste documento:** Registrar o estado exato da primeira avaliação de sócio (**Parte 1 — Pré-Skills**) e comparar com o que mudou no "córtex" da análise após instalar e absorver as 6 novas bibliotecas de skills (**Parte 2 — Pós-Skills**):
> 1. `grill-me` (`mattpocock/skills`)
> 2. `brainstorming` (`obra/superpowers`)
> 3. `design-system-builder` (`signerlabs/design-system-builder-skills`)
> 4. `prompt-engineering-guide` (`dair-ai/Prompt-Engineering-Guide`)
> 5. `shannon-security-and-code-craft` (`KeygraphHQ/shannon`)
> 6. `education-learning-science` (`GarethManning/education-agent-skills`)

---

## 📸 Parte 1: Avaliação v1 (Estado Pré-Skills — Congelado)

### 1.1. O que havia sido validado positivamente
- **Orçamento Semanal de Soma Zero (`cycleEngine.ts`):** Travar `weekly_hours_target` na realidade do estudante e apenas redistribuir os percentuais da pizza.
- **Proteção Autoral nos PDFs (`02-ai-router-and-metrics.md`):** Vincular apenas o `file_path` local do estudante sem embutir PDFs autorais nos pacotes `.fofopack`.
- **Auditoria Automatizada de UX Limpa (`questionWorkbenchAndRouter.test.tsx`):** Teste automatizado impedindo vazamento de jargão técnico na interface.

### 1.2. Os 5 Gargalos Identificados na Avaliação v1
1. **[Pedagogia / Métrica] Falha das "3 Primeiras Questões" (`isColdStartDiscovery`):** Corte fixo `prevAttemptsCount < 3` é pequeno demais e rígido para medir conhecimento em matérias extensas.
2. **[Infra / Performance] Gargalo do `localStorage` em Base64 (`database.ts`):** Limite de 5 MB e serialização síncrona.
3. **[UX / Fluxo] Quebra de Flow ao Salvar no Caderno & Isolamento entre Abas (`App.tsx`):** Salvar aula joga o aluno para outra aba e reseta o índice da questão; falta modo *Split View* (PDF + Caderno lado a lado).
4. **[Pedagogia / Ciclo] "Média Diluída" na Disciplina e Ausência da Curva de Esquecimento (`cycleEngine.ts`):** Média simples com tópicos `0%` esconde o progresso real; `last_studied_at` era ignorado no `heatScore`.
5. **[Integrações] Elo Faltante do Fallback DeepSeek (`aiRouter.ts`):** Faltava a chamada da Camada 2 no código.

---

## 🔬 Parte 2: Reavaliação v2 (O que mudou no "Córtex" após instalar as 6 Skills!)

Ao passar o mesmo código pelas lentes científicas e técnicas das 6 novas skills, **3 pontos da Avaliação v1 mudaram profundamente de natureza** e **3 pontos cegos inéditos** (que eu não havia percebido na v1!) vieram à tona:

### 🚀 Mudança 1 (Lente: `education-learning-science` — Kapur, 2016 & Kornell, 2009)
#### Novo Ponto Cego Descoberto: O Bug do "Cognitive Offloading" na Bancada de Questões!
- **O que eu não tinha visto na v1:** Em `src/components/QuestionWorkbench.tsx` (linha 470), a explicação completa da IA (`dissection_markdown`) **já nasce aberta e visível na coluna da direita ANTES de o aluno responder a questão na coluna da esquerda!**
- **Por que isso é grave segundo a Ciência Cognitiva:** Os estudos de Manu Kapur (*Productive Failure*) e Nate Kornell (*Failed Retrieval Effect*) provam que o cérebro humano sofre **Descarga Cognitiva (*Cognitive Offloading*)** quando vê a explicação antes de tentar recuperar a resposta na memória. Ler a explicação direto dá uma **ilusão de fluência** (o aluno acha que entendeu), mas a retenção de longo prazo despenca.
- **Nova Solução v2:** Na Bancada de Questões, a coluna da direita fica em **Modo Protegido de Recuperação Ativa** até que o estudante:
  1. Clique em uma alternativa (A–E) para testar seu cérebro primeiro, **OU**
  2. Clique explicitamente no botão **"🌱 É meu 1º contato absoluto (Revelar Base Teórica)"**.

---

### 🚀 Mudança 2 (Lente: `education-learning-science` — Mandinach & Gummer, 2016 + Settles & Meeder, 2016)
#### Da "Regra das 3 Questões" para Saturação Contínua BM25 + Regressão de Meia-Vida (Duolingo HLR)
- **Por que a solução da v1 ainda era rasa:** Na v1 pensamos apenas em trocar o número `3` ou usar média simples dos tópicos estudados.
- **O que a ciência de dados educacionais exige na v2:**
  1. **Curva de Confiança Amostral estilo BM25 ($C_n$):**
     Em vez de `prevAttemptsCount < 3`, a confiança no domínio medido de um tópico segue a equação de saturação do Elasticsearch BM25:
     $$C_n = \frac{W_{\text{evidência}}}{W_{\textDev} + k}$$
     onde $W_{\text{evidência}}$ soma o peso das questões resolvidas ponderadas pela **Complexidade (1 a 5 estrelas)**, e $k$ é a constante de maturidade do tópico (ex: $k = 12$).
     - Com 2 ou 3 questões simples, $C_n \approx 0.18$ (18% de maturidade amostral). O sistema sabe matematicamente que o tópico ainda está em **Baixa Amostragem (Mapeamento)** sem precisar de nenhum `if (< 3)` arbitrário!
  2. **Meia-Vida da Memória ($h$) + Regra dos 10–20% de Cepeda et al. (2006):**
     Cada tópico tem uma estabilidade de memória $h$ (em dias) que cresce a cada `MASTERED` e encolhe em `BASE_GAP`. A probabilidade de esquecimento após $\Delta t$ dias sem estudar (`last_studied_at`) aquece o Mapa de Calor segundo $1 - 2^{-\Delta t / h}$, calibrado para revisar a cada 10–20% do tempo restante até a prova (`daysUntilExam`).

---

### 🚀 Mudança 3 (Lente: `shannon-security-and-code-craft` — KeygraphHQ/shannon)
#### Alerta de Segurança em `VITE_DEEPSEEK_API_KEY` + Limpeza de Ternários Aninhados
- **Onde a v1 quase cometeu um erro de segurança:** Na v1, eu sugeri simplesmente adicionar `import.meta.env.VITE_DEEPSEEK_API_KEY` no `aiRouter.ts`.
- **O que a skill do Shannon alertou na v2:**
  1. **Exposição de Segredos no Binário Distribuído:** Qualquer variável `VITE_*` é embutida em texto puro dentro do bundle JS do `.exe`. Se você distribuir o `.exe` com sua `VITE_DEEPSEEK_API_KEY` dentro, qualquer pessoa (caso o `.exe` vaze para fora da família) pode extrair a chave em 10 segundos.
  2. **Arquitetura Correta (Shannon Spending Cap Safeguard):** O `aiRouter.ts` deve priorizar um endpoint de **Gateway (`VITE_FOFOLAB_AI_GATEWAY_URL`)** (sua Oracle Cloud / Cloudflare Worker, onde a chave fica oculta no servidor com limite diário por IP/app), mantendo as variáveis diretas apenas para o seu ambiente local de desenvolvimento.
  3. **Higiene de Código TypeScript:** O Shannon identificou **ternários aninhados de 3 níveis** em `src/App.tsx` (linhas 135–149 e 683–695) e `src/lib/database.ts` (linha 567) que devem ser substituídos por *lookup maps* ou funções auxiliares claras.

---

### 🚀 Mudança 4 (Lente: `prompt-engineering-guide` — DAIR.AI)
#### De Prompt Genérico para "Eliminação Contrastiva + Regra de Abstenção"
- **Na v1:** Não havíamos auditado a qualidade do prompt dentro de `aiRouter.ts`.
- **Na v2:** O prompt do Tutor de Estudo Reverso passa a exigir:
  1. **Eliminação Contrastiva das Alternativas:** Diagnosticar o tipo exato de armadilha em cada item incorreto (*Inversão Conceitual*, *Extrapolação*, *Troca de Competência*, *Exceção Literal*).
  2. **Abstenção Estrita Anti-Alucinação:** Proibição explícita de inventar números de artigos/leis caso não estejam confirmados no contexto.

---

### 🚀 Mudança 5 (Lente: `design-system-builder` — SignerLabs)
#### De "God Component" (`App.tsx` com 781 linhas) para Bancada Dupla (Split View) Componentizada
- Em vez de continuar colocando HTML do Leitor de PDF e do Caderno dentro do `App.tsx`, a **Fatia 5** deve nascer como um módulo próprio (`src/components/StudyMaterialsWorkbench.tsx`) com **Modo Lado a Lado (PDF à esquerda + Caderno Markdown com Busca à direita)** e tokens visuais padronizados.

