# 12c — Acervo da Cebraspe no app Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O estudante importa o pacote do minerador e, em cada tópico do plano, vê, responde e diagnostica as questões da Cebraspe classificadas naquele assunto, sem pesar o banco dele. Reimportar um pacote mais novo não mexe nas tentativas.

**Architecture:** O pacote vira um banco sql.js **à parte e só de leitura** (`src/lib/acervo/`), guardado fora do banco do estudante e das cópias de segurança, e aberto sob demanda. O banco do estudante (migração v12) guarda só o que é dele: as ligações tópico ↔ assunto, os itens tirados de um tópico e a cópia de cada item **no primeiro uso que grava algo**. Uma função pura monta a lista do tópico (questões próprias + itens ligados) e substitui o recuo automático para o grupo e a matéria da 9b. A UI fica em `src/features/acervo/` e `src/features/questions/`. O `App.tsx` só troca o efeito das questões por um hook e chama a cópia antes de gravar.

**Tech Stack:** React 19 + TypeScript strict, sql.js, Vitest (+ `fake-indexeddb`), Playwright (Edge), Tailwind 3.4.

**Spec:** `docs/specs/12c-acervo-no-app.md` (aprovada em 27/10/2026). Formato do pacote: `tools/minerador/pacote.ts` (`Pacote`) e `tools/minerador/vocab.ts` (`Vocabulario`, `assuntoId`, `cleanSubjectName`, `seedFromEdital`).

## Global Constraints
- **Nada em `src/` importa `tools/`.** Regras do minerador que o app precisa, como a normalização de nome, o `cleanSubjectName` e as palavras-chave, são copiadas para `src/lib/acervo/` com um comentário apontando a origem, e um teste as confere contra o `acervo/vocabulario.json` real.
- Textos em pt-BR, sem jargão (`ui-clean-design-and-tdd.md`; nada de "SQLite", "JSON", "banco", "cache" na tela), sem emoji (`noEmojiInUi.test.ts`), sem ternário aninhado, componentes até ~250 linhas.
- **Rótulos exatos:**
  - "Acervo da Cebraspe (pacote do minerador)"
  - "Ainda não há questões classificadas neste tópico."
  - "Ver as do grupo ‹código›"
  - "Do acervo: ‹caminho sem a matéria, unido por ' › '›"
  - "Desligar este assunto"
  - "Não é deste tópico"
  - "Anulada pela banca"
  - "Classificação incerta"
  - procedência no formato "Cebraspe · ANATEL 2024 · item 40"
- Pacote: `formato === 'fofolab-acervo'`, `versao === 1`, no máximo **80 MB** (`MAX_PACOTE_BYTES`).
- No acervo entram **só os itens com ao menos um assunto**. Ficam fora da lista os itens `dependeDeFigura` e os `temSimboloIlegivel`, que entram só na conta do resumo.
- **Ligação nunca a um assunto raiz** (caminho de 1 nível = a matéria inteira). **Por nome, nunca a um assunto de outra matéria.** Pela IA:
  - até 15 candidatos;
  - aceita só os ids da lista, com confiança **≥ 0,7**;
  - no máximo 3 assuntos por tópico;
  - `[]` quer dizer "nenhum serve".
- **Sem IA configurada:** só a ligação por nome. Nunca grava ligação simulada.
- **Item incerto pesa 0,5** no domínio (`UNCERTAIN_ITEM_WEIGHT`).
- **Item anulado:** só leitura e fora do domínio.
- **O que muda depois de responder vale "dali em diante".** A exceção é o gabarito trocado, que apaga a `ai_dissections` daquela questão.
- **O acervo nunca entra nas cópias de segurança** e nunca é regravado fora da importação.
- **Dados do estudante:** a reimportação que vai mudar uma questão já usada (gabarito, anulação ou incerto; o gabarito trocado apaga a explicação) chama antes `createSafetyBackup('antes-de-atualizar-acervo')`. Não pede confirmação: importar já é o pedido explícito, e a spec §5.2 decidiu a atualização automática. "Desligar este assunto" e "Não é deste tópico" não apagam tentativa nenhuma e são desfazíveis ou não destrutivos, então não pedem cópia.

## Review Focus
1. **Outro PC ou backup restaurado sem o acervo** (o dono alterna o PC de casa e o do trabalho): o tópico com ligação mostra as questões próprias e a linha "O acervo da Cebraspe não está neste computador. Importe o pacote de novo em "Importar Questões"." Nada de erro nem de lista muda sem explicação. Teste na Task 8 (`acervoMissing`) e na Task 10.
2. **IA com limite (429) ou fora do ar no meio da ligação:** as ligações já feitas ficam gravadas e o resto conta como "sem ligação", para ser tentado na próxima importação. Teste na Task 7.
3. **Pacote mais antigo que o acervo do computador** (`vocabulario.versao` menor): é recusado com mensagem clara, e o acervo atual e as ligações ficam intactos. Teste na Task 7.
4. **O mesmo item em dois planos ou em duas matérias:** cada matéria tem a sua cópia, e apagar um plano não leva as tentativas do outro, porque `questions.subject_id` apaga em cascata. Teste na Task 6.
5. **Duplo clique ao responder um item do acervo, ou tópico apagado depois de ligado:** a cópia é uma só (`INSERT OR IGNORE` pelo id fixo), e as ligações e exclusões do tópico somem em cascata. Teste na Task 6.

