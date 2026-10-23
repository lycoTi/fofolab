# 7b — Registro rápido do TEC: Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Depois de um bloco, o estudante registra em segundos o que fez no TEC (total, certas, em branco) e isso vira evidência real: domínio do tópico, confiança da amostra, curva de esquecimento e Mapa de Calor.

**Architecture:** Tabela `question_logs` (migração **v7**) com registros agregados — nunca tentativas falsas. O domínio do tópico é uma média ponderada pela evidência; o motor do ciclo soma os registros às tentativas do app. A entrada fica no bloco atual da coluna (formulário inline), aberta sozinha uma vez ao concluir o bloco.

**Tech Stack:** React 19, TypeScript strict, sql.js, Vitest, Playwright.

**Spec:** `docs/specs/07-edital-ciclo-e-situacao.md` §5.4 e §6 (`question_logs`); integração com a coluna da spec 09.

## Global Constraints
- Sem conteúdo do TEC: só números digitados pelo estudante (Termos de Uso do TEC §18.8).
- Mudança no contrato SQL → **nova** migração (v7), `LATEST_SCHEMA_VERSION` 6 → 7, contrato `docs/specs/01-database-schema.sql`. Nunca editar migração existente.
- Textos pt-BR, sem jargão; números validados (certas + em branco ≤ total; total 1–500).
- A Revisão do dia (9c) passa a usar a migração **v8**.

## Decisões (do Claude, dentro do que a spec 07 deixou ao construtor)
- **Domínio:** `novo = (atual × peso + acerto% × total) / (peso + total)`, com `peso = min(40, tentativas do app + questões já registradas)`. Acerto% = certas / total (em branco conta como não sabia, sem penalidade extra). O teto 40 deixa um registro novo grande ainda mover o domínio. Status do tópico pelo `resolveTopicStatus` existente; domínio da matéria recalculado (`recalculateSubjectMastery`).
- **Motor:** `attemptsCount` do tópico soma os `total` dos registros (confiança da amostra); um registro com acerto ≥ 70% conta 1 `MASTERED` e < 50% conta 1 `BASE_GAP` para a meia-vida da memória.
- **Estudado hoje:** gravar registro atualiza `last_studied_at`.
- **Desfazer:** cada registro guarda `mastery_before`; "Desfazer" apaga o último registro do tópico e restaura o domínio anterior (pede confirmação, conforme a regra de dados do estudante).

## Review Focus
1. **Números impossíveis** (certas + em branco > total, total 0, negativos, texto) → botão desabilitado com motivo curto. *(Task 3.)*
2. **Registro no tópico errado** (estava em olhada) → o seletor mostra o tópico do bloco por padrão e o tópico olhado como opção. *(Task 3.)*
3. **Desfazer depois de outro registro no mesmo tópico** → só o último pode ser desfeito. *(Task 1.)*
4. **Plano sem questões no app** (o caso do dono): domínio e confiança mudam só pelos registros. *(Task 2.)*
5. **Fechar o app logo após registrar** → gravação imediata (`flushDatabase`) como na diagnose. *(Task 1/E2E.)*

---

### Task 1: Tabela e gravação (v7)
**Files:** `src/lib/migrations.ts`, `docs/specs/01-database-schema.sql`, `src/types/database.ts`, `src/lib/database.ts`; testes em `src/__tests__/migrations.test.ts`, `src/__tests__/database.test.ts`.
**Interfaces (produces):**
- `QuestionLog { id; subject_id; topic_id; total; correct; blank; source: 'TEC'; logged_at; mastery_before: number }`
- `blendMastery(current: number, evidenceWeight: number, correct: number, total: number): number` (puro, em `src/lib/questionLogs.ts`)
- `recordQuestionLog(input: { subjectId; topicId; total; correct; blank }): { log: QuestionLog; topic: Topic }`
- `getQuestionLogs(sinceIso?: string): QuestionLog[]`
- `undoLastQuestionLog(topicId: string): boolean`
- [ ] Testes que falham: tabela na v7 (paridade contrato × migrações; `appliedMigrations` termina em 7); `blendMastery(40, 10, 14, 20) ≈ 60`; peso 0 → acerto puro; teto 40; gravar atualiza domínio, status, `last_studied_at`, domínio da matéria; desfazer restaura o domínio e só vale para o último do tópico.
- [ ] Implementar; rodar `npx vitest run src/__tests__/migrations.test.ts src/__tests__/database.test.ts`; commit `feat(tec): registro rápido do TEC no banco (v7)`.

### Task 2: Registros no motor do ciclo
**Files:** `src/lib/cycleEngine.ts` (parâmetro `questionLogs?: QuestionLog[]` em `calculateDynamicStudyCycle`), `src/App.tsx` (carrega `getQuestionLogs` no `refreshData`), teste `src/__tests__/cycleEngine.test.ts`.
- [ ] Testes que falham: tópico só com registro de 20 questões tem `attemptsCount` 20 e confiança > 0; registro ≥ 70% aumenta a meia-vida como um `MASTERED`; < 50% conta como `BASE_GAP`.
- [ ] Implementar; commit `feat(tec): registros do TEC entram no motor do ciclo`.

### Task 3: Formulário no bloco da coluna
**Files:** `src/features/routine/QuestionLogForm.tsx` (≤ ~150 linhas), `RoutineBlockItem.tsx`, `RoutineColumn.tsx`, `App.tsx`; teste `src/__tests__/routineColumn.test.tsx`.
**Interfaces:** `QuestionLogForm(props: { topics: Topic[]; defaultTopicId: string; onSubmit: (v: { topicId; total; correct; blank }) => void; onUndo?: () => void; lastLogLabel: string | null })`.
- Botão "Registrar questões do TEC" no bloco atual abre o formulário inline (Total, Certas, Em branco, tópico — padrão o do bloco; opções: tópicos do grupo + o olhado). Gravar mostra "Registrado: 14 de 20 (70%)" com "Desfazer".
- Ao concluir o bloco (fase `DONE` ou sessão gravada que completa o bloco), o formulário abre sozinho uma vez com o convite "Fez questões no TEC? Registre aqui".
- [ ] Testes que falham: validação (certas + em branco > total desabilita, com "Confira os números"); envia com o tópico do bloco por padrão; mostra o resumo e chama desfazer; auditoria de jargão.
- [ ] Implementar; commit `feat(tec): formulário de registro rápido no bloco da coluna`.

### Task 4: Verificação ponta a ponta
**Files:** `e2e/tec.spec.ts`, `BACKLOG.md`, `docs/handoff/...`.
- [ ] `test('registrar 20 questões do TEC muda o domínio, sobrevive a recarregar e pode ser desfeito')` — iniciar bloco, registrar 20/14/2, ver "Registrado: 14 de 20 (70%)", recarregar, Mapa de Calor mostra o tópico com 20 questões; desfazer com confirmação volta o domínio.
- [ ] `npm test`, `npm run test:e2e` (2 rodadas), `npm run build`; BACKLOG (7b, 9c usa v8); `graphify update .`; commit; revisão independente; push.
