# 🎯 Módulo de Questões — Contexto Vivo & Arquitetura da Bancada

> **Módulo:** `questions` (`src/features/questions/`, `src/features/answer-flow/`, `src/lib/acervo/`, `src/lib/questionOptions.ts`)  
> **Papel:** O coração do estudo no FofoLab: Prancheta de Resolução de Questões, Fila Inteligente, Acervo Integrado e Ciclo de Retenção.  
> **Status:** Specs 09, 11, 12c, 12d implementadas e 100% testadas (Vitest + Playwright).  
> **Single Source of Truth:** Este arquivo consolida o estado, decisões e diretrizes da fatia para que qualquer agente ou desenvolvedor se situe instantaneamente sem vasculhar o repositório.

---

## 1. Missão & Filosofia da Bancada

- **A Bancada é uma Mesa de Estudos de Alto Rendimento (*Operate mode*):** o estudante está se preparando para concursos de topo (CGU, BACEN, Auditorias, Tribunais). A interface é uma **Folha de Prova Contínua (Prancheta)**, densa, sóbria e tátil.
- **Banimento da Hiper-Cardização (Anti-IA):** Proibido encapsular a questão em caixas dentro de caixas ("bonecas russas de cards"). Elementos se dividem por réguas elegantes de 1px (`border-slate-800`), com metadados estruturados em linha única (`CEBRASPE · STM 2025 · ITEM 65 | MÉDIA`).
- **Resolução Conectada à FofoIA e ao Caderno:** A questão ativa alimenta em tempo real a coluna direita: a FofoIA recebe o enunciado, alternativas e a tentativa real (`<tentativa_do_estudante>`), e qualquer explicação pode ser enviada diretamente para o caderno do tópico com o botão `+ Caderno`.

---

## 2. O Fluxo de Resolução em 4 Fases

```
[1. Leitura & Calibração] ➔ [2. Julgamento & Resposta] ➔ [3. Correção & Diagnóstico] ➔ [4. Aprofundamento / Avanço]
     ConfidencePicker                AnswerOptions              QuestionCorrection               Próxima / FofoIA
```

### Fase 1: Leitura & Calibração Pré-Resposta (`ConfidencePicker`)
- **Ciência da Aprendizagem (Confidence Calibration / Kahneman & Tversky):** antes de ver ou clicar nas opções, o estudante calibra seu nível de certeza:
  - `SURE` ("Sei"): alta confiança. Se errar, expõe **falsa certeza** (ilusão de competência).
  - `RECENT` ("Estou estudando"): contato recente, em consolidação.
  - `THINK` ("Acho que sei"): recuperação com dúvida ou hesitação.
  - `GUESS` ("Vou chutar"): chute puro. Se acertar, classifica como `LUCKY_GUESS` (chute certo não infla domínio).
- **Opção 1º Contato:** botão *"Ver explicação antes de responder"* (`firstContact`) permite estudo reverso acolhedor sem registro de erro punitivo.
- **Botão "Pedir pista à FofoIA":** convoca o andaime progressivo (Hint Scaffolding Ladder) em 3 níveis sem revelar o gabarito oficial.

### Fase 2: Julgamento & Resposta (`AnswerOptions`)
- **Formatos:**
  - **Certo/Errado:** 2 botões táteis largos (`Certo` / `Errado`) em destaque.
  - **Múltipla Escolha:** alternativas completas de A a E tratadas via `parseQuestionOptions`.
- **Riscador de Distratores (Eliminação Ativa):**
  - Permite descartar/riscar alternativas óbvias antes de responder, reduzindo a sobrecarga na memória de trabalho (*Cognitive Load Theory*).
  - Acionamento duplo: clique no botão sutil de corte na borda da alternativa ou atalho `Alt + Letra` (ex.: `Alt + A`).
  - Alternativa riscada recebe destaque esmaecido com tachado (`line-through opacity-40 text-slate-500 bg-slate-950/30`), com opção de desfazer a qualquer momento.
