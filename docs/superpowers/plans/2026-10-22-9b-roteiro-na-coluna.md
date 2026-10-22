# 9b — Roteiro do dia na coluna esquerda: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A coluna esquerda vira o roteiro de hoje (bloco atual aberto, os outros recolhidos), "Meu Dia" e "Bancada Pro" viram uma tela só, e clicar num tópico fora do roteiro é uma "olhada" que pausa o relógio sem mexer no roteiro.

**Architecture:** O roteiro do dia é congelado no banco na primeira abertura (`daily_plans`, migração v5) e classificado em feito/atual/próximo a partir das sessões do dia (`src/lib/dailyRoutine.ts`, puro). A olhada é um hook (`usePeek`) que compara o tópico selecionado com o tópico do bloco e pausa/retoma o bloco. `RoutineColumn` substitui o `SyllabusTreeDock` dentro do `SidePanel` esquerdo da 9a; o modo `daily` e o `DailyFocusView` saem.

**Tech Stack:** React 19, TypeScript strict, sql.js, Vitest + Testing Library, Playwright (Edge).

**Spec:** `docs/specs/09-bancada-roteiro-e-revisao.md` (§5.2, §5.3.1, §5.4). Base: 9a pronta (`docs/superpowers/plans/2026-10-22-9a-casca-da-bancada.md`).

## Global Constraints
- Textos em pt-BR, sem jargão técnico; tempo em HH:mm com `formatDuration`; componentes ≤ ~250 linhas; sem ternário aninhado.
- Sem penalidade: olhada, pausa e dica nunca geram alerta vermelho, contagem de falhas ou tom de bronca.
- O estudante **não escolhe** o roteiro: ele vem do motor (`planDailyBlocks`); ajustes só pela recalibragem.
- Bloco = um tópico "folha" (opção a). Irmão (mesmo `parent_id`) clicado = olhada.
- Mudou o contrato SQL → migração em `src/lib/migrations.ts`, `LATEST_SCHEMA_VERSION` 4 → **5**, e `docs/specs/01-database-schema.sql`. A Revisão do dia (9c) usará a **v6** (a spec citava v5 para as duas; v5 fica só com `daily_plans`).
- Dica da olhada: depois de **3 min** (`PEEK_NUDGE_MS = 180_000`), **uma vez** por olhada.
- Antes de encerrar: `npm test`, `npm run test:e2e`, `npm run build` verdes; BACKLOG; `graphify update .`.

## Review Focus
1. **Virada do dia com o app aberto** (estudo depois da meia-noite): o roteiro de ontem não pode ficar como o de hoje → a chave do dia é recalculada ao recarregar os dados; o roteiro novo é congelado. *(Task 1/5: teste de chave por data.)*
2. **Pausa manual antes da olhada**: voltar ao bloco não pode retomar um relógio que o estudante pausou → só retoma o que a olhada pausou. *(Task 3.)*
3. **Bloco sem tópico** (matéria sem tópicos cadastrados): coluna mostra só a matéria, olhada nunca dispara por causa dele, "Iniciar" funciona. *(Task 2 e Task 4.)*
4. **Roteiro congelado aponta para tópico/matéria apagados depois**: bloco órfão some do roteiro em vez de quebrar a tela. *(Task 2.)*
5. **Plano trocado no Edital** no meio do dia: o roteiro é do plano ativo (chave = plano + data). *(Task 1.)*

---

### Task 1: Roteiro congelado no banco (migração v5)

**Files:**
- Modify: `src/lib/migrations.ts` (nova migração 5), `docs/specs/01-database-schema.sql`, `src/lib/database.ts` (seção nova "Roteiro do dia"), `src/types/database.ts`
- Test: `src/__tests__/migrations.test.ts`, `src/__tests__/database.test.ts`

**Interfaces:**
- Produces:
  - `interface FrozenBlock { blockNumber: number; subjectId: string; topicId: string | null; durationMinutes: number; reasonText: string }` em `src/types/database.ts` (nomes/cores vêm dos dados vivos na hora de mostrar).
  - `getDailyPlan(planId: string, dateKey: string): FrozenBlock[] | null`
  - `saveDailyPlan(planId: string, dateKey: string, blocks: FrozenBlock[]): void` (upsert; grava com `persistDatabase()`)
  - `clearDailyPlan(planId: string, dateKey: string): void`
  - `localDateKey(date: Date): string` passa a ser exportada de `database.ts` (já existe, privada) e o `localDateStamp()` do `App.tsx` passa a usá-la.
- Tabela: `daily_plans (plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE, date TEXT NOT NULL, blocks_json TEXT NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP, PRIMARY KEY (plan_id, date))`.

