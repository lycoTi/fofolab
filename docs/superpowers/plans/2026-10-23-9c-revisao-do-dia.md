# 9c — Revisão do dia e tela "Bom dia": Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ao abrir o app, o centro mostra o "Bom dia": uma linha factual do último dia de estudo, a **Revisão do dia**
(3 a 5 tópicos já estudados que estão esfriando, intercalados — por questão do app, pergunta aberta ou questões feitas
fora do app) e a **Situação** por prova; começar um bloco leva à bancada.

**Architecture:** Migração **v8** com confiança/origem nas tentativas, revisão do dia congelada (`daily_reviews`, como o
roteiro em `daily_plans`), autoavaliações da pergunta aberta (`recall_checks`) e a chave liga/desliga no plano. Regras puras
em `src/lib/dailyReview.ts` (seleção, progresso, diagnóstico derivado) e `src/lib/goodMorning.ts` (linha de ânimo,
situação); tela na fatia nova `src/features/good-morning/`. O progresso da revisão é **derivado** do que foi gravado hoje
(tentativas com origem `DAILY_REVIEW`, autoavaliações, registros de fora do app), nunca guardado à parte.

**Tech Stack:** React 19, TypeScript strict, sql.js, Tailwind, Vitest, Playwright (Edge).

**Spec:** `docs/specs/09-bancada-roteiro-e-revisao.md` §5.3, §5.3.1, §5.3.2 (decisões de 23/10) e §5.4;
`docs/specs/07-edital-ciclo-e-situacao.md` §5.5 (Situação e linha de ânimo).

## Global Constraints
- Mudança no contrato SQL → **nova** migração v8, `LATEST_SCHEMA_VERSION` 7 → 8, contrato `docs/specs/01-database-schema.sql`
  com o mesmo efeito (o teste compara os dois caminhos). Nunca editar migração existente.
- Textos em pt-BR, sem jargão, tempo em HH:mm (`formatDuration`), texto de explicação por `RichText`. Nenhum texto cita o TEC
  (outros estudantes usam outros sites): "questões feitas fora do app".
- Nada da revisão depende de IA. Explicação de exemplo (`provider_used = 'EXAMPLE'`) aparece com o rótulo de exemplo existente.
- Pular, pausar ou desligar nunca gera penalidade, alerta vermelho ou contagem de falhas. Tom acolhedor (`blue` para
  primeiro contato, `amber` só para o aviso da prova eliminatória).
- Componentes ≤ ~250 linhas; sem ternário aninhado; animações só por CSS com `motion-reduce` (usar `Collapse`).
- Toda gravação da revisão chama `flushDatabase()` (fechar o app logo depois não perde nada).

## Decisões do construtor (dentro do que a spec deixou)
- **Seleção** (`selectDailyReview`): elegível = tópico folha, já estudado (`last_studied_at` **ou** tentativa **ou**
  registro de fora do app) e **não estudado hoje**. Até **2** do último dia de estudo anterior (busca até 30 dias atrás);
  o resto dos "esfriando" (`R = 2^(−Δt/h)` < **0,9**, menor `R` primeiro; empate: estudado há mais tempo). **1 por tópico,
  até 5**; menos de 3 só se não houver mais elegíveis; nenhum → a seção some (sem mensagem de falta).
- **Intercalar:** ordem final sem duas seguidas da mesma matéria quando for possível.
- **Tipo do item:** tópico com questão do app (não anulada) → `QUESTION` (preferir nunca respondida; senão a respondida
  há mais tempo); sem questão → `OPEN`. Os dois tipos oferecem o atalho **"Fiz questões fora do app"** (abre o registro
  rápido da coluna com o tópico; um registro de hoje no tópico conclui o item).
- **Pergunta aberta:** "Lembrei bem" = +0,5 "dominei" na meia-vida; "Não lembrei" = +0,5 "lacuna"; "Lembrei em parte" só
  conta como revisão. Todas atualizam `last_studied_at`; o domínio (`mastery_score`) não muda (é autoavaliação).
- **Diagnóstico derivado** (spec §5.3.1): certeza+acerto → `MASTERED`; acho/chutei+acerto → `DOUBT`; erro → `BASE_GAP`
  (trocável por `BOARD_TRAP`; acerto trocável entre `MASTERED`/`DOUBT`). A tentativa é gravada no "Próxima" — fechar o app
  com a correção aberta faz a questão voltar, sem tentativa pela metade.