---

### Task 1: Migração v12 + contrato SQL + tipos

**Files:**
- Modify: `docs/specs/01-database-schema.sql`, `src/lib/migrations.ts` (v12, `LATEST_SCHEMA_VERSION = 12`), `src/types/database.ts` (`Question`)
- Test: `src/__tests__/migrations.test.ts`

**Interfaces:**
- Produces (SQL, iguais no contrato e na migração idempotente):
  - `questions` ganha `acervo_item_id TEXT`, `source_label TEXT`, `acervo_uncertain INTEGER NOT NULL DEFAULT 0` + `CREATE UNIQUE INDEX IF NOT EXISTS idx_questions_acervo_item ON questions(subject_id, acervo_item_id) WHERE acervo_item_id IS NOT NULL`. **(decisão do plano: único por matéria, não global — §Review Focus 4.)**
  - `acervo_links(topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE, assunto_id TEXT NOT NULL, origin TEXT NOT NULL /* 'NAME' | 'AI' */, vocab_version INTEGER NOT NULL, disabled INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (topic_id, assunto_id))`.
  - `acervo_exclusions(topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE, acervo_item_id TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (topic_id, acervo_item_id))`.
  - `Question` ganha `acervo_item_id?: string | null; source_label?: string | null; acervo_uncertain?: number` (opcionais: os literais de teste e do exemplo inicial continuam válidos).

- [ ] **Step 1: Testes que falham:**
  - "a v12 cria as ligações e as colunas do acervo num banco v11 com questões, sem perder nada";
  - "a v12 não quebra um banco que já tem as colunas" (idempotente, como a v9–v11);
  - o teste existente "contrato SQL × v1 + migrações" passa a cobrir a v12 sozinho.
- [ ] **Step 2:** `npx vitest run src/__tests__/migrations.test.ts` → FAIL.
- [ ] **Step 3:** implementar a v12 (checa `PRAGMA table_info` antes de cada `ALTER`) e o contrato.
- [ ] **Step 4:** PASS. Rodar `npx vitest run` inteiro e confirmar que só os testes que fixam `LATEST_SCHEMA_VERSION = 11` mudaram.
- [ ] **Step 5: Commit** `feat(acervo): migração v12 com ligações tópico ↔ assunto e cópia de itens`

### Task 2: Ler e validar o pacote (puro)

**Files:**
- Create: `src/lib/acervo/pacote.ts`
- Test: `src/__tests__/acervoPacote.test.ts` (+ fixture `src/__tests__/fixtures/acervo-mini.json`, escrita à mão, sem texto de prova)

**Interfaces:**
- Produces:
  - `MAX_PACOTE_BYTES = 80 * 1024 * 1024`.
  - `interface PacoteAssunto { id: string; caminho: string[]; sinonimos: string[] }`.
  - `interface PacoteProcedencia { banca: string; concurso: string; ano: number; numero: number }`.
  - `interface PacoteItem { id: string; formato: 'CERTO_ERRADO' | 'MULTIPLA_ESCOLHA'; textoBase: string | null; enunciado: string; alternativas: string[] | null; gabarito: string; anulado: boolean; dependeDeFigura: boolean; temSimboloIlegivel: boolean; procedencias: PacoteProcedencia[]; assuntos: { id: string; confianca: number }[]; incerto: boolean }`.
  - `interface PacoteValido { vocabVersion: number; assuntos: PacoteAssunto[]; itens: PacoteItem[]; invalidItems: number }`.
  - `parsePacote(text: string): { ok: true; pacote: PacoteValido } | { ok: false; message: string }`. Mensagens:
    - "Este arquivo não é um pacote do acervo." (JSON ilegível, `formato` errado ou sem `vocabulario`);
    - "Este pacote é de uma versão mais nova do FofoLab." (`versao !== 1`);
    - "O arquivo passa de 80 MB." (`text.length > MAX_PACOTE_BYTES`).
    Item com campo faltando ou de tipo errado é contado em `invalidItems` e ignorado. Na múltipla escolha, as alternativas são ≥ 2 e começam por "X) ".
  - `formatProcedencia(p: PacoteProcedencia, others: number): string`: troca no `concurso` o número de 2 dígitos igual a `ano % 100` pelo ano inteiro ("ANATEL 24" + 2024 → "Cebraspe · ANATEL 2024 · item 40"). Com `others > 0`, acrescenta " (e em mais N provas)" ("prova" no singular).

