# 12b — Assuntos canônicos do acervo (classificação com IA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dar a cada item do acervo 1 a 3 assuntos canônicos de um vocabulário vigiado (semente: o edital da CGU 2026), com confiança, em lotes retomáveis — **Gemini pelo Antigravity CLI (assinatura do dono) como provedor principal**, Groq grátis como reserva —, **conferir todos os itens com uma segunda opinião independente** de outra família de modelo (Claude/GPT-OSS pelo Antigravity agora; DeepSeek quando houver crédito), guardar a resposta de cada modelo e o consenso, e exportar o pacote que a 12c vai importar no app.

**Architecture:** Mais comandos na mesma ferramenta (`tools/minerador/`, fora do app). Vocabulário em `acervo/vocabulario.json` (com versões); classificação **separada** do acervo cru, em `acervo/classificacao/<ID>.json`, com **uma resposta por modelo** e o consenso calculado (refazer ou conferir com outro modelo não mexe nos itens nem apaga a outra opinião). Provedores de IA próprios da ferramenta: `agy` (Antigravity CLI em modo `-p`, saída presa a um esquema JSON, sem chave — login da conta Google), `groq` e `deepseek` (HTTP OpenAI-compatível, chave no `.env`). Funções puras por etapa (semente, candidatos locais, prompt, validação, propostas, consenso) e a casca de CLI que faz E/S.

**Tech Stack:** TypeScript strict, `tsx`, Vitest (`// @vitest-environment node`), `fetch` do Node 22, `pdfjs-dist` legacy + `src/lib/pdfText.ts` + `src/lib/editalParser.ts` (puros, já testados com o edital real).

**Spec:** `docs/specs/12-minerador-cebraspe.md` (§6.4 vocabulário vigiado, §6.3 passos 5–6, §6.5 só o formato do pacote, §7 entrega 12b). Ler também o plano da 12a para o formato do acervo (`acervo/cebraspe/<ID>.json`, versão 1).

## Global Constraints

- Nada em `src/` importa `tools/`; `tools/` importa só funções puras de `src/lib` (`editalParser`, `pdfText`, `questionImport.normalizeStatement`).
- Regra autoral de prompts: o texto do item é a fonte; a matéria de origem vai **como pista**, nunca como resposta; resposta **só JSON**, validada; nada inventado (assunto fora da lista só como proposta explícita).
- Chaves: `VITE_GROQ_API_KEY` / `VITE_DEEPSEEK_API_KEY` lidas de `process.env` ou de `.env.local` / `.env` (nessa ordem); **nunca** impressas nem gravadas no acervo.
- Groq grátis por modelo: **1.000 requisições/dia** e **8.000 tokens/min**; todo pedido leva `max_completion_tokens`; pedido acima de ~6.000 tokens estimados é dividido. DeepSeek: `deepseek-flash`, `thinking: { type: 'disabled' }`.
- Antigravity CLI (`%LOCALAPPDATA%\agy\bin\agy.exe`, v1.4.7, verificado em 25/10): `agy --input-format stream-json --output-format stream-json --json-schema <arquivo> --model <id> --disable-slash-commands --sandbox -p=` com o prompt pela entrada padrão (`{"event":"user","message":{"role":"user","content":…}}` — a linha de comando do Windows corta em 32 mil caracteres e um lote passa disso; a resposta vem no evento `result`), rodando numa **pasta vazia** (o texto dos itens é entrada não confiável e o agente tem ferramentas: sandbox + pasta vazia impedem que um item "mande" ele mexer no projeto). A resposta validada vem em `structured_output`; `status` diferente de `SUCCESS` é falha. Cada chamada carrega ~12 mil tokens do próprio agente → lotes de **~30 itens** (padrão), não 10. Modelo padrão da classificação: `gemini-3.8-flash-low`; conferência: `claude-sonnet-5-5-low` (outra família). `agy models` lista os disponíveis.
- Confiança: `>= 0.7` = certo; abaixo = **incerto** (selinho no app). Item sem resposta válida fica **sem classificação** e volta à fila.
- Determinismo: mesma classificação → mesmo arquivo byte a byte (ordem por id, sem data de execução); acervo em LF (`.gitattributes` já cobre `acervo/**`).
- Retomável: cada lote grava ao terminar; interromper e rodar de novo continua de onde parou, sem reclassificar o que já está certo.

## Review Focus

