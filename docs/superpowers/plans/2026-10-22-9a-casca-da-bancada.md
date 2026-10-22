# 9a — Casca da Bancada: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cabeçalho fixo de ponta a ponta e painéis laterais que recolhem para um trilho (com transição), com Copiloto e Caderno dividindo a coluna da direita em abas montadas.

**Architecture:** Nova fatia `src/features/workbench-shell/` com um hook de estado de painel (lembrado no localStorage, como as larguras), um `SidePanel` genérico (largura animada por CSS, conteúdo `inert` quando recolhido, trilho de ícones no lugar), um `RightDock` com abas e um `AppHeader`. O `App.tsx` passa a montar: cabeçalho em cima, linha com [painel esquerdo | centro | painel direito]. A troca "Meu Dia / Bancada Pro" continua (sai só em 9b).

**Tech Stack:** React 19, TypeScript strict, Tailwind, Vitest + Testing Library, Playwright (Edge).

**Spec:** `docs/specs/09-bancada-roteiro-e-revisao.md` (§5.1 e §5.3.1 — "9a mantém a troca Meu Dia / Bancada Pro").

## Global Constraints
- Textos da tela em pt-BR, sem jargão técnico; tempo em HH:mm (`formatDuration`) quando houver tempo.
- Componentes ≤ ~250 linhas; TS strict; sem ternário aninhado; comentários explicam o porquê.
- Animação só com CSS, sem biblioteca nova. Largura: `220ms ease`. `prefers-reduced-motion: reduce` → sem transição.
- Trilho recolhido: **44 px**. Painéis recolhidos ficam montados (não desmontar: conversa, rascunho e PDF não podem se perder).
- Nenhum controle do cabeçalho muda de posição ao abrir/recolher painéis; o cabeçalho não quebra linha.
- Botões "Tópicos", "Caderno", "Copiloto IA" e "Edital Verticalizado" saem do cabeçalho; "Edital" vira link no pé da coluna esquerda.
- Larguras continuam redimensionáveis e lembradas (`useResizableWidth`).
- Leitura ampliada do PDF continua escondendo cabeçalho e painéis (cabeçalho escondido por CSS, não desmontado — o Pomodoro segue contando).
- Antes de encerrar: `npm test`, `npm run test:e2e`, `npm run build` verdes; BACKLOG atualizado; `graphify update .`.

## Review Focus
1. **Arrastar a divisória com a transição ligada** deixa o painel "atrasado" atrás do ponteiro → durante o arraste (`body.fofolab-resizing`) não há transição. *(Task 1, teste do CSS.)*
2. **Conteúdo do painel recolhido alcançável por Tab ou leitor de tela** → recolhido = `inert` + `aria-hidden`. *(Task 1.)*
3. **Recolhimento automático da leitura salvo como preferência**: fechar o app com o leitor aberto e reabrir com o roteiro recolhido "sem motivo" → mudanças feitas pelo leitor não são gravadas. *(Task 1 `persist: false`; Task 4.)*
4. **Janela estreita (~1100 px)**: cabeçalho quebra linha e botões trocam de lugar → posições idênticas antes/depois de recolher. *(Task 5, E2E.)*
5. **Plano sem data de prova e sem provas do edital** → cabeçalho sem "dias" e sem "P1…", sem "null"/"NaN". *(Task 3.)*

---

### Task 1: Painel lateral que recolhe em trilho

**Files:**
- Create: `src/features/workbench-shell/useCollapsiblePanel.ts`
- Create: `src/features/workbench-shell/SidePanel.tsx`
- Modify: `src/index.css` (regras de transição)
- Test: `src/__tests__/workbenchShell.test.tsx`

**Interfaces:**
- Produces:
  - `useCollapsiblePanel(storageKey: string, defaultOpen: boolean): { open: boolean; setOpen: (open: boolean, options?: { persist?: boolean }) => void; toggle: () => void }` — `persist` padrão `true`; `persist: false` muda o estado sem gravar no localStorage. Valor lido: `'1'`/`'0'`; ausente ou localStorage indisponível → `defaultOpen`.
  - `export const RAIL_WIDTH = 44;`
  - `SidePanel(props: { side: 'left' | 'right'; label: string; open: boolean; width: number; onOpenChange: (open: boolean) => void; collapseLabel: string; rail: ReactNode; resize?: { label: string; min: number; max: number; onResize: (width: number) => void; onReset: () => void }; hidden?: boolean; children: ReactNode })`
  - `RailButton(props: { label: string; icon: ReactNode; active?: boolean; onClick: () => void })` — botão 30×30 com `aria-label={label}` e `title={label}`.