- **Travamento Imediato Anti-Viés:** ao clicar na alternativa, a resposta trava instantaneamente. A primeira tentativa é gravada no banco (`onAnswer`), impedindo autoengano pós-gabarito.
- **Feedback Visual de 150ms:**
  - Alternativa correta: destaque verde sutil (`border-emerald-500/60 bg-emerald-500/15 text-emerald-100`).
  - Alternativa errada marcada: destaque vermelho sutil (`border-rose-500/60 bg-rose-500/15 text-rose-100`).

### Fase 3: Correção & Autodiagnóstico (`QuestionCorrection` & `DiagnosisPicker`)
- **Veredito Claro e Construtivo:**
  - Acerto: *"Você acertou."* (verde esmeralda).
  - Erro: *"Não foi desta vez. Errar agora ajuda a fixar a resposta certa."* (âmbar construtivo, zero vergonha).
  - 1º Contato: *"Em mapeamento inicial: primeiro contato com esta questão."* (azul-céu).
- **Gabarito Oficial e Explicação Guardada:** exibe `dissection_markdown` via `RichText`. Se não houver, exibe botão tátil *"Gerar explicação"* (com persistência automática em `ai_dissections` para reutilização permanente).
- **Autodiagnóstico Pós-Tentativa:**
  - **Inicialização Desmarcada:** o seletor visual inicia em `null` para estimular reflexão sincera sem ancoragem, enquanto a base recebe a derivação automática (`deriveDiagnosis`).
  - **Feedbacks Pedagógicos em Destaque:**
    - Falsa certeza (`confidence === 'SURE'` + erro): *"Você tinha certeza. Vale entender de onde veio essa ideia."*
    - Chute no escuro (`confidence === 'GUESS'` + erro): *"Em mapeamento inicial: é um primeiro contato com isso, e a explicação é o que fixa."*

### Fase 4: Aprofundamento & Próxima Questão
- **Aprofundar com a FofoIA:** botão direto para abrir o diálogo contextual na coluna da direita com o prompt já calibrado na tentativa do aluno.
- **Desafiar o Ponto Cego (`findNextSameSubjectQuestion`):** atalho `Próxima sobre [Assunto] →` localiza a próxima questão inédita do acervo com a mesma tag minerada para teste imediato de retenção.
- **Próxima Questão:** navegação fluida seguindo a ordem visual do olhar do estudante.

### 2.1 Modo Teclado & Ergonomia de Alta Velocidade (`useQuestionKeyboardShortcuts`)
- **Resolução Sem Tirar as Mãos do Teclado (Fluxo 100% Contínuo):**
  - **Antes de responder:**
    - `1`, `2`, `3`, `4`: calibra a certeza (`1`: Sei, `2`: Estudando, `3`: Acho que sei, `4`: Chuto).
    - `C` / `E` (em Certo/Errado) ou `A`, `B`, `C`, `D`, `E` (em Múltipla Escolha): responde a alternativa correspondente.
    - `Alt + Letra`: descarta/risca a alternativa correspondente (Riscador de Distratores).
    - `P`: pede pista à FofoIA (`onHint`).
    - `V`: ver explicação antes de responder (1º contato).
  - **Após responder:**
    - `1`, `2`, `3`, `4`, `5`: seleciona diretamente as opções de autodiagnóstico ("Como foi?" / "Por quê?"), ajustando a tentativa na hora sem tocar no mouse.
    - `E`: aprofunda ou abre a explicação com a FofoIA na doca direita.
    - `Enter` ou `Espaço` ou `Seta Direita (→)`: avança para a próxima questão (`onNextQuestion`).
    - `Seta Esquerda (←)`: retorna para a questão anterior.
- **Proteção e Acessibilidade:**
  - Ignora atalhos automaticamente quando o foco está em campos de texto (`input`, `textarea`, `select`, `contentEditable`) ou com teclas modificadoras (`Ctrl`, `Alt`, `Cmd`).
  - Badges visuais sutis com `aria-hidden="true"` preservam os nomes acessíveis dos botões para leitor de tela e testes.