- [ ] **Step 1: Testes que falham:**
  - "aceita a fixture: 4 itens, 1 inválido contado";
  - "recusa formato errado / versão 2 / acima de 80 MB com a mensagem certa";
  - "item sem `procedencias` ou com alternativa sem letra conta como inválido e não derruba";
  - "procedência: ANATEL 24/2024/40 → 'Cebraspe · ANATEL 2024 · item 40'; APEX BRASIL 21 ANALISTA/2021 → 'APEX BRASIL 2021 ANALISTA'; 2 procedências → '(e em mais 1 prova)'";
  - `it.skipIf(!existsSync('acervo/pacote/fofolab-acervo-cebraspe.json'))('aceita o pacote real do minerador, sem itens inválidos')`.
- [ ] **Step 2:** `npx vitest run src/__tests__/acervoPacote.test.ts` → FAIL.
- [ ] **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(acervo): leitura e validação do pacote do minerador`

### Task 3: Banco do acervo e onde ele fica

**Files:**
- Create: `src/lib/acervo/acervoDb.ts`, `src/lib/acervo/acervoStore.ts`
- Modify: `src/lib/database.ts`: exportar `getSqlJs(): SqlJsStatic` (lança erro se o `initDatabase` não rodou) e os helpers `queryAll`/`queryOne`, que hoje são privados
- Test: `src/__tests__/acervoDb.test.ts`

**Interfaces:**
- Consumes: `PacoteValido`, `formatProcedencia` (Task 2).
- Produces:
  - Tabelas do acervo: `meta(key PRIMARY KEY, value)` com `vocab_version` e `imported_at`; `assuntos(id PRIMARY KEY, caminho_json, sinonimos_json)`; `itens(id PRIMARY KEY, statement, options_json, final_answer, anulado, incerto, hidden, source_label, exam_year, organ)`; `item_assuntos(item_id, assunto_id, PRIMARY KEY(item_id, assunto_id))` + índice em `assunto_id`. Regras de montagem:
    - `statement` = `textoBase + "\n\n" + enunciado` (ou só o enunciado);
    - `options_json` = `alternativas`, ou `["C) Certo","E) Errado"]` no Certo/Errado;
    - `hidden = dependeDeFigura || temSimboloIlegivel`;
    - `organ` = `concurso` com o ano inteiro.
  - `interface AcervoRow { id: string; statement: string; options_json: string; final_answer: string; anulado: number; incerto: number; source_label: string; exam_year: number; organ: string }`.
  - `buildAcervoDb(SQL: SqlJsStatic, pacote: PacoteValido): { db: Database; stats: { withSubject: number; hidden: number } }`.
  - `acervoVocabVersion(db: Database): number`.
  - `readAcervoVocab(db: Database): PacoteAssunto[]`.
  - `itemsForAssuntos(db: Database, assuntoIds: string[]): AcervoRow[]`: casa o id exato ou os descendentes (`assunto_id LIKE id || '>%'`), sem `hidden`, sem repetir, ordenado por `exam_year DESC, id`.
  - `itemsByIds(db: Database, ids: string[]): AcervoRow[]`.
  - `assuntoCaminhos(db: Database, ids: string[]): Record<string, string[]>`: só os ids pedidos, para a linha "Do acervo: …".
  - `interface AcervoStorage { kind: StorageKind; load(): Promise<Uint8Array | null>; save(bytes: Uint8Array): Promise<void> }`, em três versões:
    - `createMemoryAcervoStorage()`;
    - `createIndexedDbAcervoStorage({ dbName = 'fofolab-acervo', factory? })`: banco IndexedDB próprio, para não subir o `IDB_VERSION` do principal;
    - `createTauriAcervoStorage()`: arquivo `acervo.db` na pasta de dados, gravado como `.tmp` e renomeado, como o `fofolab.db`.

    A versão certa é escolhida por `createDefaultAcervoStorage()`.
  - Sessão: `openAcervo(): Promise<Database | null>` (promessa guardada; `null` = nada importado), `replaceAcervo(db: Database): Promise<void>` (grava os bytes, fecha o anterior e troca o que está aberto), `useAcervoStorageForTests(storage: AcervoStorage | null): void`.

- [ ] **Step 1: Testes que falham:**
  - "monta só os itens com assunto; figura e símbolo ilegível ficam `hidden` e contam em `stats.hidden`";
  - "Certo/Errado vira C) Certo / E) Errado; texto-base vai antes do enunciado";
  - "`itemsForAssuntos(['dir-adm>atos'])` traz o item de `dir-adm>atos>atributos` e não o de `dir-adm>atos-normativos`" (o separador `>` não casa por prefixo de palavra);
  - "item com dois assuntos ligados aparece uma vez";
  - "grava e reabre pela memória e pelo IndexedDB (`fake-indexeddb/auto`)";
  - "`replaceAcervo` troca o que está aberto: o `openAcervo` seguinte vê o pacote novo";
  - "nada importado → `openAcervo()` = null".
- [ ] **Step 2:** `npx vitest run src/__tests__/acervoDb.test.ts` → FAIL.
- [ ] **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(acervo): banco do acervo à parte, aberto sob demanda`

