# 12b — Assuntos canônicos do acervo (classificação com IA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada item do acervo 1 a 3 assuntos canônicos de um vocabulário vigiado (semente: o edital da CGU 2026), com confiança, em lotes retomáveis pelo Groq grátis hoje e pelo DeepSeek depois (revisão dos incertos), e exportar o pacote que a 12c vai importar no app.

**Architecture:** Mais comandos na mesma ferramenta (`tools/minerador/`, fora do app). Vocabulário em `acervo/vocabulario.json` (com versões); classificação **separada** do acervo cru, em `acervo/classificacao/<ID>.json` (refazer com outro modelo não mexe nos itens). Um provedor de IA próprio da ferramenta (OpenAI-compatível: Groq e DeepSeek), com teto de resposta, ritmo pelos cabeçalhos de limite e parada limpa no limite diário. Funções puras por etapa (semente, candidatos locais, prompt, validação, propostas) e a casca de CLI que faz E/S.

**Tech Stack:** TypeScript strict, `tsx`, Vitest (`// @vitest-environment node`), `fetch` do Node 22, `pdfjs-dist` legacy + `src/lib/pdfText.ts` + `src/lib/editalParser.ts` (puros, já testados com o edital real).

**Spec:** `docs/specs/12-minerador-cebraspe.md` (§6.4 vocabulário vigiado, §6.3 passos 5–6, §6.5 só o formato do pacote, §7 entrega 12b). Ler também o plano da 12a para o formato do acervo (`acervo/cebraspe/<ID>.json`, versão 1).

## Global Constraints

- Nada em `src/` importa `tools/`; `tools/` importa só funções puras de `src/lib` (`editalParser`, `pdfText`, `questionImport.normalizeStatement`).
- Regra autoral de prompts: o texto do item é a fonte; a matéria de origem vai **como pista**, nunca como resposta; resposta **só JSON**, validada; nada inventado (assunto fora da lista só como proposta explícita).
- Chaves: `VITE_GROQ_API_KEY` / `VITE_DEEPSEEK_API_KEY` lidas de `process.env` ou de `.env.local` / `.env` (nessa ordem); **nunca** impressas nem gravadas no acervo.
- Groq grátis por modelo: **1.000 requisições/dia** e **8.000 tokens/min**; todo pedido leva `max_completion_tokens`; pedido acima de ~6.000 tokens estimados é dividido. DeepSeek: `deepseek-flash`, `thinking: { type: 'disabled' }`.
- Confiança: `>= 0.7` = certo; abaixo = **incerto** (selinho no app). Item sem resposta válida fica **sem classificação** e volta à fila.
- Determinismo: mesma classificação → mesmo arquivo byte a byte (ordem por id, sem data de execução); acervo em LF (`.gitattributes` já cobre `acervo/**`).
- Retomável: cada lote grava ao terminar; interromper e rodar de novo continua de onde parou, sem reclassificar o que já está certo.

## Review Focus

1. Modelo responde com assunto que não está na lista dos candidatos (ou id inventado) → o item não recebe esse assunto; se nada sobrar, fica sem classificação e volta à fila (teste na Tarefa 4).
2. Lote em que a resposta traz só parte dos itens, ou ids trocados → só os ids do lote são aceitos; os ausentes voltam à fila (teste na Tarefa 4).
3. Limite diário do Groq (429 com `retry-after` longo) no meio da rodada → para limpo, grava o que já classificou e diz "continue amanhã" (teste na Tarefa 5).
4. Proposta de assunto novo igual (ou quase) a um existente → não duplica: vira o existente (teste na Tarefa 3).
5. Revisão com o DeepSeek reclassifica só incertos/sem classificação e não piora um item certo por outro modelo sem querer (teste na Tarefa 6).

---

## Estrutura de arquivos

```
tools/minerador/
  vocab.ts            tipos do vocabulário; semente a partir do edital; normalização; aplicar propostas; versões
  candidates.ts       palavras-chave e candidatos locais (top K) por item; ordem da fila
  classifyPrompt.ts   prompt do lote e validação da resposta JSON
  aiProvider.ts       Groq/DeepSeek (OpenAI-compatível), chaves do ambiente, teto, ritmo, limite diário
  classifyRun.ts      orquestra uma rodada de classificação (lotes, gravação, relatório)
  classificationStore.ts  lê/grava acervo/classificacao/<ID>.json
  pacote.ts           monta o pacote para o app (vocabulário + itens + assuntos)
  cli.ts              (alterar) comandos `semente`, `classificar`, `pacote`
  __tests__/…         um arquivo por módulo
acervo/vocabulario.json            (no git)
acervo/classificacao/<ID>.json      (no git)
acervo/pacote/                      (fora do git: gerado)
```

## Tipos (em `vocab.ts` e `classificationStore.ts`)

