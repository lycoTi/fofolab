# 12a — Minerador da Cebraspe até o acervo cru — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma ferramenta de linha de comando que descobre os concursos da Cebraspe, baixa provas objetivas e gabaritos definitivos com cache e ritmo lento, extrai cada item (Certo/Errado e múltipla escolha) com texto-base e gabarito, e grava o acervo no git — sem IA.

**Architecture:** Pasta `tools/minerador/` no mesmo repositório, em TypeScript, rodada com `tsx` (`npm run minerar -- …`), nunca importada por `src/`. Funções puras por etapa (API → seleção de arquivos → linhas do PDF → segmentação → gabarito → montagem) e uma casca fina de CLI que faz E/S. O acervo é um JSON estável por concurso em `acervo/cebraspe/`; os PDFs ficam num cache local fora do git.

**Tech Stack:** TypeScript strict, `pdfjs-dist` (legacy build, já instalado), `tsx` (novo, só desenvolvimento), Vitest com ambiente `node`, `fetch` do Node 22.

**Spec:** `docs/specs/12-minerador-cebraspe.md` (entrega 12a, §6.1–6.3 e §8). Leia a spec inteira antes da primeira tarefa — §4 tem o formato real da API e dos PDFs.

## Global Constraints

- Nada em `src/` importa `tools/`; `tools/` pode importar funções puras de `src/lib` (`normalizeStatement` de `src/lib/questionImport.ts`).
- TS strict, sem ternário aninhado, comentários em pt-BR explicando o porquê, guard clauses.
- Ritmo: **uma requisição por vez**, pausa mínima de **1.000 ms** entre requisições à Cebraspe; `User-Agent: FofoLab-minerador (estudo pessoal; github.com/lycoTi)`.
- Cache: arquivo já baixado (mesmo nome e mesmo tamanho informado pelo servidor, ou já presente quando o servidor não informa) nunca é pedido de novo. Pasta `.minerador-cache/` (no `.gitignore`).
- Só entram arquivos cuja descrição contém `PROVA OBJETIVA` **sem** `GABARITO`, e `GABARITO DEFINITIVO`; preferir `ATUALIZADO`; ignorar `SEM EFEITO`, preliminar, discursiva ("Conhecimentos Aplicados", "DISCURSIVA") e arquivo único "PROVA OBJETIVA E GABARITO".
- Lote inicial: concursos encerrados com `eventoAno >= 2021`.
- Endpoints: lista `https://apis.cebraspe.org.br/cebraspe/eventos/tipo/concursos/fase/encerrado` (resposta `[{ faseEvento, ordem, eventos: [...] }]`); detalhe `https://apis.cebraspe.org.br/cebraspe/eventos/{identificador}`; arquivo `https://cdn.cebraspe.org.br/{eventoTipo}/{identificador}/arquivos/{nomeArquivo}`.
- Acervo determinístico: mesma entrada → mesmo arquivo byte a byte (ordem estável, sem data de execução dentro dos itens), para o diff do git só mostrar mudança real.
- Prova com contagem de itens ≠ contagem de respostas do gabarito → **quarentena** inteira com motivo; nada dela entra no acervo.
- Formato da API inesperado → erro `FormatoCebraspeMudou` com o campo que faltou; a rodada para sem gravar nada daquele passo.

## Review Focus

1. Linha de texto do item que começa com número (ex.: "2023 foi o ano…", "10 anos depois") não pode abrir item novo — só o **próximo número esperado** na margem abre item (teste na Tarefa 5).
2. Rodar duas vezes seguidas: a segunda não baixa nada e o acervo sai idêntico (teste na Tarefa 9).
3. Falha de rede ou 5xx num caderno não derruba o lote: ele vai para `falhas` no relatório e a rodada segue (na próxima rodada é tentado de novo); já formato inesperado da API para tudo (teste na Tarefa 2 e na Tarefa 9).
4. Concurso só com gabarito preliminar (definitivo ainda não saiu) fica "pendente", não em quarentena (teste na Tarefa 3).
5. Caderno que começa no item 51 (específicos) e gabarito com posições `0`: as posições vazias não contam como itens faltando (teste na Tarefa 7).

---

## Estrutura de arquivos

