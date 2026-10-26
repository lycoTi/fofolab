# 13a — Horas por dia e "Sua semana" Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O estudante escolhe os dias de estudo e as horas de cada dia (com folga fixa, semana atípica e "mudar o tempo de hoje"), e a aba Ciclo vira "Plano de estudo" com a semana dia a dia — feito, hoje e previsão.

**Architecture:** Um módulo puro de disponibilidade (`availability.ts`) responde "quantos minutos tem o dia D / a semana S"; o motor do ciclo passa a receber o orçamento da semana corrente; o planejador do dia recebe o orçamento do dia (teto de 02:00 por bloco, Revisão da semana no dia mais longo); um módulo puro de previsão (`weekForecast.ts`) roda o planejador dia a dia para o resto da semana. UI nova em `src/features/study-plan/`; o `App.tsx` só liga um hook.

**Tech Stack:** React 19 + TypeScript strict, sql.js, Vitest (+ Testing Library), Playwright (Edge), Tailwind.

**Spec:** `docs/specs/13-plano-de-estudo.md` (§4.1, §4.2, §4.4, §5; entrega 13a em §6).

## Global Constraints
- Tempo na tela sempre em HH:mm: `formatDuration()` de `src/lib/timeFormat.ts`.
- Textos e comentários em pt-BR; nenhum termo proibido de `.agents/rules/ui-clean-design-and-tdd.md` (auditoria `uiCleanliness.test.tsx`).
- Contrato SQL mudou → migração **v11** em `src/lib/migrations.ts` e `LATEST_SCHEMA_VERSION = 11`; o teste de migrações compara banco novo × migrado.
- Orçamento semanal fixo, soma zero: a soma dos blocos de todos os dias da semana nunca passa do orçamento da semana.
- Componentes até ~250 linhas; sem ternário aninhado; guard clauses.
- Dark mode do projeto: fundo `bg-slate-950`, superfícies `bg-slate-900/70` + `border-slate-800`, destaque `orange-500`; feito `emerald`; folga em tom neutro (`slate`), nunca vermelho.
- Semana começa na segunda (`startOfWeek` de `cycleEngine.ts`); datas locais `'YYYY-MM-DD'` (`localDateKey` de `database.ts`).
- Nada de penalidade/cobrança na tela (anti-objetivo da spec 13 §2).

## Review Focus
1. **Semana inteira de folga** (todos os dias desligados, orçamento 0): nada de NaN, nenhum bloco inventado, a semana mostra só "Folga" e o motor não força os 60 min mínimos de hoje.
2. **"Mudar o tempo de hoje" para menos do que já foi estudado hoje:** os blocos feitos continuam feitos, nada fica negativo, e o roteiro some só o que falta.
3. **Plano antigo sem padrão de horas** (`weekday_minutes_json` nulo, horas como 31,5): o padrão nasce de `weekly_hours_target ÷ 7` e o ciclo de quem não editou nada não muda (diferença ≤ 7 min por arredondamento).
4. **Dia longo com poucas matérias pendentes** (sábado 06:00, só 2 matérias com tempo na semana): bloco ≤ 02:00, matéria só repete quando não há outra com tempo, e com outro tópico.
5. **Exceção de outra semana/data**: uma folga gravada para 03/11 não pode mexer na semana de 26/10; virar a meia-noite troca o "hoje" sem levar a exceção de ontem.

---

### Task 1: Banco — padrão de horas, reta final e exceções por data (migração v11)

**Files:**
- Modify: `docs/specs/01-database-schema.sql` (colunas em `study_plans`; tabela nova)
- Modify: `src/lib/migrations.ts` (v11, `LATEST_SCHEMA_VERSION = 11`)
- Modify: `src/types/database.ts` (`StudyPlan`)
- Modify: `src/lib/database.ts` (funções abaixo)
- Test: `src/__tests__/migrations.test.ts`, `src/__tests__/studyPlanHours.test.ts` (novo)