- [ ] **Step 1: Failing tests** — em `migrations.test.ts`, o teste que compara banco novo × migrado já cobre o contrato: incluir `daily_plans` na lista de tabelas esperadas e `LATEST_SCHEMA_VERSION === 5`. Em `database.test.ts`: `it('guarda o roteiro do dia por plano e data')` — `saveDailyPlan('p1','2026-10-22',[b])` → `getDailyPlan('p1','2026-10-22')` igual a `[b]`; `getDailyPlan('p1','2026-10-23')` é `null`; `getDailyPlan('p2','2026-10-22')` é `null`; salvar de novo substitui; `clearDailyPlan` → `null`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/migrations.test.ts src/__tests__/database.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** migração v5 (`description: 'Roteiro do dia congelado (spec 09)'`), o mesmo `CREATE TABLE` no SQL do contrato, as três funções e o export de `localDateKey`.
- [ ] **Step 4: Run** os mesmos testes — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(roteiro): roteiro do dia congelado no banco (v5)`

---

### Task 2: Roteiro classificado (feito / atual / próximo)

**Files:**
- Create: `src/lib/dailyRoutine.ts`
- Test: `src/__tests__/dailyRoutine.test.ts`

**Interfaces:**
- Consumes: `FrozenBlock`, `DailyPlan`/`DailyFocusBlock` de `src/lib/dailyPlanner.ts`, `StudySession`, `Subject`, `Topic`.
- Produces:
  - `freezeDailyPlan(plan: DailyPlan): FrozenBlock[]`
  - `type RoutineStatus = 'done' | 'current' | 'next'`
  - `interface RoutineItem { block: FrozenBlock; subject: Subject; topic: Topic | null; status: RoutineStatus; studiedMinutes: number; remainingMinutes: number }`
  - `buildRoutine(params: { blocks: FrozenBlock[]; subjects: Subject[]; topicsBySubject: Record<string, Topic[]>; todaySessions: StudySession[] }): RoutineItem[]`
  - `routineSiblings(topic: Topic | null, topicsBySubject: Record<string, Topic[]>): Topic[]` — mesmo `parent_id` (não nulo), sem o próprio, em ordem de `code`.
  - `pickExtraBlock(live: DailyPlan, frozen: FrozenBlock[]): FrozenBlock | null` — primeiro bloco do planejador vivo cujo tópico não está no congelado; senão o primeiro; `null` se o planejador não tiver blocos.

- [ ] **Step 1: Failing tests** (`dailyRoutine.test.ts`), com sessões de hoje (`session_type` diferente de `'REVIEW'`):
  - `it('bloco vira feito quando o tempo de hoje na matéria alcança a duração')` — blocos A (TI, 60) e B (CASP, 40); sessões TI 35 + 25 → A `done`, B `current`, `A.studiedMinutes === 60`.
  - `it('o primeiro bloco não feito é o atual, os seguintes são próximos')` — sem sessões → A `current` (`remainingMinutes` 60), B `next`.
  - `it('tempo de revisão não conta para o bloco')` — sessão TI `session_type: 'REVIEW'` 60 → A continua `current`.
  - `it('bloco cuja matéria foi apagada sai do roteiro')` — bloco com `subjectId` inexistente não aparece; bloco com `topicId` apagado aparece com `topic === null`.
  - `it('irmãos são os tópicos do mesmo grupo')` — tópicos 2.2.1, 2.2.2, 2.2.3 com o mesmo pai → `routineSiblings(2.2.1)` = [2.2.2, 2.2.3]; tópico sem pai → `[]`.
  - `it('bloco extra vem do motor e evita repetir tópico do dia')`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/dailyRoutine.test.ts` — Expected: FAIL.
