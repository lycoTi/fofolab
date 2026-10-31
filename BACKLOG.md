# 🐹🧪 FofoLab — Backlog & Estado do Projeto (Índice para IA)

> **Instrução para IA (Antigravity / Claude / Gemini):** leia este arquivo no início de cada sessão. Ele descreve o estado **real** (o que foi verificado e o que não foi). Detalhes técnicos ficam em `docs/specs/`; a última revisão completa está em `docs/reviews/2026-10-21-estado-do-projeto.md`.

## 📌 Status Global
- **Objetivo imediato:** uso pessoal nos estudos da **CGU** e do **BACEN**; depois, compartilhar com família e amigos.
- **Stack:** Tauri v2 + React 19 + TypeScript + Vite + Tailwind + Vitest + Playwright + sql.js (banco SQLite em memória, gravado em arquivo/IndexedDB).
- **25/10/2026:** **Plano de estudo (spec 13): 13a pronta** — horas por dia, folgas, "mudar o tempo de hoje" e a semana dia a dia. Spec 12 (minerador da Cebraspe) e entrega **12a** prontas — acervo de 29,9 mil itens em `acervo/` (revisão independente feita e corrigida); **12b [PARCIAL]** — vocabulário de assuntos e os primeiros 300 itens classificados pela IA. FofoIA: cumprimento respondido pelo app e resposta surgindo por parágrafo.
- **27/10/2026:** 13b e o Fofo no app prontos (abaixo). **12b [PARCIAL]** — 630 itens classificados (Gemini + DeepSeek com teto de R$ 5 por dia), vocabulário v27. **12c [DONE] [Claude Code]** (`docs/specs/12c-acervo-no-app.md`): o acervo da Cebraspe entra no app ligado aos tópicos do plano (pacote real: 273 de 275 tópicos da CGU pelo nome); banco na migração **v12**. **12d [DONE] [Antigravity]** (`docs/specs/12d-auto-sync-e-fila-questoes.md`): sincronização automática do acervo sem clique manual (`/__acervo/index.json` + pacotes por banca), fila inteligente na aba Questões (`Inéditas`, `Errei ou chutei`, `Todas`, ordenação `Certo/Errado` antes de `Múltipla escolha`, anuladas fora da contagem do bloco) e reta final flexível (migração **v13**).
- **27/10/2026 [Antigravity]:** Bancada de Questões polida no padrão Anti-IA (filtros colapsáveis compactos com resumo, paginação de questões seguindo o fluxo do olhar do estudante, complexidade intrínseca de 3 níveis Fácil/Média/Difícil estável, diagnóstico pós-resolução desmarcado por padrão para avaliação sem viés). Sincronização automática com stamp estritamente determinístico (notificação recorrente eliminada). Acervo Cebraspe ampliado com +500 questões pelo DeepSeek (28.344 itens com assunto, vocabulário v1694). Todos os 82 arquivos de teste (743 testes), E2E e build verificados e passando.
- **30/10/2026 [Antigravity]:** Bancada de Questões - Fase 15d: Inteligência de Ritmo & Simulação de Prova Real (Conclusão total da Fase 15) (DoD 100% verificado):
  - **Micro (HUD da Sessão em Tempo Real - `WorkbenchSessionHud.tsx`):** Placar discreto no topo da prancheta exibindo taxa de acerto (`8/10 acertos · 80%`), ritmo médio de resolução medido por item (`01:15/q`), tempo acumulado de foco no bloco e atalho direto para simulação de prova;
  - **Motor de Ritmo e Simulação de Prova Real (`pacingEngine.ts`):**
    - Diferenciação de ritmo por formato de item: itens Certo/Errado (Cebraspe) separados de Múltipla Escolha (FGV/FCC/Vunesp);
    - Detecção de gargalos críticos por disciplina (ex.: Português com enunciados extensos consumindo > 180s/item);
    - Filtro de anomalias (ignora itens com pausas > 15min para não enviesar a métrica);
    - Simulação de prova real com inclusão de margens realistas de preenchimento de cartão-resposta (15–30 min) e pausas/banheiro (5–15 min), projetando diagnósticos claros (`DEFICIT` de tempo / `TIGHT` ritmo no limite / `COMFORTABLE`);
  - **Macro (Modal de Simulação & Ritmo Histórico - `ExamPacingModal.tsx`):** Acessível a partir do HUD da bancada e da aba Início (`GoodMorningView.tsx`), com presets rápidos para provas reais (FGV 70q / 4h, FGV 80q / 4h30, Cebraspe 120 itens / 3h30) e customização livre de parâmetros;
  - **Verificação Total:** 418 testes passando em 39 arquivos (suites `pacingEngine.test.ts`, `workbenchSessionHud.test.tsx`, `examPacingModal.test.tsx`, `goodMorningView.test.tsx`, `questionWorkbench.test.tsx` e `noEmojiInUi.test.ts`), build de produção limpo em 1.48s e regras de arquitetura ($\le 250$ linhas) estritamente cumpridas.
- **30/10/2026 [Antigravity]:** Modelos Fortes de Raciocínio sob Demanda na FofoIA (`VITE_*_MODEL_STRONG`) (DoD 100% verificado):
  - **Raciocínio Profundo sob Demanda (`aiRouter.ts`, `ask.ts`, `vite.config.ts`):** Ativação seletiva de modelos de alta capacidade exclusivamente para os modos que exigem síntese analítica profunda (`LESSON` - Aula Completa e `EDITAL` - Cai no meu edital?), preservando os modelos rápidos e econômicos para o fluxo cotidiano (Pista, Rápida, Fixação);
  - **Suporte Multiprovedor Completo:**
    - Groq: `VITE_GROQ_MODEL_STRONG` (ex.: `openai/gpt-oss-120b` ou `llama-3.3-70b-versatile`);
    - Gemini: `VITE_GEMINI_MODEL_STRONG` (ex.: `gemini-1.5-pro`);
    - DeepSeek: `VITE_DEEPSEEK_MODEL_STRONG` (ex.: `deepseek-v4-pro` ou `deepseek-reasoner` com thinking habilitado);
    - Ponte local agy: `VITE_AGY_MODEL_STRONG` aciona `gemini-3.8-flash-high` na CLI via middleware `/__ai/agy`;
    - Gateway remoto: repassa o flag `strong: true` no payload JSON;
  - **Transparência e Selo Visual (`FofoMessage.tsx`):** Respostas geradas por modelos fortes recebem o badge discreto de 10px `Modelo forte` (no padrão editorial Anti-IA, sem emojis);
  - **Verificação Total:** 102 arquivos de testes (983 testes passando 100%), suites `aiRouter.test.ts` e `fofoiaPanel.test.tsx` atualizadas, build de produção limpo em 12.00s e grafo `graphify` atualizado.
- **30/10/2026 [Antigravity]:** Bancada de Questões - Fase 15c: Grifo no Enunciado e Nota Rápida no Caderno (DoD 100% verificado):
  - **Grifo no Enunciado (`QuestionStatement.tsx`, `questionHighlights.ts`):** Ferramenta de marcação sutil em amarelo/âmbar translúcido ao selecionar termos restritivos no enunciado (como "vedado", "exclusivamente", "sempre"), com detecção de seleção, balão flutuante, tecla de atalho `G`, remoção ao clicar no grifo e persistência local por questão;
  - **Nota Rápida no Caderno (`QuestionCorrection.tsx`, `QuestionWorkbench.tsx`, `App.tsx`):** Ação tátil `[ + Caderno ]` na folha de correção pós-resolução para registrar pegadinhas e insights diretamente nas anotações do tópico sem sair do fluxo da prancheta;
  - **Verificação Total:** Suites `questionHighlights.test.ts`, `questionStatement.test.tsx`, `questionWorkbench.test.tsx` e `noEmojiInUi.test.ts` 100% verdes, build de produção limpo em 14.98s e grafo `graphify` atualizado.
- **30/10/2026 [Antigravity]:** Auto-Cache de Dissecações Inéditas no Acervo Local na FofoIA (DoD 100% verificado):
  - **Auto-Cache em `ai_dissections` (`useFofoConversation.ts`, `App.tsx`):** Quando o estudante aprofunda numa questão inédita (`Aprofundar com a FofoIA` ou `Destrinchar alternativas`) sem dissecação prévia, a FofoIA gera a análise e o app automaticamente materializa a questão no SQLite (`materializeQuestion`) e persiste a dissecação em `ai_dissections` via `saveAiDissection`;
  - **Zero Tokens & Zero Latência Futura:** Questões já dissecadas passam a ser abertas instantaneamente a **0 tokens de IA e 0ms de espera** via `sendStored`, mantendo paridade com o acervo minerado e poupando custos de API em consultas recorrentes;
  - **Verificação Total:** 100 arquivos de teste (969 testes passando 100%), incluindo `useFofoConversation.test.tsx`, `fofoiaPanel.test.tsx` e `noEmojiInUi.test.ts`, build de produção limpo em 14.47s e grafo `graphify` atualizado.
- **30/10/2026 [Antigravity]:** Bancada de Questões - Fases 15a e 15b: Ergonomia de Prova, Modo Consulta Protegido e Folha Contínua (DoD 100% verificado):
  - **15a — Ergonomia de Prova e Folha Contínua (`QuestionCard.tsx`, `QuestionCorrection.tsx`, `AnswerCorrection.tsx`):** Eliminação da borda dupla e da "boneca russa de cards". A correção agora flui como continuação natural da prancheta (`embedded`), com régua suave de 1px. Removida a setinha `>` redundante de navegação mantendo o foco no botão primário `[ Próxima questão → ↵ ]`. Removido o círculo redundante `(i)` de explicabilidade do cronômetro para limpeza visual no padrão Anti-IA;
  - **15b — Modo Consulta / Revisão Protegida (`QuestionWorkbench.tsx`, `topicQuestions.ts`):** Questões já resolvidas na sessão ou em blocos anteriores abrem em **Modo Consulta** com selo discreto `Modo consulta`, exibindo a tentativa anterior e o gabarito travado sem contaminar as estatísticas do bloco. Adicionado botão tátil `[ Refazer ]` para estudantes que desejam voluntariamente resolver a questão novamente;
  - **Verificação Total:** Suites `questionWorkbench.test.tsx` (28 testes), `noEmojiInUi.test.ts` e `topicQuestions.test.ts` 100% verdes.
- **30/10/2026 [Antigravity]:** Fofo Window - Cenário da Trilha Finalizado (`trilha.ts`, `paintScene.ts`):
  - Desenho em pixel art da paisagem de trilha do explorador com silhueta de montanhas, pinheiros, ponto de luz quente e chão de terra com sombra projetada do Fofo, compatível com os 3 períodos celestes (dia, dourado, noite);
  - Testes em `fofoScenePaint.test.ts` atualizados e passando 100%.