1. Modelo responde com assunto que não está na lista dos candidatos (ou id inventado) → o item não recebe esse assunto; se nada sobrar, fica sem classificação e volta à fila (teste na Tarefa 4).
2. Lote em que a resposta traz só parte dos itens, ou ids trocados → só os ids do lote são aceitos; os ausentes voltam à fila (teste na Tarefa 4).
3. Limite diário do Groq (429 com `retry-after` longo) no meio da rodada → para limpo, grava o que já classificou e diz "continue amanhã" (teste na Tarefa 5).
4. Proposta de assunto novo igual (ou quase) a um existente → não duplica: vira o existente (teste na Tarefa 3).
5. Conferência por outro modelo não apaga a primeira opinião e não vê a resposta dela (prompt idêntico, sem a classificação anterior); discordância vira incerto, concordância confirma (teste na Tarefa 6).

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
/** Uma opinião: o que um modelo respondeu para o item. */
export interface Opiniao { assuntos: AssuntoDoItem[]; versaoVocabulario: number }
/** `opinioes` por modelo ("agy:gemini-3.8-flash-low", "agy:claude-sonnet-5-5-low", "deepseek:deepseek-flash"…); o consenso é calculado. */
export interface ClassificacaoItem { opinioes: Record<string, Opiniao>; consenso: AssuntoDoItem[]; incerto: boolean; concordancia: 'uma-opiniao' | 'concordam' | 'discordam' }
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
- Produces: `loadKeys(env: NodeJS.ProcessEnv, files: string[]): { groq?: string; deepseek?: string }`; `createProvider(opts: { nome: 'groq' | 'deepseek'; chave: string; modelo?: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }): AiProvider`; `createAgyProvider(opts: { modelo?: string; exe?: string; workDir: string; schemaPath: string; run?: (args: string[], cwd: string) => Promise<{ stdout: string; code: number }> }): AiProvider` com `interface AiProvider { nome: string; modelo: string; tamanhoLote: number; complete(prompt: string, maxTokens: number): Promise<string> }` (`nome:modelo` é a chave da opinião; `tamanhoLote` 10 no Groq/DeepSeek, 30 no `agy`); `class LimiteDiario extends Error { retryAfterSec: number }`.

`agy`: chama `agy.exe -p <prompt> --model <modelo> --output-format json --json-schema <schemaPath> --disable-slash-commands --sandbox` com `cwd = workDir` (pasta vazia criada pela ferramenta); devolve `JSON.stringify(structured_output)`; `status !== 'SUCCESS'`, saída sem JSON ou código ≠ 0 → erro com a mensagem; mensagem com "quota"/"limit"/"exhausted" → `LimiteDiario`. As linhas "ERROR: logging before google.Init" da saída padrão de erro são ruído e são ignoradas.

Ritmo: 429 com `retry-after` ≤ 120 s → espera e tenta de novo (até 3 vezes); `retry-after` > 120 s ou cabeçalho `x-ratelimit-remaining-requests: 0` → `LimiteDiario`. Groq: `https://api.groq.com/openai/v1/chat/completions`, modelo padrão `qwen/qwen3.8-27b` (ou `MINERADOR_GROQ_MODEL`); DeepSeek: `https://api.deepseek.com/chat/completions`, `deepseek-flash`, `thinking: { type: 'disabled' }`. Sempre `response_format: {type:'json_object'}` e o teto de resposta recebido.

- [ ] **Step 1: testes** (fetch falso) — `loadKeys` lê `VITE_GROQ_API_KEY` de um arquivo `.env` temporário e o ambiente vence o arquivo; o corpo enviado ao Groq tem `max_completion_tokens` e `model`; 429 com `retry-after: 5` → `sleep(5000)` e segunda tentativa; 429 com `retry-after: 3600` → `LimiteDiario`; a chave não aparece em nenhuma mensagem de erro. `agy` (com `run` falso devolvendo a saída real registrada em 25/10: `{"status":"SUCCESS","structured_output":{…}}`): os argumentos têm `-p`, `--model`, `--json-schema`, `--sandbox` e `cwd` é a pasta de trabalho; `structured_output` volta como texto JSON; `status: "ERROR"` → erro; saída com "quota exhausted" → `LimiteDiario`.
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
- Produces: `readClassificacao(dir, id): ClassificacaoConcurso`, `writeClassificacao(dir, c: ClassificacaoConcurso): void` (determinístico); `consensus(opinioes: Record<string, Opiniao>): Pick<ClassificacaoItem, 'consenso' | 'incerto' | 'concordancia'>`; `runClassificacao(opts: { provider: AiProvider; acervoDir: string; limite: number; alvo: 'sem-opiniao' | 'todos' | 'discordantes'; k: number }): Promise<ClassifyReport>` com `ClassifyReport = { classificados: number; incertos: number; concordam: number; discordam: number; semResposta: number; propostasAceitas: string[]; propostasPendentes: number; juncoesSugeridas: [string, string][]; versaoVocabulario: number; parouNoLimite: boolean }`.

