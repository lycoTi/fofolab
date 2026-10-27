# 12d — Sincronização Automática do Acervo, Fila da Aba Questões e Reta Final Flexível Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O pacote do acervo se atualiza sozinho no minerador e sincroniza automaticamente no app sem clique manual; a aba Questões abre na fila de inéditas (com Certo/Errado primeiro), permite refazer erros/chutes com histórico visível e esconde anuladas da fila; e a Reta Final libera tópicos inéditos quando os estudados já estão dominados ou quando o estudante preferir avançar.

**Architecture:**
1. `tools/minerador/pacote.ts` grava `acervo/pacote/cebraspe.json`, `fofolab-acervo-cebraspe.json` e `acervo/pacote/index.json` ao final de qualquer comando que mude classificações ou vocabulário.
2. `vite.config.ts` expõe `GET /__acervo/<arquivo>.json` lendo apenas arquivos `.json` dentro de `acervo/pacote/`; `src/lib/acervo/autoSync.ts` e `src/features/acervo/useAcervoAutoSync.ts` checam o `index.json` ao iniciar ou trocar de plano e importam em segundo plano quando a versão/contagem subiu ou há tópicos ainda não verificados.
3. `src/lib/acervo/topicQuestions.ts` calcula o resumo de tentativas (`attemptSummary`) por tópico e exclui anuladas da contagem do bloco; `QuestionWorkbench` e `QuestionFilters` filtram por status (`UNSOLVED` | `RETRY` | `ALL`) e formato (`ALL` | `CE` | `ME`), ordenando C/E primeiro.
4. `src/lib/dailyPlanner.ts` libera tópicos inéditos na Reta Final quando os tópicos estudados da matéria já estão dominados (`mastery_score >= 75` e `R >= 0.85`) ou quando `allowNewInFinalStretch` está ativo.

**Tech Stack:** React 19 + TypeScript strict, sql.js, Vitest, Playwright (Edge), Tailwind 3.4.

**Spec:** `docs/specs/12d-auto-sync-e-fila-questoes.md` (aprovada em 27/10/2026).

## Global Constraints
- **Nada em `src/` importa `tools/`.**
- Textos em pt-BR, sem jargão técnico na UI (`ui-clean-design-and-tdd.md`), sem emojis (`noEmojiInUi.test.ts`), sem ternários aninhados, componentes até ~250 linhas.
- Responder uma questão no filtro "Inéditas" **não** esconde a questão imediatamente da tela: ela permanece na leva atual da sessão até o estudante trocar de filtro, escopo ou tópico.
- Item anulado (`is_annulled === 1`) não conta em `useTopicQuestionCount` nem entra nos filtros `UNSOLVED` / `RETRY` (só em `ALL`).

## Review Focus
1. **Sem pasta `acervo/pacote/` (ex.: clone limpo ou ambiente de teste):** `/__acervo/index.json` retorna 404 e `syncLocalAcervoIfNeeded` encerra silenciosamente sem erro nem toast.
2. **Idempotência da sincronização automática quando um tópico ficou sem ligação (porque nenhum assunto serviu):** `acervo_sync_state` (ou `meta` no `acervo.db` + plano) lembra a `vocabVersion` e `withSubject` já sincronizados para aquele `planId`, evitando re-rodar `importAcervoPacote` a cada F5 quando nada mudou.
3. **Responder questão no filtro "Inéditas":** após clicar na alternativa, `refreshData()` e `bumpQuestions()` atualizam `attemptSummary`, mas a questão continua visível na posição atual para o estudante ler a correção, trocar diagnóstico e usar a FofoIA.
4. **Refazer questão no filtro "Errei ou chutei":** a questão abre desbloqueada (`locked = false`) para uma nova tentativa real, mas mostra o selo discreto da tentativa anterior ("Já respondida · Errou / Chutou").
5. **Reta final com tópicos já dominados:** se os tópicos estudados da matéria já têm `mastery_score >= 75` e `R >= 0.85`, o bloco da Reta Final avança para o próximo tópico inédito da matéria em vez de repetir o que já está dominado.

---

### Task 1: Manifesto `index.json` e atualização automática do pacote no minerador

**Files:**
- Modify: `tools/minerador/pacote.ts`, `tools/minerador/cli.ts`
- Test: `tools/minerador/__tests__/pacote.test.ts`