**Interfaces:**
- Produces:
  - `StudyPlan.weekday_minutes_json?: string | null` — JSON de 7 inteiros seg–dom.
  - `StudyPlan.final_stretch_days?: number` — padrão 14 (usado na 13b).
  - Tabela `plan_day_overrides(plan_id TEXT NOT NULL REFERENCES study_plans(id) ON DELETE CASCADE, date TEXT NOT NULL, minutes INTEGER NOT NULL, PRIMARY KEY (plan_id, date))`.
  - `updateWeekdayMinutes(planId: string, minutes: WeekdayMinutes): StudyPlan | null` — grava o JSON e `weekly_hours_target = soma ÷ 60`.
  - `getDayOverrides(planId: string, fromKey: string, toKey: string): Record<string, number>` (inclusive).
  - `setDayOverride(planId: string, dateKey: string, minutes: number | null): void` — `null` apaga.
  - `setWeekOverride(planId: string, weekStartKey: string, minutes: WeekdayMinutes | null): void` — grava/apaga os 7 dias da semana.
  - Tipo `WeekdayMinutes` vem da Task 2 (`src/lib/availability.ts`); declare-o lá primeiro, ou nesta task e mova na 2.

- [ ] **Step 1: Testes que falham**
  - `migrations.test.ts`: o caso que compara banco novo × v1 migrado passa a incluir `weekday_minutes_json`, `final_stretch_days` e `plan_day_overrides`; migrar um plano com `weekly_hours_target = 31.5` deixa `weekday_minutes_json = '[270,270,270,270,270,270,270]'` e `final_stretch_days = 14`; migração idempotente (rodar o `up` duas vezes não falha).
  - `studyPlanHours.test.ts` ('horas por dia gravam e voltam depois de salvar e reabrir o banco'): `updateWeekdayMinutes(id, [150,150,150,150,150,300,0])` → `weekly_hours_target === 17.5`; `setDayOverride(id,'2026-10-27',60)` e `setWeekOverride(id,'2026-11-02',[0,0,0,0,0,0,0])` → `getDayOverrides(id,'2026-10-26','2026-11-08')` tem `'2026-10-27': 60` e os 7 dias de 02/11 a 08/11 com 0; `setDayOverride(id,'2026-10-27',null)` remove; apagar o plano apaga as exceções. Use o padrão de banco real em Node que os outros testes de `database.ts` já usam.
- [ ] **Step 2:** `npx vitest run src/__tests__/migrations.test.ts src/__tests__/studyPlanHours.test.ts` → FAIL (colunas/funções não existem).
- [ ] **Step 3: Implementar.** Migração v11 idempotente no estilo da v8/v9 (`PRAGMA table_info` antes de cada `ALTER`); o `UPDATE` que preenche `weekday_minutes_json` usa `round(weekly_hours_target * 60 / 7)` em todos os dias só onde ainda é nulo. Contrato SQL com as mesmas colunas (comentário `[v11]`). `createStudyPlan`/cópias de plano em `database.ts` passam a gravar o padrão a partir das horas.
- [ ] **Step 4:** mesmos testes → PASS; `npm test` sem regressão.
- [ ] **Step 5: Commit** `feat(plano): horas por dia da semana e exceções por data no banco (migração v11)`

### Task 2: Disponibilidade — minutos do dia e da semana (módulo puro)

**Files:**
- Create: `src/lib/availability.ts`
- Test: `src/__tests__/availability.test.ts`

**Interfaces:**
- Produces:
  - `type WeekdayMinutes = [number, number, number, number, number, number, number]` (seg … dom).
  - `const WEEKDAY_LABELS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'] as const`.
  - `parseWeekdayMinutes(json: string | null | undefined, weeklyHoursTarget: number): WeekdayMinutes` — JSON inválido/ausente → `round(h×60÷7)` em todos.
  - `weekdayIndex(dateKey: string): number` (0 = segunda).
  - `weekDateKeys(weekStart: Date): string[]` (7 chaves locais).
  - `minutesForDay(dateKey: string, pattern: WeekdayMinutes, overrides: Record<string, number>): number` — exceção vence o padrão.
  - `weekBudgetMinutes(weekStart: Date, pattern: WeekdayMinutes, overrides: Record<string, number>): number`.
  - `weeklyReviewDay(weekStart: Date, pattern: WeekdayMinutes, overrides: Record<string, number>): string | null` — o dia com mais minutos; empate → o mais tarde; tudo 0 → `null`.
  - `weekReviewDuration(weekBudget: number): number` — 10% da semana, entre 30 e 90, arredondado a 5; semana < 300 min → 0 (não cabe revisão separada) **(decisão do plano, ver spec §4.2)**.