Regras: os candidatos da Tarefa 2 (`{id, score}`) viram `Assunto[]` pelo id antes de ir ao prompt; a fila (itens não anulados, em `queueOrder`) depende do alvo — `'sem-opiniao'`: itens sem nenhuma opinião (1ª classificação); `'todos'`: itens que ainda não têm opinião **deste** modelo (conferência independente: o prompt é o mesmo, nunca leva a opinião anterior); `'discordantes'`: itens com `concordancia: 'discordam'` sem opinião deste modelo (desempate). Lotes de até `provider.tamanhoLote` itens (sem passar de ~6.000 tokens estimados no Groq); cada lote: candidatos → prompt → `complete(prompt, 60 × itens + 100)` → validação → propostas (`applyProposals`, `minConfianca` 0.8; assunto proposto e aceito/mapeado vale para o item com a confiança da proposta) → grava a opinião de `nome:modelo`, recalcula o consenso e grava concursos tocados e vocabulário. `consensus`: uma opinião → `consenso` = ela, `incerto` se alguma confiança < 0.7 ou nada escolhido; duas ou mais → assuntos escolhidos pela **maioria** das opiniões (empate de 2: os que as duas escolheram), `concordam` se o assunto principal (maior confiança) de cada uma é o mesmo, senão `discordam` e `incerto: true`. `LimiteDiario` → para, grava, `parouNoLimite: true`.

- [ ] **Step 1: testes** (provider falso que devolve JSON escolhendo o 1º candidato, com confiança 0.9 para itens pares e 0.5 para ímpares; acervo temporário com 2 concursos pequenos escritos por `writeConcurso`): rodada com `limite: 4` classifica 4 itens e grava os arquivos; segunda rodada continua dos que faltam (não chama o provider para os já feitos); itens 0.5 ficam `incerto`; conferência `alvo: 'todos'` com outro provider (que escolhe o 2º candidato num item) mantém as duas opiniões, marca esse item `discordam`/`incerto` e os demais `concordam`, e o prompt enviado ao 2º provider não contém ids escolhidos pelo 1º além da lista de candidatos; `alvo: 'discordantes'` com um 3º provider só chama para o item discordante; provider que lança `LimiteDiario` no 2º lote → `parouNoLimite` e o 1º lote gravado; a saída é idêntica byte a byte ao reler e regravar.
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
- Produces: `buildPacote(acervoDir: string): Pacote` com `Pacote = { formato: 'fofolab-acervo'; versao: 1; vocabulario: Vocabulario; concursos: { identificador: string; concurso: string; ano: number; areas: string[] }[]; itens: (AcervoItem & { assuntos: AssuntoDoItem[]; incerto: boolean; concordancia: ClassificacaoItem['concordancia'] | 'sem-classificacao' })[] }` (o pacote leva só o **consenso**, não as opiniões; itens sem classificação entram com `assuntos: []`, para a 12c decidir); `writePacote(path: string, p: Pacote): void`.
- CLI: `npm run minerar -- semente [caminho-do-edital.pdf]` (padrão `e2e/fixtures/cgu-2026-affc-edital.pdf`; não sobrescreve vocabulário existente sem `--forcar`); `npm run minerar -- classificar [--provedor agy|groq|deepseek] [--modelo id] [--limite N]` (1ª opinião; padrão `--provedor agy --modelo gemini-3.8-flash-low --limite 1000`); `npm run minerar -- conferir [--provedor …] [--modelo …]` (opinião independente de outro modelo em todos os itens; padrão `agy` + `claude-sonnet-5-5-low`); `npm run minerar -- desempatar [--provedor …] [--modelo …]` (só os discordantes); `npm run minerar -- pacote` (grava `acervo/pacote/fofolab-acervo-cebraspe.json`).

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
- [ ] **Step 2:** `npm run minerar -- classificar --limite 200` (`agy` + Gemini 3.8 Flash) → abrir 10 itens classificados (de matérias diferentes) e conferir à mão se o assunto faz sentido; anotar tempo por lote, taxa de incertos e de sem resposta.
- [ ] **Step 3:** `npm run minerar -- conferir --limite 200` (Claude Sonnet pelo `agy`) sobre a mesma amostra → anotar a taxa de concordância; olhar 5 discordantes à mão (quem está certo?).
- [ ] **Step 4:** se a amostra estiver boa, deixar `classificar` e depois `conferir` rodando em segundo plano até a fila acabar (param limpo no limite da cota; rodar de novo continua) e commitar o que já foi classificado; rodar `classificar` sem nada novo na fila → nenhuma chamada e `git status` limpo em `acervo/`.
- [ ] **Step 5:** BACKLOG (12b [PARCIAL] enquanto as filas não terminarem, com números; DeepSeek como 3ª opinião/desempate quando houver crédito), handoff, `CLAUDE.md`, `graphify update .`; commit `chore(acervo): vocabulário e primeira classificação`.