```
tools/minerador/
  cli.ts                  casca: lê argumentos, chama `runMinerador`, imprime o relatório
  types.ts                tipos compartilhados (abaixo)
  cebraspeApi.ts          validação/parse da lista e do detalhe; urls
  politeClient.ts         fetch com pausa, User-Agent, cache em disco
  examFiles.ts            escolhe e pareia prova ↔ gabarito definitivo
  pdfLines.ts             PDF → linhas (colunas, espaços, sem cabeçalho/rodapé)
  segmentTrueFalse.ts     linhas → itens Certo/Errado com texto-base
  segmentMultipleChoice.ts linhas → questões A–E com texto-base
  answerKey.ts            linhas do gabarito → número → resposta
  assembleExam.ts         itens + gabarito → itens do acervo ou quarentena; código/figura
  acervoStore.ts          lê/grava acervo/cebraspe/<ID>.json, deduplica, lote.json
  runMinerador.ts         orquestra uma rodada (injeta o cliente; testável sem rede)
  report.ts               relatório em texto
  __fixtures__/           JSON reais recortados + 4 PDFs reais (abaixo)
  __tests__/*.test.ts     um arquivo por módulo
acervo/cebraspe/          um JSON por concurso (no git)
acervo/lote.json          lista editável de identificadores do lote (no git)
acervo/quarentena.json    provas recusadas com motivo (no git)
```

Fixtures (baixar uma vez com o próprio `politeClient` ou `curl`, e versionar):
`846_SERPRO_23_001_01.PDF` + `GAB_DEFINITIVO_846_SERPRO_23_001_01.PDF` (`SERPRO_23`, C/E, itens 51–120) e
`860_PMSC_OFICIAL_OBJ_001_01.PDF` + `GAB_DEFINITIVO_860_PMSC_OFICIAL_OBJ_001_01.PDF` (`PM_SC_23_OFICIAL`, A–E, questões 1–80).
JSON: `eventos-encerrado.json` (recorte com ~5 eventos da resposta real, mantendo o embrulho `[{faseEvento,ordem,eventos}]`), `evento-SERPRO_23.json` e `evento-PM_SC_23_OFICIAL.json` (respostas reais completas).

## Tipos (`tools/minerador/types.ts`)

```ts
export interface CebraspeEvent { identificador: string; nome: string; ano: number; tipo: string; status: string }
export interface CebraspeFile { descricao: string; nomeArquivo: string; data: string }
export interface CebraspeEventDetail extends CebraspeEvent { areas: string[]; arquivos: CebraspeFile[] }
export interface ExamPair { prova: CebraspeFile; gabarito: CebraspeFile; caderno: string }
export interface PdfLine { page: number; column: 'L' | 'R'; x: number; y: number; text: string; atMargin: boolean }
export type ItemFormat = 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA';
export interface ExtractedItem { numero: number; formato: ItemFormat; textoBase: string | null; enunciado: string; alternativas: string[] | null; materiaOrigem: string | null }
export type AnswerMark = 'C' | 'E' | 'A' | 'B' | 'D' | 'X'; // 'E' serve aos dois formatos; 'X' = anulado
export interface Procedencia { banca: 'Cebraspe'; identificador: string; concurso: string; ano: number; areas: string[]; prova: string; caderno: string; numero: number }
export interface AcervoItem {
  id: string;                    // `${identificador}:${caderno}:${numero}`
  formato: ItemFormat;
  textoBase: string | null;
  enunciado: string;
  alternativas: string[] | null; // ["A) …", …] na múltipla escolha
  gabarito: Exclude<AnswerMark, 'X'> | null;
  anulado: boolean;
  materiaOrigem: string | null;  // pista, nunca verdade (spec 12 §1)
  temCodigo: boolean;
  dependeDeFigura: boolean;
  procedencias: Procedencia[];   // item reaplicado acumula procedências
}
export type ExamOutcome = { kind: 'ok'; itens: AcervoItem[] } | { kind: 'quarentena'; motivo: string };
```

---

### Task 1: Base da ferramenta + leitura da API

**Files:**
- Modify: `package.json` (devDependency `tsx` `^4.20.0`; script `"minerar": "tsx tools/minerador/cli.ts"`), `tsconfig.json` (`"include": ["src", "tools"]`), `.gitignore` (`.minerador-cache/`)
- Create: `tools/minerador/types.ts`, `tools/minerador/cebraspeApi.ts`, `tools/minerador/__fixtures__/eventos-encerrado.json`, `evento-SERPRO_23.json`, `evento-PM_SC_23_OFICIAL.json`
- Test: `tools/minerador/__tests__/cebraspeApi.test.ts` (primeira linha: `// @vitest-environment node`, como todo teste de `tools/`)