### 2.2 Centralização de Explicação na FofoIA (0 Tokens com Dissecação do Acervo)
- **Folha de Prova Limpa (Prancheta Central):** a prancheta de resolução permanece sóbria e focada em resolver, sem calhamaços de texto ou caixas pontilhadas desnecessárias. O gabarito oficial é exibido logo após a resposta.
- **Tutoria Unificada na Coluna Direita (FofoIA):**
  - Todo o estudo reverso, dissecação e explicação aprofundada acontecem na coluna da direita.
  - **Zero Consumo de Tokens (Acervo Oficial):** se a questão já possui dissecação cadastrada no banco (`dissection_markdown` em `ai_dissections` / acervo), o Fofo exibe instantaneamente a análise da banca com 0 tokens de IA e sem latência de rede (`sendStored`).
  - **Geração Sob Demanda:** se a questão não possuía dissecação prévia, a FofoIA analisa com a IA e disponibiliza o aprofundamento.

### 2.3 Cronômetro Discreto de Ritmo de Prova (`QuestionPacingTimer` & `useQuestionPacingTimer`)
- **Autopercepção Temporal Sem Estresse (Time Pacing):**
  - Diferente de contagens regressivas que disparam ansiedade com alarmes vermelhos ou bipes, o cronômetro é **progressivo e editorial** (formato tabular `mm:ss`).
  - Posicionado discretamente no cluster superior direito da folha de prova junto ao indicador de teclado.
- **Transparência de Inicialização & Vínculo com Bloco de Foco (`blockRunning`):**
  - **Modo Livre (sem bloco ativo):** o cronômetro fica em espera `(livre)` e não corre sozinho, respeitando a navegação descompromissada do aluno. Permite ativação manual via clique tátil de play `▶`.
  - **Com Bloco de Foco Ativo (Pomodoro / FofoDoro):** o cronômetro corre automaticamente durante a resolução de cada item do bloco.
- **Detecção Real de Presença & Inatividade:**
  - **Mudança de aba / Janela oculta (`visibilitychange`):** pausa imediata `(em espera)` ao trocar de aba ou suspender a tela, impedindo que o tempo infle artificialmente.
  - **Inatividade de Mouse e Teclado (60s):** ao passar 60 segundos sem nenhuma interação, entra em pausa automática `(ausente)` e retoma no primeiro toque no mouse/teclado.
  - **Controle Manual:** botão tátil play/pause (`⏸` / `▶`) direto no cronômetro.
- **Explicabilidade para Aluno Leigo (`MetricExplainer`):**
  - Ícone `?` com popover educativo explicando a finalidade do ritmo de prova, como funciona a pausa automática e que o recurso não consome nem altera as horas do ciclo semanal.
- **Faixas de Ritmo Recomendadas (Concursos de Alto Nível):**
  - `< 02:00` (`normal`): ritmo ideal de prova (`text-slate-400`).
  - `02:00 – 03:00` (`warning`): zona de atenção para não perder tempo excessivo (`text-amber-400`).
  - `> 03:00` (`extended`): ritmo estendido / questão longa (`text-rose-400`).
- **Congelamento e Persistência:**
  - Ao responder a questão (`locked`), o cronômetro congela instantaneamente no tempo final gasto.
  - O valor em segundos é gravado na tentativa (`time_spent_seconds`) e recuperado ao revisitar o item na sessão (`AttemptState.timeSpentSeconds`) ou no histórico (`QuestionAttemptSummary.lastTimeSpentSeconds`).

---

## 3. Fila Inteligente & Filtros Dinâmicos (Spec 12d)

A `QuestionWorkbench` gerencia uma fila inteligente orientada à produtividade:

1. **Status da Fila:**
   - **`Inéditas` (`UNSOLVED` - padrão):** foca no que nunca foi feito. Questões anuladas pela banca são automaticamente removidas desta contagem.
   - **`Errei ou chutei` (`RETRY`):** filtra apenas itens onde a última tentativa precisa de repetição (`needsRetry = true`), seja por erro, chute (`GUESS` / `LUCKY_GUESS`) ou 1º contato.
   - **`Todas` (`ALL`):** acervo completo do escopo selecionado, incluindo itens anulados.