```ts
export interface Assunto { id: string; caminho: string[]; sinonimos: string[]; origem: 'edital' | 'proposta' }
export interface Vocabulario { versao: number; assuntos: Assunto[]; historico: { versao: number; mudancas: string[] }[] }
export interface PropostaAssunto { caminho: string[]; confianca: number }
export interface AssuntoDoItem { id: string; confianca: number }
export interface ClassificacaoItem { assuntos: AssuntoDoItem[]; incerto: boolean; modelo: string; versaoVocabulario: number }
export interface ClassificacaoConcurso { identificador: string; itens: Record<string, ClassificacaoItem> }
```
`Assunto.id`: slug estável do caminho normalizado (sem acento, minúsculas, `>` entre níveis), ex. `engenharia-de-software-e-programacao>requisitos`.

---

### Task 1: Semente do vocabulário a partir do edital

**Files:**
- Create: `tools/minerador/vocab.ts`
- Test: `tools/minerador/__tests__/vocab.test.ts`

**Interfaces:**
- Produces: `assuntoId(caminho: string[]): string`; `seedFromEdital(lines: string[]): Vocabulario` (versão 1, todas as matérias comuns e de **todos** os cargos — `edital.commonSubjects` + cada `edital.roleSubjects[n]`, sem repetir matéria pelo nome; cada tópico vira `[matéria, título do tópico sem numeração]`, subtópico `[matéria, tópico pai, subtópico]`); `readEditalLines(pdfPath: string): Promise<string[]>` (pdf.js legacy + `textItemsToLines`, como `src/__tests__/helpers/loadPdfLines.ts`).

- [ ] **Step 1: testes** com `e2e/fixtures/cgu-2026-affc-edital.pdf`: há assunto com caminho `['Engenharia de Software e Programação', …]` (nome como o `parseEdital` entrega); todas as 13 matérias do Cargo 4 aparecem como primeiro nível; nenhum id repetido; `assuntoId(['Persistência', 'SQL'])` = `assuntoId(['persistencia', ' SQL '])`; `versao === 1`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS; `npx tsc -b`.
- [ ] **Step 5:** commit `feat(minerador): semente do vocabulário a partir do edital da CGU`.

### Task 2: Candidatos locais e ordem da fila

**Files:**
- Create: `tools/minerador/candidates.ts`
- Test: `tools/minerador/__tests__/candidates.test.ts`

**Interfaces:**
- Consumes: `Vocabulario`, `AcervoItem` (12a).
- Produces: `keywords(text: string): Set<string>` (minúsculas, sem acento, palavras de 4+ letras fora de uma lista de palavras vazias de prova — "julgue", "item", "itens", "seguir", "acerca", "correto", "afirmar", "considerando"…, cortadas no 6º caractere); `candidatesFor(item: AcervoItem, vocab: Vocabulario, k: number): { id: string; score: number }[]` (pontua palavras em comum entre texto-base+enunciado+alternativas e caminho+sinônimos; a matéria de origem soma pouco); `queueOrder(items: AcervoItem[], vocab: Vocabulario): AcervoItem[]` (maior melhor-score primeiro; empate por id).

- [ ] **Step 1: testes** — item sintético sobre "chave primária… tabela… SQL" tem como 1º candidato um assunto de banco de dados/SQL do vocabulário da Tarefa 1; `k` limita; item sem nenhuma palavra em comum devolve lista vazia; `queueOrder` põe primeiro o item de SQL e por último um item sobre "regime jurídico de servidores militares".
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): candidatos locais e ordem da fila de classificação`.

### Task 3: Propostas e versões do vocabulário

**Files:**
- Modify: `tools/minerador/vocab.ts`
- Test: `tools/minerador/__tests__/vocab.test.ts`

**Interfaces:**
- Produces: `applyProposals(vocab: Vocabulario, propostas: PropostaAssunto[], minConfianca: number): { vocab: Vocabulario; aceitas: string[]; pendentes: PropostaAssunto[]; mapeadas: Record<string, string> }` — proposta com caminho igual (normalizado) a um assunto existente vira esse assunto (em `mapeadas`, chave = id proposto); nova com `confianca >= minConfianca` entra (`origem: 'proposta'`) e gera **uma** versão nova com as mudanças listadas em `historico`; abaixo fica pendente; nada muda → mesma versão. `mergeCandidates(vocab: Vocabulario): [string, string][]` — pares de assuntos irmãos com nomes quase iguais (Jaccard de palavras ≥ 0.8), só para o relatório (não junta sozinho).

- [ ] **Step 1: testes** — proposta `['Banco de Dados', 'SQL']` quando já existe `['banco de dados', 'sql']` → `mapeadas` aponta para o existente e a versão não muda; duas propostas novas com confiança 0.9 → versão 2 com 2 mudanças; proposta com 0.5 → pendente; `mergeCandidates` devolve o par `['X','Algoritmos e estruturas de dados']` × `['X','Algoritmos e estrutura de dados']` e **não** devolve `['X','Lógica de programação']` × `['X','Redes de computadores']`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): propostas de assunto novo e versões do vocabulário`.