- [ ] **Step 1: Write the failing tests** em `src/__tests__/workbenchShell.test.tsx`:
  - `it('lembra se o painel estava aberto ou recolhido neste computador')` — `renderHook(() => useCollapsiblePanel('t_open', true))`; `act(() => result.current.setOpen(false))`; `expect(localStorage.getItem('t_open')).toBe('0')`; novo `renderHook` com a mesma chave → `open === false`.
  - `it('mudança feita pelo leitor não vira preferência (persist: false)')` — `setOpen(false, { persist: false })` → `open === false` e `localStorage.getItem('t_open2')` continua `null`.
  - `it('recolhido, o painel vira trilho e o conteúdo continua montado mas fora do alcance do teclado')` — render `<SidePanel side="left" label="Roteiro" open={false} width={320} … rail={<RailButton label="Abrir roteiro" …/>}><textarea aria-label="campo" defaultValue="rascunho"/></SidePanel>`; `getByRole('complementary', { name: 'Roteiro' })` tem `style.width === '44px'`; o contêiner do conteúdo tem atributo `inert` e `aria-hidden="true"`; `getByLabelText('campo', { selector: 'textarea' })` (hidden) ainda tem valor `'rascunho'`; botão "Abrir roteiro" visível.
  - `it('a seta da borda recolhe e o trilho reabre')` — aberto: clicar `getByRole('button', { name: 'Recolher roteiro' })` chama `onOpenChange(false)`; recolhido: clicar "Abrir roteiro" chama o `onClick` do `RailButton`.
  - `it('sem transição ao arrastar a divisória e para quem pediu menos movimento')` — `import css from '../index.css?raw'`; `expect(css).toMatch(/\.fofolab-resizing \.fofolab-panel[^{]*\{[^}]*transition:\s*none/)` e `expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.fofolab-panel[\s\S]*transition:\s*none/)`.

- [ ] **Step 2: Run** `npx vitest run src/__tests__/workbenchShell.test.tsx` — Expected: FAIL (módulos não existem).

- [ ] **Step 3: Implement** `useCollapsiblePanel` (mesmo padrão try/catch de `useResizableWidth` em `src/components/ResizeHandle.tsx`), `SidePanel`, `RailButton` e o CSS:
  - `<aside aria-label={label} className="fofolab-panel relative shrink-0 overflow-hidden border-slate-800 bg-slate-900/70 …" style={{ width: open ? width : RAIL_WIDTH }}>`; borda `border-r` à esquerda, `border-l` à direita; `hidden` → classe `hidden` (não desmonta).
  - Conteúdo: `<div className="fofolab-panel-content h-full" style={{ width }} inert={!open} aria-hidden={!open}>` — largura fixa evita reflow durante a animação; opacidade 0 quando recolhido.
  - Trilho: absoluto na borda do lado, `width: RAIL_WIDTH`, visível só recolhido (opacidade), coluna de ícones com `gap-2.5 pt-2.5`.
  - Seta de recolher (só aberto), canto superior na borda interna: `‹` à esquerda, `›` à direita, `aria-label={collapseLabel}`.
  - `resize` presente e aberto → renderizar `ResizeHandle` existente colado à borda interna (`direction` `grow-right` à esquerda, `grow-left` à direita).
  - `src/index.css`: `.fofolab-panel { transition: width 220ms ease; }`, `.fofolab-panel-content, .fofolab-rail { transition: opacity 220ms ease; }`, `body.fofolab-resizing .fofolab-panel { transition: none; }` e `@media (prefers-reduced-motion: reduce) { .fofolab-panel, .fofolab-panel-content, .fofolab-rail { transition: none; } }`.

- [ ] **Step 4: Run** `npx vitest run src/__tests__/workbenchShell.test.tsx` — Expected: PASS.