- [ ] **Step 3: Implement** as funções. Tempo do bloco = soma de `duration_minutes` das sessões de hoje com `subject_id === block.subjectId` e `session_type !== 'REVIEW'`, distribuída na ordem dos blocos (dois blocos da mesma matéria consomem o tempo em sequência).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(roteiro): roteiro do dia classificado em feito, atual e próximo`

---

### Task 3: Olhada com pausa automática

**Files:**
- Create: `src/features/routine/usePeek.ts`
- Test: `src/__tests__/peek.test.tsx`

**Interfaces:**
- Consumes: `StudyBlockController` (`state.running`, `state.phase`, `state.block`, `pause()`, `resume()`) de `useStudyBlock.ts`; `Topic`.
- Produces:
  - `type PeekKind = 'none' | 'sibling' | 'outside'`
  - `peekKind(selected: Topic | null, blockTopic: Topic | null): PeekKind` — `'none'` se não há tópico selecionado, não há tópico de bloco, ou são o mesmo; `'sibling'` se mesmo `parent_id` não nulo; senão `'outside'`.
  - `export const PEEK_NUDGE_MS = 180_000;`
  - `usePeek(params: { selectedTopic: Topic | null; blockTopic: Topic | null; studyBlock: StudyBlockController }): { kind: PeekKind; pausedByPeek: boolean; showNudge: boolean }`
  - Regras: ao entrar em olhada (`kind` passa de `'none'` a outro) com `phase === 'FOCUS'`, `running` e `state.block?.topicId === blockTopic.id` → `pause()` e `pausedByPeek = true`. Ao voltar para `'none'` com `pausedByPeek` → `resume()`. Se o estudante retomar à mão durante a olhada (`running` volta a `true`), `pausedByPeek = false`. `showNudge` fica `true` após `PEEK_NUDGE_MS` contínuos de olhada, só uma vez por olhada.

- [ ] **Step 1: Failing tests** (`vi.useFakeTimers()`, controlador falso com `vi.fn()`):
  - `it('classifica a olhada: mesmo tópico, irmão ou fora')`.
  - `it('entrar na olhada pausa o bloco em foco e voltar retoma')`.
  - `it('não retoma um bloco que o estudante já tinha pausado')` — `running: false` antes da olhada → `resume` nunca chamado.
  - `it('dica aparece uma vez depois de 3 min de olhada')` — avança 179 s → `false`; 1 s → `true`; volta e entra de novo → `false` até mais 3 min.
  - `it('bloco sem tópico nunca vira olhada')`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/peek.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** `peekKind` e `usePeek` (efeito em `kind`; `setTimeout` de `PEEK_NUDGE_MS` limpo ao sair).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(roteiro): olhada fora do roteiro pausa e retoma o bloco`

---

### Task 4: Coluna do roteiro

**Files:**
- Create: `src/features/routine/RoutineColumn.tsx`, `src/features/routine/RoutineBlockItem.tsx`, `src/features/routine/PeekBanner.tsx`
- Test: `src/__tests__/routineColumn.test.tsx`

**Interfaces:**
- Consumes: `RoutineItem`, `routineSiblings` (Task 2), `PeekKind` (Task 3).
- Produces:
  - `RoutineColumn(props: { items: RoutineItem[]; dayTotalMinutes: number; weekStudiedMinutes: number; weekTargetMinutes: number; extraBlock: RoutineItem | null; selectedTopicId: string | null; blockRunning: boolean; siblings: Topic[]; materials: { pdfLabel: string | null; questionCount: number; hasNotes: boolean }; peek: { kind: PeekKind; topicLabel: string; showNudge: boolean; nudgeText: string } | null; onStartBlock: (item: RoutineItem) => void; onSelectTopic: (subjectId: string, topicId: string) => void; onReturnToBlock: () => void; onOpenMaterial: (kind: 'pdf' | 'questions' | 'notes') => void; onOpenCycle: () => void; onOpenEdital: () => void; adminToggle: ReactNode })`
  - Textos fixos: título `Hoje · {HH:mm}`; bloco feito com "✓" e esmaecido; bloco atual com `código título`, irmãos (botões), atalhos "PDF p. X/Y", "N questões", "Caderno", botão **"Iniciar bloco"** (só se não estiver rodando); próximos recolhidos com o `reasonText`; quando o bloco anterior ao atual está feito, uma linha discreta acima do atual: "Intervalo sugerido de 10 minutos antes deste bloco" (mesmo texto do antigo Meu Dia); pé "Semana: HH:mm de HH:mm" + botão "Ver ciclo" + botão "Edital" + `adminToggle`; todos feitos → "Roteiro de hoje cumprido" + o bloco extra com "Iniciar bloco extra".
  - `PeekBanner`: `outside` → "Dando uma olhada em ‹rótulo› · fora do roteiro de hoje"; `sibling` → "Olhar ‹rótulo› não conta para o bloco de hoje"; botão "Voltar ao bloco"; `showNudge` → linha extra com `nudgeText` (ex.: "Seu bloco de TI está esperando: faltam 00:41").