### Task 4: Ligação por nome (puro)

**Files:**
- Create: `src/lib/acervo/linking.ts`
- Test: `src/__tests__/acervoLinking.test.ts`

**Interfaces:**
- Consumes: `PacoteAssunto`.
- Produces:
  - `normalizeName(text: string): string`: igual ao `slug` de `tools/minerador/vocab.ts` (NFD, sem acento, minúsculas, `[^a-z0-9]+` → `-`, sem `-` nas pontas).
  - `cleanSubjectName(name: string): string`: cópia da regra de `tools/minerador/vocab.ts`.
  - `assuntoIdFromCaminho(caminho: string[]): string`: `caminho.map(normalizeName).join('>')`.
  - `topicCaminho(subjectName: string, topic: Topic, topicsById: ReadonlyMap<string, Topic>): string[]` = `[cleanSubjectName(subjectName), ...títulos dos ancestrais, topic.title]`.
  - `linkByName(caminho: string[], vocab: PacoteAssunto[]): { kind: 'linked'; assuntoId: string } | { kind: 'ambiguous'; candidates: string[] } | { kind: 'none' }`. Regras, em ordem:
    1. o id do caminho inteiro existe e não é raiz → `linked`;
    2. senão, dentro da raiz cujo nome normalizado é igual a `caminho[0]`, os assuntos de 2+ níveis cuja folha ou algum sinônimo normalizado é igual ao título normalizado do tópico: 1 → `linked`, mais de 1 → `ambiguous`, 0 → `none`.

    Sem raiz da mesma matéria, o resultado é `none`.

- [ ] **Step 1: Testes que falham:**
  - "caminho inteiro igual liga";
  - "folha igual na mesma matéria liga; sinônimo também";
  - "'Conceito' em dois pais da mesma matéria → ambiguous com os 2 ids";
  - "folha igual só em outra matéria → none" (o anti-objetivo da spec);
  - "nunca liga à raiz";
  - **vocabulário real:** "os tópicos do plano criado do edital da CGU (`e2e/fixtures/cgu-2026-affc-edital.pdf`, como em `editalCycle.test.ts`) ligam pelo caminho inteiro contra `acervo/vocabulario.json` em ≥ 95%". Se der menos, anotar a medida e o motivo no teste antes de baixar o limiar.
- [ ] **Step 2:** `npx vitest run src/__tests__/acervoLinking.test.ts` → FAIL.
- [ ] **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(acervo): ligação de tópico a assunto pelo nome, sem cruzar matéria`

### Task 5: Ligação pela IA (prompt e resposta, puros)

**Files:**
- Modify: `src/lib/acervo/linking.ts`
- Test: `src/__tests__/acervoLinking.test.ts`

**Interfaces:**
- Produces:
  - `aiCandidates(caminho: string[], vocab: PacoteAssunto[], k = 15): PacoteAssunto[]`: palavras-chave com IDF, como `tools/minerador/candidates.ts` (`keywords`, folha vale o dobro dos pais), sem raízes, com empate decidido pelo id.
  - `buildLinkPrompt(caminho: string[], candidates: PacoteAssunto[]): string`. Segue a regra autoral de prompts:
    - fonte da verdade = a lista numerada de candidatos (id + caminho);
    - "escolha só ids da lista; se nenhum cobre o tópico, devolva lista vazia; não invente id";
    - resposta só em JSON `{"assuntos":[{"id":"…","confianca":0.0}]}`.
  - `parseLinkResponse(text: string, candidateIds: ReadonlySet<string>): string[] | null`:
    - tira cercas de código;
    - mantém `id ∈ candidateIds` com `confianca ≥ 0.7`, no máximo 3, da maior confiança para a menor;
    - `[]` = nenhum serve; `null` = resposta ilegível.

- [ ] **Step 1: Testes que falham:**
  - "candidatos: tópico 'Lei 14.133 — contratações diretas' traz 'contratação direta' entre os 15 e nenhuma raiz";
  - "id fora da lista é descartado";
  - "confiança 0,65 é descartada";
  - "4 válidos → os 3 de maior confiança";
  - "lista vazia = []";
  - "texto sem JSON = null";
  - "o prompt contém os ids dos candidatos e a regra de não inventar".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(acervo): candidatos locais e resposta validada para ligar pela IA`

### Task 6: O que o acervo grava no banco do estudante

**Files:**
- Create: `src/lib/acervo/studentAcervo.ts`
- Modify: `src/lib/database.ts`:
  - `recordQuestionDiagnosis` e `updateAttemptDiagnosis` multiplicam o delta por `UNCERTAIN_ITEM_WEIGHT` quando `questions.acervo_uncertain = 1`;
  - `getReviewQuestionCandidates` ignora a cópia tirada daquele tópico (`acervo_exclusions`).
