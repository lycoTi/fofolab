# 13b — "Dá tempo?", linha do tempo e reta final Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Plano de estudo responde "dá tempo de ver o edital até a prova?" — pelo plano e pelo ritmo real —, mostra o caminho semana a semana até a prova e, nos últimos dias, o roteiro passa a ser só de revisão.

**Architecture:** Um projetor puro (`src/lib/examProjection.ts`) distribui os tópicos que faltam pelas semanas até a reta final, com o tempo estimado de cada tópico (autoavaliação misturada ao ritmo real) e a divisão por matéria do ciclo; dele saem a linha do tempo e o "Dá tempo?". O planejador do dia ganha o modo reta final (só tópicos já vistos, os mais frios). UI em `src/features/study-plan/`; o App só carrega os fatos (sessões de 4 semanas, primeira vez de cada tópico) num hook.

**Tech Stack:** React 19 + TypeScript strict, sql.js, Vitest, Playwright (Edge), Tailwind 3.4.

**Spec:** `docs/specs/13-plano-de-estudo.md` §4.3 (13b: projetor, "Dá tempo?", linha do tempo, reta final) e §4.4 (ordem na tela).

## Global Constraints
- Tempo na tela em HH:mm (`formatDuration`); textos em pt-BR, sem jargão (`uiCleanliness.test.tsx`); sem ternário aninhado; componentes até ~250 linhas.
- "Visto" = o critério de `editalProgress`: `last_studied_at` preenchido **ou** primeira data em `getTopicFirstStudyDates()`. Só tópicos folha (sem filhos).
- Tempo por tópico: Nunca vi 02:00 · Já vi por cima 01:30 · Sei bem 01:00 · Domino 00:30 (nível do tópico; nulo herda o da matéria), misturado ao ritmo real por `C = n ÷ (n + 5)`.
- Reta final: `study_plans.final_stretch_days` (padrão 14; opções 7, 10, 14, 21), começando exatamente N dias antes da prova.
- Limiares: ritmo real só com 7+ dias desde a primeira sessão; mostrar a linha do ritmo real quando ele for ≥ 10% menor que o plano.
- Cores: emerald (garantido), amber (atenção), orange (foco); nada de vermelho; nada de cobrança.
- Sessões puladas (`was_skipped`) não contam em nenhuma conta.

## Review Focus
1. **Sem data da prova, prova já passou ou hoje já dentro da reta final:** nada quebra (sem NaN, sem semanas negativas); a tela diz o que está acontecendo em vez de projetar.
2. **Plano sem nenhum tópico visto e sem histórico** (primeiro dia de uso): projeção pelo tempo da autoavaliação, sem linha de ritmo real e sem divisão por zero.
3. **Semana de folga ou semana atípica no meio do caminho:** a projeção usa as horas daquela semana (exceções gravadas), e uma semana com 00:00 aparece como semana sem tópico novo, não como erro.
4. **Matéria com a parte do ciclo 0 ou sem tópico sobrando:** o tempo dela volta para as outras; projeção nunca trava num laço.
5. **Reta final no roteiro sem tópico visto em nenhuma matéria:** o roteiro segue o normal (tópico novo) em vez de ficar vazio.

---

### Task 1: Tempo por tópico e ritmo real (puro)

**Files:**
- Create: `src/lib/examProjection.ts`
- Test: `src/__tests__/examProjection.test.ts`

**Interfaces:**
- Produces:
  - `TOPIC_MINUTES_BY_LEVEL: Record<1 | 2 | 3 | 4, number>` = `{ 1: 120, 2: 90, 3: 60, 4: 30 }`.
  - `topicLevel(topic: Topic, subject: Subject): number` — `topic.initial_knowledge_level ?? subject.initial_knowledge_level`, limitado a 1–4.
  - `realPace(input: { sessions: StudySession[]; firstStudyDates: Record<string, string>; leafTopicIds: ReadonlySet<string>; now: Date }): { minutesPerTopic: number | null; sample: number }` — tópicos folha vistos pela 1ª vez nos últimos 28 dias; para cada um, minutos das sessões (não puladas) nele dentro da janela; tópico com 0 minuto fica de fora; média.
  - `estimateTopicMinutes(levelMinutes: number, pace: { minutesPerTopic: number | null; sample: number }): number` — `C = n ÷ (n + 5)`; sem ritmo, o da autoavaliação; arredondado a 5.