**Interfaces:**
- Produces in `tools/minerador/pacote.ts`:
  - `interface PacoteIndexEntry { id: string; banca: string; arquivo: string; vocabVersion: number; itensComAssunto: number; atualizadoEm: string }`
  - `interface PacoteIndex { formato: 'fofolab-acervo-index'; versao: 1; pacotes: PacoteIndexEntry[] }`
  - `writePacoteAndIndex(acervoDir: string, now?: Date): { pacote: Pacote; entry: PacoteIndexEntry }`: constrói o pacote e grava `acervo/pacote/cebraspe.json`, `acervo/pacote/fofolab-acervo-cebraspe.json` e atualiza `acervo/pacote/index.json` (preservando entradas de outras bancas se já existirem no `index.json`).
- Modify `tools/minerador/cli.ts`: chamar `writePacoteAndIndex(ACERVO)` ao final de `classify`, `juntar`, `recalcular` e `pacote`.

- [ ] **Step 1: Write the failing test in `tools/minerador/__tests__/pacote.test.ts`**
- [ ] **Step 2: Run `npx vitest run tools/minerador/__tests__/pacote.test.ts` → FAIL**
- [ ] **Step 3: Implement `writePacoteAndIndex` in `tools/minerador/pacote.ts` and hook into `cli.ts`**
- [ ] **Step 4: Run `npx vitest run tools/minerador/__tests__/pacote.test.ts` → PASS**
- [ ] **Step 5: Commit `feat(minerador): atualiza pacote e index.json automaticamente após classificar`**

---

### Task 2: Sincronização automática do acervo no App (`autoSync` + middleware Vite)

**Files:**
- Modify: `src/lib/acervo/acervoDb.ts`, `vite.config.ts`, `src/App.tsx`
- Create: `src/lib/acervo/autoSync.ts`, `src/features/acervo/useAcervoAutoSync.ts`
- Test: `src/__tests__/acervoAutoSync.test.ts`

**Interfaces:**
- Modify `src/lib/acervo/acervoDb.ts`:
  - Gravar `'with_subject'` na tabela `meta` em `buildAcervoDb`;
  - Exportar `acervoWithSubjectCount(db: Database): number`.
- Create `src/lib/acervo/autoSync.ts`:
  - `interface AcervoIndexEntry { id: string; banca: string; arquivo: string; vocabVersion: number; itensComAssunto: number; atualizadoEm: string }`
  - `interface AcervoIndex { formato: 'fofolab-acervo-index'; versao: 1; pacotes: AcervoIndexEntry[] }`
  - `parseAcervoIndex(text: string): AcervoIndex | null`
  - `mergePacotesTexts(texts: string[]): string | null`: se houver 1 pacote, devolve o próprio texto; se houver múltiplos pacotes válidos no índice, combina `assuntos` (maior `vocabVersion`) e `itens` num único JSON de pacote válido.
  - `syncLocalAcervoIfNeeded(input: { planId: string; ai: LinkAi | null; fetchText?: (url: string) => Promise<string | null> }): Promise<{ synced: boolean; summary?: AcervoImportSummary }>`:
    - Busca `/__acervo/index.json`; se `null` ou inválido ou `pacotes.length === 0`, retorna `{ synced: false }`.
    - Calcula a assinatura do índice (`maxVocabVersion` e soma de `itensComAssunto`).
    - Abre `openAcervo()`: se `acervoVocabVersion(db) === maxVocabVersion`, `acervoWithSubjectCount(db) === totalItensComAssunto` e o `planId` já foi sincronizado nessa assinatura (guardado em memória/localStorage `fofolab_acervo_sync_v1` + o plano não ganhou tópicos novos sem link), retorna `{ synced: false }`.
    - Caso contrário, baixa cada `/__acervo/<entry.arquivo>`, junta com `mergePacotesTexts`, chama `importAcervoPacote`, grava a assinatura do plano e retorna `{ synced: true, summary }`.
- Modify `vite.config.ts`: plugin `fofolabAcervoStatic` que responde `GET /__acervo/<nome>.json` lendo `acervo/pacote/<nome>.json` com validação de nome seguro (`/^[a-z0-9._-]+\.json$/i`).