### Task 4: Prompt do lote e validação da resposta

**Files:**
- Create: `tools/minerador/classifyPrompt.ts`
- Test: `tools/minerador/__tests__/classifyPrompt.test.ts`

**Interfaces:**
- Consumes: `AcervoItem`, candidatos da Tarefa 2.
- Produces: `buildBatchPrompt(batch: { item: AcervoItem; candidatos: Assunto[] }[]): string`; `parseBatchResponse(text: string, batch: { item: AcervoItem; candidatos: Assunto[] }[]): Map<string, { assuntos: AssuntoDoItem[]; proposta: PropostaAssunto | null }>`; `estimateTokens(text: string): number` (≈ caracteres ÷ 3,5).

Prompt (regras fixas, em pt-BR): o texto do item é a fonte; a matéria de origem é só pista e pode estar errada; escolher de 1 a 3 assuntos **por id, só da lista daquele item**, com confiança 0–1; se nenhum serve, `"assuntos": []` e `"proposta": {"caminho": ["Matéria", "Assunto"], "confianca": 0–1}`; responder **somente** `{"resultados":[{"id":"…","assuntos":[{"id":"…","confianca":0.0}],"proposta":null}]}`. Itens: id, matéria de origem, texto-base (cortado em 700 caracteres), enunciado, alternativas; candidatos como `id — caminho`.

- [ ] **Step 1: testes** — prompt contém o enunciado, os ids dos candidatos e a frase sobre a matéria de origem ser só pista; resposta com cercas ```` ```json ```` é aceita; assunto fora dos candidatos do item é descartado; id de item fora do lote é ignorado; item ausente na resposta não aparece no mapa; confiança fora de 0–1 é cortada para o intervalo; JSON quebrado → mapa vazio (sem exceção).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): prompt do lote de classificação e validação da resposta`.

### Task 5: Provedor de IA da ferramenta

**Files:**
- Create: `tools/minerador/aiProvider.ts`
- Test: `tools/minerador/__tests__/aiProvider.test.ts`

**Interfaces:**
- Produces: `loadKeys(env: NodeJS.ProcessEnv, files: string[]): { groq?: string; deepseek?: string }`; `createProvider(opts: { nome: 'groq' | 'deepseek'; chave: string; modelo?: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }): AiProvider` com `interface AiProvider { nome: string; modelo: string; complete(prompt: string, maxTokens: number): Promise<string> }`; `class LimiteDiario extends Error { retryAfterSec: number }`.

Ritmo: 429 com `retry-after` ≤ 120 s → espera e tenta de novo (até 3 vezes); `retry-after` > 120 s ou cabeçalho `x-ratelimit-remaining-requests: 0` → `LimiteDiario`. Groq: `https://api.groq.com/openai/v1/chat/completions`, modelo padrão `qwen/qwen3.8-27b` (ou `MINERADOR_GROQ_MODEL`); DeepSeek: `https://api.deepseek.com/chat/completions`, `deepseek-flash`, `thinking: { type: 'disabled' }`. Sempre `response_format: {type:'json_object'}` e o teto de resposta recebido.