- **29/10/2026 [Antigravity]:** Barreira Local Anti-Desvio a Zero Tokens & Ciclo Socrático Multi-Turn de Fixação na FofoIA (DoD 100% verificado):
  - **Barreira Local Anti-Desvio (`offTopicGuard.ts`):** interceptação local de perguntas desvinculadas de concursos (receitas culinárias, apostas/jogos de azar, horóscopo/esoterismo, resultados esportivos, fofocas de celebridades e prescrições médicas de saúde) **antes** de qualquer chamada à IA. Retorna imediatamente a custo **zero de tokens e 0ms de rede** com a voz acolhedora do hamster convidando a voltar ao edital ativo; imune a falsos positivos (termos do edital como receita orçamentária ou blockchain de TI são respeitados);
  - **Ciclo Socrático Multi-Turn de Fixação (`RETRIEVAL`):** quando o estudante responde ao micro-cenário do "Testar se fixei" (ex.: "acho que o ato é nulo"), o motor reconhece `isAnsweringRetrieval` em `signals.ts` e `prompts.ts`, mantendo o modo `Fixação` e ativando a instrução de avaliação direta `<avaliacao_de_fixacao>` para julgar se o estudante acertou, apontar a distinção técnica e fechar a recuperação ativa;
  - **Modularização de Armazenamento (`conversationStorage.ts`):** persistência de sessões da FofoIA extraída para módulo isolado, garantindo componentes e hooks rigorosamente $\le 250$ linhas (`FofoIaPanel.tsx`: 247 linhas, `useFofoConversation.ts`: 215 linhas);
  - **Verificação Total:** suites `offTopicGuard.test.ts`, `fofoiaRetrieval.test.ts`, `fofoiaPanel.test.tsx`, `noEmojiInUi.test.ts` e `npm run build` passando 100%.