**Interfaces:**
- Produces: `class FormatoCebraspeMudou extends Error { campo: string }`; `parseEventList(json: unknown): CebraspeEvent[]`; `parseEventDetail(json: unknown): CebraspeEventDetail`; `eventListUrl(): string`; `eventDetailUrl(id: string): string`; `fileUrl(tipo: string, id: string, nomeArquivo: string): string`.

- [ ] **Step 1: testes** — `parseEventList(fixture)` devolve os eventos achatados de todos os grupos, com `identificador = eventoURL`, `ano = eventoAno`, `nome = eventoNomeAbreviado` (trim); `parseEventDetail(evento-SERPRO_23)` tem `areas` contendo `'ANALISTA – ESPECIALIZAÇÃO: TECNOLOGIA'` e um arquivo com `nomeArquivo === '846_SERPRO_23_001_01.PDF'` (vindo de `arquivosGabarito` + `arquivosEdital` juntos); `parseEventList({})` e um evento sem `eventoURL` lançam `FormatoCebraspeMudou` com `campo` igual a `'eventos'` e `'eventoURL'`; `fileUrl('concursos','SERPRO_23','846_SERPRO_23_001_01.PDF')` é a URL do CDN da Global Constraints.
- [ ] **Step 2:** `npm install` e `npx vitest run tools/minerador/__tests__/cebraspeApi.test.ts` → FAIL (módulo não existe).
- [ ] **Step 3:** implementar `cebraspeApi.ts` (validação manual de cada campo usado, sem biblioteca).
- [ ] **Step 4:** rodar → PASS; `npx tsc -b` sem erro.
- [ ] **Step 5:** commit `feat(minerador): base da ferramenta e leitura da API da Cebraspe`.

### Task 2: Cliente educado com cache

**Files:**
- Create: `tools/minerador/politeClient.ts`
- Test: `tools/minerador/__tests__/politeClient.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces: `interface PoliteClient { getJson(url: string): Promise<unknown>; download(url: string, cachePath: string): Promise<{ path: string; fromCache: boolean }> }`; `createPoliteClient(opts: { delayMs: number; userAgent: string; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> }): PoliteClient`; `class FalhaDeRede extends Error { url: string; status: number | null }`.

- [ ] **Step 1: testes** (com `fetchImpl` e `sleep` falsos, pasta temporária): duas chamadas seguidas → `sleep` chamado com `1000` antes da segunda; o `User-Agent` vai no cabeçalho; `download` grava o arquivo e a segunda chamada com o mesmo `cachePath` devolve `fromCache: true` **sem** chamar `fetchImpl`; resposta 503 ou exceção do `fetch` → `FalhaDeRede` com o status (ou `null`); `getJson` de corpo que não é JSON → `FalhaDeRede`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar (cria as pastas do `cachePath`; grava em arquivo temporário e renomeia, para um download interrompido não virar cache corrompido).
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): cliente com pausa, identificação e cache`.

### Task 3: Escolha e pareamento dos arquivos

**Files:**
- Create: `tools/minerador/examFiles.ts`
- Test: `tools/minerador/__tests__/examFiles.test.ts`

**Interfaces:**
- Consumes: `CebraspeEventDetail`.
- Produces: `selectExamPairs(detail: CebraspeEventDetail): { pares: ExamPair[]; pendentes: string[]; ignorados: string[]; justificativas: CebraspeFile[] }` (`justificativas`: arquivos "Justificativas de alterações de gabarito", só baixados para o cache, como referência) — `caderno` = `nomeArquivo` sem extensão e sem o prefixo `GAB_DEFINITIVO_` (comparação sem diferenciar maiúsculas).