- [ ] **Step 1: testes** (fetch falso) — `loadKeys` lê `VITE_GROQ_API_KEY` de um arquivo `.env` temporário e o ambiente vence o arquivo; o corpo enviado ao Groq tem `max_completion_tokens` e `model`; 429 com `retry-after: 5` → `sleep(5000)` e segunda tentativa; 429 com `retry-after: 3600` → `LimiteDiario`; a chave não aparece em nenhuma mensagem de erro.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): provedor de IA da ferramenta com ritmo e limite diário`.

### Task 6: Rodada de classificação retomável

**Files:**
- Create: `tools/minerador/classificationStore.ts`, `tools/minerador/classifyRun.ts`
- Test: `tools/minerador/__tests__/classifyRun.test.ts`

**Interfaces:**
- Consumes: Tarefas 1–5; `readConcurso` da 12a.
- Produces: `readClassificacao(dir, id): ClassificacaoConcurso`, `writeClassificacao(dir, c: ClassificacaoConcurso): void` (determinístico); `runClassificacao(opts: { provider: AiProvider; acervoDir: string; limite: number; revisar: 'pendentes' | 'incertos'; tamanhoLote: number; k: number }): Promise<ClassifyReport>` com `ClassifyReport = { classificados: number; incertos: number; semResposta: number; propostasAceitas: string[]; propostasPendentes: number; juncoesSugeridas: [string, string][]; versaoVocabulario: number; parouNoLimite: boolean }`.

Regras: os candidatos da Tarefa 2 (`{id, score}`) viram `Assunto[]` pelo id antes de ir ao prompt; fila = itens não anulados de todos os concursos, sem classificação (`'pendentes'`) ou incertos/sem classificação (`'incertos'`), em `queueOrder`; lotes de até `tamanhoLote` itens sem passar de ~6.000 tokens estimados; cada lote: candidatos → prompt → `complete(prompt, 60 × itens + 100)` → validação → propostas (`applyProposals`, `minConfianca` 0.8; assunto proposto e aceito/mapeado vale para o item com a confiança da proposta) → grava classificação dos concursos tocados e o vocabulário. Item com assunto de confiança < 0.7 → `incerto: true`. `LimiteDiario` → para, grava, `parouNoLimite: true`. Item classificado por um modelo **não** é reclassificado em `'pendentes'`; em `'incertos'` só os incertos ou sem classificação.

- [ ] **Step 1: testes** (provider falso que devolve JSON escolhendo o 1º candidato, com confiança 0.9 para itens pares e 0.5 para ímpares; acervo temporário com 2 concursos pequenos escritos por `writeConcurso`): rodada com `limite: 4` classifica 4 itens e grava os arquivos; segunda rodada continua dos que faltam (não chama o provider para os já feitos); itens 0.5 ficam `incerto`; `revisar: 'incertos'` com outro provider reclassifica só os incertos e marca o `modelo` novo; provider que lança `LimiteDiario` no 2º lote → `parouNoLimite` e o 1º lote gravado; a saída é idêntica byte a byte ao reler e regravar.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): rodada de classificação retomável com revisão dos incertos`.

### Task 7: Pacote para o app e comandos

**Files:**
- Create: `tools/minerador/pacote.ts`
- Modify: `tools/minerador/cli.ts`, `.gitignore` (`acervo/pacote/`)
- Test: `tools/minerador/__tests__/pacote.test.ts`

**Interfaces:**
- Produces: `buildPacote(acervoDir: string): Pacote` com `Pacote = { formato: 'fofolab-acervo'; versao: 1; vocabulario: Vocabulario; concursos: { identificador: string; concurso: string; ano: number; areas: string[] }[]; itens: (AcervoItem & { assuntos: AssuntoDoItem[]; incerto: boolean })[] }` (itens sem classificação entram com `assuntos: []`, para a 12c decidir); `writePacote(path: string, p: Pacote): void`.
- CLI: `npm run minerar -- semente [caminho-do-edital.pdf]` (padrão `e2e/fixtures/cgu-2026-affc-edital.pdf`; não sobrescreve vocabulário existente sem `--forcar`); `npm run minerar -- classificar [--provedor groq|deepseek] [--limite N] [--revisar incertos]` (imprime o relatório; padrão `--limite 1000`, `--provedor groq`); `npm run minerar -- pacote` (grava `acervo/pacote/fofolab-acervo-cebraspe.json`).

- [ ] **Step 1: testes** — `buildPacote` sobre o acervo temporário da Tarefa 6: `formato`, `versao`, um item classificado com `assuntos` e um sem classificação com `assuntos: []`, `concursos` com as áreas do cabeçalho.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS; `npm test`, `npm run build`.
- [ ] **Step 5:** commit `feat(minerador): pacote do acervo para o app e comandos semente/classificar/pacote`.

### Task 8: Rodada real, conferência e registro

**Files:**
- Create/Modify: `acervo/vocabulario.json`, `acervo/classificacao/*.json` (gerados)
- Modify: `BACKLOG.md`, `docs/handoff/2026-10-24-estado-e-proxima-ia.md`, `CLAUDE.md` (comandos novos)

- [ ] **Step 1:** `npm run minerar -- semente` → conferir no relatório o número de assuntos por matéria.
- [ ] **Step 2:** `npm run minerar -- classificar --limite 200` (Groq) → abrir 10 itens classificados (de matérias diferentes) e conferir à mão se o assunto faz sentido; anotar a taxa de incertos e de sem resposta.
- [ ] **Step 3:** se a amostra estiver boa, deixar `npm run minerar -- classificar --limite 100000` rodando em segundo plano (para limpo no limite diário; rodar de novo no dia seguinte continua) e commitar o que já foi classificado.
- [ ] **Step 4:** rodar `classificar` sem nada novo na fila → nenhuma chamada e `git status` limpo em `acervo/`.
- [ ] **Step 5:** BACKLOG (12b [PARCIAL] enquanto a fila não terminar, com o número classificado; revisão com DeepSeek pendente do crédito do dono), handoff, `CLAUDE.md`, `graphify update .`; commit `chore(acervo): vocabulário e primeira classificação`.