- [ ] **Step 1: Testes que falham** (`availability.test.ts`)
  - 'padrão nasce das horas da semana quando não há dias gravados': `parseWeekdayMinutes(null, 31.5)` → sete `270`; `parseWeekdayMinutes('lixo', 14)` → sete `120`.
  - 'exceção do dia vence o padrão; exceção de outra semana não entra': padrão `[150,150,150,150,150,300,0]`, exceções `{'2026-10-27': 60, '2026-11-03': 0}` → `minutesForDay('2026-10-27', …) === 60`, `minutesForDay('2026-11-01', …) === 0`, `weekBudgetMinutes(seg 26/10, …) === 150*4 + 60 + 300 + 0`.
  - 'dia da revisão da semana: o mais longo, empate fica com o mais tarde': padrão `[120,120,120,120,120,300,300]` → domingo `'2026-11-01'`; tudo 0 → `null`.
  - 'tempo da revisão da semana': `weekReviewDuration(1260) === 90`, `weekReviewDuration(600) === 60`, `weekReviewDuration(320) === 30`, `weekReviewDuration(240) === 0`.
- [ ] **Step 2:** `npx vitest run src/__tests__/availability.test.ts` → FAIL.
- [ ] **Step 3:** implementar em `src/lib/availability.ts` (datas locais, sem `toISOString` para chave de dia).
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plano): disponibilidade por dia e por semana`

### Task 3: Motor do ciclo recebe o orçamento da semana corrente

**Files:**
- Modify: `src/lib/cycleEngine.ts` (`calculateDynamicStudyCycle`)
- Test: `src/__tests__/cycleEngine.test.ts`

**Interfaces:**
- Consumes: nada novo.
- Produces: parâmetro opcional `weeklyMinutesBudget?: number` em `calculateDynamicStudyCycle`. Ausente → comportamento atual (`max(60, weekly_hours_target×60)`). Presente → usado como está, **inclusive 0**.

- [ ] **Step 1: Testes que falham**
  - 'orçamento da semana vindo dos dias: soma zero com o valor recebido': com `weeklyMinutesBudget: 900`, `totalWeeklyMinutesBudget === 900` e a soma de `recommendedWeeklyMinutes` das alocações ≤ 900 (mesma invariante dos testes atuais).
  - 'semana inteira de folga': `weeklyMinutesBudget: 0` → `totalWeeklyMinutesBudget === 0`, todas as alocações com `recommendedWeeklyMinutes === 0` e `remainingThisWeekMinutes === 0`, nenhum `NaN` em nenhum número do resultado.
  - 'plano antigo sem padrão: o ciclo quase não muda': plano com `weekly_hours_target = 10.5` calculado sem o parâmetro × com `weeklyMinutesBudget: 7 * round(10.5×60÷7)` → a soma das diferenças de `recommendedWeeklyMinutes` entre as matérias ≤ 7.
- [ ] **Step 2:** `npx vitest run src/__tests__/cycleEngine.test.ts` → FAIL.
- [ ] **Step 3:** implementar; conferir as divisões que usam o orçamento (`dailyAverageMinutes`, pisos da nota mínima — o piso total nunca passa do orçamento) para o caso 0.
- [ ] **Step 4:** PASS + `npx vitest run src/__tests__/editalCycle.test.ts` (piso da nota mínima) sem regressão.
- [ ] **Step 5: Commit** `feat(plano): ciclo usa o orçamento da semana corrente`

### Task 4: Planejador do dia — orçamento do dia, teto de 02:00 e Revisão da semana

**Files:**
- Modify: `src/lib/dailyPlanner.ts`, `src/lib/dailyRoutine.ts`, `src/types/database.ts` (`FrozenBlock`)
- Test: `src/__tests__/dailyPlannerAndExplainability.test.ts`, `src/__tests__/dailyRoutine.test.ts`

**Interfaces:**
- Consumes: `weekReviewDuration` (Task 2) — quem chama decide se hoje é o dia e passa os minutos.
- Produces:
  - `planDailyBlocks({ cycleData, topicsBySubject, weeklyHoursTarget, dayMinutesBudget?: number, weekReviewMinutes?: number, excludeTopicIds?: ReadonlySet<string> })`. `dayMinutesBudget` ausente → `round(weeklyHoursTarget×60÷7)` (hoje). `excludeTopicIds` é para a previsão (Task 5).
  - `DailyFocusBlock.kind: 'STUDY' | 'WEEK_REVIEW'`; `FrozenBlock.kind?: 'WEEK_REVIEW'` (ausente = estudo, para os roteiros já gravados).
  - Constantes exportadas: `MAX_BLOCK_MINUTES = 120`, `LONG_DAY_MINUTES = 180`, `MAX_BLOCKS_LONG_DAY = 4`.
  - `routineProfileKey(plan, subjects, topicsBySubject, dayMinutes: number)` — o orçamento do dia entra na assinatura (mudar o tempo de hoje regrava o roteiro).

- [ ] **Step 1: Testes que falham**
  - 'dia de até 03:00 continua como hoje': `dayMinutesBudget: 150` → no máximo 2 blocos, os mesmos de antes para o mesmo `cycleData`.
  - 'dia longo: bloco de no máximo 02:00, sem repetir matéria enquanto houver outra': `dayMinutesBudget: 360` com 4 matérias pendentes → 3 ou 4 blocos, todos ≤ 120, matérias distintas, soma ≤ 360; com só 2 matérias pendentes (cada uma com ≥ 200 min na semana) → a repetição acontece com outro tópico.
  - 'orçamento do dia 0 → nenhum bloco'.
  - 'Revisão da semana: um bloco no tópico estudado que mais esfriou': com `weekReviewMinutes: 60` e dois tópicos já estudados (meia-vida/dias diferentes) → um bloco `kind: 'WEEK_REVIEW'` de 60 min no de menor chance de lembrar (`2^(−dias÷meia-vida)`, campos `daysSinceLastStudy` e `memoryHalfLifeDays` de `TopicHeatItem`), dentro do orçamento do dia, com o motivo citando há quantos dias o tópico foi estudado; sem tópico estudado → nenhum bloco de revisão e os 60 min vão para estudo.
  - `dailyRoutine.test.ts`: `freezeDailyPlan` leva o `kind`; `buildRoutine` conta o bloco de revisão pelas sessões da matéria do tópico, como os outros; `routineProfileKey` muda quando `dayMinutes` muda.
- [ ] **Step 2:** `npx vitest run src/__tests__/dailyPlannerAndExplainability.test.ts src/__tests__/dailyRoutine.test.ts` → FAIL.
- [ ] **Step 3:** implementar. Ordem no `planDailyBlocks`: (1) separa os minutos da revisão; (2) monta os blocos de estudo com o teto; (3) põe o bloco de revisão por último no dia. Motivo do bloco de revisão em linguagem humana: "Revisão da semana: ‹código título› foi estudado há ‹N› dias".
- [ ] **Step 4:** PASS; `useDailyRoutine.test.tsx` e `routineColumn.test.tsx` sem regressão (ajustar só a chamada de `routineProfileKey`).
- [ ] **Step 5: Commit** `feat(plano): roteiro do dia pelas horas do dia, blocos de até 02:00 e revisão da semana`

### Task 5: Previsão da semana (módulo puro)

**Files:**
- Create: `src/lib/weekForecast.ts`
- Test: `src/__tests__/weekForecast.test.ts`

**Interfaces:**
- Consumes: Task 2 (`weekDateKeys`, `minutesForDay`, `weeklyReviewDay`, `weekReviewDuration`, `weekBudgetMinutes`), Task 4 (`planDailyBlocks`).
- Produces:
  - `interface ForecastBlock { subjectId: string; topicId: string | null; minutes: number; kind: 'STUDY' | 'WEEK_REVIEW' }`
  - `interface DayForecast { dateKey: string; label: string /* 'Ter 27' */; plannedMinutes: number; studiedMinutes: number; rest: boolean; when: 'past' | 'today' | 'future'; blocks: ForecastBlock[] }`
  - `forecastWeek(input: { weekStart: Date; now: Date; pattern: WeekdayMinutes; overrides: Record<string, number>; cycleData: CycleCalculationResult; topicsBySubject: Record<string, Topic[]>; weekSessions: StudySession[]; todayBlocks: FrozenBlock[]; reviewEnabled: boolean }): DayForecast[]`

Regras: dias passados = blocos das sessões do dia (agrupadas por matéria+tópico, minutos somados); hoje = `todayBlocks`; dias futuros = `planDailyBlocks` com o orçamento do dia, sobre uma cópia de `cycleData` cujas alocações têm `remainingThisWeekMinutes` descontado do que os dias anteriores da previsão já usaram, e `excludeTopicIds` com os tópicos já usados na semana (liberados quando não sobra outro tópico da matéria). A revisão entra só em `weeklyReviewDay` e só se `reviewEnabled`. Sobra da semana não vai para nenhum dia.

- [ ] **Step 1: Testes que falham** (`weekForecast.test.ts`, `now` = terça 27/10/2026 10:00)
  - 'passado, hoje e futuro': segunda tem sessões → `when: 'past'` com `studiedMinutes` igual à soma; terça = os `todayBlocks`; quarta a domingo `future`.
  - 'folga fixa': padrão com domingo 0 → `rest: true`, sem blocos.
  - 'previsão respeita as horas de cada dia e a soma zero': para cada dia futuro, soma dos blocos ≤ minutos do dia; soma de passado + hoje + futuro ≤ orçamento da semana.
  - 'o que não foi feito não vira dívida': segunda sem nenhuma sessão → os dias futuros não ganham minutos além dos próprios.
  - 'tópico não repete na semana enquanto houver outro'.
  - 'revisão da semana só no dia mais longo e só com a Revisão do dia ligada'.
  - 'semana inteira de folga': padrão todo 0 → os 7 dias `rest: true`, nenhum bloco, nenhum `NaN`.
- [ ] **Step 2:** `npx vitest run src/__tests__/weekForecast.test.ts` → FAIL.
- [ ] **Step 3:** implementar.
- [ ] **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plano): previsão da semana dia a dia`