- [ ] **Step 1: Testes que falham** — 'nível do tópico vence o da matéria; nulo herda'; 'ritmo real: média dos minutos nos tópicos vistos pela 1ª vez nas 4 semanas; tópico só com registro de fora não entra; sessão pulada não conta; tópico visto há 40 dias não entra'; 'mistura pela confiança: 0 tópicos → autoavaliação; 5 tópicos → metade; 45 → quase o real'.
- [ ] **Step 2:** `npx vitest run src/__tests__/examProjection.test.ts` → FAIL.
- [ ] **Step 3:** implementar. **Step 4:** PASS.
- [ ] **Step 5: Commit** `feat(plano): tempo por tópico pela autoavaliação e pelo ritmo real`

### Task 2: Horas por semana até a reta final (puro)

**Files:** Modify `src/lib/examProjection.ts`; Test `src/__tests__/examProjection.test.ts`

**Interfaces:**
- Consumes: `minutesForDay`, `weekDateKeys`, `weeklyReviewDay`, `weekReviewDuration`, `weekBudgetMinutes` de `availability.ts`.
- Produces:
  - `stretchStartKey(examDate: string, finalStretchDays: number): string` — data local N dias antes da prova.
  - `interface WeekSlot { weekStart: Date; weekStartKey: string; newTopicMinutes: number; phase: 'TEORIA' | 'ULTIMOS' | 'RETA_FINAL' }`
  - `weekSlots(input: { now: Date; examDate: string; finalStretchDays: number; pattern: WeekdayMinutes; overrides: Record<string, number>; todayStudiedMinutes: number; reviewEnabled: boolean }): WeekSlot[]` — da semana de hoje até a da prova. `newTopicMinutes` = soma dos dias **de hoje em diante e antes da reta final** (hoje: o que sobra do dia, `max(0, minutos de hoje − estudado hoje)`), menos a Revisão da semana quando o dia dela cai antes da reta final e ela está ligada. Fase: semana inteira antes da reta final = `TEORIA`; semana que contém o 1º dia da reta final = `ULTIMOS`; depois = `RETA_FINAL` (0 minuto novo).

- [ ] **Step 1: Testes que falham** (prova 13/12/2026, reta final 14 dias → começa 29/11; hoje = segunda 26/10 10:00; padrão `[180,180,180,180,180,180,180]`): 'semanas de 26/10 a 07/12; a de 23/11 é ÚLTIMOS, 30/11 e 07/12 RETA_FINAL'; 'semana de hoje desconta o já estudado hoje e a revisão da semana'; 'semana com 7 exceções 0 tem 0 minuto novo'; 'hoje já dentro da reta final → todas RETA_FINAL'; 'prova no passado → lista vazia'.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat(plano): horas para tópico novo em cada semana até a reta final`

### Task 3: Projetor — tópicos pelas semanas (puro)

**Files:** Modify `src/lib/examProjection.ts`; Test `src/__tests__/examProjection.test.ts`

**Interfaces:**
- Produces:
  - `interface SubjectQueue { subjectId: string; partCode: string | null; share: number /* 0..1, do ciclo */; totalLeaf: number; seen: number; queue: { topicId: string; minutes: number }[] /* não vistos, na ordem de prioridade */ }`
  - `interface ProjectedWeek extends WeekSlot { newTopics: number; coveragePercent: number /* % visto ao fim da semana, edital todo */ }`
  - `projectTopics(slots: WeekSlot[], subjects: SubjectQueue[]): { weeks: ProjectedWeek[]; seenAtStretch: Map<string, number> /* por matéria */; leftForLater: string[] /* tópicos não alcançados: o fim da fila de cada matéria, matéria a matéria na ordem da lista */ }`
  - Regra (spec §4.3): em cada semana, a matéria recebe `share × minutos`; consome a fila na ordem, com sobra levada para a semana seguinte (o tópico fica visto quando o tempo dele fecha); matéria sem fila devolve a sobra às que têm fila, na proporção das `share` delas (repetir até não sobrar tempo ou fila — com limite de voltas para nunca travar). `share` 0 em todas → divisão igual.

- [ ] **Step 1: Testes que falham** — 'tópico só conta como visto quando o tempo dele fecha (sobra passa para a semana seguinte)'; 'matéria que fecha devolve o tempo às outras na proporção'; 'reta final não recebe tópico novo'; '% visto ao fim de cada semana sobe e para na reta final'; 'o que não cabe vai para "ficam para depois" na ordem de prioridade (os últimos da fila)'; 'todas as partes 0 → divisão igual; nenhuma fila → nada muda, sem laço'.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(plano): projetor dos tópicos até a reta final`