- Test: `src/__tests__/studentAcervo.test.ts`

**Interfaces:**
- Consumes: `getDb`, `queryAll`, `queryOne`, `persistDatabase` (Task 3); `AcervoRow`.
- Produces:
  - `UNCERTAIN_ITEM_WEIGHT = 0.5` (em `database.ts`, perto de `diagnosisDelta`).
  - `acervoQuestionId(subjectId: string, itemId: string): string` = `` `acv:${subjectId}:${itemId}` ``.
  - `toVirtualQuestion(row: AcervoRow, subjectId: string, topicId: string): Question`: `exam_board 'Cebraspe'`, `acervo_item_id = row.id`, `acervo_uncertain = row.incerto`, `is_annulled = row.anulado`.
  - `materializeQuestion(question: Question): void`: sem `acervo_item_id`, não faz nada. Com ele, faz `INSERT OR IGNORE` com o id já fixo, `subject_id`, `topic_id` e os campos da questão, sem chamar `persistDatabase` (quem grava em seguida persiste).
  - `interface AcervoLink { topic_id: string; assunto_id: string; origin: 'NAME' | 'AI'; vocab_version: number; disabled: number }`.
  - `getAcervoLinks(topicIds: string[]): AcervoLink[]`.
  - `saveAcervoLinks(links: { topicId: string; assuntoId: string; origin: 'NAME' | 'AI'; vocabVersion: number }[]): void`: `INSERT OR IGNORE`, então uma ligação desligada nunca volta.
  - `disableAcervoLink(topicId: string, assuntoId: string): void`.
  - `removeVanishedLinks(validIds: ReadonlySet<string>): number`: apaga só as ligações **ativas** com assunto que sumiu; as desligadas ficam, como memória do "não".
  - `excludeItemFromTopic(topicId: string, itemId: string): void`, `restoreItemToTopic(topicId: string, itemId: string): void`, `getExcludedItemIds(topicId: string): string[]`.
  - `refreshCopiedQuestions(rows: ReadonlyMap<string, AcervoRow>): { updated: number }`: atualiza `final_answer`, `is_annulled` e `acervo_uncertain` pelo `acervo_item_id`. Quando o gabarito muda, apaga a `ai_dissections` da questão. Item que sumiu do pacote fica como está. Não mexe em `question_attempts`.

- [ ] **Step 1: Testes que falham:**
  - "exibir não copia; `materializeQuestion` duas vezes = 1 linha";
  - "responder um item copiado grava a tentativa no tópico em que foi respondido";
  - "incerto: Dominei soma metade do delta do seguro; trocar o diagnóstico desfaz e aplica com o mesmo peso";
  - "reimportação: gabarito trocado atualiza a questão e apaga a explicação; anulação e incerto atualizados; tentativas intactas (contagem e `mastery_delta` iguais)";
  - "o mesmo item em matérias de dois planos → 2 linhas; apagar um plano mantém as tentativas do outro";
  - "apagar o tópico leva as ligações e as exclusões";
  - "ligação desligada não volta com `saveAcervoLinks`; `removeVanishedLinks` não apaga a desligada";
  - "item tirado do tópico sai da Revisão do dia daquele tópico".
- [ ] **Step 2:** `npx vitest run src/__tests__/studentAcervo.test.ts` → FAIL.
- [ ] **Step 3:** implementar. **Step 4:** PASS + `npx vitest run src/__tests__/database.test.ts` verde.
- [ ] **Step 5: Commit** `feat(acervo): cópia ao usar, ligações e peso metade do item incerto`

### Task 7: Importar o pacote de ponta a ponta

**Files:**
- Create: `src/lib/acervo/importAcervo.ts`
- Test: `src/__tests__/importAcervo.test.ts`

**Interfaces:**
- Consumes: Tasks 2–6; `AiCallResult` de `aiRouter.ts`.
- Produces:
  - `type LinkAi = (prompt: string) => Promise<AiCallResult>`. O App passa `(p) => callAiProviders(p, { json: true, maxTokens: 300 })` com a IA configurada e `null` sem ela.
  - `interface AcervoImportSummary { withSubject: number; hidden: number; invalidItems: number; topicsLinked: number; topicsWithoutLink: number; copiesUpdated: number; aiSkipped: boolean }`.
  - `importAcervoPacote(text: string, input: { planId: string; ai: LinkAi | null; onProgress?: (done: number, total: number) => void; wait?: (ms: number) => Promise<void> }): Promise<{ ok: true; summary: AcervoImportSummary } | { ok: false; message: string }>`. Passos numerados no código:
    1. `parsePacote`;
    2. com acervo aberto e `vocabVersion` menor que a dele → `{ ok: false, message: 'Este pacote é mais antigo que o acervo deste computador. Use o pacote mais novo do minerador.' }`;
    3. `buildAcervoDb` + `replaceAcervo`;
    4. se alguma cópia vai mudar, `createSafetyBackup('antes-de-atualizar-acervo')`, e depois `refreshCopiedQuestions`;
    5. `removeVanishedLinks`;
    6. tópicos do plano **sem ligação ativa**;
    7. `linkByName` → `saveAcervoLinks` com origem `NAME`;
    8. para o que ficou `ambiguous`/`none`, se `ai`, um tópico por vez:
       - o `aiCandidates` deixa de fora os assuntos desligados naquele tópico;
       - no 429 (`retryAfterSec`), espera uma vez (no máximo 60 s, pelo `wait`) e tenta de novo;
       - na 2ª falha seguida, para a IA, e o resto fica sem ligação;
       - cada ligação aceita é gravada na hora, com origem `AI`;
    9. `persistDatabase()` + resumo.

    Ligação feita conta em `topicsLinked`; o que sobrou conta em `topicsWithoutLink`.