- **Tempo:** cada item concluído grava uma `study_sessions` `REVIEW` na matéria do item (`max(1, round(segundos/60))`). O
  roteiro já ignora sessões `REVIEW` (`dailyRoutine.ts:40`); a meta da semana as conta.
- **Congelada no dia:** a primeira abertura do "Bom dia" no dia grava a seleção; recalibrar não muda a revisão do dia.
  "Pular a revisão de hoje" grava `skipped = 1`; os tópicos voltam a concorrer amanhã.
- **Tela:** aba **"Início"** (primeira da lista, ícone `Sun`; o título dentro dela muda com a hora: Bom dia / Boa tarde /
  Boa noite). Abre sozinha ao iniciar o app sem bloco em andamento; iniciar um bloco com ela aberta leva à aba Questões.
- **Linha de ânimo:** só com fatos do último dia de estudo anterior — "Ontem: 01:40 de estudo em 2 matérias. Você começou
  2.1 Arquitetura de microsserviços." ("Em 20/10: …" se não foi ontem; até 2 tópicos começados + "e mais N"). Sem dia
  anterior → sem linha.
- **Situação:** "Faltam N dias para a prova (dd/mm/aaaa)" + cada prova com % visto (barra) + **um** aviso `amber` para a
  prova com nota mínima cujo % visto está ≥ 20 pontos abaixo da média das outras: "P1 está ficando para trás: 12% visto
  (as outras: 40%). Ela tem nota mínima." Plano sem provas → só os dias; sem data → seção sem a linha dos dias.
- **Desligar:** caixa no último passo do Wizard "Revisão do dia ao abrir o app" (padrão ligada), com "Desligue se você já
  tem seu método de revisão." Não entra na `routineProfileKey` (não refaz o roteiro).

## Review Focus
1. **Tópico estudado hoje** (sessão, questão ou registro de fora) não entra na revisão; tópico estudado **só** por registro
   de fora do app entra amanhã. *(Task 3: testes `estudado hoje fica fora`, `registro de fora conta como estudado`.)*
2. **Fechar e abrir no meio da revisão:** os itens concluídos continuam concluídos, a seleção não é sorteada de novo, a
   questão com a correção aberta volta sem tentativa gravada. *(Task 6, E2E.)*
3. **Virada do dia com o app aberto:** a revisão de ontem não continua hoje — a chave do dia é recalculada ao mostrar a aba.
   *(Task 5: teste do hook com `now` trocado.)*
4. **Questão anulada, sem gabarito ou Certo/Errado:** anulada não entra; Certo/Errado responde com os dois botões.
   *(Task 3 e Task 5.)*
5. **Revisão desligada:** nada é sorteado nem gravado, a seção some, o motor segue igual. *(Task 5 e Task 6.)*

---

### Task 1: Banco v8
**Files:** `src/lib/migrations.ts`, `docs/specs/01-database-schema.sql`, `src/types/database.ts`, `src/lib/database.ts`;
testes em `src/__tests__/migrations.test.ts`, `src/__tests__/database.test.ts`.

**Interfaces (produces):**
- Tipos: `ReviewConfidence = 'SURE' | 'THINK' | 'GUESS'`; `RecallRating = 'GOOD' | 'PARTIAL' | 'FORGOT'`;
  `QuestionAttempt.confidence: ReviewConfidence | null`, `QuestionAttempt.source: 'DAILY_REVIEW' | null`;
  `StudyPlan.daily_review_enabled: number` (0 | 1); `RecallCheck { id; subject_id; topic_id; rating: RecallRating; checked_at }`;
  `ReviewItem { topicId: string; subjectId: string; kind: 'QUESTION' | 'OPEN'; questionId: string | null; reason: 'LAST_DAY' | 'COOLING' }`.
- SQL v8: `ALTER TABLE question_attempts ADD COLUMN confidence TEXT`, `ADD COLUMN source TEXT`;
  `ALTER TABLE study_plans ADD COLUMN daily_review_enabled INTEGER NOT NULL DEFAULT 1`;
  `daily_reviews (plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE, date TEXT NOT NULL, items_json TEXT NOT NULL, skipped INTEGER NOT NULL DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (plan_id, date))`;
  `recall_checks (id TEXT PRIMARY KEY, subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE, topic_id TEXT NOT NULL REFERENCES topics(id) ON DELETE CASCADE, rating TEXT NOT NULL, checked_at DATETIME DEFAULT CURRENT_TIMESTAMP)`.