- [ ] **Step 1: Write the failing test in `src/__tests__/acervoAutoSync.test.ts`**
- [ ] **Step 2: Run `npx vitest run src/__tests__/acervoAutoSync.test.ts` → FAIL**
- [ ] **Step 3: Implement `acervoWithSubjectCount`, `autoSync.ts`, `useAcervoAutoSync.ts`, `vite.config.ts` and wire into `App.tsx`**
- [ ] **Step 4: Run `npx vitest run src/__tests__/acervoAutoSync.test.ts` → PASS**
- [ ] **Step 5: Commit `feat(acervo): sincronização automática de pacotes em segundo plano`**

---

### Task 3: Histórico de tentativas por questão no tópico e exclusão de anuladas da contagem

**Files:**
- Modify: `src/lib/acervo/topicQuestions.ts`
- Test: `src/__tests__/topicQuestions.test.ts`

**Interfaces:**
- Produces in `src/lib/acervo/topicQuestions.ts`:
  - `export interface QuestionAttemptSummary { count: number; lastIsCorrect: boolean; lastConfidence: ReviewConfidence | null; lastDiagnosis: SelfDiagnosisType; lastAttemptAt: string; needsRetry: boolean }`
  - `QuestionsView['items']` passa a ser `{ question: Question; dissection: AiDissection | null; attemptSummary: QuestionAttemptSummary | null }[]`.
  - `needsRetry` é `true` quando `!lastIsCorrect || lastConfidence === 'GUESS' || lastDiagnosis === 'FIRST_CONTACT' || lastDiagnosis === 'GUESSED_RIGHT'`.
  - Em `useTopicQuestionCount` (`src/features/acervo/useTopicQuestions.ts`), conta apenas questões não anuladas (`q.question.is_annulled !== 1`).

- [ ] **Step 1: Write the failing tests in `src/__tests__/topicQuestions.test.ts`**
- [ ] **Step 2: Run `npx vitest run src/__tests__/topicQuestions.test.ts` → FAIL**
- [ ] **Step 3: Implement `attemptSummary` in `topicQuestions.ts` and filter annulled in `useTopicQuestionCount`**
- [ ] **Step 4: Run `npx vitest run src/__tests__/topicQuestions.test.ts` → PASS**
- [ ] **Step 5: Commit `feat(questions): resumo de tentativas por tópico e anuladas fora da contagem do bloco`**

---

### Task 4: Fila de Inéditas, Refazer ("Errei ou chutei"), Formato C/E primeiro e Selo de já respondida

**Files:**
- Modify: `src/features/questions/QuestionFilters.tsx`, `src/features/questions/QuestionCard.tsx`, `src/features/questions/EmptyTopicQuestions.tsx`, `src/features/questions/QuestionWorkbench.tsx`
- Test: `src/__tests__/questionWorkbench.test.tsx`

**Interfaces:**
- `export type QuestionStatusFilter = 'UNSOLVED' | 'RETRY' | 'ALL'`
- `export type QuestionFormatFilter = 'ALL' | 'CE' | 'ME'`
- `QuestionFilters` recebe `statusFilter`, `onStatusFilter`, `counts: { unsolved: number; retry: number; all: number }`, `formatFilter`, `onFormatFilter`.
- Ordenação padrão: quando `formatFilter === 'ALL'`, questões Certo/Errado vêm antes das de Múltipla Escolha (mantendo ano mais recente primeiro dentro de cada formato).
- `QuestionWorkbench` mantém `sessionTouchedIds: Set<string>` (limpo ao mudar `scopeFilter`, `statusFilter`, `formatFilter` ou de tópico): uma questão inédita que o estudante acabou de responder continua na leva atual do filtro `UNSOLVED` até ele trocar de filtro/tópico, para não sumir da tela no clique.
- Quando `statusFilter === 'UNSOLVED'` e `filtered.length === 0`, mas `counts.all > 0` no tópico: mostra o estado "Você já respondeu as questões inéditas deste tópico" com botões para `"Refazer as que errei ou chutei (X)"` (se `counts.retry > 0`), `"Ver todas (N)"` e `"Ver as do grupo ‹código›"` (se houver grupo).
- `QuestionCard` exibe um selo discreto quando `attemptSummary !== null`: `"Já respondida · Errou / Acertou / Chutou / 1º contato"`.