- **28/10/2026 [Antigravity]:** Des-cardização completa do app no paradigma da Prancheta/Bancada de Alta Densidade (*Operate mode*, Anti-IA, Emil Kowalski & Apple Design). Removida hiper-cardização e decorações de landing page (teias de aranha de Halloween removidas da área de estudo). Reestruturados: Coluna da Esquerda (remoção da trilha vertical artificial que espremia o texto, eliminação radical da moldura/caixa de 4 bordas do bloco atual, itens feitos e próximos em linhas limpas de alta densidade sem cards, botões de materiais e seletor de Pomodoro convertidos em toolbars/segmented controls unificados de 1px), Questões (metadados tipográficos inline em vez de chips aninhados), FofoIA (textarea expansível até 35vh com Shift+Enter para quebra de linha, botões táteis `active:scale-[0.97]`), Início/Bom dia (painel contínuo de prancheta com divisores de 1px sem cards dentro de cards) e Plano de estudo (calendário com micro-interações táteis e réguas de ciclo limpas). Especialistas modulares criados: `fofoia-specialist` (com `CONTEXT.md`) e `ui-design-specialist` (com `emil-design-eng` e `apple-design` na stack global). Verificados: 83 arquivos de testes (742 testes) passando 100%, `npm run build` e grafo `graphify` atualizados.
- **28/10/2026 [Antigravity]:** Varredura e refino completo da FofoIA (Renderização Rica, Segurança e Didática):
  - **Exibição e Markdown (`RichText.tsx`, `richTextBlocks.tsx`):** Parser de blocos completo para `RichText` (sem HTML cru, sanitização total e renderização suave com reveal por bloco). Adicionado suporte completo a:
    - Blocos de código cercados (```` ```linguagem ````) com cabeçalho de linguagem, botão de cópia com feedback tátil e rolagem horizontal suave;
    - Tabelas Markdown (`| col1 | col2 |`) com container responsivo com rolagem horizontal (`overflow-x-auto rounded-lg border border-slate-800`), zebra striping sutil e formatação inline (`renderInline`);
    - Listas numeradas (`1. `) e citações (`> `) com borda lateral de destaque (border accent);
  - **Segurança e Blindagem (`prompts.ts`):** Adicionada regra 11 explícita anti-jailbreak / prompt injection (imunidade contra ordens de desconsiderar regras, simulação de personas para burlar restrições e vazamento de tags internas);
  - **Didática e Ciência da Aprendizagem (`prompts.ts`, `context.ts`, `FofoIaPanel.tsx`):**
    - Injeção da tentativa real do estudante (`<tentativa_do_estudante>`): alternativa marcada, resultado, nível de confiança, autodiagnóstico e tempo gasto, permitindo desarmar o distrator específico e calibrar a falsa certeza;
    - Andaime progressivo de pistas (Hint Scaffolding Ladder em 3 níveis: Nudge conceitual -> Andaime procedimental -> Alerta de armadilha mental e incentivo ao teste) conectado via `hintsGiven` para questões de múltipla escolha;
    - Atalhos dinâmicos contextuais substituindo o botão redundante "Cai no meu edital?": não respondida (`Pedir pista`, `Conceito-base`), respondida com erro (`Por que errei?`, `Aula completa`, `Salvar resumo`), respondida com acerto (`Destrinchar alternativas`, `Aula completa`, `Salvar resumo`) e estudo livre (`Aula completa`, `Do zero`, `Salvar resumo`); auto-roteamento para EDITAL mantido via detecção de texto natural;
  - **Personalidade e Anti-IA:** Regra de voz proibindo clichês e saudações/fechamentos ocos de IA, focando no diálogo técnico de alto rendimento.
  - Verificados: 59 testes passando (unitários e de painel), `npm run build` limpo e `graphify update .` executado.
- **29/10/2026 [Antigravity]:** Evolução de Alto Rendimento na Bancada de Questões (Itens 1, 2 e 3 do Diagnóstico, Atalhos de Diagnóstico & Centralização na FofoIA com 0 Tokens):
  - **Agente Especialista & Single Source of Truth:** criado o especialista `questoes-specialist` (`.agents/skills/questoes-specialist/SKILL.md`) com junction no `.claude/skills/` e mapa de contexto vivo em `src/features/questions/CONTEXT.md` (regras invioláveis, invariantes de sessão, 4 fases de resolução e catálogo de arquivos).
  - **Item 1 — Modo Teclado de Fluxo Contínuo & Atalhos Pós-Resposta (`useQuestionKeyboardShortcuts.ts`):** resolução ultrarrápida 100% pelo teclado: teclas `1` a `4` para calibração de certeza (Sei, Estudando, Acho, Chuto), `C`/`E` ou `A` a `E` para alternativas, `Alt + Letra` para riscar distratores, `1` a `5` após responder para autodiagnóstico imediato ("Como foi?" / "Por quê?"), `E` para aprofundar com a FofoIA, e `Enter`/`Espaço`/`→` para próxima questão.
  - **Item 2 — Riscador Tátil de Distratores (`AnswerOptions.tsx`):** eliminação de alternativas na múltipla escolha com clique direto no botão de corte ou atalho `Alt + Letra` (`Alt + A`), aplicando estilo esmaecido e tachado (`line-through opacity-40`) para aliviar a carga da memória de trabalho.
  - **Item 3 — Cronômetro Discreto de Ritmo de Prova / Time Pacing (`useQuestionPacingTimer.ts` & `QuestionPacingTimer.tsx`):** contagem progressiva tabular em `mm:ss` no cabeçalho editorial com pausa imediata em troca de aba (`visibilitychange`), pausa por inatividade de 60s do mouse/teclado, modo em espera `(livre)` sem bloco ativo, congelamento automático ao responder e persistência do tempo em segundos (`time_spent_seconds`) na sessão e no histórico (`lastTimeSpentSeconds`).
  - **Centralização da Explicação na FofoIA & Zero Tokens com Dissecação do Acervo:** prancheta central de prova despoluída de caixas tracejadas; explicações detalhadas e tutoria centralizadas na coluna direita da FofoIA; se a questão já possui dissecação oficial guardada no banco (`ai_dissections`), o Fofo exibe a análise da banca instantaneamente com **0 tokens de IA e 0ms de espera de rede** (`sendStored`); se não possuir, gera sob demanda via IA.
  - **Estabilidade & DoD:** 83 arquivos de testes (812 testes) passando 100%, todos os componentes $\le 250$ linhas (`FofoIaPanel.tsx`: 247 linhas, `QuestionCorrection.tsx`: 162 linhas, `QuestionPacingTimer.tsx`: 104 linhas), zero emojis em UI text, `npm run build` limpo e grafo `graphify` atualizado.
- **29/10/2026 [Antigravity]:** Recuperação Ativa (*Retrieval Practice* na FofoIA) & Intercalação Protegida (DoD 100% verificado):
  - **Ajuste Fino Pedagógico (Prática Intercalada vs em Bloco):** removido o atalho de mesma temática da barra de correção (`QuestionCorrection.tsx`), mantendo o fluxo natural com `Próxima questão →`. Isso impede o viés de prática em bloco (ilusão de fluência), treina a habilidade de discriminação sem pista e protege as questões reais do acervo Cebraspe para as revisões espaçadas no ciclo;
  - **7º Jeito da FofoIA: Recuperação Ativa (`RETRIEVAL`, selinho `Fixação`):** botão `Testar se fixei` em `FofoShortcuts.tsx` (ao errar, acertar ou em estudo livre). A FofoIA propõe 1 micro-cenário prático inédito ou pergunta de julgamento rápido sobre a distinção chave, convidando a responder de cabeça ou em 1 linha sem revelar o gabarito previamente — testando a fixação profunda com **custo zero de questões reais do acervo**;
  - **Verificação Total:** 83 arquivos de testes (758 testes) passando 100%, `npm run build` limpo e componentes estritamente <= 250 linhas (`FofoIaPanel.tsx`: 245 linhas).
- **29/10/2026 [Antigravity]:** Desafiar o Ponto Cego (Próxima Questão Inédita do Mesmo Assunto Minerado) & Blindagem Antialucinação de Bancas (DoD 100% verificado):
  - **Próxima Questão do Mesmo Assunto (`findNextSameSubjectQuestion` em `topicQuestions.ts`):** mapeia os assuntos minerados do acervo (`item_assuntos` + `assuntos`) em cada questão da bancada. Ao responder uma questão (ou tirar dúvida com a FofoIA), o app identifica o assunto canônico exato (ex.: CSRF, Atributos do Ato) e oferece um atalho direto: `Próxima sobre [Assunto] →` (na barra de correção e nos atalhos da FofoIA), selecionando a próxima questão **inédita** do acervo que compartilha aquele mesmo tema minerado para testar e fixar o conhecimento na hora;
  - **Fallback gracioso & Filtros:** quando não há outra inédita do mesmo assunto ou trata-se de questão própria, recua suavemente para a próxima inédita do tópico; ao esgotar todas as inéditas, os botões somem de forma limpa;
  - **Blindagem Antialucinação de Bancas (`prompts.ts`):** regra 4 e fechamento do Comparativo reforçados com proibição estrita de personificar a banca ou inventar manias sem base catalogada ("Cebraspe adora trocar", "FGV costuma exigir"), impondo formulações neutras e impessoais ("Em provas de concurso costuma-se...", "Cuidados comuns em provas");
  - **Item no Backlog de Análise Futura:** adicionada tarefa para criação de mapa de calor empírico e catálogo documentado de armadilhas da Cebraspe a partir das 29k+ questões classificadas;
  - **Interface sem Emoji:** botões e atalhos de ação mantidos rigorosamente sem emojis de texto, respeitando a identidade visual e o teste `noEmojiInUi.test.ts`;
  - **Verificação Total:** 83 arquivos de testes (758 testes) passando 100%, `npm run build` limpo e componentes estritamente <= 250 linhas (`FofoIaPanel.tsx`: 245 linhas).
- **29/10/2026 [Antigravity]:** Memória isolada por questão, gestão de contexto, envio ao caderno e Matriz de Contraste X vs Y na FofoIA (DoD 100% verificado):
  - **Memória & Isolamento por Questão (`useFofoConversation.ts`):** sessões indexadas por `sessionKey` (`q:<id>` por questão ativa, ou `t:<topico>` em navegação livre). Avançar para uma nova questão limpa a lousa automaticamente, economizando tokens e evitando poluição de temas; retornar a uma questão anterior restaura com fidelidade a conversa exata daquela questão (persistência local multissessão com janela de restauração de 20 min);
  - **Botão "Limpar" Lousa (`FofoPanelHeader.tsx`):** ação tátil no cabeçalho para reiniciar a lousa sob demanda a qualquer instante;
  - **Captura de Trecho para o Caderno (`+ Caderno` em `FofoMessage.tsx`):** envio com um clique de qualquer resposta ou explicação da FofoIA diretamente para o caderno do tópico, com badge de confirmação ("Salvo no caderno");
  - **Comparativo de Conceitos (`CONTRAST`):** 6º jeito da FofoIA dedicado a desarmar confusões conceituais em provas sem jargões acadêmicos herméticos ("distrator", "conceito X/Y", "ponto de ruptura"). Botões contextuais claros: `Comparar com a certa` (ao errar), `Ver comparativo` (ao acertar) ou `Comparar conceitos` (navegação livre), além de menções naturais ("comparativo", "comparar"). Responde com tabela comparativa de 3 colunas (*No que prestar atenção* | *O que é certo (Gabarito)* | *Onde tentam te pegar*) e 3 linhas práticas (*Ideia central*, *Na prática*, *Onde costuma confundir*), fechando com *"Cuidado na prova:"* de forma direta e acionável;
  - **Modularização e Teto de 250 Linhas:** extraídos `FofoShortcuts.tsx` (164 linhas) e `FofoPanelHeader.tsx` (40 linhas), mantendo `FofoIaPanel.tsx` estritamente com 249 linhas (abaixo do teto de ~250);
  - **Verificação Total:** 83 arquivos de testes (756 testes) passando 100%, `npm run build` (tsc -b + vite) concluído com sucesso e grafo `graphify` atualizado.
- **29/10/2026 [Antigravity]:** FofoIA com a Letra da Lei - Fatia 11.2.4: Mesa de Estudos Lado a Lado & Formatação Vade Mecum Editorial (DoD 100% verificado):
  - **Mesa de Estudos Lado a Lado (Opção B - Slide-over Lateral em `LawReaderModal.tsx`):** substitui o antigo modal flutuante espremido por um slide-over lateral que ocupa a coluna direita suavemente (`animate-in slide-in-from-right duration-250`), auto-alargando a prancheta para 540px (`onWiden`) e mantendo a questão da prova aberta e legível na coluna central lado a lado para comparação imediata com o dispositivo legal; no mobile, comporta-se como bottom-sheet responsivo;
  - **Renderizador Vade Mecum Editorial (`LawArticleFormatter.tsx`):** limpa Markdown cru (`**Art. 1º**`), destaca o número do artigo em badge âmbar, formata caput em tipografia legível, indenta incisos romanos (`I -`, `II -`), destaca parágrafos (`§ 1º`, `Parágrafo único`) com bordas suaves e esmaece notas legislativas em itálico discreto;
  - **Abas de Artigos Múltiplos:** subcabeçalho tátil permite ao estudante alternar entre múltiplos artigos citados na mesma questão ou conversa sem fechar o leitor;
  - **Desvio Pedagógico Inteligente (`signals.ts`):** quando o estudante faz uma pergunta livre sobre legislação durante uma questão não respondida, a FofoIA não sequestra a conversa com a pista genérica da questão em tela, respondendo o conceito jurídico com o dispositivo legal oficial;
  - **Animações Táteis Emil Kowalski:** microinterações táteis `active:scale-[0.97]`, transição suave de cópia e envio ao caderno com feedback visual, e entrada fluida das pílulas;
  - **Verificação Total:** 12 testes dedicados em `lawPills.test.tsx` e `lawArticleFormatter.test.tsx`, 34 testes de regras pedagógicas em `fofoia.test.ts`, auditoria anti-emoji (`noEmojiInUi.test.ts`) 100% verde, build de produção limpo em 16.07s e componentes estritamente <= 250 linhas (`FofoIaPanel.tsx`: 250 linhas, `LawReaderModal.tsx`: 162 linhas, `LawArticleFormatter.tsx`: 135 linhas).
- **29/10/2026 [Antigravity]:** FofoIA com a Letra da Lei - Fatia 11.2.3: Detector e Resolvedor Cirúrgico de Artigos (DoD 100% verificado):
  - **Detector de Referências (`src/lib/laws/detector.ts`):** identifica menções diretas a normas federais (CF/88, Lei 8.112, 9.784, 14.133, 8.429, LAI) e artigos simples ou compostos no enunciado ("arts. 37 e 41 da CF/88", "art. 20 da Lei 8.112/90"), normalizando as chaves;
  - **Resolvedor de Fragmentos (`src/lib/laws/resolver.ts`):** busca o dispositivo exato no repositório de leis, gera `LawExcerpt` com redação literal e âncora direta para a fonte do Planalto (`#art37`), além de fallback heurístico por tópico de edital (ex.: "Responsabilidade Civil do Estado" -> CF/88 Art. 37, limitado a 3 artigos);
  - **Integração Reativa na FofoIA (`useLawExcerpts.ts`, `useFofoIaInputs.ts`, `FofoIaPanel.tsx`):** hook assíncrono não-bloqueante que injeta a legislação relevante no `FofoContext` da questão ativa sem travamento de tela (`FofoIaPanel.tsx`: 248 linhas, estritamente <= 250);
  - **Verificação Total:** 10 testes dedicados em `lawDetector.test.ts` e `lawResolver.test.ts`, 28 testes de painel/inputs passando, `npm run build` limpo em 13.10s e grafo `graphify` atualizado.
- **29/10/2026 [Antigravity]:** FofoIA com a Letra da Lei - Fatia 11.2.2: Parser de Artigos do ctresb/leis & Armazenamento Sob Demanda (DoD 100% verificado):
  - **Parser Leve de Legislação (`src/lib/laws/parser.ts`):** normalizador robusto de chaves (`normalizeArticleKey`: "Art. 1º" -> "1", "Art. 37, § 6º" -> "37", "Art. 103-A" -> "103-a"), extrator de frontmatter YAML e fatiador de artigos com separação precisa de `caput` e `fullText` (incluindo incisos e parágrafos);
  - **Catálogo de Normas Basilares (`src/lib/laws/catalog.ts`):** mapeamento direto das normas federais mais exigidas (CF/88, Lei 8.112/90, Lei 9.784/99, Lei 14.133/21, Lei 8.429/92, LAI) com caminhos relativos no repositório público `ctresb/leis` e links oficiais Planalto;
  - **Armazenamento Sob Demanda & Offline (`src/lib/laws/store.ts`):** repositório local em IndexedDB (`fofolab-laws`) com cache em memória. O app nasce com 0 KB de legislação no instalador e faz o download sob demanda somente das leis requeridas pelo edital estudado, salvando-as para uso 100% offline permanente;
  - **Verificação Total:** 86 arquivos de testes (todos os 773 testes passando 100%), incluindo `lawParser.test.ts` e `lawStore.test.ts`, `npm run build` limpo em 15.52s e grafo `graphify` atualizado.
- **29/10/2026 [Antigravity]:** FofoIA com a Letra da Lei - Fatia 11.2.1: Contrato de Dados (LawExcerpt) & Blindagem Normativa no Prompt (DoD 100% verificado):
  - **Contrato de Dados da Legislação (`LawExcerpt` em `src/lib/fofoia/context.ts`):** modelado para conter nome da norma (`lawName`), artigo/dispositivo (`article`), texto literal compilado oficial (`text`) e URL oficial para a fonte Planalto/Senado (`sourceUrl`). Função `lawExcerptsXml` injeta bloco `<legislacao_relevante>` no prompt;
  - **Blindagem Anti-Alucinação & Citação Literal (`prompts.ts`):** regras 1, 2, 3 e 4 reforçadas. Se houver `<legislacao_relevante>`, a FofoIA ancora a explicação no texto legal exato, cita o dispositivo literal entre aspas, foca nos termos normativos objetivos do texto (ex.: "deve" vinculado vs "pode" discricionário, prazos e competências expressas) e proíbe terminantemente inventar artigos ou manias de bancas sem catalogação empírica prévia; regra de abstenção honesta preservada quando a norma não estiver no contexto;
  - **Modo Demonstração Offline (`demo.ts`):** respostas simuladas em `QUICK` e `LESSON` atualizadas para demonstrar a citação literal oficial da norma quando há legislação relevante;
  - **Verificação Total:** 34 testes unitários de prompt e modos em `fofoia.test.ts` (100% verdes), testes de painel `fofoiaPanel.test.tsx` (25/25) e `npm run build` limpo em 13.28s.
- **29/10/2026 [Antigravity]:** Criação do Especialista do Módulo de Questões (`questoes-specialist`):
  - **Especialista Autoral (`.agents/skills/questoes-specialist/SKILL.md`):** espelhado na estrutura de alta densidade do `fofoia-specialist`, consolida o domínio técnico da Bancada de Estudos, fluxo de resposta em 4 fases, calibração de confiança, autodiagnóstico sem viés, fila inteligente e filtros em acordeão;
  - **Contexto Vivo & Zero-Waste (`src/features/questions/CONTEXT.md`):** fonte única e viva da verdade operacional do módulo de questões para que qualquer IA (Antigravity ou Claude Code) atue instantaneamente sem varredura cega no repositório;
  - **Regras da Fatia (`src/features/questions/AGENTS.md`):** diretrizes inegociáveis de design anti-IA (folha de prova contínua, linhas de 1px, sem caixas aninhadas), micro-interações táteis Emil Kowalski (`active:scale-[0.98]`), ausência de jargão de infraestrutura e teto de ~250 linhas;
  - **Paridade de Ambientes:** Junction criada em `.claude/skills/questoes-specialist` apontando para `.agents/skills/questoes-specialist`.
- **29/10/2026 [Antigravity]:** Bancada de Questões - Modo Teclado & Ergonomia de Alta Velocidade (DoD 100% verificado):
  - **Hook Dedicado (`useQuestionKeyboardShortcuts.ts`):** ergonomia contínua sem mouse. Teclas `1..4` calibram a confiança (`1`: Sei, `2`: Estudando, `3`: Acho que sei, `4`: Chuto); `C`/`E` (em Certo/Errado) ou `A..E` (em Múltipla Escolha) selecionam e respondem; `Enter`, `Espaço` ou `→` avançam para a próxima questão; `←` recua; `P` pede pista à FofoIA; `V` ativa o 1º contato;
  - **Proteção e Acessibilidade:** ignora teclas automaticamente quando o foco está em inputs/textareas ou com modificadores; badges visuais sutis usam `aria-hidden="true"` para preservar os nomes acessíveis exatos dos botões;
  - **Verificação Total:** 86 arquivos de testes (773 testes) passando 100%, auditoria anti-emoji (`noEmojiInUi.test.ts`), `npm run build` (tsc -b + vite) verde e grafo `graphify` atualizado.
- **29/10/2026 [Antigravity]:** Bancada de Questões - Riscador de Distratores / Eliminação de Alternativas (DoD 100% verificado):
  - **Eliminação de Distratores (`AnswerOptions.tsx` & `QuestionCard.tsx`):** suporte completo ao descarte ativo de opções absurdas em questões de múltipla escolha para aliviar a carga cognitiva na memória de trabalho (*Cognitive Load Theory*);
  - **Interação Dupla (Mouse & Teclado):** botão tátil com ícone `Strikethrough` surge na lateral da opção em hover/foco; atalho rápido `Alt + Letra` (ex.: `Alt+A`, `Alt+B`) permite riscar ou restaurar opções diretamente pelo teclado;
  - **Estilização Anti-IA:** opções descartadas recebem efeito esmaecido com tachado limpo (`line-through opacity-40 text-slate-500 bg-slate-950/30`), com limpeza automática ao avançar de questão ou alternar filtros;
  - **Verificação Total:** 86 arquivos de testes (todos os 775 testes passando 100%), incluindo `answerFlow.test.tsx` e `questionWorkbench.test.tsx`, auditoria anti-emoji (`noEmojiInUi.test.ts`), `npm run build` limpo em 14.53s e grafo `graphify` atualizado.
- **Fase atual (24/10/2026):** fatias 5.5–5.7 na `main`; no branch **`fatia-7-edital-ciclo`**: 7a/7b, 9a/9b/9c (bancada, roteiro, Revisão do dia e aba Início), FofoDoro (10), **FofoIA (11)** e Plano de estudo (13a/13b) — banco na migração **v11**. O app desktop (Tauri) ainda **não foi compilado em nenhum PC** (checklist abaixo). **Estado e próximos passos: `docs/handoff/2026-10-24-estado-e-proxima-ia.md`.**

- **Retomando (outra IA ou outro PC)?** Leia `docs/handoff/2026-10-24-estado-e-proxima-ia.md`; para preparar um PC novo, a seção 1 de `docs/handoff/2026-10-22-continuar-no-outro-pc.md`.

## ✅ Definição de Pronto
Um item só vira **[DONE]** quando: (1) funciona com dados reais, não só com o exemplo; (2) sobrevive a fechar e abrir o app; (3) tem teste automatizado da regra e, se o fluxo atravessa telas, teste E2E; (4) `npm test`, `npm run test:e2e` e `npm run build` passam.
Legenda: **[DONE]** verificado • **[PARCIAL]** funciona com limitações listadas • **[A VERIFICAR]** implementado, sem verificação ponta a ponta • **[ ]** não começou.

## 🎯 Estado real por área

**Dados & segurança** (spec `06-importacao-e-persistencia.md`)
- [DONE] Contrato SQL v4 + migrações (`PRAGMA user_version`); teste garante banco novo = banco v1 migrado.
- [DONE] No navegador: gravação em IndexedDB logo após cada ação, aviso visível de falha + nova tentativa, cópia diária, quarentena de banco ilegível, backup/restauração (arquivo e cópias automáticas) — testado E2E.
- [A VERIFICAR] No `.exe`: arquivo real `%APPDATA%\com.fofolab.desktop\fofolab.db` via `tauri-plugin-fs` (código pronto, **nunca compilado**).
- [DONE] Excluir/restaurar pede confirmação, mostra o que vai junto e guarda cópia antes. IDs UUID.

**Ciclo & métricas** (specs `02` e `05`)
- [DONE] Motor do ciclo (soma zero, confiança da amostra, curva de esquecimento); o "ⓘ" mostra a conta que o motor faz.
- [DONE] "Meu Dia" escolhe pelo que falta do ciclo na semana; o Wizard grava horas/estratégia/momento no plano e aplica ao ciclo.
- [PARCIAL] Estratégias são multiplicadores v1; "o que mais cai" ainda não usa a frequência real das questões (depende do banco de questões). O texto da estratégia "Base Comum" fala de Português, que não cai em todo edital.
- [DONE] Planos do edital: peso de cada matéria pelos pontos da prova, **piso de tempo pela nota mínima** (30% do orçamento; nenhuma matéria de prova eliminatória fica sem tempo) e domínio inicial pela autoavaliação — testado com o edital real e a autoavaliação do dono.
- [DONE] **Bloco de estudo** (um só para o app: cartão no Meu Dia/Ciclo + relógio no cabeçalho): pomodoros de 00:20/00:30/00:50 com pausas (00:05/00:10) e "pomodoro 2 de 4", ou modo livre até a meta; relógio real; grava cada trecho de foco no tópico em que o bloco começou — testado (máquina de estados + E2E).
- [DONE] Aba **Ciclo** (matérias agrupadas por prova, feito × meta em HH:mm, motivo em uma linha) separada da aba **Mapa de Calor** (grade: um quadradinho por tópico, detalhe e "Estudar este tópico") — E2E.
- [DONE] Tempo sempre em HH:mm (regra em `.agents/rules/ui-clean-design-and-tdd.md`); o alerta "foque em 4 ou 5 matérias" não aparece em planos do edital; o "ⓘ" explica o piso da nota mínima.
- [DONE] O bloco em andamento sobrevive a recarregar (23/10): guardado neste computador a cada mudança, volta no ponto certo pelo relógio real (pomodoro que acabou com a página fechada é gravado quando o banco abre); guardado há mais de 3 h não volta; abre na bancada. Unit + E2E.

**Questões & estudo reverso**
- [DONE] Importar questões coladas (texto ou JSON): prévia, Certo/Errado, tópico pelo código, sem duplicar.
- [DONE] Diagnóstico coerente: 1 por tentativa, resposta travada após ver o gabarito, tempo real.
- [DONE] IA sem chave = respostas marcadas "Exemplo simulado". Com chave: prompt com regras anti-alucinação e explicação guardada.
- [DONE] IA real pelo **Groq** (grátis, `qwen/qwen3.8-27b`): tutor e explicação-base verificados no Edge contra a API real (~1-2 s). Ordem: gateway → Groq → Gemini → DeepSeek. Erros dos provedores aparecem no console.
- [PARCIAL] FofoIA com IA real (ver a fatia 11 abaixo: teto de resposta corrigido; pista de Certo/Errado e Direito do `qwen` em aberto). Gemini exige crédito pré-pago; DeepSeek (`deepseek-flash`, sem modo de raciocínio) fica como reserva paga.
  **26/10/2026:** crédito de US$ 5 na DeepSeek; chave no `.env` testada com uma chamada real (200, ~1,5 s, `deepseek-flash`).
  **Minerador com teto de R$ 5 por dia na DeepSeek** (`tools/minerador/spendLedger.ts`): conta o custo pelo `usage` de
  cada resposta no preço de pico (US$ 0,30/US$ 1,20 por milhão; fontes de terceiros, a página oficial não abriu) e dólar
  a R$ 6; ao bater o teto, para com o limite diário e a fila continua no dia seguinte (`MINERADOR_DEEPSEEK_TETO_BRL`,
  `MINERADOR_USD_BRL`). No app, a DeepSeek só entra quando o Groq falha e não tem teto diário (só o saldo pré-pago).
  **26/10/2026 (relato do dono, aula sobre service mesh cortada no meio):** o app agora lê o aviso de corte do provedor
  (`finish_reason: length` / `MAX_TOKENS`), mostra a resposta até a última frase completa e oferece **"Continuar de onde
  parou"** (manda o final já mostrado; o resto herda a parte da aula). Aula: uma parte por resposta (~300 palavras, 3 a 5
  partes) e o "Continuar" leva o total anunciado e proíbe repetir (antes vinha "Parte 3 de 4" e conteúdo repetido).
  **Conversa sobrevive ao F5 e a fechar/abrir o app por 20 minutos** (desde a última fala, só no mesmo tópico; fica no
  `localStorage` deste computador). Testes: `aiRouter`, `fofoia`, `useFofoConversation`, `fofoiaPanel` + E2E do F5 em
  `e2e/fofoia.spec.ts`; `npm test` (626), `test:e2e` (38) e `build` verdes. Não verificado com a IA real: se o modelo
  respeita a parte de ~300 palavras (o corte agora é tratado de qualquer jeito).
  **26/10/2026 (2º relato: "Aula completa" e "Resumo" ignoravam a conversa):** depois de conversar, os botões pedem
  "Aula completa / Resumo de revisão do que conversamos (tópico X)"; o prompt da aula e do resumo trata da questão ou
  dúvida da conversa (o tópico vira pano de fundo); o texto longo que o estudante colou (a questão) vai sempre junto,
  mesmo depois de sair das 6 últimas falas; e se ele anunciar uma questão sem colar, a FofoIA pede em vez de inventar.
  Testes em `fofoia.test.ts` e `fofoiaPanel.test.tsx`. Não verificado com a IA real.