- `recordQuestionDiagnosis(params)` ganha `confidence?: ReviewConfidence` e `source?: 'DAILY_REVIEW'` (gravados; ausentes = `NULL`).
- `recordRecallCheck(input: { subjectId: string; topicId: string; rating: RecallRating }): RecallCheck` — atualiza
  `last_studied_at`, não mexe em `mastery_score`, `flushDatabase()`.
- `getRecallChecks(sinceIso?: string): RecallCheck[]`
- `getDailyReview(planId: string, dateKey: string): { items: ReviewItem[]; skipped: boolean; createdAt: string } | null`;
  `saveDailyReview(planId: string, dateKey: string, items: ReviewItem[]): void`; `skipDailyReview(planId: string, dateKey: string): void`.
- `getReviewQuestionCandidates(topicIds: string[]): Record<string, { questionId: string; lastAttemptAt: string | null }[]>` (sem anuladas).
- `getQuestionWithDissection(questionId: string): { question: Question; dissection: AiDissection | null } | null`.
- `getTopicFirstStudyDates(): Record<string, string>` — menor data (ISO) entre sessões, tentativas e registros por tópico.
- `updateStudyPlan` aceita `daily_review_enabled?: number`.

- [ ] Testes que falham: `migrations.test.ts` — banco novo × v1 migrado iguais com as tabelas/colunas da v8, versão final 8.
  `database.test.ts` — `recordQuestionDiagnosis` grava `confidence='SURE'` e `source='DAILY_REVIEW'`; sem elas grava `NULL`;
  `recordRecallCheck` atualiza `last_studied_at` e deixa `mastery_score` igual; `saveDailyReview` → `getDailyReview`
  devolve os itens e `skipped=false`; `skipDailyReview` → `skipped=true`; candidatos ignoram questão anulada e trazem
  `lastAttemptAt` da última tentativa; `getTopicFirstStudyDates` pega a menor das três origens; plano novo nasce com
  `daily_review_enabled = 1`.
- [ ] Rodar `npx vitest run src/__tests__/migrations.test.ts src/__tests__/database.test.ts` → falha; implementar; passa.
- [ ] Commit `feat(revisao): banco da revisão do dia (v8)`.

### Task 2: Autoavaliações na meia-vida
**Files:** `src/lib/cycleEngine.ts`, `src/App.tsx` (carregar `getRecallChecks()` no `refreshData` e no `handleOnboardingComplete`);
teste `src/__tests__/cycleEngine.test.ts`.
**Interfaces:** `calculateDynamicStudyCycle` ganha `recallChecks?: RecallCheck[]`; constante exportada `RECALL_CHECK_WEIGHT = 0.5`.
- [ ] Testes que falham: tópico com 2 "Lembrei bem" tem `memoryHalfLifeDays` igual ao de 1 "dominei"; "Não lembrei" encolhe
  como meia lacuna; "Lembrei em parte" não muda a meia-vida; nenhuma autoavaliação muda `attemptsCount` (não é amostra).
- [ ] Implementar (somar ao `masteredCount`/`baseGapCount` passados a `calculateMemoryDecayBoost`; os contadores expostos em
  `TopicHeatItem` continuam inteiros, só de tentativas e registros); commit `feat(revisao): autoavaliação da revisão na meia-vida`.

### Task 3: Seleção, progresso e diagnóstico (puros)
**Files:** `src/lib/dailyReview.ts`; teste `src/__tests__/dailyReview.test.ts`.
**Interfaces (produces):**
- `selectDailyReview(input: { heat: TopicHeatItem[]; leafTopicIds: Set<string>; studiedDates: Record<string, string[]>; questionCandidates: Record<string, { questionId: string; lastAttemptAt: string | null }[]>; now: Date }): ReviewItem[]`
  — `studiedDates`: datas locais (`localDateKey`) em que cada tópico foi estudado nos últimos 30 dias (sessões, tentativas, registros, autoavaliações).