- [ ] **Step 1: Testes que falham** (pacote da fixture, plano com 4 tópicos: 2 ligam pelo nome, 1 ambíguo, 1 sem par; IA falsa):
  - "sem IA: 2 ligados, 2 sem ligação, `aiSkipped` e nada gravado com origem AI";
  - "com IA: o ambíguo liga ao id escolhido; id inventado pela IA é ignorado";
  - "IA dá 429 e depois falha: o que ligou antes fica gravado, o resto conta como sem ligação";
  - "reimportar o mesmo pacote não muda ligação nem tentativa; pacote novo com assunto juntado religa só aquele tópico";
  - "pacote mais antigo é recusado e o acervo atual continua aberto";
  - "pacote que muda o gabarito de uma questão usada cria a cópia de segurança antes; pacote que não muda nada não cria";
  - "resumo: `withSubject`, `hidden` e `invalidItems` batem com a fixture".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(acervo): importação do pacote com ligação por nome e pela IA`

### Task 8: Questões do tópico (substitui o recuo para o grupo/matéria)

**Files:**
- Create: `src/lib/acervo/topicQuestions.ts`
- Modify: `src/features/questions/QuestionFilters.tsx` (`QuestionScope` ganha `'group'`; o `<select>` ainda não mostra a opção, que entra na Task 10)
- Test: `src/__tests__/topicQuestions.test.ts`

**Interfaces:**
- Consumes: Tasks 3 e 6.
- Produces:
  - `type QuestionScope = 'topic' | 'group' | 'subject' | 'all'`.
  - `interface QuestionsView { items: { question: Question; dissection: AiDissection | null }[]; links: { assuntoId: string; caminho: string[] }[]; excluded: { itemId: string; sourceLabel: string }[]; groupCode: string | null; acervoMissing: boolean }`. O `caminho` vem de `assuntoCaminhos`, e o `sourceLabel` dos tirados vem de `itemsByIds`.
  - `scopeTopicIds(input: { scope: QuestionScope; planId: string; subjectId: string; topicId: string }): string[]`: os tópicos cujas ligações valem no escopo.
  - `getQuestionsView(input: { scope: QuestionScope; planId: string; subjectId: string; topicId: string; acervo: Database | null }): QuestionsView`. Regras:
    - **próprias** = `acervo_item_id IS NULL`, por escopo:
      - `topic`: o próprio tópico;
      - `group`: o tópico e os irmãos (mesmo `parent_id`);
      - `subject`: a matéria;
      - `all`: as matérias do plano (antes, `all` trazia as questões de todos os planos);
    - **do acervo** = para cada tópico do escopo, as ligações ativas → `itemsForAssuntos` menos as exclusões do tópico → `toVirtualQuestion`. Quando a cópia já existe (`acervoQuestionId`), entra a linha gravada, com `topic_id` trocado pelo tópico da lista;
    - um item aparece **uma vez** por lista;
    - ordem: as próprias primeiro e depois as do acervo, cada grupo por ano decrescente;
    - `links` e `excluded` só no escopo `topic`;
    - `groupCode` = `code ?? title` do pai (null sem pai);
    - `acervoMissing` = há ligação ativa no escopo e `acervo === null`.
  - `hasActiveLinks(topicIds: string[]): boolean`: síncrona, para o hook decidir se abre o acervo.

- [ ] **Step 1: Testes que falham:**
  - "tópico com próprias + itens ligados (inclusive por descendente)";
  - "item em dois tópicos aparece nos dois; uma vez em 'subject'";
  - "item tirado do tópico some só desse tópico";
  - "cópia existente vence o item virtual: o gabarito atualizado aparece";
  - "**tópico sem questões → lista vazia e `groupCode` do pai, nada de outro tópico**";
  - "'group' traz próprias e acervo dos irmãos";
  - "'all' não traz questões de outro plano nem itens sem ligação";
  - "anulado aparece com `is_annulled = 1`";
  - "ligação ativa e acervo ausente → `acervoMissing` e só as próprias".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `npm run build` (nada foi removido ainda).
- [ ] **Step 5: Commit** `feat(acervo): questões do tópico com o acervo e sem recuo automático`

### Task 9: Hook das questões e o App

**Files:**
- Create: `src/features/acervo/useTopicQuestions.ts`
- Modify: `src/App.tsx`:
  - o efeito das questões (hoje nas linhas 297–310) e o `routineQuestionCount` (461–464) passam a usar o hook;
  - saem o `questionFallback`/`questionSourceLabel`;
  - `handleAnswer` e `handleGenerateDissection` chamam `materializeQuestion(question)` antes de gravar.
  - `src/lib/database.ts`: removidos `getTopicQuestionsWithFallback`, `QuestionFallback` e `getQuestionsForTopicOrSubject` (sem uso).
- Test: `src/__tests__/useTopicQuestions.test.tsx`. Em `src/__tests__/database.test.ts`, sai o teste "tópico sem questões mostra as do grupo…": a regra mudou por decisão do dono e está coberta na Task 8.

**Interfaces:**
- Consumes: `getQuestionsView`, `scopeTopicIds`, `hasActiveLinks`, `openAcervo`.
- Produces:
  - `useTopicQuestions(input: { ready: boolean; planId: string | null; subjectId: string; topicId: string; scope: QuestionScope; version: number }): QuestionsView & { loading: boolean }`. Só chama `openAcervo()` quando `hasActiveLinks` dos tópicos do escopo der verdadeiro; enquanto o acervo abre, mostra as próprias.
  - `useTopicQuestionCount(input: { ready: boolean; topic: Topic | null; version: number }): number`: conta só as do próprio tópico (escopo `topic`).

- [ ] **Step 1: Testes que falham:**
  - "tópico sem ligação não abre o acervo (espião em `openAcervo`)";
  - "tópico com ligação abre uma vez e mostra os itens";
  - "trocar de tópico com o acervo aberto não abre de novo";
  - "contagem do bloco = só as do tópico".
- [ ] **Step 2:** FAIL. **Step 3:** implementar o hook e ligar no App. **Step 4:** PASS + `npm test` inteiro + `npm run build`.
- [ ] **Step 5: Commit** `feat(acervo): aba Questões e bloco da Bancada usam as questões do acervo`

### Task 10: Tela: procedência, incerto, anulada, ligações e itens tirados

**Files:**
- Create: `src/features/questions/AcervoLinkBar.tsx` (linha "Do acervo: …" com "Desligar este assunto" e "Tirados deste tópico (N)", que abre a lista com "Devolver ao tópico"); `src/features/questions/EmptyTopicQuestions.tsx`
- Modify:
  - `QuestionCard.tsx`: a procedência no lugar do chip de banca/ano; `StatusSquare` âmbar "Classificação incerta" com `title` "Classificação ainda não confirmada: pesa metade no domínio."; anulada com "Anulada pela banca", as alternativas só para ler e sem confiança, resposta nem "Ver explicação"; botão discreto "Não é deste tópico" (`onNotThisTopic`).
  - `QuestionWorkbench.tsx`: novas props `view: Pick<QuestionsView, 'links' | 'excluded' | 'groupCode' | 'acervoMissing'>`, `onDisableLink(assuntoId: string)`, `onExcludeItem(question: Question)`, `onRestoreItem(itemId: string)`, `onShowGroup()`. Sai a `sourceLabel`.
  - `QuestionFilters.tsx`: rótulos "Deste tópico" · "Do grupo ‹código›" (só com `groupCode` ou com o escopo já em `group`) · "Toda a matéria" · "Todo o plano".
  - `App.tsx`: os handlers chamam `disableAcervoLink`, `excludeItemFromTopic` e `restoreItemToTopic` e depois sobem o `questionsVersion`.
- Test: `src/__tests__/questionWorkbench.test.tsx` (ampliar)

- [ ] **Step 1: Testes que falham:**
  - "tópico vazio: 'Ainda não há questões classificadas neste tópico.' e 'Ver as do grupo 2.3' chama `onShowGroup`";
  - "sem grupo, sem o botão";
  - "procedência 'Cebraspe · ANATEL 2024 · item 40' no cartão";
  - "incerto mostra 'Classificação incerta'";
  - "anulada: 'Anulada pela banca', sem 'Sei'/'Acho que sei' e sem 'Ver explicação antes de responder'";
  - "'Não é deste tópico' chama `onExcludeItem` com a questão";
  - "'Desligar este assunto' chama `onDisableLink` com o id";
  - "'Tirados deste tópico (1)' abre e 'Devolver ao tópico' chama `onRestoreItem`";
  - "acervo ausente mostra o aviso da Review Focus 1";
  - "sem termos proibidos (`FORBIDDEN_JARGON`) e sem emoji".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(acervo): procedência, incerto, anulada e desfazer ligação na aba Questões`