2. **Invariante Crítica — Sobrevivência na Sessão (`attempts[itemKey]`):**
   - Ao responder uma questão no modo `Inéditas`, **ela NÃO pode desaparecer imediatamente da tela**.
   - Ela permanece visível e interativa para estudo, diagnóstico e conversa com a FofoIA até que o usuário avance de questão (`onNext`) ou troque os filtros.
3. **Ordenação Inteligente:** no filtro `"Todos os formatos"`, questões de **Certo/Errado** são ordenadas primeiro por padrão (formato central da Cebraspe), seguidas por Múltipla Escolha.
4. **Escopos Disponíveis:**
   - `Deste tópico` (`topic`): questões estritamente ligadas ao tópico selecionado.
   - `Do tópico pai / Grupo` (`group`): fallback quando o subtópico folha tem poucas questões.
   - `Toda a matéria` (`subject`): todas as questões da disciplina.
   - `Todo o plano` (`all`): visão global do concurso.
5. **Barra de Filtros em Acordeão (`QuestionFilters`):**
   - Resumo em linha única quando recolhida (`Filtros: Deste tópico · Inéditas (12) · Certo/Errado · CEBRASPE`).
   - Expansão rápida para busca por texto, filtro de banca e perfil de complexidade (`Fácil`, `Média`, `Difícil`).

---

## 4. Integração com o Acervo Local (`acervo.db`)

- **Zero-Click Sync (`src/lib/acervo/autoSync.ts`):** ao iniciar o app ou trocar de plano, o app consulta `/__acervo/index.json`. Se houver novidades nos pacotes (`acervo/pacote/`), a mesclagem e sincronização ocorrem em segundo plano com aviso discreto e determinístico.
- **Questões Virtuais (`src/lib/acervo/studentAcervo.ts`):** 28.000+ questões mineradas da Cebraspe residem em `acervo.db` e são transformadas em tempo de execução no tipo `Question` padrão, compartilhando as mesmas tabelas de tentativas (`question_attempts`) e dissecações (`ai_dissections`).
- **Curadoria Local:** o estudante pode desvincular um assunto (`onDisableLink`) ou excluir um item inadequado daquele tópico (`onExcludeItem`), com opção de restauração.

---

## 5. Diretrizes Invioláveis & Anti-Objetivos

1. **Verdade Imutável:** O gabarito oficial (`final_answer`) e o enunciado (`statement`) são imutáveis e jamais alterados pela IA.
2. **Zero Jargão Técnico:** Proibido exibir na UI termos como `"SQLite"`, `"WASM"`, `"_score"`, `"IndexedDB"`, `"tokens"`.
3. **Sem Gamificação Punitiva:** Erros em questões **nunca** inflam a meta semanal de horas (invariante de soma zero), não geram penalidades, sequências perdidas ou alertas vermelhos alarmistas.
4. **Sem Emoji em Textos de UI:** Botões, títulos e mensagens do módulo de questões não usam emojis de texto (auditoria `src/__tests__/noEmojiInUi.test.ts`). Emojis são reservados exclusivamente para os selos de modalidade da FofoIA e o mascote.
5. **Teto de ~250 Linhas por Componente:** Manter componentes compactos e especializados.

---

## 6. Arquivos Sob Responsabilidade da Fatia