- `chooseReviewQuestion(candidates): string | null` — nunca respondida primeiro; senão menor `lastAttemptAt`.
- `interleaveBySubject(items: ReviewItem[]): ReviewItem[]`
- `reviewProgress(items: ReviewItem[], today: { attempts: QuestionAttempt[]; recallChecks: RecallCheck[]; questionLogs: QuestionLog[] }, sinceIso: string): { doneTopicIds: Set<string>; nextIndex: number | null }`
  — `QUESTION` concluído por tentativa `DAILY_REVIEW` na questão desde `sinceIso`; `OPEN` por autoavaliação; qualquer um por registro de fora no tópico.
- `deriveDiagnosis(confidence: ReviewConfidence, isCorrect: boolean): SelfDiagnosisType`
- [ ] Testes que falham: `nunca visto não entra`; `estudado hoje fica fora`; `registro de fora conta como estudado`;
  `tópico pai fica fora`; `até 2 do último dia de estudo, o resto dos que mais esfriaram`; `R ≥ 0,9 não é esfriando`;
  `máximo 5, um por tópico`; `com 2 elegíveis devolve 2`; `sem questão vira pergunta aberta`; `prefere questão nunca
  respondida, depois a mais antiga`; `intercala matérias` (A,A,B → A,B,A); progresso pelas três origens e
  `nextIndex = null` quando tudo concluído; `deriveDiagnosis('SURE', true) = 'MASTERED'`, `('GUESS', true) = 'DOUBT'`,
  `('SURE', false) = 'BASE_GAP'`.
- [ ] Implementar; commit `feat(revisao): seleção intercalada dos tópicos esfriando`.

### Task 4: Linha de ânimo e situação (puros)
**Files:** `src/lib/goodMorning.ts`; teste `src/__tests__/goodMorning.test.ts`.
**Interfaces (produces):**
- `greeting(now: Date): 'Bom dia' | 'Boa tarde' | 'Boa noite'` (5–11h / 12–17h / resto).
- `moodLine(input: { sessions: StudySession[]; firstStudyDates: Record<string, string>; topicsById: Record<string, Topic>; now: Date }): string | null`
- `examSituation(input: { plan: StudyPlan; parts: ExamPart[]; progress: ExamPartProgress[]; now: Date }): { daysLine: string | null; parts: { code: string; name: string; coveragePercent: number }[]; warning: string | null }`
  (`ExamPartProgress` de `headerSummary.ts`).
- [ ] Testes que falham: textos exatos das Decisões ("Ontem: 01:40 de estudo em 2 matérias. Você começou 2.1 Arquitetura
  de microsserviços."; "Em 20/10: …"; 3 tópicos começados → "e mais 1"); sem dia anterior → `null`; sessões só de hoje →
  `null`; aviso só para prova com mínimo e ≥ 20 pontos abaixo; empate de provas sem aviso; plano sem provas → `parts` vazio
  e `warning` nulo; sem `exam_date` → `daysLine` nulo; auditoria de jargão nos textos.
- [ ] Implementar; commit `feat(bom-dia): linha de ânimo e situação por prova`.

### Task 5: Revisão na tela
**Files:** `src/features/good-morning/useDailyReview.ts`, `ReviewQuestion.tsx`, `ReviewOpenPrompt.tsx`, `DailyReviewCard.tsx`;
teste `src/__tests__/dailyReviewCard.test.tsx`.
**Interfaces:**
- `useDailyReview(input: { plan: StudyPlan | null; heat: TopicHeatItem[]; topicsBySubject: Record<string, Topic[]>; dataVersion: number; onRecorded: () => void; now?: () => Date }): { items: ReviewItem[]; done: Set<string>; current: ReviewItem | null; skipped: boolean; enabled: boolean; answerQuestion(item: ReviewItem, result: ReviewQuestionResult): void; rateRecall(item: ReviewItem, rating: RecallRating, secondsSpent: number): void; skip(): void; refresh(): void }`
  — lê do banco (sessões, tentativas, registros e autoavaliações dos últimos 30 dias → `studiedDates`; `getReviewQuestionCandidates`);
  sorteia e grava só se ligada e sem revisão do dia; recalcula a chave do dia a cada `refresh`/montagem; depois de gravar
  chama `onRecorded` (o App recarrega domínio, calor e semana).
- `ReviewQuestionResult = { selectedOption: string; isCorrect: boolean; confidence: ReviewConfidence; diagnosis: SelfDiagnosisType; timeSpentSeconds: number }` (exportado de `ReviewQuestion.tsx`).
- `ReviewQuestion({ question, dissection, onSubmit: (r: ReviewQuestionResult) => void, onOutside: () => void })`:
  1) "Antes de responder: quão seguro você está?" — **Tenho certeza / Acho que sei / Chutei**; 2) alternativas (A–E ou
  Certo/Errado por `parseQuestionOptions`) só depois da confiança; 3) correção imediata (gabarito `final_answer`, explicação
  por `RichText` quando houver) + diagnóstico já marcado e trocável; 4) **"Próxima"** grava.