- [ ] **Step 1: Failing tests**:
  - `it('mostra o bloco atual aberto, o feito esmaecido e o próximo recolhido com o motivo')`.
  - `it('Iniciar bloco chama onStartBlock com o bloco atual; some quando o bloco já roda')`.
  - `it('atalhos de material abrem a aba certa')` — clicar "PDF…" → `onOpenMaterial('pdf')`; "N questões" → `'questions'`; "Caderno" → `'notes'`.
  - `it('faixa da olhada fala do irmão sem tom de bronca e volta ao bloco')`.
  - `it('roteiro cumprido oferece o bloco extra do motor')`.
  - `it('AUDITORIA DE UX: a coluna não mostra jargão técnico')` — reaproveitar a lista de termos proibidos do teste de UI limpa existente (`SQLite`, `_score`, `0 tokens`, `Seed`, `Cache`…) sobre o `textContent`.
- [ ] **Step 2: Run** `npx vitest run src/__tests__/routineColumn.test.tsx` — Expected: FAIL.
- [ ] **Step 3: Implement** os três componentes (≤ ~250 linhas cada; `RoutineBlockItem` desenha um item conforme o `status`; cores de status do `fofolab-especificos.md`).
- [ ] **Step 4: Run** — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(roteiro): coluna com o roteiro de hoje e a faixa da olhada`

---

### Task 5: Uma tela só — ligar o roteiro no App

**Files:**
- Modify: `src/App.tsx`, `src/features/workbench-shell/AppHeader.tsx` (`modeSwitch` passa a opcional)
- Delete: `src/features/daily-focus/DailyFocusView.tsx`; em `src/__tests__/onboardingAndExplainability.test.tsx`, os dois testes do `DailyFocusView` (o de UX vira o teste de auditoria da Task 4)
- Modify: `src/lib/database.ts` — `getQuestionsForTopicOrSubject` ganha recuo para o grupo

**Interfaces:**
- Consumes: Tasks 1–4.
- Produces: `getQuestionsForTopicOrSubject(topicId, subjectId, scope)` passa a retornar `{ items: { question; dissection }[]; groupCode: string | null }`: com `scope === 'topic'` e nenhuma questão no tópico, devolve as questões dos tópicos do mesmo `parent_id` e `groupCode` = código do pai. `QuestionWorkbench` ganha `groupLabel?: string` e mostra "Questões do grupo ‹código›" acima da lista.

- [ ] **Step 1: Failing test** em `database.test.ts`: `it('tópico sem questões mostra as do grupo')` — questão só em 2.2.2; pedir 2.2.1 com escopo tópico → 1 item e `groupCode '2.2'`; tópico sem pai e sem questões → `[]` e `null`.
- [ ] **Step 2: Implement** o recuo e o rótulo; ajustar os chamadores.
- [ ] **Step 3: App** — remover `experienceMode`, o `modeSwitch`, o ramo `daily` e o `DailyFocusView`; a coluna esquerda (sempre visível no modo estudante) recebe `RoutineColumn` no lugar do `SyllabusTreeDock`; o toggle Estudo/Admin vai como `adminToggle`.
  - Roteiro: ao carregar dados, `dateKey = localDateKey(new Date())`; `getDailyPlan(activePlan.id, dateKey)` ou, se `null`, `freezeDailyPlan(planDailyBlocks(...))` + `saveDailyPlan`. Recalibrar (`handleOnboardingComplete`) chama `clearDailyPlan` e recongela.
  - `todaySessions` = sessões desde o início do dia local (`getStudySessionsSince`).
  - Tópico do bloco = item `current`. `usePeek` com o tópico selecionado; "Voltar ao bloco" seleciona o tópico do bloco. Texto da dica: `Seu bloco de ${matéria} está esperando: faltam ${formatDuration(remainingMinutes)}`.
  - "Iniciar bloco" → `studyBlock.start({ …tópico do item, targetMinutes: remainingMinutes })` e seleciona o tópico do bloco.
  - Atalhos: `pdf` → `selectTab('reader')`; `questions` → `selectTab('questions')`; `notes` → abre a coluna direita na aba Caderno.
- [ ] **Step 4: Run** `npx vitest run` e `npm run build` — Expected: PASS.
- [ ] **Step 5: Commit** — `feat(roteiro): Meu Dia e Bancada numa tela só, com o roteiro na coluna`

---

### Task 6: Tópicos clicáveis viram olhada (Mapa de Calor, Ciclo, Edital)

**Files:**
- Modify: `src/App.tsx` (callbacks), `src/features/cycle/CycleSubjectRow.tsx`, `src/features/cycle/CycleView.tsx`, `src/components/CurriculumManagerModal.tsx`
- Test: `src/__tests__/routineColumn.test.tsx` (ou o teste do ciclo existente)

**Interfaces:**
- Produces: `CycleView`/`CycleSubjectRow` ganham `onOpenSubject?: (subjectId: string) => void` (nome da matéria vira botão); `CurriculumManagerModal` ganha `onOpenTopic?: (subjectId: string, topicId: string) => void` (botão "Abrir na bancada" em cada tópico; fecha o modal).
- No App, as três origens chamam o mesmo `openTopicOnWorkbench(subjectId, topicId)`: seleciona o tópico e vai para a aba Questões. Para matéria (Ciclo), o tópico é o de maior calor da matéria em `cycleData.topicHeatmapRanking` (sem tópicos → só seleciona a matéria).

- [ ] **Step 1: Failing test** — `it('clicar na matéria no Ciclo pede para abrir a matéria na bancada')` — render `CycleSubjectRow` com `onOpenSubject` → clicar no nome chama com o `subject.id`.
- [ ] **Step 2: Implement** os props e o `openTopicOnWorkbench`.
- [ ] **Step 3: Run** `npx vitest run` — Expected: PASS.
- [ ] **Step 4: Commit** — `feat(roteiro): tópicos do Mapa de Calor, do Ciclo e do Edital abrem na bancada como olhada`

---

### Task 7: Aviso discreto de recalibrar

**Files:**
- Create: `src/lib/recalibrationHint.ts`
- Modify: `src/features/routine/RoutineColumn.tsx` (linha no pé, botão "Recalibrar perfil")
- Test: `src/__tests__/dailyRoutine.test.ts`

**Interfaces:**
- Produces: `recalibrationHint(allocations: SubjectCycleAllocation[], ranking: CycleCalculationResult['topicHeatmapRanking']): { subjectName: string; direction: 'harder' | 'easier' } | null`. Nível declarado → domínio esperado: `{ 1: 0, 2: 40, 3: 70, 4: 85 }`. Confiança da matéria = média de `sampleConfidencePercent` dos tópicos dela no ranking. `harder`: confiança ≥ 50 e `studiedTopicsMastery ≤ esperado − 30`. `easier`: nível 1, confiança ≥ 50 e domínio ≥ 70. Retorna o primeiro (maior peso de prova).
- Texto: `harder` → "‹Matéria› está mais difícil do que você marcou. Quer recalibrar?"; `easier` → "‹Matéria› está indo melhor do que você marcou. Quer recalibrar?".

- [ ] **Step 1: Failing tests** — confiança 60, nível 3, domínio 35 → `harder`; confiança 30 → `null`; nível 1, domínio 75, confiança 55 → `easier`.
- [ ] **Step 2–4:** implementar, mostrar na coluna (só texto + botão, sem cor de alerta), rodar `npx vitest run`.
- [ ] **Step 5: Commit** — `feat(roteiro): aviso discreto de recalibrar quando o desempenho contraria a autoavaliação`

---

### Task 8: Verificação ponta a ponta

**Files:**
- Modify: `e2e/bancada.spec.ts`, `e2e/casca.spec.ts` (helpers sem "Bancada Pro"/"Meu Dia de Hoje"; "Iniciar Estudo Direto" → "Iniciar bloco" na coluna)
- Create: `e2e/roteiro.spec.ts`
- Modify: `BACKLOG.md`

- [ ] **Step 1: Ajustar os specs existentes** — `openPro` vira `openApp` (só `goto` + coluna visível); o teste do edital confere a matéria fraca de peso dobrado como **bloco atual da coluna**; o teste do bloco em pomodoros inicia pela coluna.
- [ ] **Step 2: `e2e/roteiro.spec.ts`**:
  - `test('roteiro congelado: recarregar no mesmo dia mantém os blocos')` — guardar os títulos dos blocos, estudar 1 pomodoro (relógio do Playwright), recarregar → mesmos títulos e o 1º com tempo registrado.
  - `test('olhada pelo Mapa de Calor pausa o bloco e "Voltar ao bloco" retoma')` — iniciar bloco, abrir Mapa de Calor, abrir um tópico de outra matéria → faixa "fora do roteiro", relógio "Continuar bloco" (pausado); "Voltar ao bloco" → relógio "Pausar bloco" (rodando) e tópico do bloco selecionado.
  - `test('a dica aparece depois de 3 minutos de olhada')` — `page.clock` avança 3 min → texto "está esperando".
  - Captura `e2e/.screens/09-roteiro-na-coluna.png`.
- [ ] **Step 3: Run** `npm test`, `npm run test:e2e`, `npm run build` — Expected: tudo verde.
- [ ] **Step 4: BACKLOG + grafo** — 9b conforme a DoD; anotar que a 9c usa a migração v6; `graphify update .`.
- [ ] **Step 5: Commit** — `test(roteiro): E2E do roteiro na coluna e backlog da 9b`