| Área | Arquivo | Responsabilidade |
|---|---|---|
| **Bancada Principal** | [`src/features/questions/QuestionWorkbench.tsx`](file:///d:/dev/fofolab/src/features/questions/QuestionWorkbench.tsx) | Orquestração da fila, filtros, tentativas da sessão e atalhos. |
| **Atalhos de Teclado** | [`src/features/questions/useQuestionKeyboardShortcuts.ts`](file:///d:/dev/fofolab/src/features/questions/useQuestionKeyboardShortcuts.ts) | Ergonomia de alta velocidade (1-4 confiança, C/E ou A-E resposta, ↵ próxima). |
| **Cronômetro de Ritmo** | [`src/features/questions/QuestionPacingTimer.tsx`](file:///d:/dev/fofolab/src/features/questions/QuestionPacingTimer.tsx)<br/>[`src/features/questions/useQuestionPacingTimer.ts`](file:///d:/dev/fofolab/src/features/questions/useQuestionPacingTimer.ts) | Time Pacing discreto (mm:ss), vínculo com bloco de foco, detecção de inatividade/aba e explicabilidade. |
| **Folha de Questão** | [`src/features/questions/QuestionCard.tsx`](file:///d:/dev/fofolab/src/features/questions/QuestionCard.tsx) | Prancheta editorial limpa: metadados, enunciado, calibração e botões de ação. |
| **Correção & Feedback** | [`src/features/questions/QuestionCorrection.tsx`](file:///d:/dev/fofolab/src/features/questions/QuestionCorrection.tsx) | Veredito, gabarito, explicação salva, autodiagnóstico e navegação. |
| **Barra de Filtros** | [`src/features/questions/QuestionFilters.tsx`](file:///d:/dev/fofolab/src/features/questions/QuestionFilters.tsx) | Toolstrip em acordeão com resumo tipográfico contínuo. |
| **Componentes de Fluxo** | [`src/features/answer-flow/AnswerOptions.tsx`](file:///d:/dev/fofolab/src/features/answer-flow/AnswerOptions.tsx)<br/>[`src/features/answer-flow/ConfidencePicker.tsx`](file:///d:/dev/fofolab/src/features/answer-flow/ConfidencePicker.tsx)<br/>[`src/features/answer-flow/DiagnosisPicker.tsx`](file:///d:/dev/fofolab/src/features/answer-flow/DiagnosisPicker.tsx)<br/>[`src/features/answer-flow/AnswerCorrection.tsx`](file:///d:/dev/fofolab/src/features/answer-flow/AnswerCorrection.tsx) | Primitivas reutilizáveis do fluxo de resposta e diagnóstico. |
| **Estado Vazio & Links** | [`src/features/questions/EmptyTopicQuestions.tsx`](file:///d:/dev/fofolab/src/features/questions/EmptyTopicQuestions.tsx)<br/>[`src/features/questions/AcervoLinkBar.tsx`](file:///d:/dev/fofolab/src/features/questions/AcervoLinkBar.tsx) | Telas de fallback e gestão de assuntos vinculados do acervo. |
| **Lógica & Acervo** | [`src/lib/acervo/topicQuestions.ts`](file:///d:/dev/fofolab/src/lib/acervo/topicQuestions.ts)<br/>[`src/lib/acervo/autoSync.ts`](file:///d:/dev/fofolab/src/lib/acervo/autoSync.ts)<br/>[`src/lib/questionOptions.ts`](file:///d:/dev/fofolab/src/lib/questionOptions.ts)<br/>[`src/lib/dailyReview.ts`](file:///d:/dev/fofolab/src/lib/dailyReview.ts) | Consultas com escopo, parser de opções, sincronização e algoritmo HLR da revisão. |
| **Testes Chave** | [`src/__tests__/questionWorkbench.test.tsx`](file:///d:/dev/fofolab/src/__tests__/questionWorkbench.test.tsx)<br/>[`src/__tests__/topicQuestions.test.ts`](file:///d:/dev/fofolab/src/__tests__/topicQuestions.test.ts)<br/>[`src/__tests__/answerFlow.test.tsx`](file:///d:/dev/fofolab/src/__tests__/answerFlow.test.tsx)<br/>[`e2e/bancada.spec.ts`](file:///d:/dev/fofolab/e2e/bancada.spec.ts)<br/>[`e2e/acervo.spec.ts`](file:///d:/dev/fofolab/e2e/acervo.spec.ts) | Bateria de validação de regras de fila, calibração e persistência. |

---

## 7. Próximos Passos & Dívidas Técnicas Identificadas

- [ ] **Modularização de `QuestionWorkbench.tsx`:** O componente possui ~376 linhas (acima do teto de ~250 linhas). Extrair o hook `useQuestionQueue` (responsável pela filtragem, contagens de fila e retenção na sessão) para que o componente fique com ~180 linhas limpas.
- [ ] **Catálogo Empírico de Pegadinhas Cebraspe:** Aproveitar as 28k+ questões mineradas para gerar métricas de distratores frequentes por assunto.
- [ ] **Modo Simulado / Cronometrado:** Configuração opcional de tempo por questão sem perder o fluxo de estudo reverso.