- `ReviewOpenPrompt({ topicLabel, notebookExcerpt: string | null, onRate: (r: RecallRating, secondsSpent: number) => void, onOutside: () => void })`:
  "O que você lembra de ‹tópico›?" (texto livre, não gravado) → **"Ver minhas anotações"** (trecho do caderno por `RichText`
  ou "Você ainda não tem anotações deste tópico.") → **Lembrei bem / Lembrei em parte / Não lembrei**.
- `DailyReviewCard`: título "Revisão do dia · 2 de 4", o tópico do item com a matéria, "Pular a revisão de hoje" (sem
  confirmação, sem penalidade), concluída → "Revisão de hoje feita: 4 tópicos revisados." Cada item concluído grava a sessão
  `REVIEW`. `onOutside` chama `onLogOutside(topicId)` (Task 6).
- [ ] Testes que falham: alternativas só aparecem depois da confiança; acerto com "Tenho certeza" chega ao `onSubmit` com
  `MASTERED` e dá para trocar para `DOUBT`; erro chega com `BASE_GAP`; Certo/Errado mostra dois botões; pergunta aberta só
  mostra as anotações depois do botão e o texto digitado não vai no `onRate`; card mostra "2 de 4" e a mensagem de
  concluída; "Pular" chama `skip`; hook com revisão desligada não grava nada; hook com `now` no dia seguinte sorteia nova;
  auditoria de jargão (`FORBIDDEN_JARGON` como em `routineColumn.test.tsx`).
- [ ] Implementar; commit `feat(revisao): revisão do dia por questão e pergunta aberta`.

### Task 6: Aba "Início", Wizard e ponta a ponta
**Files:** `src/features/good-morning/GoodMorningView.tsx`, `SituationCard.tsx`; `src/App.tsx` (aba `'today'` na
`WorkbenchTab`, inicial quando não há bloco, `startRoutineBlock` troca para `'questions'` se estava em `'today'`,
`onLogOutside(topicId)` → `setLogInvite({ topicId })` e abre a coluna esquerda); `OnboardingWizardModal.tsx` (+ campo
`dailyReviewEnabled` no `OnboardingProfile`, caixa no último passo), `handleOnboardingComplete` grava `daily_review_enabled`;
`e2e/revisao.spec.ts`; `BACKLOG.md`; `docs/handoff/2026-10-22-continuar-no-outro-pc.md`.
- [ ] Testes que falham (unit, `goodMorningView.test.tsx`): ordem saudação → linha de ânimo → Revisão → Situação; sem
  revisão (desligada ou vazia) a seção não aparece; botão "Começar o bloco de ‹matéria›" chama o início do roteiro.
- [ ] E2E `test('revisão do dia: responde, autoavalia, sobrevive a recarregar e não volta depois de feita')` — semear um
  tópico estudado há 10 dias com questão e outro sem questão (`page.clock` + dados pelo próprio app), abrir → aba Início com
  2 itens; responder a questão com confiança; recarregar no meio → "1 de 2" concluído e a mesma seleção; pergunta aberta →
  "Ver minhas anotações" → "Lembrei bem"; "Revisão de hoje feita"; recarregar → continua feita. Captura em `e2e/.screens/`.
- [ ] E2E `test('fazer questões fora do app conclui o item pelo registro rápido')` e `test('revisão desligada no Wizard não aparece')`.
- [ ] `npm test`, `npm run test:e2e` (2 rodadas), `npm run build` verdes; BACKLOG (9c e "Bom dia" com o que foi
  verificado; migração v8) e handoff; `graphify update .`; commit `feat(bom-dia): aba Início com a revisão do dia e a situação`.
- [ ] Revisão independente do branch (um revisor novo) e correções com teste que reproduz cada defeito.