- [ ] Importar prova em PDF + gabarito (extração automática) → depois da 7b (o dono usa o TEC Concursos para questões).

**Caderno, PDF & layout**
- [DONE] Caderno por tópico com salvamento automático (não perde rascunho ao trocar de tópico).
- [DONE] Colunas redimensionáveis com largura lembrada.
- [DONE] Leitor de PDF próprio (pdf.js, aba "Leitura de PDF", um leitor só): total de páginas exato, página atual seguida pela rolagem, página conta como lida após 15 s na tela com a janela em foco (desmarcável), volta onde parou, zoom, texto selecionável — testado E2E.
- [DONE] Maximizar (esconde cabeçalho, abas e painéis; caderno por botão; Esc restaura) — testado E2E. [A VERIFICAR] Tela cheia (API do navegador; conferir no `.exe`).
- [PARCIAL] O app guarda só nome/página/páginas lidas (direitos autorais): após reiniciar é preciso abrir o arquivo de novo.

**Edital**
- [PARCIAL] Colar o conteúdo programático → tópicos e subtópicos (heurístico, com prévia).
- [DONE] Importar edital em PDF (modelo Cebraspe, sem IA): cargos, provas com pontos e mínimos, matérias por prova, tópicos, datas, taxa → prévia editável → plano novo → Wizard com **autoavaliação por matéria e por tópico**. Testado com o PDF real da CGU 2026 (`e2e/fixtures/`), unitário e E2E.
- [PARCIAL] Editais de outras bancas (FGV, FCC…) não foram testados; quando o leitor não reconhece, a tela avisa e sugere colar o conteúdo.

**Ainda não começou:** grafo interativo (Fatia 6) • pacote `.fofopack` para amigos • Modo Admin real (a tela mostra dados de exemplo) • vídeo/Gran/YouTube.