### Task 11: Importar o acervo pela tela de importação

**Files:**
- Create: `src/features/acervo/AcervoImportPanel.tsx`
- Modify: `src/features/question-import/QuestionImportModal.tsx` (escolha no topo: "Colar questões" | "Acervo da Cebraspe (pacote do minerador)"; o modal já passa de 250 linhas, então o painel novo fica todo fora dele); `src/App.tsx` (passa `planId` e `ai`; ao terminar, sobe o `questionsVersion`)
- Test: `src/__tests__/acervoImportPanel.test.tsx`

**Interfaces:**
- Consumes: `importAcervoPacote`, `LinkAi`.
- Produces: `AcervoImportPanel(props: { planId: string; ai: LinkAi | null; onImported: () => void })`. Mostra:
  - a escolha de arquivo (`accept=".json"`, rótulo "Escolher o arquivo do pacote") e o botão "Importar acervo";
  - durante a ligação pela IA, "Ligando tópicos: 3 de 12" e "Pode fechar: o que faltar fica para a próxima importação.";
  - no resumo, a 1ª linha `${withSubject} questões com assunto · ${topicsLinked} tópicos do seu plano ligados · ${topicsWithoutLink} sem ligação` e, quando houver:
    - "N ficaram de fora (figura ou fórmula que não dá para ler).";
    - "N itens com problema foram ignorados.";
    - "N questões que você já usou foram atualizadas.";
    - com `aiSkipped`, "Sem IA configurada, os tópicos sem ligação ficam para a próxima importação.";
  - no erro, a mensagem do `importAcervoPacote`.