- [ ] **Step 5: Commit** — `git add src/features/workbench-shell src/index.css src/__tests__/workbenchShell.test.tsx && git commit -m "feat(casca): painel lateral que recolhe em trilho"`

---

### Task 2: Coluna da direita com abas Copiloto | Caderno

**Files:**
- Create: `src/features/workbench-shell/RightDock.tsx`
- Modify: `src/features/notebook-dock/NotebookDockPanel.tsx:47,78-79` e `src/features/ai-copilot/AiCopilotDockPanel.tsx:38,85-86` (largura opcional)
- Test: `src/__tests__/workbenchShell.test.tsx`

**Interfaces:**
- Consumes: `SidePanel`, `RailButton`, `useCollapsiblePanel` (Task 1).
- Produces:
  - `export type RightDockTab = 'copilot' | 'notebook';`
  - `useRightDockTab(): { tab: RightDockTab; setTab: (tab: RightDockTab, options?: { persist?: boolean }) => void }` — chave `fofolab_layout_right_tab_v1`, padrão `'copilot'`.
  - `RightDock(props: { tab: RightDockTab; onTabChange: (tab: RightDockTab) => void; copilot: ReactNode; notebook: ReactNode })` — conteúdo das abas para dentro do `SidePanel` direito.
  - `rightDockRail(props: { tab: RightDockTab; onOpenTab: (tab: RightDockTab) => void }): ReactNode` — dois `RailButton`: "Abrir Copiloto IA" e "Abrir Caderno".
  - `NotebookDockPanel` e `AiCopilotDockPanel`: `width` passa a ser opcional; sem `width` → `className` com `w-full` e sem `style.width`.

- [ ] **Step 1: Write the failing tests**:
  - `it('Copiloto e Caderno alternam por abas sem perder o que foi digitado')` — render `RightDock` com `copilot={<input aria-label="pergunta" />}` e `notebook={<textarea aria-label="nota" />}` controlado por estado local; digitar "minha nota" em "nota", clicar aba `getByRole('tab', { name: 'Copiloto' })`, voltar em `getByRole('tab', { name: 'Caderno' })` → valor `'minha nota'`; aba ativa tem `aria-selected="true"`; painel inativo tem `hidden`.
  - `it('lembra a aba escolhida')` — `useRightDockTab` → `setTab('notebook')` → `localStorage.getItem('fofolab_layout_right_tab_v1') === 'notebook'`.
  - `it('ícone do trilho abre a coluna já na aba certa')` — clicar "Abrir Caderno" chama `onOpenTab('notebook')`.