## 🏠 Checklist do app desktop (pendente — juntado na `main` antes, por decisão do dono)
0. Pré-requisito: **Build Tools do Visual Studio com "Desenvolvimento para desktop com C++"** (o PC de casa tem Rust 1.99, mas não tem o compilador C++; o PC do trabalho não tem Rust). Compile pelo PowerShell: no Git Bash, o `link` do Git esconde o `link.exe` do Visual Studio.
1. `npm install` → `npm test`, `npm run test:e2e`, `npm run build`.
2. `npm run tauri:dev` precisa compilar com `tauri-plugin-fs`. Se reclamar de permissão, conferir os identificadores em `src-tauri/capabilities/default.json`.
3. No app desktop: criar um tópico, fechar, abrir → continua lá? Existem `fofolab.db` e `backups/` em `%APPDATA%\com.fofolab.desktop\`?
4. Digitar no caderno e fechar a janela em seguida → perdeu? (não há gravação no fechamento da janela; se perder, implementar `onCloseRequested` + permissão `core:window:allow-destroy`).
5. "Fazer Backup" no app desktop baixa o arquivo? (se não, usar `plugin-dialog` + `plugin-fs`). Abrir um PDF mostra o leitor? O botão "Tela cheia" do leitor funciona na janela do `.exe`?
6. Trocar os [A VERIFICAR] verificados por [DONE]; o que falhar vira tarefa com o motivo.

## 🔜 Próximas fatias
- [DONE] **Bancada de Questões — Refino de Alto Rendimento, Navegação Protegida & Inteligência de Ritmo (Fase 15 / Fatia 15)** (30/10/2026 [Antigravity]):
  - [DONE] **15a — Ergonomia de Prova e Limpeza Visual (UI/UX Anti-IA):**
    - Remoção da redundância da setinha `>` na paginação da folha (manter apenas `[ ← Anterior ]`, `Questão X de Y` e o botão primário `[ Próxima questão → ↵ ]` com destaque tátil);
    - Fim da "boneca russa de cards" na folha de questões: eliminar a borda dupla interna da correção, integrando veredito e diagnóstico como continuação contínua da prancheta via régua de 1px (`border-t border-white/[0.06]`);
    - Limpeza de ícones informativos redundantes no cabeçalho editorial (eliminar os dois círculos `(i)` concorrentes de complexidade e cronômetro);
    - Estabilidade espacial ancorada na barra inferior para evitar layout shift entre estado antes e depois de responder.
  - [DONE] **15b — Modo Consulta / Revisão Protegida de Questões Anteriores:**
    - Permitir recuar livremente com `[ ← Anterior ]` (ou atalho `←`) em questões já feitas do bloco/sessão;
    - A questão revisitada abre em **Modo Consulta Travado** (exibe a tentativa anterior, o gabarito oficial, o veredito e a dissecação);
    - **Blindagem das Estatísticas:** impede resolução duplicada acidental no meio do bloco, preservando a pureza das métricas de acerto e tempo da sessão, com opção voluntária de `Refazer`;
    - Diálogo com a FofoIA (`Explicar com a FofoIA`) e envio de notas ao caderno totalmente liberados na questão revisitada.
  - [DONE] **15c — Ferramentas Ativas de Resolução na Folha (Grifo & Caderno Rápido):**
    - **Grifo no Enunciado (`QuestionStatement.tsx`, `questionHighlights.ts`):** Ferramenta de marca-texto tátil no enunciado para destacar termos restritivos ("vedado", "sempre", "exclusivamente") e conceitos-chave, com atalho `G`, balão flutuante, remoção com 1 clique e persistência local por questão;
    - **Nota Rápida no Caderno (`+ Caderno` em `QuestionCorrection.tsx`):** Editor compacto pós-resolução para registrar insights e pegadinhas direto nas anotações do tópico sem quebrar o fluxo de estudo.
  - [DONE] **15d — Inteligência de Ritmo & Simulação de Prova Real (Micro na Bancada & Macro no App):**
    - **Micro (HUD do Bloco em Tempo Real - `WorkbenchSessionHud.tsx`):** indicador compacto no topo da prancheta mostrando acertos da sessão atual (`8/10 acertos · 80%`), ritmo médio (`01:15/q`), tempo de foco do bloco e botão para simulação;
    - **Macro (Painel de Ritmo & Simulação de Prova Real nas abas Início e Bancada - `ExamPacingModal.tsx`, `pacingEngine.ts`):**
      - Projeção de viabilidade de tempo de prova real com base no ritmo histórico medido por estilo de item (Certo/Errado vs Múltipla Escolha) com estimativa de folga para preenchimento de cartão-resposta e banheiro;
      - Diagnóstico e alertas antecipados de risco de esgotamento de tempo (inspirado na dor real de provas extensas como SEFAZ/FGV);
      - Matriz de gargalos por disciplina e atalho integrado na aba Início.
- [ ] **Coluna Hoje com a janela do Fofo** (28/10/2026 [Claude Code], brainstorming em andamento; começo da reestruturação
  do app inteiro por roupa do Fofo). Decidido com o dono: ordem tópico de agora → janela do Fofo (FofoDoro com cenário em
  pixel, mesmo tamanho de pixel do Fofo, que pisa no chão) → trilho do resto do dia com hora estimada até o fim do roteiro;
  céu pela hora de verdade e festa por cima; destaque das roupas fora das cores de status; Fofo por momento (antes do play:
  ritual de começo; foco: só pisca; pausa: dorme). Primeira entrega: coluna + três paisagens da hora + antes/foco/pausa +
  camada do Natal até 1º/12. Esboços em pixel feitos por código. Depois: outras partes do app, uma por vez.
  **Spec: `docs/specs/14-coluna-hoje-janela-do-fofo.md`** (esboços em `docs/specs/14-esbocos/`), aguardando aprovação do
  dono para virar plano. A janela usa a roupa da hora (fazendeiro/explorador/madrugada), decisão do dono em 28/10.
- [ ] **Roupa base do Fofo e fone azul jeans** (29/10/2026 [Claude Code], decisões do dono; fora da spec 14, em
  `tools/mascote/gen.cjs`). (1) **Fone azul jeans** em todas as roupas, poses e no ícone: `j #263a52`, `K #3f5f82`,
  `u #86a6c6` (o azul-céu `#38BDF8` ficou estourado; o cinza some no pelo). Hoje `K`/`u` também pintam objetos de
  outras roupas (relógio da base, estrelinha do Ano-novo, caneta da prova): dar ao fone cores próprias antes de trocar.
  (2) **Roupa base "estudante em casa"**: moletom, óculos redondos e marca-texto atrás da orelha; livros e caneca ficam
  no cenário da janela, não no corpo (32×32 não comporta tudo). Nos avisos do FofoDoro, segura o relógio "25".
- [ ] **Ideia guardada: arte do Fofo em 3D renderizada como pixel art** (28/10/2026 [Claude Code], decisão do dono:
  para depois). Caminho do Dead Cells: Fofo modelado e animado no Blender, cada quadro renderizado em baixa resolução sem
  suavização → sprites; roupas como peças trocáveis (qualquer pose com qualquer roupa sem redesenhar), cenários 3D com o
  sol na hora certa, animação fluida a 8–12 fps (personagem) sem mexer durante o foco. Ferramentas conferidas em
  28/10/2026: servidor oficial do Blender para agentes (Blender 5.1+) e a skill `roble3/cc-blender-skill` (conferir com
  `--list` antes de instalar, no projeto). Muda a regra "sem 3D" de `identidade-fofolab.md` (decisão do dono). Começar por
  um teste descartável: Fofo modelado, passagem do ritual para o foco e o cenário da fazenda, comparado com o atual.
- [DONE] **Fofo no app** (regra `.agents/rules/identidade-fofolab.md`; desenhos em `tools/mascote/`, 11 roupas).
  **Parte 1 feita (26/10/2026):** guarda-roupa `src/features/mascot/wardrobe.ts` (roupa fixa > dia da prova > nomeado >
  data especial > madrugada > aba > base; Carnaval pela Páscoa), `FofoSprite` (SVG pixel a pixel; parado / só pisca /
  momento; "reduzir movimento" para tudo), roupa por contexto refeita a cada minuto (`FofoOutfitContext`). O Fofo
  aparece no cabeçalho (só pisca), no painel da FofoIA, no aviso do FofoDoro (se mexe) e nas telas de carregar/erro.
  Sprites do app gerados por `node tools/mascote/gen.cjs` em `fofoSprites.generated.ts` (tipado: falta de roupa não
  compila). Testes: `fofoWardrobe`, `fofoSprite`, `fofoOutfitContext` + E2E `e2e/fofo.spec.ts` (roupa por aba e
  Halloween em outubro); `npm test` (616), `test:e2e` (37) e `build` verdes. Nada novo é gravado no banco. Fechamento (parte 2c): `npm test` (642), `test:e2e` (41) e `build` verdes.
  **Parte 2a feita (26/10/2026):** emojis de interface trocados — status por `StatusSquare` (quadradinho de pixel +
  texto: diagnóstico, painel Admin, resultado de importação), ações por ícone (`Lightbulb` "Pedir pista",
  `GraduationCap` "Aprofundar", `Calculator`, `Link2`, `Layers`), selinho da FofoIA só com o nome do jeito, Fofo no
  Wizard; títulos sem emoji. Auditoria `src/__tests__/noEmojiInUi.test.ts` reprova emoji em texto de interface (exceções
  de conteúdo listadas com o porquê). A lista da conversa da FofoIA virou `role="log"` ("Conversa com a FofoIA").
  `npm test` (627), `test:e2e` (38) e `build` verdes.
  **Parte 2b feita (26/10/2026, decisões do dono):** roupas pela hora do dia e pelo sol do fuso do computador
  (`sun.ts`, cidade de referência por fuso; fazendeiro de dia, explorador do pôr do sol às 22:00, madrugada até o
  nascer do sol; fuso desconhecido = 06:00–18:00); Fofo do relógio no FofoDoro; o Fofo se mexe o tempo todo e só
  pisca durante um bloco de foco (hover anima); clicar no Fofo do cabeçalho abre o **guarda-roupa** (Automática ou
  roupa fixa) e o **"Fui nomeado!"** — guardados neste computador (`useFofoPrefs`, sem mudar o banco); o nomeado
  vale para o plano e a data de prova de quando foi marcado. Testes `fofoWardrobe`, `fofoSprite`,
  `fofoOutfitContext` + E2E `e2e/fofo.spec.ts` (sol, Halloween, guarda-roupa e nomeado depois do F5);
  `npm test` (634), `test:e2e` (41) e `build` verdes.
  **Parte 2c feita (26/10/2026):** poses `pensando` (no "A FofoIA está pensando…"), `dormindo` (aviso do começo da
  pausa) e `comemorando` ("Meta da semana cumprida." no pé da coluna), com testes e o E2E do FofoDoro conferindo o
  Fofo dormindo; ícone de 16 px desenhado à parte (`tools/mascote/icon.cjs` → favicon pixel a pixel e ícones do app
  de desktop via `tauri icon`), com teste que barra imagem embutida no favicon. **Fofo no app: [DONE]** salvo o que
  depende do app de desktop compilado (o ícone na barra de tarefas não foi visto num .exe).
- **5.6 — IA real:** feito com Groq (ver acima). Falta: copiloto com IA real; gateway próprio antes de distribuir o `.exe` (chaves `VITE_*` vão dentro do app).
- **6 — Mapa de conceitos & pacotes:** grafo de tópicos/pré-requisitos; decidir o formato do pacote (o backup completo já existe; para amigos, um pacote só de conteúdo, sem progresso pessoal).
- [DONE] **7b — registro rápido de questões feitas fora do app** (23/10/2026, plano `docs/superpowers/plans/2026-10-22-7b-registro-rapido-tec.md`):
  painel no topo da coluna (recolhido; abre sozinho ao concluir um bloco), total/certas/em branco + tópico (o do bloco por
  padrão), validação, "Registrado: 14 de 20 (70%)" com Desfazer (confirmação). Banco: tabela `question_logs` (migração
  **v7**), só números. Domínio = média ponderada pela evidência (histórico pesa até 40 questões); no motor, as questões
  contam como amostra e cada registro ≥ 70% conta como "dominei" (< 50% como lacuna) para a memória. Textos genéricos (não
  citam o TEC: outros estudantes usam outros sites). E2E `e2e/registro-externo.spec.ts`; testes e build verdes.
  Revisão independente: desfazer age pelo id e só volta o domínio se nada mudou depois; recalcula a data de estudo;
  tópico pai não recebe registro; registros com menos de 5 questões não contam como "dominei"/lacuna; trocar de plano ou
  restaurar o banco limpa o convite; excluir avisa quantos registros vão junto.