- [ ] **Step 1: Testes que falham** (`importAcervoPacote` falso):
  - "escolher o arquivo e importar mostra o resumo com os números";
  - "erro mostra a mensagem e não chama `onImported`";
  - "progresso aparece durante a ligação";
  - "sem jargão e sem emoji".
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS + `npm run build`.
- [ ] **Step 5: Commit** `feat(acervo): opção de importar o pacote do minerador`

### Task 12: E2E, pacote real e fechamento

**Files:**
- Create: `e2e/acervo.spec.ts`; `e2e/fixtures/acervo-pequeno.json`, feita à mão, sem texto de prova. Os ids e caminhos vêm de `acervo/vocabulario.json`: três folhas irmãs A, B e C de um mesmo grupo do plano da CGU, além da raiz e do pai. Os itens são:
  - i1 em A;
  - i2 em A e B;
  - i3 em B, incerto;
  - i4 com figura.

  C fica sem item.
- Modify: `BACKLOG.md` (12c com o que foi verificado), `docs/handoff/2026-10-24-estado-e-proxima-ia.md` (§0)

- [ ] **Step 1: E2E** (com o edital real, reaproveitando o `importCguEdital` de `e2e/plano-ate-a-prova.spec.ts`, passado para `e2e/helpers.ts`; sem IA, porque o `playwright.config.ts` zera as chaves):
  1. importa `acervo-pequeno.json`, e o resumo diz "3 questões com assunto";
  2. no tópico A aparecem i1 e i2 com a procedência, e no B aparecem i2 e i3 (com "Classificação incerta");
  3. responde i1 no A (Sei → alternativa), recarrega, e a tentativa e a procedência continuam (o domínio do A mudou);
  4. "Não é deste tópico" em i2 no B tira só o item, e i2 continua no A;
  5. "Desligar este assunto" no A tira a ligação;
  6. recarrega, e os dois continuam valendo;
  7. o tópico C mostra "Ainda não há questões classificadas neste tópico." e "Ver as do grupo …" traz os itens de A e B.

  Captura em `e2e/.screens/acervo-*.png`.
- [ ] **Step 2:** `npx playwright test e2e/acervo.spec.ts` → verde. `npm run test:e2e` inteiro, **duas rodadas**. O `bancada.spec`/`roteiro.spec` que contavam com o recuo para o grupo são ajustados à regra nova, e o porquê vai no commit.
- [ ] **Step 3: Pacote real**, no navegador (`npm run dev`, com o banco de estudo do dono; antes, um "Fazer Backup" manual pela tela):
  1. importa `acervo/pacote/fofolab-acervo-cebraspe.json` e anota no BACKLOG o tempo da importação, os números do resumo e quantos tópicos da CGU ligaram pelo nome e quantos pela IA;
  2. se a tela travar mais de ~3 s, abre uma tarefa (Web Worker) no BACKLOG, em vez de esconder;
  3. confere à mão 5 tópicos (o item é do tópico?);
  4. fecha e abre o app: as questões continuam lá.
- [ ] **Step 4:** `npm test`, `npm run test:e2e` (2 rodadas) e `npm run build` verdes; `graphify update .`.
- [ ] **Step 5:** revisão independente do branch (o fluxo do dono), correções com teste, BACKLOG/handoff atualizados. **Commits** `test(acervo): E2E do pacote no app` e `docs: 12c verificada`.
