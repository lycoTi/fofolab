# 📝 Regras da Fatia de Questões (`src/features/questions/` e `src/features/answer-flow/`)

Este arquivo governa todas as modificações na Bancada de Questões, no fluxo de resolução e na fila de exercícios.
Fonte única e viva do estado do módulo: [`src/features/questions/CONTEXT.md`](file:///d:/dev/fofolab/src/features/questions/CONTEXT.md).

## Diretrizes Locais Obrigatórias

1. **Paradigma da Prancheta (Anti-IA & Operate Mode):**
   - **PROIBIDO hiper-cardização:** nada de cards cinzas aninhados dentro de cards com bordas grossas e sombras flutuantes.
   - Trate a área de resolução como uma **Folha de Prova Contínua**: linhas limpas de 1px (`border-slate-800`), superfícies escuras sóbrias (`bg-slate-950`, `bg-slate-900/40`), metadados tipográficos inline em linha única.
   - Micro-interações táteis no padrão Emil Kowalski (`active:scale-[0.98]` ou `[0.97]`, transições de 150ms).
   - Zero emojis em textos de interface ou botões (auditoria `noEmojiInUi.test.ts`).

2. **Componentes e Modularização:**
   - **Teto de ~250 linhas por componente:** se ultrapassar, decompor imediatamente extraindo subcomponentes puros ou hooks dedicados (ex.: hooks de fila, paginação ou filtros).
   - `QuestionWorkbench.tsx` é o orquestrador e deve delegar responsabilidades para `QuestionCard`, `QuestionCorrection`, `QuestionFilters` e hooks de seleção.

3. **Invariantes do Fluxo Pedagógico (Ciência da Aprendizagem):**
   - **Calibração Pré-Resposta:** nunca liberar as alternativas sem a seleção prévia de confiança (`ConfidencePicker`), a não ser no 1º contato consciente ("Ver explicação antes de responder").
   - **Sem Revelação Prematura:** o gabarito oficial e a correção jamais aparecem antes de o estudante marcar a opção ou acionar o 1º contato. Pistas da FofoIA jamais eliminam alternativas ou revelam a resposta.
   - **Sobrevivência da Questão Respondida:** responder a questão **não** pode fazê-la sumir da tela imediatamente, mesmo no filtro de `Inéditas`. A tela mantém a questão ativa para o estudo pós-resolução até o avanço explícito.
   - **Autodiagnóstico Sem Viés:** o seletor visual de diagnóstico pós-resolução inicia desmarcado (`null`) para que o estudante faça a autoavaliação de forma consciente, enquanto a base grava o baseline derivado da confiança.

4. **Integração & Zero Jargão:**
   - **Zero Jargão Interno:** proibido exibir termos como "SQLite", "IndexedDB", "WASM", "_score", "tokens".
   - **Sincronização com a FofoIA:** manter os contratos `onActiveQuestionChange` e `onAskFofoIa` atualizados, alimentando a coluna direita com a questão ativa e a tentativa real (`<tentativa_do_estudante>`).
   - **Testes Obrigatórios:** toda alteração de fluxo deve passar nos testes unitários (`questionWorkbench.test.tsx`, `topicQuestions.test.ts`) e testes E2E (`bancada.spec.ts`, `acervo.spec.ts`).