- [DONE] **Tela "Bom dia"** (spec 07 §5.5) — entregue com a 9c como aba **Início** (ver 9c abaixo).
- **Mapa de incidência das bancas** (spec `08`, **rascunho — rodar o brainstorming antes de construir**): o que cada banca/órgão/área realmente cobra, a partir das provas catalogadas, cruzado com o mapa pessoal. Junto com o módulo de questões.
- **9 — Bancada única (spec `09`, aprovada em 22/10/2026):** [DONE] **9a casca** (22/10/2026, plano
  `docs/superpowers/plans/2026-10-22-9a-casca-da-bancada.md`): cabeçalho fixo de ponta a ponta (concurso, dias, "P1 x% visto"),
  painéis que recolhem em trilho com transição de 220 ms (sem animação com "reduzir movimento"), Copiloto+Caderno em abas
  montadas, "Edital" no pé da coluna, estado recolhido lembrado após reabrir (E2E `e2e/casca.spec.ts`; `npm test`,
  `test:e2e` e `build` verdes). O resumo por prova no cabeçalho só aparece em planos do edital (coberto por teste de unidade).
  [DONE] **9b roteiro na coluna** (22/10/2026, plano `docs/superpowers/plans/2026-10-22-9b-roteiro-na-coluna.md`): Meu Dia
  e Bancada numa tela só; roteiro do dia congelado no banco (migração **v5**, tabela `daily_plans`) e classificado em
  feito/atual/próximo pelas sessões de hoje; "olhada" (tópico fora do bloco, inclusive irmão) pausa o relógio e "Voltar ao
  bloco" retoma, dica única após 3 min; atalhos de PDF/questões/caderno do bloco; tópico sem questões mostra as do grupo
  (ou da matéria) com rótulo; Mapa de Calor, Ciclo (pela matéria) e Edital abrem o tópico como olhada; aviso discreto de
  recalibrar; recalibrar refaz o roteiro do dia. Corrigido no caminho: o detalhe do Mapa de Calor fazia a grade tremer ao
  passar o mouse. E2E `e2e/roteiro.spec.ts`; `npm test`, `test:e2e` (2 rodadas) e `build` verdes. A importação de questões
  passa a sugerir a matéria aberta (a do bloco de hoje), não a primeira da lista.
  Revisão independente: pausa da olhada não conta como atrito; virada do dia não herda o tempo de ontem; bloco extra
  fica fixo no dia; o roteiro guarda a assinatura do perfil e é refeito sozinho se o perfil mudou (recalibrar e fechar o
  app antes de gravar não deixa o roteiro antigo); restaurar backup volta a bancada ao bloco. E2E: 3 rodadas verdes.
  Ajustes pedidos pelo dono (22/10): irmãos do bloco como "Outros tópicos do mesmo grupo" (sem recuo de filho, até 3 +
  "Ver mais", selecionado com fundo e contorno); barrinha de progresso no relógio do cabeçalho (pomodoro/pausa) e no bloco
  atual da coluna (anda ao vivo); clicar no relógio do cabeçalho leva ao Ciclo.
  [DONE] **9c Revisão do dia + Início** (23/10/2026, plano `docs/superpowers/plans/2026-10-23-9c-revisao-do-dia.md`, decisões
  do dono na spec 09 §5.3.2): aba **Início** (primeira; abre sozinha; título Bom dia/Boa tarde/Boa noite) com linha de ânimo
  factual do último dia de estudo, **Revisão do dia** e **Situação** (dias, % visto por prova, um aviso `amber` para prova
  com nota mínima ≥ 20 pontos atrás das outras) e o atalho "Começar o bloco de ‹matéria›" (leva à aba Questões).
  Revisão: até 5 tópicos já estudados e não estudados hoje — até 2 do último dia de estudo, o resto dos que mais esfriaram
  (`R < 0,9`), intercalados por matéria; congelada no dia (migração **v8**: `daily_reviews`, `recall_checks`, confiança e
  origem em `question_attempts`, `daily_review_enabled` no plano). Três caminhos: questão do app (confiança antes,
  correção logo depois, diagnóstico já marcado e trocável; grava no "Próxima"), pergunta aberta (lembrar → ver anotações →
  Lembrei bem/em parte/não lembrei = ±0,5 na meia-vida, domínio intacto) e "Fiz questões fora do app" (abre o registro
  rápido com o tópico; o registro conclui o item). Cada item feito grava uma sessão `REVIEW` (conta na semana, não no
  roteiro). "Pular a revisão de hoje" sem penalidade; desligar na caixa do último passo do Wizard. Testes: unit (seleção,
  progresso, textos, cartões, hook, migração v8 nos dois caminhos) + E2E `e2e/revisao.spec.ts` (responder, recarregar no
  meio, concluir e continuar feita; registro de fora conclui o item; desligada no Wizard; começar o bloco pelo Início).
  Revisão independente: começar o bloco pelo Início agora leva à aba Questões e o botão some com um bloco rodando (antes
  recomeçava do zero e perdia o foco); questão apagada depois do sorteio conclui pela autoavaliação (antes, laço);
  tópico apagado sai da revisão (antes ela dava "feita" antes da hora); sessão de revisão não mexe no atrito da matéria;
  um dia só de revisão não vira o "último dia de estudo" da revisão seguinte; a linha de ânimo acompanha a virada do dia.
  `npm test` (286), `test:e2e` (26, 2 rodadas) e `build` verdes.