- [ ] **Step 1: testes** — SERPRO_23 → 2 pares (`846_SERPRO_23_001_01` e o de conhecimentos básicos), discursiva em `ignorados`; detalhe sintético com `GABARITO DEFINITIVO … (P1)` + `… (P1) - ATUALIZADO` + `… (P1) - SEM EFEITO` → o par usa o `ATUALIZADO`; descrição `GABARITO DEFINITIVO - PROVA OBJETIVA` nunca é tomada como prova; prova sem definitivo (só `GABARITO PRELIMINAR`) → caderno em `pendentes`; `PROVA OBJETIVA E GABARITO DEFINITIVO` → `ignorados`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): escolhe prova e gabarito definitivo de cada caderno`.

### Task 4: Linhas do PDF

**Files:**
- Create: `tools/minerador/pdfLines.ts`, `tools/minerador/__fixtures__/` (os 4 PDFs)
- Test: `tools/minerador/__tests__/pdfLines.test.ts`

**Interfaces:**
- Produces: `readPdfLines(data: Uint8Array): Promise<PdfLine[]>` — ordem de leitura (página, coluna `L` antes de `R`, `y` decrescente), cabeçalho/rodapé repetidos removidos, `atMargin` = `x` a no máximo 3 unidades da menor `x` da coluna naquela página.

Abordagem: `pdfjs-dist/legacy/build/pdf.mjs` com `verbosity: 0`; itens com o mesmo `y` (±2) e mesma coluna (`x < largura da página / 2` → `L`) formam uma linha; entre dois itens da mesma linha, inserir espaço quando o intervalo `x_seguinte − (x_anterior + width_anterior)` passar de 1 unidade e nenhum dos dois já tiver espaço na borda (as linhas justificadas da Cebraspe vêm sem espaços). Cabeçalho/rodapé: texto que se repete idêntico em ≥ 60% das páginas (ex.: `84600101344553 CEBRASPE – SERPRO – Edital: 2023`) sai; linhas só com números de página também.

- [ ] **Step 1: testes** (SERPRO P3): existe uma linha com texto começando por `51 A integridade é uma propriedade que visa aplicar` e `atMargin: true`; a linha seguinte começa por `conhecimentos e habilidades para garantir a assinatura` com `atMargin: false`; nenhuma linha contém `CEBRASPE – SERPRO – Edital`; a linha `Com base na NBR ISO/IEC 27000, julgue os próximos itens, a` vem antes da linha do item 51.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): linhas do PDF em ordem de leitura e com espaços`.

### Task 5: Itens Certo/Errado com texto-base

**Files:**
- Create: `tools/minerador/segmentTrueFalse.ts`
- Test: `tools/minerador/__tests__/segmentTrueFalse.test.ts`

**Interfaces:**
- Consumes: `PdfLine[]` (Task 4).
- Produces: `segmentTrueFalse(lines: PdfLine[]): ExtractedItem[]`.

Regra (não está na assinatura): percorre as linhas; linha `-- X --` define `materiaOrigem = X`. Uma linha **na margem** que começa pelo **próximo número esperado** (o primeiro número encontrado; depois, o anterior + 1), colado ou não ao texto (`51A integridade`), abre um item. Linha recuada continua o item atual. Linha na margem que **não** abre item faz parte de um texto-base: um bloco de linhas assim, encontrado depois de um item, **substitui** o texto-base vigente, que vale para os itens seguintes. O primeiro item da prova pode não ter texto-base (`null`).

- [ ] **Step 1: testes** (SERPRO P3): 70 itens, números 51 a 120 em sequência; item 51 com `textoBase` contendo `Com base na NBR ISO/IEC 27000, julgue os próximos itens` e `enunciado` começando por `A integridade é uma propriedade`; item 52 com o mesmo texto-base; item 53 com texto-base contendo `controle de acesso`; item 72 tem o código Python no `enunciado` (`PI = 3.14159` e `print(`) e o item 73 começa por `Para permitir a integração entre os frameworks React e`; `materiaOrigem` do item 51 = `CONHECIMENTOS ESPECÍFICOS`. Teste sintético (Review Focus 1): linhas `[{margem:'10 O prazo…'}, {recuada:'de 2023 foi…'}, {margem:'2023 foi o ano'}]` com esperado 10 → `2023 foi o ano` entra como texto-base, não como item 2023.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): itens Certo/Errado com o texto-base de cada um`.

### Task 6: Questões de múltipla escolha

**Files:**
- Create: `tools/minerador/segmentMultipleChoice.ts`
- Test: `tools/minerador/__tests__/segmentMultipleChoice.test.ts`

**Interfaces:**
- Consumes: `PdfLine[]`.
- Produces: `segmentMultipleChoice(lines: PdfLine[]): ExtractedItem[]` (`alternativas` como `['A) …', 'B) …', …]`).

Regra: `Questão N` abre a questão N. Depois dela, a linha que começa com a **próxima letra esperada** seguida de espaço (`A `, depois `B `…) abre a alternativa; as demais linhas continuam o enunciado (antes de `A`) ou a alternativa atual. Linha só em maiúsculas sem número (ex.: `DIREITO CONSTITUCIONAL`) define `materiaOrigem`. Linhas entre a última alternativa de uma questão e o próximo `Questão N` formam o texto-base das questões seguintes (troca quando aparece um novo bloco).

- [ ] **Step 1: testes** (PM SC): 80 questões, 1 a 80; questão 1 com enunciado `No que se refere à segurança pública, é correto afirmar que às polícias`, 5 alternativas, a A = `A) militares competem as funções de polícia judiciária da União.` e a B terminando em `de infrações penais comuns e militares.`; `materiaOrigem` da questão 1 = `DIREITO CONSTITUCIONAL`; na questão 3, a alternativa A começa por `A) Lei que tipifica` e a B por `B) A prática de racismo` (a palavra "A" no começo do texto não abre alternativa nova).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): questões de múltipla escolha`.