### Task 6: Editor de dias e horas (componente compartilhado)

**Files:**
- Create: `src/features/study-plan/WeekdayHoursEditor.tsx`
- Test: `src/__tests__/weekdayHoursEditor.test.tsx`

**Interfaces:**
- Consumes: `WeekdayMinutes`, `WEEKDAY_LABELS` (Task 2).
- Produces: `WeekdayHoursEditor({ value: WeekdayMinutes; onChange: (next: WeekdayMinutes) => void; title?: string })`. Topo: **"Em quais dias você estuda?"** — 7 botões liga/desliga (`aria-pressed`). Abaixo, só os dias ligados, cada um com o tempo em HH:mm (passos de 00:30, de 00:30 a 08:00) e o atalho **"Mesmo tempo nos dias de estudo"**. Rodapé: "‹HH:mm› por semana". Desligar um dia grava 0; religar volta ao último tempo daquele dia ou 01:00.

- [ ] **Step 1: Testes que falham**
  - 'desligar o domingo grava 0 e esconde o tempo dele'; 'religar volta ao tempo anterior'.
  - '"Mesmo tempo nos dias de estudo" aplica o tempo só aos dias ligados'.
  - 'total da semana em HH:mm' (ex.: `[150,150,150,150,150,300,0]` → "17:30 por semana"); nenhum termo proibido no texto.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (≤ 250 linhas, acessível por teclado). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plano): editor de dias de estudo e horas`

### Task 7: Aba "Plano de estudo" — Sua semana, Ajustar e semana atípica

**Files:**
- Create: `src/features/study-plan/useWeekAvailability.ts`, `src/features/study-plan/WeekView.tsx`, `src/features/study-plan/DayCard.tsx`, `src/features/study-plan/StudyPlanView.tsx`
- Modify: `src/App.tsx` (rótulo da aba, troca de `CycleView` por `StudyPlanView`, `weeklyMinutesBudget` e o hook), `src/features/cycle/CycleView.tsx` (sai o `TotalsStrip` e a barra da semana; o resto vira a seção "Divisão da semana" usada pelo `StudyPlanView`, ou é absorvido por ele)
- Modify: `e2e/bancada.spec.ts`, `e2e/roteiro.spec.ts` (botão da aba)
- Test: `src/__tests__/studyPlanView.test.tsx` (novo), `src/__tests__/cycleView.test.tsx` (ajustar: totais saem)

**Interfaces:**
- Consumes: Tasks 1, 2, 3, 5, 6.
- Produces:
  - `useWeekAvailability({ plan: StudyPlan | null; dataVersion: number; now: Date }): { pattern: WeekdayMinutes; overrides: Record<string, number>; weekStart: Date; todayKey: string; todayMinutes: number; weekBudget: number; reviewDayKey: string | null; setPattern(m: WeekdayMinutes): void; setTodayMinutes(m: number | null): void; setThisWeek(m: WeekdayMinutes | null): void }` — lê/grava pelas funções da Task 1 e avisa o App para recarregar (`refreshData`).
  - `StudyPlanView` na ordem da spec §4.4: **Sua semana** (`WeekView` com 7 `DayCard`: rótulo "Ter 27", HH:mm do dia, barra feito × meta em `emerald`/`orange`, blocos "matéria · tópico · HH:mm"; folga = cartão neutro "Folga"; hoje com borda `orange-500`; clicar num dia futuro abre a lista do roteiro previsto dele) → **"Ajustar"** recolhido (o `WeekdayHoursEditor` do padrão; "Só esta semana é diferente" abre um segundo editor para a semana corrente — `setThisWeek` — com "Voltar ao padrão"; a estratégia continua onde está) → sugestões do ciclo → **Divisão da semana por matéria** (lista atual por prova, `CycleSubjectRow`).
  - Rótulo da aba: **"Plano de estudo"** (id `cycle` continua, para não mexer em navegação). Se a barra de abas quebrar a 1.440 px com os dois painéis abertos, usar "Plano".
  - `App.tsx` passa `weeklyMinutesBudget: weekBudget` às duas chamadas de `calculateDynamicStudyCycle` (a do App e a do Wizard).

- [ ] **Step 1: Testes que falham** (`studyPlanView.test.tsx`)
  - 'mostra os 7 dias com as horas de cada um e "Folga" no dia desligado'.
  - 'hoje destacado; dia passado com o feito; dia futuro com a previsão'.
  - 'saem os totais "Este ano" e "Desde o começo"' (e `cycleView.test.tsx` deixa de esperar por eles).
  - '"Só esta semana é diferente" grava a semana e "Voltar ao padrão" apaga' (com o hook usando o banco real em Node).
  - `useWeekAvailability`: 'virar o dia troca o hoje e não leva a exceção de ontem' — `now` em 27/10 com exceção 60 min em 27/10 → `todayMinutes === 60`; `now` em 28/10 → `todayMinutes` = padrão de quarta.
  - Nenhum termo proibido; todo tempo em HH:mm.
- [ ] **Step 2:** FAIL. **Step 3:** implementar; cada componente ≤ 250 linhas. **Step 4:** PASS; `npm test` inteiro sem regressão.
- [ ] **Step 5: Commit** `feat(plano): aba Plano de estudo com a semana dia a dia`

### Task 8: "Mudar o tempo de hoje" na coluna do roteiro

**Files:**
- Create: `src/features/routine/TodayTimeControl.tsx`
- Modify: `src/features/routine/useDailyRoutine.ts` (parâmetros `dayMinutes`, `weekReviewMinutes`), `src/features/routine/RoutineColumn.tsx` (ao lado de "Hoje · HH:mm"), `src/App.tsx` (passa os valores do `useWeekAvailability`)
- Test: `src/__tests__/routineColumn.test.tsx`, `src/__tests__/useDailyRoutine.test.tsx`

**Interfaces:**
- Consumes: Task 4 (`planDailyBlocks` com `dayMinutesBudget`/`weekReviewMinutes`, `routineProfileKey` com `dayMinutes`), Task 7 (`setTodayMinutes`).
- App passa ao `useDailyRoutine`: `dayMinutes = todayMinutes` e `weekReviewMinutes = (reviewDayKey === todayKey && plan.daily_review_enabled !== 0) ? weekReviewDuration(weekBudget) : 0` (escrever com `if`, sem ternário aninhado).
- Produces: `TodayTimeControl({ minutes: number; onChange: (m: number | null) => void })` — "Mudar o tempo de hoje" abre: tempos em HH:mm (passos de 00:30) e **"Hoje não vou estudar"** (grava 0); "Voltar ao tempo de sempre" (`null`). Ao mudar, a assinatura do perfil muda e o roteiro de hoje é regravado pelo mecanismo que já existe.

- [ ] **Step 1: Testes que falham**
  - `useDailyRoutine.test.tsx`: 'mudar o tempo de hoje regrava o roteiro: blocos feitos continuam feitos, o resto encolhe' — com 01:30 já estudado num bloco de 01:30 e o dia passando de 02:30 para 01:00, o roteiro tem o bloco feito e nenhum bloco a fazer, nada negativo.
  - `routineColumn.test.tsx`: '"Hoje não vou estudar" deixa a coluna com uma mensagem neutra, sem cobrança' (texto sem "atrasado", "falta", vermelho).
- [ ] **Step 2:** FAIL. **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plano): mudar o tempo de hoje pela coluna do roteiro`