- [DONE] **Início mais completo (23/10, ideias aprovadas pelo dono):** Situação com **cobertura do edital** e
  **proficiência nos tópicos estudados** separadas + **ritmo** ("Faltam N tópicos… cerca de X por semana. Seu ritmo nas
  últimas 2 semanas: Y"); **Continuar de onde parou** (último PDF na página e última anotação, a um clique); **Últimas 4
  semanas** (um quadradinho por dia, sem contar sequência); **Sua calibração** (acerto por "Tenho certeza / Acho que sei /
  Chutei", a partir de 8 respostas marcadas na revisão). Regras em `src/lib/goodMorningStats.ts`; unit + E2E. `npm test`
  (306), `test:e2e` (28, 2 rodadas) e `build` verdes. Movimentos da coluna mais suaves (fechar some antes de encolher;
  prévia e relógio trocam sem se sobrepor). No RDP o Windows desliga as animações (o app obedece a "menos movimento").
- [DONE] **Animações do roteiro (23/10):** blocos feito/atual/próximo, árvore de tópicos ao dar play, FofoDoro, prévia,
  registro rápido e faixas do topo abrem e fecham com altura animada (`src/components/Collapse.tsx`, só CSS, respeita
  "reduzir movimento"); os modais ganharam o fade que a classe `animate-fade-in` nunca teve.
- [DONE] **FofoDoro (spec 10, 23/10):** pomodoro no bloco atual da coluna Hoje (opção A), relógio em anel, pausa curta
  proporcional ao foco e pausa longa a cada N (contando entre blocos do dia), ajustes lembrados, prévia do bloco, avisos
  em toast, foco nunca recomeça sozinho; resumo do fim do dia e totais (hoje/semana/ano/tudo) no Ciclo. 219 unit + 22 E2E.
- [DONE] **Barras do tempo reservado no Ciclo** (comprimento proporcional à matéria com mais tempo; preenchimento = estudado).
- **Épico — Plano de estudo (spec `13-plano-de-estudo.md`, brainstorm e design aprovados em 25/10/2026):** a aba Ciclo
  virou **"Plano de estudo"**, com a semana dia a dia e (13b/13c) o caminho até a prova.
  [DONE] **13a — horas por dia e "Sua semana"** (25/10/2026, plano `docs/superpowers/plans/2026-10-25-13a-horas-por-dia-e-sua-semana.md`):
  "Em quais dias você estuda?" + horas de cada dia (folga fixa sem cobrança; atalho "mesmo tempo nos dias de estudo"), no
  "Ajustar" do Plano e no passo 2 do Wizard; **semana atípica** ("Só esta semana é diferente" / "Voltar ao padrão");
  **"Mudar o tempo de hoje"** na coluna ("Hoje não vou estudar" deixa a coluna neutra; os blocos já feitos ficam no roteiro).
  O orçamento do ciclo é a soma dos dias da semana (folga e imprevisto não viram dívida). Roteiro do dia pelas horas do dia:
  dia de até 03:00 igual a antes; dia longo com blocos de até 02:00, matérias intercaladas. **Revisão da semana**: um bloco
  no dia mais longo, no tópico estudado mais frio que não está no dia (some com a Revisão do dia desligada). **Sua semana**:
  dias que passaram com o feito, hoje com o roteiro, os próximos como previsão (o mesmo planejador). Totais "Este ano /
  Desde o começo" saíram. Migração **v11** (`weekday_minutes_json`, `final_stretch_days`, `plan_day_overrides`).
  Verificado: unit (539), E2E 33 em duas rodadas (`e2e/plano.spec.ts` com recarregar; a semana com o edital real da CGU em
  `bancada.spec.ts`), build. Revisão independente (26/10) corrigida com teste: divisão do ciclo gravada pela semana padrão
  (semana de folga/atípica zerava a divisão), previsão limitada ao que sobra da semana, roteiro refeito sem perder tempo
  nem duplicar a revisão, plano novo herda os dias, tempo de hoje travado com bloco rodando. Pendente de olhar no `.exe`.
  [DONE] **13b — "Dá tempo?", linha do tempo e reta final** (26/10/2026, plano
  `docs/superpowers/plans/2026-10-26-13b-da-tempo-linha-do-tempo-reta-final.md`): projetor puro (`src/lib/examProjection.ts`)
  — tempo por tópico pela autoavaliação (Nunca vi 02:00 … Domino 00:30) misturado ao ritmo real das 4 semanas
  (`C = n ÷ (n + 5)`); horas de cada semana até a reta final (dias, folgas, semanas atípicas, menos a Revisão da semana);
  tópicos que faltam espalhados pela divisão do ciclo (matéria que fecha devolve o tempo). **"Dá tempo?"**: % do edital
  visto até a véspera da reta final, ritmo real quando 10%+ abaixo do plano (7+ dias de uso), "+HH:mm por semana" (abre o
  Ajustar) e a lista do que fica para depois, P1/P2/P3 com o aviso da nota mínima; "ⓘ" explica a conta (e que ela tende a
  ser otimista). **Linha do tempo** por semana (fase, tópicos novos, % visto). **Reta final** ajustável (7/10/14/21 dias):
  o roteiro do dia e a previsão passam a ser só de revisão (tópico estudado mais frio; sem nenhum estudado, roteiro normal).
  Revisão independente (26/10) corrigida com teste: reta final enchia pouco ou deixava a coluna vazia; nível do grupo
  (Wizard) ignorado; "+HH:mm" errado e irreal (agora calculado pela projeção, e "Não cabe" quando passaria do dobro do
  plano ou de 08:00 por dia); ritmo real com sessões de outros planos e contra o padrão cru (agora contra o planejado nos
  dias); semanas cheias com "0 tópicos novos" (avanço parcial); lista do que fica para depois pela menor prioridade;
  sessão pulada marcava o tópico como estudado. Ficou de fora (menor): a previsão da semana não para a reta final na data da
  prova.
  Verificado: unit (602), E2E 35 em duas rodadas (`e2e/plano-ate-a-prova.spec.ts` com o edital real da CGU e a reta final),
  build. Com o edital real (cargo 4, ~200 tópicos) e 21:00 por semana sem autoavaliação: 31% até 28/11, "não cabe".
  **Próxima:** 13c (mapa matéria × semana, sugestão de ajustar o padrão).
- [DONE] **FofoIA + diagnóstico pela confiança (spec 11, 24/10/2026; plano `docs/superpowers/plans/2026-10-24-11-fofoia.md`):**
  um só professor na coluna direita (aba **FofoIA**; o painel de IA saiu da aba, que virou **Questões**), com jeitos
  escolhidos pelos sinais e selinho (Rápida · Do zero · Aula completa em partes, alargando a coluna · Resumo no formato da
  Dora · Cai no meu edital? com filtro local · Pista) — inspirados nos professores do grupo de estudos do dono. Contexto com
  o caderno do tópico (até 1.500 caracteres, com aviso); **gabarito nunca vai à IA antes da resposta**; conversa recomeça
  ao trocar de tópico; resumo só vai ao caderno com IA real e confirmação; aquecimento antes da primeira aula num tópico
  nunca tentado (desligável no Wizard: "Sugerir tentar antes da aula", migração **v9**); modelo forte opcional
  (`VITE_*_MODEL_STRONG`). Aba Questões: confiança obrigatória antes das alternativas; tentativa gravada ao responder;
  diagnóstico deduzido (novos: **acertei no chute**, **confundi com outra coisa**; **falsa certeza** pesa mais no calor);
  "Por quê?" corrige a mesma tentativa (delta aplicado guardado, migração **v10**); explicação embaixo da questão. Revisão
  do dia com os mesmos rótulos. Testes: unit (diagnóstico, motor, banco, fluxo de resposta, aba Questões, núcleo e painel
  da FofoIA, entradas, conversa) + E2E `e2e/fofoia.spec.ts`; `npm test` (355), `test:e2e` (31, 2 rodadas) e `build` verdes.
  Revisão independente: trocar diagnóstico perto de 0/100; questão ativa limpa ao sair da aba; resposta atrasada descartada
  na troca de tópico; pedido da aba Questões não se perde nem repete; voltar a questão respondida não dá 2ª tentativa.
  [PARCIAL] **com a IA real (Groq, conferido em 24/10 por sonda com os prompts reais, conteúdo de Direito Administrativo da CGU):**
  - Corrigido (unit): o plano grátis do Groq aceita só **1.000 tokens de resposta por minuto** no `qwen/qwen3.8-27b`;
    sem `max_tokens` ele reservava 2.048 e recusava quase toda chamada (429 "Request too large"). Agora cada pedido leva
    um teto (`MODE_MAX_TOKENS` por jeito; 800 na explicação-base). No 429, a tela diz "pausa curta… tente em N segundos"
    (cabeçalho `retry-after`). Letras chinesas que o Qwen solta no meio do português são retiradas. "Parte 1/3" também
    mostra o "Continuar" (antes só "Parte 1 de 3"). Prompts com tamanho por jeito, sem "corrigir" o caderno sem certeza,
    sem autor preferido da banca, só classificações consagradas.
  - Verificado: rápida, resumo no formato da Dora (`parseSummary` lê) e "Cai no meu edital?" funcionam; respostas em 1–3 s.
  - [DONE] **Pista em questão Certo/Errado sai do próprio app, sem IA** (decisão do dono, 24/10): com o `qwen` e o
    `gpt-oss-120b` a pista entregava a resposta mesmo com a regra explícita ("não é absoluta"). Agora são três níveis de
    texto fixo, iguais para toda questão C/E (só o tópico muda): lembrar a regra do tópico → julgar por partes → "agora é
    com você" (`src/lib/fofoia/trueFalseHint.ts`). Não gasta limite. Múltipla escolha segue com a pista da IA (não
    conferida com a IA real). Unit + E2E.
  - **Falha aberta — Direito errado no `qwen`:** atributos do ato inventados ("PAT", "Imprescritibilidade"), chamou o
    COFIFOMOB (certo) de "inventado". O `openai/gpt-oss-120b` acertou os atributos (PATI) e respeitou o caderno; serve
    como `VITE_GROQ_MODEL_STRONG` (aula e edital), com a ressalva de 21/10 (inventou conceitos de auditoria) e de gastar
    tokens "pensando" (a aula bateu no teto). Correção de fundo: **FofoIA com a letra da lei** (`ctresb/leis`, brainstorm
    próprio). Depois: **professores personalizados** (ideia).
- **Caderno:** já grava sozinho ("Salvo automaticamente", como o Google Docs) — avaliar tirar o botão "Salvar" redundante.
- **Épico — Banco de questões a partir das provas oficiais** — brainstorm feito (25/10), **spec `12-minerador-cebraspe.md`**
  (só Cebraspe, qualquer formato; assunto canônico no acervo + ligação barata no app; acervo no git, PDFs só em cache).
  [DONE] **12a — minerador até o acervo cru** (25/10/2026, plano `docs/superpowers/plans/2026-10-25-12a-minerador-acervo-cru.md`):
  `tools/minerador/` (fora do app; `npm run minerar -- lote | rodar`), API pública da Cebraspe com verificação de formato,
  1 requisição/s com cache, prova ↔ gabarito definitivo (nome do caderno ou descrição, para arquivos com nome em hash;
  `ATUALIZADO` vence, `SEM EFEITO`/preliminar fora), itens Certo/Errado e múltipla escolha com texto-base, anulados,
  código em bloco, figura marcada, quarentena quando as contagens não batem, acervo determinístico (`acervo/cebraspe/<ID>.json`,
  formato v1 com cabeçalho do concurso). 57 testes com 6 provas reais (SERPRO 23, PM SC 23, DATAPREV 23, STM 25, ANATEL 24 ×2).
  **Rodada real:** lote de 67 concursos (2021+, TI e controle, conferido pelo dono) → 59 com itens, 481 provas,
  **29.892 itens** (27,5 mil depois de juntar repetidos entre cadernos), 1.007 anulados, 212 com código, 936 dependem de
  figura/tabela, acervo de 33 MB; conferidos à mão contra o PDF (TCE SC 21 item 60, BCB 24 item 48, CD 25 item 170) e
  gabaritos conferidos por uma leitura independente da grade; rodar de novo não baixa nada e não muda o acervo.
  **Revisão independente (25/10), corrigida com teste:** grade do gabarito fora de ordem (línguas estrangeiras, INPI 23)
  era ignorada e o espanhol ficava com as respostas do inglês → quarentena; repetidos com gabarito diferente (anulado num
  caderno, válido noutro — TRT10 24) eram juntados → o gabarito entra na chave; um gabarito podia servir a duas provas →
  um para um, prova ATUALIZADO vence, código mais específico vence; pedaços de fórmula cortavam o item e viravam
  texto-base; 1ª linha recuada após o título da seção sumia; "-- X --" virava texto-base na múltipla escolha; "definição",
  "importância", "classe" viravam código; PDF ruim derrubava a rodada (agora quarentena; cache valida `%PDF-`); regravar
  um caderno apagava procedências de outros; identificador/nome de arquivo da API iam crus para o caminho do cache.
  Item com fórmula que o PDF não traduz ganhou `temSimboloIlegivel` (≈1 mil itens) — o app decide se avisa ou esconde.
  Ficou de fora (motivos em `acervo/quarentena.json`):
  - **SEFAZ AL 21 / SEFAZ CE 21 ("MATRIZ"):** uma prova por cargo com básicos + específicos, mas gabarito em 2 arquivos
    (o pareamento assume 1 gabarito por prova). **INPI 23 básicos** (línguas estrangeiras com numeração repetida) e
    **SEPLAG CE 24 básicos** (grade fora de ordem): quarentena de propósito — precisam de leitura por bloco de língua.
  - **TELEBRAS 21 (17 cadernos), SERPRO 21, APEX 21-2, SEFA PR 25, SUSEP 25, ANVISA 24:** prova sem gabarito definitivo
    reconhecido (publicação em outro formato) — 32 cadernos "pendentes".
  - **Múltipla escolha com alternativa perdida na virada de página/coluna:** FINEP 23 q47, ITAIPU 23 q42, TCE PR 24 q54,
    SEFAZ SE 25 q100, TCE MG 25 q38, TST 23 q48.
  - **Casos isolados:** ANAC 23 (básicos para no item 35; específicos no 66), CNPq 23 e MPO 24 (gerais sem nenhum item),
    INFRASA 26, INPI 23 (item 120), MME 23 (item 30), PETROBRAS 21 (itens 1–4), SEFIN Fortaleza 23 (142–150), SEPLAG CE 24
    (21–35), TRF6 24 ("item 203" fantasma).
  - Repetidos **entre concursos** ainda não se juntam (só dentro do mesmo concurso): fica para o pacote da 12b.
  **Segundo lote (decisão do dono):** provas de procurador e de servidor de MP e TJ (Direito Público, para P1/P2).
  [DONE] **12b — assuntos canônicos** (25–27/10/2026, plano `docs/superpowers/plans/2026-10-25-12b-assuntos-canonicos.md`):
  `npm run minerar -- semente | classificar | conferir | desempatar | juntar | recalcular | pacote`. Vocabulário
  (`acervo/vocabulario.json`, v14) nasce do edital da CGU + 6 editais de abertura do acervo (Português, Raciocínio
  Lógico, Direito, Contabilidade, Economia, TI): 3.917 assuntos em 92 matérias; a IA propõe assunto novo (aceito com
  confiança ≥ 0,8, canonizado contra o que já existe em qualquer nível da matéria, versão nova a cada mudança);
  `juntar` funde repetido (vira sinônimo). Classificação em `acervo/classificacao/<ID>.json`: uma opinião por modelo,
  consenso derivado (mesmo tópico = pai/filho ou mesmo nome em matérias diferentes; concorda quando o principal de uma
  opinião está na escolha de todas; selinho "incerto" abaixo de 0,7 de confiança média). Candidatos locais por palavras
  raras + pistas de matéria (Português pelo código do texto "CB2A1", parágrafo, aspas…); fila com as matérias da CGU
  primeiro. Provedores sem chave: `agy` (Antigravity CLI, em pasta vazia e `--sandbox`) com Gemini/Claude; Groq/DeepSeek
  por chave. 101 testes em `tools/minerador/`.
  **Rodada real (25/10):** 300 de 27,5 mil itens com a opinião do Gemini 3.8 Flash (2 incertos, ~24 min, 22 assuntos
  novos aceitos, 2 juntados à mão); conferidos à mão 12 de matérias diferentes — todos fazem sentido. Conferência com o
  gpt-oss-120b (Groq grátis) parou em 107 itens (limite de ~200 mil tokens por dia, ~100 itens) e discordou em 35 — na
  maioria erro do Groq (item de interpretação de texto classificado pelo assunto do texto; inflação em "governança de
  estatais"). **Falta:** terminar a 1ª opinião (cota do Gemini ≈ 5 mil itens/semana → ~5 semanas; CGU primeiro);
  decidir a 2ª opinião (DeepSeek quando houver crédito, para conferir todos — decisão do dono; o Groq não serve para o
  acervo todo); `pacote` + 12c.
  **26–27/10 [Antigravity]:** a DeepSeek (`deepseek-flash`) classificou o acervo inteiro em paralelo (com índice invertido em `tools/minerador/candidates.ts` que baixou o `queueOrder` de >60 s para 2,9 s em 27,5 mil itens): **25.928 itens com assunto** no vocabulário canônico (**v1573**), empacotados em `acervo/pacote/cebraspe.json` + `acervo/pacote/index.json` (sincronizados automaticamente pelo app ao abrir).
  [DONE] **12c — acervo da Cebraspe no app** (27/10/2026, spec `12c-acervo-no-app.md`, plano
  `docs/superpowers/plans/2026-10-27-12c-acervo-no-app.md`):
  - **Importar:** opção "Acervo da Cebraspe (pacote do minerador)" na importação de questões.
  - **Onde fica:** o pacote vira um banco à parte e só de leitura (IndexedDB próprio no navegador, `acervo.db` no
    desktop), fora das cópias de segurança e aberto só quando um tópico com ligação aparece.
  - **Cópia ao usar:** a questão entra no banco do estudante no primeiro uso que grava algo. Migração **v12**:
    `acervo_links`, `acervo_exclusions` e colunas do acervo em `questions`, com uma cópia por matéria.
  - **Ligação tópico ↔ assunto:**
    - pelo nome: caminho inteiro, ou folha/sinônimo dentro da mesma matéria; nunca a raiz nem outra matéria;
    - pelo que sobra, pela IA: até 15 candidatos locais, só ids da lista, confiança ≥ 0,7.
  - **Na aba Questões:**
    - tópico sem questões fica vazio, com "Ver as do grupo";
    - "Desligar este assunto" e "Não é deste tópico";
    - procedência no cartão;
    - "Classificação incerta", que pesa metade no domínio;
    - "Anulada pela banca", só para ler.
  - **Reimportar:**
    - atualiza gabarito, anulação e incerto sem tocar nas tentativas;
    - faz cópia de segurança antes, e o gabarito trocado apaga a explicação guardada;
    - recusa pacote mais antigo que o acervo do computador ou que o banco do estudante.

  **Verificado:**
  - unit (735), E2E 42 em duas rodadas (`e2e/acervo.spec.ts` com o edital real da CGU) e build;
  - **pacote real (619 itens com assunto):**
    - 273 de 275 tópicos da CGU ligados pelo nome, 75 com questões, 37 itens fora por figura ou fórmula;
    - no Edge a importação leva 0,8 s (a tela fica parada no máximo 0,34 s), e as questões continuam depois do F5;
  - **amostra conferida à mão:** a maioria certa; 2 duvidosas são erro da classificação (12b), não da ligação;
  - **com o pacote todo classificado (simulado):** "Todo o plano" leva ~0,2 s e a importação 1,7 s no Node.

  **Revisão independente (27/10), corrigida com teste:**
  - nos escopos amplos o item caía no tópico pai, fora do calor e da revisão: agora vai à folha;
  - a busca por assunto varria o acervo a cada tópico: agora usa o índice (~2,6 s → ~0,2 s);
  - num PC sem acervo, um pacote mais antigo desfazia gabaritos: agora a versão das ligações também conta;
  - questão desligada ou reclassificada continuava na Revisão do dia;
  - o painel de importação travava em falha, e arquivo acima de 80 MB era lido inteiro;
  - aparecia "não há questões" enquanto o acervo abria;
  - gabarito fora das alternativas era aceito;
  - metade de um erro ímpar arredondava para cima;
  - o mesmo item ficava travado no segundo tópico;
  - assunto desligado voltava pela IA via pai ou filho;
  - duas importações podiam rodar ao mesmo tempo.

  [A VERIFICAR] ligação pela IA com a IA real: só foi testada com IA simulada; no plano da CGU sobram 2 tópicos para ela.

  **Ficou de fora (menor):**
  - assunto inválido no pacote é descartado sem contar;
  - correção de texto do minerador não chega à questão já usada (só gabarito, anulação e incerto);
  - item anulado conta em "Questão N de M" e no bloco;
  - o aviso de acervo ausente só aparece no escopo do tópico;
  - o resumo não mostra quantos itens das matérias do plano não caem em tópico nenhum (19 de 109 no plano da CGU);
  - Web Worker na importação, se o pacote todo classificado travar a tela.

  **Próximas (decisão do dono, 27/10):**
  [DONE] **12d [Antigravity] — sincronização automática do acervo, fila inteligente de questões e reta final flexível** (27/10/2026, spec `docs/specs/12d-auto-sync-e-fila-questoes.md`, plano `docs/superpowers/plans/2026-10-27-12d-auto-sync-e-fila-questoes.md`):
  - **Sincronização automática (`Zero-Click Sync`):** qualquer comando do minerador que atualiza classificações (`classificar`, `conferir`, `desempatar`, `juntar`, `recalcular`, `pacote`) grava automaticamente `acervo/pacote/cebraspe.json`, `fofolab-acervo-cebraspe.json` e `acervo/pacote/index.json` (preservando outras bancas). O Vite serve `/__acervo/*.json` e o app sincroniza sozinho ao abrir ou trocar de plano quando `vocabVersion`/`itensComAssunto` sobem ou quando o plano ganha tópicos novos (`acervo_meta` guarda `with_subject`).
  - **Fila inteligente na aba Questões (`QuestionWorkbench`):**
    - Filtro de situação: `Inéditas (N)` (padrão), `Errei ou chutei (N)` e `Todas (N)`. Responder na aba de inéditas mantém a questão na sessão atual para ler a correção e conversar com a FofoIA.
    - Filtro de formato: `Todos os formatos` (padrão, ordenando `Certo/Errado` antes de `Múltipla escolha`), `Certo/Errado` e `Múltipla escolha`.
    - Questão já respondida exibe selo discreto (`Já respondida · Errou / Acertou / Chutou / 1º contato`) e abre destravada em `Errei ou chutei`.
    - Questões anuladas (`is_annulled === 1`) não inflam a contagem de questões do bloco na coluna do roteiro e só aparecem em `Todas`.
    - Esgotar as inéditas de um tópico mostra estado claro com atalhos para refazer erros/chutes, ver todas ou abrir as do grupo.
  - **Reta final flexível (`final_stretch_allow_new`, migração v13):** na reta final, se os tópicos estudados de uma matéria já estiverem dominados e frescos (`mastery_score >= 75` e `R >= 0,85`), o planejador libera automaticamente tópicos inéditos da matéria; além disso, o estudante pode marcar `"Continuar avançando em tópicos novos na reta final"` em `Plano de estudo → Ajustar`.
  - **Refino da coluna do roteiro, FofoDoro, escopos e FofoIA (27/10 [Antigravity]):**
    - **Coluna do roteiro (`RoutineBlockItem.tsx`, `TopicTree.tsx`, `FofoDoroPreview.tsx`):** o tópico-pai (`1 Problemas e requisitos · N subtópicos ▾`) passou a ser o único acordeão dos subtópicos (recolhido por padrão antes e durante o bloco), exibindo logo abaixo apenas o subtópico ativo do bloco sem repetir o filho dentro de si mesmo e sem caixa dentro de caixa na prévia do FofoDoro.
    - **FofoDoro (`studyBlockMachine.ts`, `useStudyBlock.ts`):** removida a opção de 20 minutos (`FOCUS_OPTIONS = [25, 30, 50]`), migrando preferências salvas de 20 para 25 min.
    - **Nomenclatura de escopo na aba Questões (`topicQuestions.ts`, `QuestionFilters.tsx`, `EmptyTopicQuestions.tsx`, `QuestionWorkbench.tsx`):** substituído `"Do grupo X"` / `"Ver as do grupo X"` por `"Tópico <código> · <título>"` / `"Ver do tópico <código> · <título>"`, com botão direto `"Ver toda a matéria"` quando o subtópico ou tópico-pai não têm questões.
    - **FofoIA (`vite.config.ts`, `aiRouter.ts`, `prompts.ts`, `App.tsx`):** ponte local `/__ai/agy` no Vite para a FofoIA usar Groq, DeepSeek e Antigravity CLI em cascata; corrigido o resumo de revisão (`SUMMARY`) para resumir fielmente o assunto real de `<conversa_ate_aqui>` sem misturar com o tópico aberto quando a dúvida foi sobre questão externa; `strongTopics` para analogias agora exige `mastery_score >= 75` **e** `sampleConfidencePercent >= 55` (impedindo tratar tópico recém-iniciado ou acertado no chute como dominado).
    - **Confiança `"Estou estudando"` (`RECENT`) e diagnóstico `"Pegando o jeito"` (`STUDYING`, `+4` pontos):** adicionados em `ConfidencePicker`, `DiagnosisPicker`, `diagnosis.ts`, `dailyReview.ts` e `database.ts` para quando o estudante está no processo de estudo do assunto e ainda não o sente consolidado como `"Dominei"` (`+8`).
    - **Complexidade simplificada para `Fácil` · `Média` · `Difícil` (`aiRouter.ts`, `explainabilityEngine.ts`):** substituída a antiga classificação confusa (`Direta` / `Intermediária` / `Densa / Estudo de Caso`) pelo padrão direto e universal, com semáforo visual suave e explicador detalhado.
    - **Redesenho *Operate Mode* com identidade na aba Questões (`QuestionFilters.tsx`, `QuestionCard.tsx`, `QuestionCorrection.tsx`, `AcervoLinkBar.tsx`, `CurriculumManagerModal.tsx`):**
      - Filtros em acordeão recolhível com resumo em uma linha e botão `Personalizar ▾` para não ocupar a tela durante os estudos;
      - Numeração e navegação de questões (`Questão X de Y` e botões `< >`) posicionadas no rodapé, acompanhando o fluxo do olhar logo ao lado de `Próxima questão →`;
      - Cabeçalho da questão com chips nítidos de 1px (banca/concurso, número do item, dificuldade semafórica e status);
      - Trilha do acervo (breadcrumb) com ícone `<Layers />` e separadores visuais elegantes;
      - Botão `"Importar Questões"` movido para o cabeçalho de `"Gerenciar Edital"`.
    - **Expansão do acervo Cebraspe e unificação de assuntos gêmeos (27/10 [Antigravity]):** minerados e filtrados +15 concursos de TI/Controle/Básicos (`AEB_24`, `ANA_24`, `ANM_24`, `BANRISUL_22`, `BANRISUL_25`, `CODEVASF_24`, `EMBRAPA_24`, `FUB_22`, `FUB_25`, `FUNPRESP_21`, `FUNPRESP_24_EXE`, `MPC_SC_22_SERVIDOR`, `TBG_23`, `TJ_CE_23_SERVIDOR`, `TJ_PA_25_SERVIDOR`), classificados os itens prioritários da CGU 2026 com a DeepSeek e unificados assuntos gêmeos de Engenharia de Requisitos/UX no vocabulário (**27.838 questões com assunto**, `vocabVersion: 1682`; `1 · Problemas e requisitos` subiu de 23 para **279 questões**).
  - **Verificado:** 743 testes de unidade (82 arquivos), E2E no Edge (`e2e/acervo.spec.ts`, `e2e/bancada.spec.ts`, `e2e/fofodoro.spec.ts`) e `npm run build`.
  - **Backlog futuro (distribuição para amigos):** buscar `index.json` e pacotes de acervo de uma URL remota (GitHub Releases / Cloudflare R2 / Object Storage) para atualizar o acervo dos usuários sem precisar gerar novo executável `.exe`.
  - **Mapa de calor e armadilhas documentadas da Cebraspe (análise futura):** análise estatística automatizada sobre o acervo classificado (29k+ questões) para mapear termos restritivos mais trocados, distratores recorrentes e padrões de formulação com base empírica, eliminando qualquer risco de alucinação da IA ao citar bancas.
  Depois: conferir a ligação pela IA com a chave real; outras bancas (FGV…), radar de concursos (DOU/notícias), PDFs no Object Storage da Oracle se a banca apagar
  provas antigas.
- **Épico — Guia / mapa de incidência** (spec `08`): depende do banco classificado. Tópico sem questão = baixa incidência
  (reduz prioridade), nunca escondido.
- **TEC só por registro manual (feito na 7b):** a importação do desempenho por arquivo salvo (spec 07 §9) fica descartada —
  ler a página salva com o app é processamento automatizado vedado pelo §18.8.1 dos Termos de Uso do TEC.
- **Depois:** ferramentas do leitor (grifar, desenhar, atalho para o caderno, resumo ao fechar); tópicos relacionados entre matérias. (O formato por dias, preferido pela esposa do dono, entrou na 13a.)
- **Leitura:** grifos em `highlights_json`; reabrir o último PDF sozinho no `.exe` (lá o caminho do arquivo é conhecido).
- **Dívidas conhecidas:** `OnboardingWizardModal.tsx` (~420 linhas), `App.tsx` (~1470) e `QuestionImportModal.tsx` (~333) passam do teto de ~250 linhas; no mapa de calor, tópicos sem questões da mesma matéria empatam (a diferença aparece com dados de estudo/TEC); bundle ~515 kB; com 6 abas e os dois painéis abertos, os rótulos longos das abas quebram em 2 linhas (1440 px); histórico do copiloto não é salvo; acertar depois de ver a explicação ainda permite "Dominei" (fica registrado em `used_ai_review`).