### Task 7: Gabarito definitivo

**Files:**
- Create: `tools/minerador/answerKey.ts`
- Test: `tools/minerador/__tests__/answerKey.test.ts`

**Interfaces:**
- Consumes: `PdfLine[]`.
- Produces: `parseAnswerKey(lines: PdfLine[]): Map<number, AnswerMark>`.

Regra: uma linha só de inteiros crescentes seguida de uma linha com o mesmo número de símbolos em `C E A B D X 0` forma pares número → símbolo; `0` (posição vazia) e número `0` não entram.

- [ ] **Step 1: testes** — SERPRO: 70 entradas (51–120), `get(51) === 'E'`, `get(60) === 'X'`, `get(66) === 'X'`, `get(120) === 'C'`, `has(0) === false`; PM SC: 80 entradas, `get(1) === 'D'`, `get(16) === 'X'`, `get(80) === 'E'`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): leitura do gabarito definitivo com anulados`.

### Task 8: Montagem da prova, quarentena, código e figura

**Files:**
- Create: `tools/minerador/assembleExam.ts`
- Test: `tools/minerador/__tests__/assembleExam.test.ts`

**Interfaces:**
- Consumes: `ExtractedItem[]`, `Map<number, AnswerMark>`, `Procedencia` sem `numero` (Tasks 5–7).
- Produces: `assembleExam(items: ExtractedItem[], key: Map<number, AnswerMark>, origem: Omit<Procedencia, 'numero'>): ExamOutcome`; `detectCode(text: string): { temCodigo: boolean; texto: string }`; `dependsOnFigure(text: string): boolean`.

Regras: conjuntos de números de itens e do gabarito precisam ser **iguais**; senão `quarentena` com motivo `"itens sem resposta: 61, 62"` / `"respostas sem item: 121"`. `X` → `anulado: true`, `gabarito: null`. Resposta incompatível com o formato (`A` num item C/E) → quarentena. `detectCode`: 2+ linhas seguidas com cara de código (`=`, `(`/`)` com `:` ou `;`, `{`/`}`, `def `, `print(`, `return`) viram um bloco cercado por ```` ``` ````, com aspas tipográficas trocadas por retas só dentro do bloco. `dependsOnFigure`: menciona `figura`, `imagem`, `gráfico` ou `ilustração` (sem acento também).

- [ ] **Step 1: testes** — SERPRO completo (fixtures + Tasks 4,5,7) → `ok` com 70 itens, item 60 `anulado`, item 72 `temCodigo` com ```` ``` ```` e `"Digite o raio do círculo:` com aspas retas, `id === 'SERPRO_23:846_SERPRO_23_001_01:51'`; PM SC → `ok` com 80 itens; tirar a resposta 61 do mapa → `quarentena` com `itens sem resposta: 61`; `dependsOnFigure('Na figura a seguir…') === true`.
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS.
- [ ] **Step 5:** commit `feat(minerador): monta a prova com gabarito, quarentena, código e figura`.

### Task 9: Acervo, lote, relatório e a rodada completa

**Files:**
- Create: `tools/minerador/acervoStore.ts`, `tools/minerador/runMinerador.ts`, `tools/minerador/report.ts`, `tools/minerador/cli.ts`
- Test: `tools/minerador/__tests__/acervoStore.test.ts`, `tools/minerador/__tests__/runMinerador.test.ts`

**Interfaces:**
- Consumes: tudo acima; `normalizeStatement` de `src/lib/questionImport.ts`.
- Produces:
  - `buildLote(events: CebraspeEvent[], opts: { anoMinimo: number; palavras: string[] }): string[]` — identificadores com `ano >= anoMinimo` e nome que casa alguma palavra (sem acento, sem caixa); `LOTE_PALAVRAS_PADRAO` com: `TI`, `TECNOLOGIA`, `SISTEMAS`, `DADOS`, `INFORMATICA`, `SERPRO`, `DATAPREV`, `AUDITOR`, `CONTROLE`, `TCU`, `TCE`, `TCM`, `CGU`, `CGE`, `MPU`, `STJ`, `STF`, `TST`, `TSE`, `BACEN`, `BANCO CENTRAL`, `ANALISTA`.
  - `writeConcurso(dir: string, identificador: string, itens: AcervoItem[]): void` — JSON com 2 espaços, itens ordenados por `id`, chaves em ordem fixa, `\n` no fim.
  - `mergeDuplicates(itens: AcervoItem[]): AcervoItem[]` — mesmo `normalizeStatement(textoBase + ' ' + enunciado + ' ' + alternativas)` vira um item só, juntando `procedencias` (fica o `id` menor).
  - `runMinerador(opts: { client: PoliteClient; acervoDir: string; cacheDir: string; lote: string[] }): Promise<RunReport>` com `RunReport = { concursos: number; provas: number; itens: number; anulados: number; comCodigo: number; comFigura: number; quarentena: { caderno: string; motivo: string }[]; pendentes: string[]; falhas: { identificador: string; erro: string }[]; baixados: number; doCache: number }`.
  - `formatReport(r: RunReport): string` (pt-BR, uma linha por número e uma por quarentena/falha).
  - `cli.ts`: `npm run minerar -- lote` (grava `acervo/lote.json` a partir da lista e de `LOTE_PALAVRAS_PADRAO`, com `anoMinimo: 2021`) e `npm run minerar -- rodar` (lê `acervo/lote.json`, roda, grava `acervo/quarentena.json`, imprime o relatório).

- [ ] **Step 1: testes** — `buildLote` com 3 eventos sintéticos (`SERPRO 23`/2023 entra, `PM SC 23 OFICIAL`/2023 sai, `TCE PB 19 AUDITOR`/2019 sai); `mergeDuplicates` junta dois itens iguais com procedências diferentes; `runMinerador` com um `PoliteClient` falso servindo as fixtures (lista, detalhe do SERPRO_23 e os 2 PDFs dele; o caderno de básicos responde `FalhaDeRede` 503) → relatório com `itens: 70`, `anulados: 9` (os `X` da grade: 60, 66, 67, 72, 89, 91, 93, 106, 107), o caderno de básicos em `falhas` com o status 503 (a rodada não para), e o arquivo `acervo/cebraspe/SERPRO_23.json` criado; **rodar de novo** com o mesmo cliente → `baixados: 0` e o arquivo idêntico byte a byte (Review Focus 2); detalhe com campo faltando → `runMinerador` rejeita com `FormatoCebraspeMudou` e nenhum arquivo é escrito (Review Focus 3).
- [ ] **Step 2:** rodar → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** rodar → PASS; `npm test` inteiro verde; `npm run build` verde.
- [ ] **Step 5:** commit `feat(minerador): acervo no git, lote, relatório e a rodada completa`.

### Task 10: Rodada real e registro

**Files:**
- Create: `acervo/lote.json`, `acervo/cebraspe/*.json`, `acervo/quarentena.json` (gerados)
- Modify: `BACKLOG.md`, `docs/handoff/2026-10-24-estado-e-proxima-ia.md`, `CLAUDE.md` (mapa rápido: `tools/minerador/` e `acervo/`)

- [ ] **Step 1:** `npm run minerar -- lote` → conferir com o dono a lista em `acervo/lote.json` (ele corta ou acrescenta identificadores à mão).
- [ ] **Step 2:** `npm run minerar -- rodar` com o lote aprovado → relatório; abrir 3 itens aleatórios de 3 concursos e conferir à mão contra o PDF (enunciado, texto-base, gabarito, anulado).
- [ ] **Step 3:** para cada prova em quarentena, anotar o motivo no BACKLOG (é o insumo de ajuste da extração; não corrigir à mão o acervo).
- [ ] **Step 4:** rodar `npm run minerar -- rodar` de novo → `baixados: 0` e `git status` sem mudança em `acervo/`.
- [ ] **Step 5:** atualizar BACKLOG (12a [DONE] só se os passos 2 e 4 passaram; senão [PARCIAL] com as limitações), handoff e `CLAUDE.md`; `graphify update .`; commit `chore(acervo): primeira rodada do minerador da Cebraspe`.