- [ ] **Step 2: Run** `npx vitest run src/__tests__/workbenchShell.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement** `RightDock` (`role="tablist"` com `aria-label="Copiloto e Caderno"`, botões `role="tab"` "Copiloto" e "Caderno", dois `role="tabpanel"` sempre montados, inativo com `hidden`), `useRightDockTab` (mesmo padrão do Task 1), `rightDockRail`, e a largura opcional nos dois painéis.

- [ ] **Step 4: Run** `npx vitest run` — Expected: PASS (inclui `notebookDraftAndLayout.test.tsx` e `questionWorkbenchAndRouter.test.tsx` sem regressão).

- [ ] **Step 5: Commit** — `git commit -m "feat(casca): Copiloto e Caderno em abas na coluna da direita"`

---

### Task 3: Cabeçalho de ponta a ponta

**Files:**
- Create: `src/features/workbench-shell/headerSummary.ts`
- Create: `src/features/workbench-shell/AppHeader.tsx`
- Test: `src/__tests__/workbenchShell.test.tsx`

**Interfaces:**
- Produces:
  - `interface ExamPartProgress { code: string; coveragePercent: number }`
  - `summarizeExamParts(allocations: SubjectCycleAllocation[], examParts: ExamPart[]): ExamPartProgress[]` — uma entrada por prova, na ordem de `sort_order`; `coveragePercent` = média arredondada de `allocation.coveragePercent` das matérias com `subject.exam_part_id === part.id`; prova sem matéria → omitida; `examParts` vazio → `[]`.
  - `AppHeader(props: { hidden: boolean; planLabel: string; daysUntilExam: number | null; examParts: ExamPartProgress[]; modeSwitch: ReactNode; saveStatus: ReactNode; onRecalibrate: () => void; blockClock: ReactNode })` — `<header>` de largura total, `flex-nowrap`; esquerda: `modeSwitch`, concurso (`truncate`, `min-w-0`), "‹N› dias" e "P1 62% visto · P2 40% visto"; direita (`shrink-0`): `saveStatus`, botão "Recalibrar perfil", `blockClock`. `hidden` → classe `hidden` (não desmonta).

- [ ] **Step 1: Write the failing tests**:
  - `it('resume quanto de cada prova já foi visto')` — duas provas (P1 `sort_order` 1, P2 2), matérias P1 com cobertura 50 e 75, P2 com 40 → `[{ code: 'P1', coveragePercent: 63 }, { code: 'P2', coveragePercent: 40 }]`.
  - `it('plano sem provas do edital não tem resumo de provas')` — `summarizeExamParts(allocs, []) → []`.
  - `it('cabeçalho mostra concurso, dias e provas, e nada dos antigos botões de painel')` — render com `daysUntilExam={53}` e `[{code:'P1',coveragePercent:62}]` → textos "53 dias" e "P1 62% visto"; `queryByRole('button', { name: /Tópicos|Caderno|Copiloto IA|Edital Verticalizado/ })` é `null`; "Recalibrar perfil" presente.
  - `it('sem data de prova, o cabeçalho não mostra contagem')` — `daysUntilExam={null}`, `examParts={[]}` → `queryByText(/dias/)` null e o texto do cabeçalho não contém `null` nem `NaN`.

- [ ] **Step 2: Run** `npx vitest run src/__tests__/workbenchShell.test.tsx` — Expected: FAIL.

- [ ] **Step 3: Implement** `summarizeExamParts` e `AppHeader`. "1 dia" no singular; 0 ou negativo → omitir a contagem.

- [ ] **Step 4: Run** `npx vitest run src/__tests__/workbenchShell.test.tsx` — Expected: PASS.

- [ ] **Step 5: Commit** — `git commit -m "feat(casca): cabeçalho fixo com concurso, dias e provas"`

---

### Task 4: Montar a casca no App

**Files:**
- Modify: `src/App.tsx` (estado dos painéis `:151-156`, `selectTab` `:690-702`, `dockToggleClass` `:720-725`, JSX `:733-1080`)
- Modify: `src/features/syllabus-dock/SyllabusTreeDock.tsx` (largura vinda do painel; link "Edital" no pé)
- Test: `src/__tests__/notebookDraftAndLayout.test.tsx` (sem regressão)

**Interfaces:**
- Consumes: `useCollapsiblePanel`, `SidePanel`, `RailButton`, `RightDock`, `useRightDockTab`, `rightDockRail`, `AppHeader`, `summarizeExamParts`.
- Produces: `SyllabusTreeDock` ganha `onOpenEdital: () => void` (link "Edital" no pé, abre `openCrudModal('topics')`) e `width` passa a ser opcional (sem `width` → `w-full`, sem a borda própria).

- [ ] **Step 1: Estado dos painéis** — trocar `showSyllabusDock`/`showNotebookDock`/`showAiCopilotDock` e `copilotWidth` por: `leftPanel = useCollapsiblePanel('fofolab_layout_left_open_v1', true)`, `rightPanel = useCollapsiblePanel('fofolab_layout_right_open_v1', true)`, `rightTab = useRightDockTab()`, `rightWidth = useResizableWidth('fofolab_layout_right_v1', 384, 300, 960)`; `syllabusWidth` mantém a chave atual.

- [ ] **Step 2: Leitura** — `selectTab('reader')` guarda `{ left: leftPanel.open, right: rightPanel.open, tab: rightTab.tab }` em `docksBeforeReaderRef` e faz `leftPanel.setOpen(false, { persist: false })`, `rightPanel.setOpen(true, { persist: false })`, `rightTab.setTab('notebook', { persist: false })`; ao sair, restaura os três com `persist: false`. `PdfReaderStage`: `notebookVisible = rightPanel.open && rightTab.tab === 'notebook'`; `onToggleNotebook` → se visível recolhe, senão abre na aba Caderno (ambos `persist: false`).

- [ ] **Step 3: JSX** — raiz `flex h-screen w-screen flex-col`; `AppHeader` (só `mode === 'student'`, `hidden={readerExpanded}`; `modeSwitch` = a troca "Meu Dia / Bancada Pro" atual; `saveStatus` = `SaveStatusIndicator`; `blockClock` = `StudyBlockMini`; `planLabel` = `[órgão] título`; `daysUntilExam` = `cycleData.daysUntilExam`; `examParts` = `summarizeExamParts(cycleData.allocations, examParts)`). Abaixo, `flex min-h-0 flex-1`: `SidePanel` esquerdo (`label="Painel de Tópicos e Edital"`, `collapseLabel="Recolher tópicos"`, trilho com `RailButton` "Abrir tópicos"; só em `experienceMode === 'pro'`; `hidden={readerExpanded}`) → `main` → `SidePanel` direito (`label="Copiloto e Caderno"`, `collapseLabel="Recolher Copiloto e Caderno"`; só em pro e `mode === 'student'`; `hidden` quando `readerExpanded` e a aba não é o Caderno). Copiloto sem `studentContext` → texto "Escolha um tópico para conversar com o Copiloto.". Os `onCloseDock` dos dois painéis passam a recolher o painel direito. Remover os quatro botões antigos do cabeçalho e `dockToggleClass`.

- [ ] **Step 4: Run** `npx vitest run` e `npm run build` — Expected: PASS e build sem erros de tipo.

- [ ] **Step 5: Commit** — `git commit -m "feat(casca): bancada com cabeçalho fixo e painéis que recolhem"`

---

### Task 5: Verificação ponta a ponta

**Files:**
- Modify: `e2e/bancada.spec.ts` (teste "leitura maximizada…" `:253-300` e qualquer clique nos botões removidos do cabeçalho)
- Create: `e2e/casca.spec.ts`
- Modify: `BACKLOG.md`

- [ ] **Step 1: Ajustar `bancada.spec.ts`** — onde hoje espera `toHaveCount(0)` para os painéis na leitura, esperar o `complementary` "Painel de Tópicos e Edital" com largura de 44 px (trilho) ou oculto conforme `readerExpanded`; trocar `locator('header').getByRole('button', { name: 'Caderno' })` por abrir pelo trilho/aba "Caderno"; o separador passa a se chamar o `label` do painel direito ("Largura do painel direito") com valor lembrado após `reload`.

- [ ] **Step 2: Write `e2e/casca.spec.ts`**:
  - `test('recolher e reabrir painéis não move nenhum controle do cabeçalho')` — `page.setViewportSize({ width: 1100, height: 800 })`; Bancada Pro; guardar `boundingBox()` de "Recalibrar perfil", do relógio do bloco e do status de gravação; recolher esquerda ("Recolher tópicos") e direita; aguardar 300 ms; caixas iguais (`toEqual`); reabrir pelos trilhos; caixas iguais; cabeçalho com altura de uma linha (≤ 64 px).
  - `test('recolhido continua recolhido depois de fechar e abrir o app')` — recolher esquerda, `reload`, painel esquerdo com largura 44.
  - `test('o rascunho do caderno sobrevive a trocar de aba e a recolher a coluna')` — aba Caderno, digitar em "Conteúdo do caderno do tópico", aba Copiloto, recolher, reabrir por "Abrir Caderno" → texto preservado.
  - `test('quem pediu menos movimento não vê animação')` — `page.emulateMedia({ reducedMotion: 'reduce' })`; `getComputedStyle` do painel esquerdo → `transitionDuration === '0s'`.
  - Captura `e2e/.screens/08-casca-recolhida.png`.

- [ ] **Step 3: Run** `npm test`, `npm run test:e2e`, `npm run build` — Expected: tudo verde.

- [ ] **Step 4: BACKLOG + grafo** — marcar 9a conforme a DoD (`[DONE]` só com os três comandos verdes e persistência verificada pelo E2E de reload); `graphify update .`.

- [ ] **Step 5: Commit** — `git commit -m "test(casca): E2E da casca e backlog da 9a"`