### Task 9: Wizard pergunta os dias e as horas

**Files:**
- Modify: `src/features/onboarding-wizard/OnboardingWizardModal.tsx` (passo 2), `src/App.tsx` (`handleOnboardingComplete`)
- Test: o teste do Wizard existente em `src/__tests__/` (procure por `OnboardingWizardModal`)

**Interfaces:**
- Consumes: Task 1 (`updateWeekdayMinutes`), Task 6 (`WeekdayHoursEditor`).
- Produces: `OnboardingProfile.weekdayMinutes: WeekdayMinutes` (o `weeklyHours` vira a soma ÷ 60; `dailyHours` sai). Passo 2: título "Em quais dias e quanto tempo você consegue estudar?"; os 5 tempos rápidos atuais viram o atalho de "mesmo tempo nos dias de estudo"; abaixo, o `WeekdayHoursEditor`. `handleOnboardingComplete` grava com `updateWeekdayMinutes`.

- [ ] **Step 1: Teste que falha:** 'Wizard grava os dias de estudo: domingo desligado e sábado 05:00 chegam ao plano'.
- [ ] **Step 2:** FAIL. **Step 3:** implementar (o Wizard já passa de 250 linhas — dívida conhecida; não aumentar: o passo 2 vira `HoursStep.tsx` próprio). **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plano): Wizard pergunta os dias de estudo e as horas de cada um`

### Task 10: E2E, documentação e verificação final

**Files:**
- Create: `e2e/plano.spec.ts`
- Modify: `BACKLOG.md`, `docs/handoff/2026-10-24-estado-e-proxima-ia.md`, `docs/specs/13-plano-de-estudo.md` (status no topo), `CLAUDE.md` (mapa do código: `src/features/study-plan/`, `availability.ts`, `weekForecast.ts`)

- [ ] **Step 1: E2E** `plano.spec.ts` com o relógio fixo numa terça (`page.clock.install({ time: new Date('2026-10-27T09:00:00') })`): abrir "Plano de estudo" → "Ajustar" → desligar domingo, sábado 05:00 → a semana mostra "Folga" no domingo e 05:00 no sábado → coluna: "Mudar o tempo de hoje" → 01:00 → "Hoje · 01:00" → recarregar a página → tudo continua; captura em `e2e/.screens/`.
- [ ] **Step 2:** `npm test`, `npm run test:e2e` (duas rodadas) e `npm run build` → tudo verde. Conferir à mão no `npm run dev` com o plano real da CGU: a semana dia a dia e "Mudar o tempo de hoje".
- [ ] **Step 3:** BACKLOG (13a [DONE] só com tudo da definição de pronto; senão [PARCIAL] com o que falta), handoff, spec 13 (status), `CLAUDE.md`; `graphify update .`.
- [ ] **Step 4: Commit** `docs: 13a — horas por dia e Sua semana`