- [ ] **Step 1: Write the failing tests in `src/__tests__/questionWorkbench.test.tsx`**
- [ ] **Step 2: Run `npx vitest run src/__tests__/questionWorkbench.test.tsx` → FAIL**
- [ ] **Step 3: Implement in `QuestionFilters.tsx`, `QuestionCard.tsx`, `EmptyTopicQuestions.tsx`, `QuestionWorkbench.tsx`**
- [ ] **Step 4: Run `npx vitest run src/__tests__/questionWorkbench.test.tsx` → PASS**
- [ ] **Step 5: Commit `feat(questions): fila de inéditas, refazer erros/chutes e ordenação por formato`**

---

### Task 5: Reta Final sem engessar (liberar tópicos inéditos quando dominados ou a pedido)

**Files:**
- Modify: `docs/specs/01-database-schema.sql`, `src/lib/migrations.ts` (v13: `final_stretch_allow_new`), `src/types/database.ts`, `src/lib/database.ts`, `src/lib/dailyPlanner.ts`, `src/lib/dailyRoutine.ts`, `src/features/routine/useDailyRoutine.ts`, `src/lib/weekForecast.ts`, `src/features/study-plan/StudyPlanView.tsx`, `src/App.tsx`
- Test: `src/__tests__/dailyPlanner.test.ts`, `src/__tests__/migrations.test.ts`

**Interfaces:**
- Migração **v13** (`LATEST_SCHEMA_VERSION = 13`): `ALTER TABLE study_plans ADD COLUMN final_stretch_allow_new INTEGER NOT NULL DEFAULT 0`.
- Em `dailyPlanner.ts`:
  - `needsStretchReview(h: TopicHeatItem): boolean` → `h.daysSinceLastStudy !== null && (recallOf(h) < 0.85 || h.topic.mastery_score < 75)`.
  - `planDailyBlocks` aceita `allowNewInFinalStretch?: boolean`.
  - Na Reta Final (`finalStretch === true` e `!allowNewInFinalStretch`):
    - Tenta primeiro revisar o tópico estudado mais frio que **precisa de revisão** (`needsStretchReview(h)`).
    - Se a matéria não tiver nenhum tópico estudado precisando de revisão (todos já estão com `mastery >= 75` e `R >= 0.85`) e houver tópicos inéditos na matéria, escolhe o próximo tópico inédito normalmente! Se não houver inéditos, revisa o estudado mais frio.
  - Se `allowNewInFinalStretch === true`, a Reta Final usa a seleção normal do ciclo (avança em tópicos inéditos e revisa urgentes pelo calor).
- Em `StudyPlanView.tsx` (dentro de Ajustar, ao lado de "Dias da reta final"): checkbox `"Continuar avançando em tópicos novos na reta final"` que atualiza `final_stretch_allow_new`.

- [ ] **Step 1: Write the failing tests in `src/__tests__/dailyPlanner.test.ts` and `src/__tests__/migrations.test.ts`**
- [ ] **Step 2: Run `npx vitest run src/__tests__/dailyPlanner.test.ts src/__tests__/migrations.test.ts` → FAIL**
- [ ] **Step 3: Implement migration v13, `dailyPlanner.ts`, `StudyPlanView.tsx` and wire into `App.tsx`**
- [ ] **Step 4: Run `npx vitest run` → PASS**
- [ ] **Step 5: Commit `feat(plano): reta final avança em tópicos inéditos quando dominados ou a pedido`**

---

### Task 6: Verificação ponta a ponta (E2E, pacote real, docs e graphify)

**Files:**
- Modify: `e2e/acervo.spec.ts`, `BACKLOG.md`, `docs/handoff/2026-10-24-estado-e-proxima-ia.md`

- [ ] **Step 1: Atualizar `acervo/pacote/index.json` e `cebraspe.json` rodando `npm run minerar -- pacote`**
- [ ] **Step 2: Adicionar teste de fila de inéditas / refazer e auto-sync em `e2e/acervo.spec.ts`**
- [ ] **Step 3: Rodar `npm test`, `npm run test:e2e` (2 rodadas) e `npm run build`**
- [ ] **Step 4: Atualizar `BACKLOG.md`, `docs/handoff/2026-10-24-estado-e-proxima-ia.md` e rodar `graphify update .`**
- [ ] **Step 5: Commit final da 12d**