### Task 4: "Dá tempo?" — plano, ritmo real, saídas e provas (puro)

**Files:** Modify `src/lib/examProjection.ts`; Test `src/__tests__/examProjection.test.ts`

**Interfaces:**
- Consumes: Tasks 1–3; `examSituation` de `goodMorning.ts` (para o aviso da prova com nota mínima).
- Produces: `examOutlook(input: { plan: StudyPlan; now: Date; pattern: WeekdayMinutes; overrides: Record<string, number>; subjects: Subject[]; topicsBySubject: Record<string, Topic[]>; cycleData: CycleCalculationResult; examParts: ExamPart[]; sessions: StudySession[] /* 28 dias */; firstStudyDates: Record<string, string>; todayStudiedMinutes: number }): ExamOutlook | null` (`null` sem data da prova), com:
  - `status: 'PROJETANDO' | 'RETA_FINAL' | 'PROVA_PASSOU'`; `stretchStartKey`; `weeks: ProjectedWeek[]`;
  - `coverageAtStretch` (plano, %); `real: { weeklyMinutes: number; coverageAtStretch: number } | null` (só com 7+ dias desde a 1ª sessão e ritmo ≥ 10% abaixo do plano; mesma projeção com cada semana escalada por real ÷ planejado);
  - `extraWeeklyMinutes: number` (0 quando dá; senão o que falta ÷ semanas antes da reta final, arredondado para cima em 00:30);
  - `leftForLater: Topic[]`; `parts: { code: string; name: string; coverageAtStretch: number }[]` (média das matérias da prova, como `summarizeExamParts`); `partWarning: string | null` (de `examSituation` com o % projetado);
  - `topicMinutes: { estimate: number; source: 'AUTOAVALIACAO' | 'RITMO_REAL' | 'MISTO'; sample: number }` (para o "ⓘ").
  - Fila de cada matéria: tópicos folha não vistos na ordem de `cycleData.topicHeatmapRanking`; `share` = `currentWeeklyMinutes ÷ total` das alocações.

- [ ] **Step 1: Testes que falham** (seed CGU + prova numa data fixa): 'com horas de sobra dá 100% e nenhuma saída'; 'com pouco tempo: % < 100, +HH:mm por semana e a lista do que fica para depois'; 'ritmo real 15:30 com plano 21:00 → mostra o real; ritmo 20:00 (menos de 10% abaixo) → não mostra; menos de 7 dias de uso → não mostra'; 'P1/P2/P3 com o % projetado e o aviso pela regra de 20 pontos'; 'sem data → null; hoje na reta final → status RETA_FINAL; prova passada → PROVA_PASSOU'.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(plano): "dá tempo?" pelo plano e pelo ritmo real`

### Task 5: Reta final no roteiro do dia e na previsão

**Files:**
- Modify: `src/lib/dailyPlanner.ts` (`finalStretch?: boolean`), `src/lib/weekForecast.ts` (passa por dia), `src/features/routine/useDailyRoutine.ts` (parâmetro), `src/lib/dailyRoutine.ts` (assinatura com `|reta` na reta final), `src/App.tsx`
- Test: `src/__tests__/dailyPlannerAndExplainability.test.ts`, `src/__tests__/weekForecast.test.ts`, `src/__tests__/dailyRoutine.test.ts`

**Interfaces:**
- Produces: `planDailyBlocks({ …, finalStretch?: boolean })` — com `true`, cada bloco escolhe o tópico **já estudado** da matéria com menor chance de lembrar (`2^(−dias÷meia-vida)`); matéria sem tópico estudado sai da vez; **nenhum tópico estudado no plano inteiro → segue o roteiro normal**. Motivo do bloco: "Reta final: revisar ‹tópico› (estudado há N dias)". `forecastWeek` passa `finalStretch` para os dias ≥ o 1º dia da reta final (recebe `stretchStartKey?: string | null`). A assinatura do roteiro inclui a reta final (virar o dia em que ela começa regrava o roteiro).

- [ ] **Step 1: Testes que falham** — 'reta final: só tópicos estudados, o mais frio primeiro, nada novo'; 'reta final sem nenhum tópico estudado: roteiro normal'; 'previsão: dias a partir do início da reta final só com tópicos estudados'; 'assinatura muda quando a reta final começa'.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(plano): reta final no roteiro do dia e na previsão`

### Task 6: Reta final ajustável (banco + Ajustar)

**Files:**
- Modify: `src/types/database.ts` (`UpdateStudyPlanInput.final_stretch_days?`), `src/lib/database.ts` (`updateStudyPlan` grava, limitado a 7–21), `src/features/study-plan/StudyPlanView.tsx` (controle no "Ajustar")
- Test: `src/__tests__/studyPlanHours.test.ts`, `src/__tests__/studyPlanView.test.tsx`

**Interfaces:**
- Produces: no "Ajustar", **"Reta final: últimos [7 | 10 | 14 | 21] dias antes da prova — só revisão e questões"** (select); `StudyPlanView` ganha `onChangeFinalStretch(days: number)`.

- [ ] **Step 1: Testes que falham** — 'final_stretch_days grava, volta depois de reabrir e fica entre 7 e 21'; 'o Ajustar mostra a reta final e muda pelo select'.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(plano): reta final ajustável no Ajustar`

### Task 7: Tela — "Dá tempo?" e linha do tempo

**Files:**
- Create: `src/features/study-plan/ExamOutlookCard.tsx` ("Dá tempo?"), `src/features/study-plan/WeekTimeline.tsx` (linha do tempo), `src/features/study-plan/useExamOutlook.ts` (carrega sessões de 28 dias e primeira vez de cada tópico; chama `examOutlook`)
- Modify: `src/features/study-plan/StudyPlanView.tsx` (ordem §4.4: Sua semana → Dá tempo? → Linha do tempo → Ajustar → divisão), `src/App.tsx`
- Test: `src/__tests__/examOutlookCard.test.tsx` (novo), `src/__tests__/studyPlanView.test.tsx`

**Interfaces:**
- `ExamOutlookCard({ outlook: ExamOutlook | null; onAdjust: () => void })`:
  - linha principal grande "‹N›% do edital visto até ‹dd/mm›" (véspera da reta final);
  - ritmo real quando houver ("no seu ritmo das últimas 2 semanas (HH:mm por semana), ‹N›%");
  - se < 100%: "+HH:mm por semana" (botão abre o "Ajustar") e "‹N› tópicos de menor prioridade ficam para depois" (lista recolhida; até 30 e "e mais N");
  - P1/P2/P3 com barra e selo: amber "atenção" na prova do aviso (regra de 20 pontos); emerald "em dia" com 90%+ projetado; as demais orange "foco";
  - "ⓘ" com a origem do tempo por tópico;
  - sem data: "Defina a data da prova no edital para ver o caminho até ela."; reta final: "Reta final: só revisão e questões até a prova."
- `WeekTimeline({ weeks: ProjectedWeek[] })`: uma linha por semana (dd/mm, selo da fase — "Teoria + questões" / "Últimos tópicos" / "Reta final: revisão" —, tópicos novos, barra com % visto ao fim). A semana de hoje destacada.
- Entrada com a mesma animação curta dos cartões (`fofolab-reveal`), parada com "menos movimento".

- [ ] **Step 1: Testes que falham** — 'mostra o % e a data da véspera da reta final'; 'saídas só quando não dá'; 'ritmo real só quando o outlook traz'; 'sem data / reta final: frase certa'; 'linha do tempo com as fases e a semana de hoje destacada'; ordem das seções no Plano; sem termos proibidos, tudo em HH:mm.
- [ ] **Step 2–4.** **Step 5: Commit** `feat(plano): "Dá tempo?" e linha do tempo na aba Plano de estudo`

### Task 8: E2E, documentação, verificação e revisão

**Files:** Create `e2e/plano-ate-a-prova.spec.ts`; Modify `BACKLOG.md`, `docs/handoff/2026-10-24-estado-e-proxima-ia.md`, `docs/specs/13-plano-de-estudo.md` (status), `CLAUDE.md` (mapa: `examProjection.ts`).

- [ ] **Step 1: E2E** com o edital real da CGU (fluxo de importação de `bancada.spec.ts`) e o relógio fixo em 26/10/2026: "Dá tempo?" mostra "% do edital visto até 28/11"; a linha do tempo vai até a semana de 07/12 com "Reta final: revisão"; mudar a reta final para 21 dias muda a data; recarregar mantém. Relógio em 01/12/2026: a coluna Hoje só tem tópicos já estudados (ou o roteiro normal, sem estudo prévio) e o "Dá tempo?" diz que é reta final.
- [ ] **Step 2:** `npm test`, `npm run test:e2e` (duas rodadas), `npm run build`.
- [ ] **Step 3:** docs + `graphify update .`; revisão independente do conjunto; corrigir o que ela achar, com teste.
- [ ] **Step 4: Commit** `docs: 13b — dá tempo, linha do tempo e reta final`
