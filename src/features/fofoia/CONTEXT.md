# 🐹 FofoIA — Contexto Vivo & Arquitetura da Fatia

> **Módulo:** `fofoia` (`src/features/fofoia/` e `src/lib/fofoia/`)  
> **Papel:** Professor e tutor pedagógico único do FofoLab na coluna direita.  
> **Status:** Spec 11 implementada, testes unitários e E2E verdes.  
> **Single Source of Truth:** Este arquivo consolida o estado, decisões e diretrizes da fatia para que qualquer agente ou desenvolvedor se situe instantaneamente sem vasculhar o repositório.

---

## 1. Missão & Voz
- **A FofoIA é o professor único do app:** substitui o antigo Copiloto e o painel de Estudo Reverso.
- **Voz do Hamster:** acolhedor, direto, sem infantilizar; trata o estudante por "você"; sem cumprimentos longos e sem floreios vazios.
- **Foco do uso:** tira-dúvidas pós-resolução de questões, explicações conceituais aprofundadas e aulas completas sob medida.
- **Termos de terceiros:** questões de sites externos (ex: TEC) não entram cruas; o estudante pergunta com suas palavras. O app foca nas questões locais e nas dúvidas do estudante.

---

## 2. Os 6 Jeitos da FofoIA (Personas Pedagógicas)
O app escolhe o jeito automaticamente através de **sinais heurísticos locais** (sem gastar chamada de IA para classificar):

| Jeito | Selinho | Gatilhos / Sinais | Formato & Comportamento |
|---|---|---|---|
| **Rápida** | 🐹💡 Rápida | Padrão | Curta e direta (até ~120 palavras), analogia prática, siglas de TI expandidas, fecha com "Palavras-chave:" e até 5 termos. |
| **Do zero** | 🐹🌱 Do zero | Pergunta de base ("o que é", "não entendi nada"), domínio < 30, primeiro contato, erro com "Sei" (falsa certeza) ou "Confundi" | Até ~250 palavras. Ideia central via metáfora do cotidiano; verifica pré-requisitos antes se necessário; fecha oferecendo tema correlato. |
| **Aula completa** | 🐹📚 Aula | Botão explícito "Aula completa", ou sugestão aceita (após 2 follow-ups ou domínio baixo) | Dividida em partes (Parte N de M, ~300 palavras por parte). Ordem: 1) O essencial (2–3 linhas); 2) Exemplo concreto ligado a ponto forte; 3) Camadas (Direito: lei → jurisprudência → cobrança; TI: conceito → exemplo → cobrança); 4) Cuidados comuns em provas; 5) 1–2 perguntas de recuperação para responder de cabeça. Alarga a coluna para 560px. |
| **Resumo** | 🐹📝 Resumo | Botão "Salvar resumo de revisão" | Exatamente 6 linhas (formato Dora) para o caderno do tópico: Título com emoji, Palavras-chave, Conceito curto (máx 2 frases), Uso funcional, Analogia, Cuidado em prova. |
| **Cai no meu edital?** | 🐹🧭 Edital | Pergunta livre em texto sobre relevância/edital (sem botão redundante) | Filtra localmente até 20 tópicos candidatos; responde em até 150 palavras se está no edital, qual tópico/peso, ou abstenção honesta. |
| **Pista** | 🐹🔍 Pista | Questão ativa do app ainda NÃO respondida | Até ~80 palavras. **NUNCA dá o gabarito nem elimina**. Se 1ª pista: indica conceito e pergunta socrática; se 2ª pista: aponta trecho do enunciado para reflexão. |
| **Comparativo** | 🐹⚖️ Comparativo | Botão "Comparar com a certa" (ao errar) / "Ver comparativo" (ao acertar) / "Comparar conceitos" (livre), ou menção a "comparar/comparativo" | Até ~220 palavras. Tabela comparativa humanizada (sem jargão acadêmico como "distrator", "conceito X/Y" ou "ponto de ruptura"). 3 colunas: "No que prestar atenção" \| "O que é certo (Gabarito)" \| "Onde tentam te pegar", e 3 linhas práticas: Ideia central, Na prática, Onde costuma confundir. Fecha com "Cuidado na prova:" direto e acionável. |

---

## 3. Diretrizes Invioláveis (Regras de Segurança & Anti-Objetivos)
1. **Verdade Imutável:** O gabarito oficial (`final_answer`) e o enunciado (`statement`) da questão ativa, além da lista de tópicos do plano, são verdades imutáveis. Nunca contradizê-los.
2. **Proteção da Tentativa:** Se a questão ativa não foi respondida, é proibido dar a resposta, indicar alternativa ou eliminar opções.
3. **Abstenção Honesta:** Jamais inventar número de artigo, inciso, súmula ou nome de autor. Sem certeza, dizer: *"não consigo confirmar o dispositivo exato"* e explicar o conceito doutrinário.
4. **Sem Alucinação de Banca:** Não dizer que uma banca tem "pegadinha típica" ou "preferência" sem dados catalogados. Usar sempre *"cuidados comuns em provas"*.
5. **Demonstração Rotulada:** Resposta sem chave de API usa o motor de demonstração com aviso visível; nunca fingir ser resposta real gerada.
6. **Formatação e Renderização Rica (`RichText`):** Renderizar via `RichText` com suporte seguro (sem HTML cru) a blocos de código (com botão de cópia e linguagem), tabelas Markdown com rolagem horizontal fluida (sem quebrar a coluna), listas numeradas, citações e bullets.
7. **Blindagem contra Prompt Injection:** Regra explícita de segurança proibindo ignorar instruções pedagógicas, vazar tags XML internas ou simular personas para furar a proteção de gabaritos.
8. **Voz Sem Clichês de IA:** Proibição estrita de saudações ocos ("Olá!", "Certamente!", "Com certeza!") e despedidas protocolares ("Espero ter ajudado!"). Direto ao conteúdo com clareza e empatia.
9. **Contexto da Tentativa Real:** Quando a questão é respondida, o prompt injeta `<tentativa_do_estudante>` (alternativa marcada, resultado, nível de confiança, autodiagnóstico e tempo gasto) para desconstruir distratores e calibrar a falsa certeza de forma personalizada.

---

## 4. Estrutura de Código & Onde as Coisas Moram
- **Componentes de Interface (`src/features/fofoia/`):**
  - `FofoIaPanel.tsx`: Painel mestre na coluna direita (<= 250 linhas), gerenciamento de largura (`LESSON_MIN_WIDTH = 560`), rolagem e entrada multilinhas com auto-expand (até ~35% de altura da tela, Enter envia e Shift+Enter quebra linha).
  - `FofoPanelHeader.tsx`: Cabeçalho compacto com visual do hamster, indicador de tópico e botão "Limpar" para reiniciar a lousa da questão ativa.
  - `FofoShortcuts.tsx`: Barra de atalhos contextuais orientados ao momento pedagógico (questão em aberto: Pista/Conceito-base; erro: Por que errei?/Aula/Resumo; acerto: Destrinchar alternativas/Aula/Resumo; livre: Aula/Do zero/Resumo).
  - `FofoMessage.tsx`: Balão de mensagem, expressão do hamster, selinho de jeito, ações de aula/resumo, e ação `+ Caderno` para transferir explicações diretamente para o caderno do tópico.
  - `useFofoConversation.ts`: Hook de ciclo de vida da conversa, isolamento por `sessionKey` (`q:<id>` por questão, ou `t:<topico>` em navegação livre), sobrevivência a recarregamento por até 20 minutos e retomada de partes cortadas.
  - `useFofoIaInputs.ts`: Coleta de insumos (caderno até 1.500 caracteres, questão ativa com tentativa calibrada, pontos fortes).
  - `WarmupInvite.tsx` & `warmup.ts`: Convite de aquecimento pré-aula (opcional para tópicos sem tentativas).
- **Componentes de Renderização (`src/components/`):**
  - `RichText.tsx`: Parser estruturado seguro de blocos (tabelas, blocos de código com cópia, listas numeradas, citações e bullets).
  - `richTextBlocks.tsx`: `RichCodeBlock` (linguagem e botão de cópia com feedback tátil) e `RichTableBlock` (tabela Markdown fluida com rolagem horizontal e zebrado de 1px).
- **Lógica Pura & Prompts (`src/lib/fofoia/`):**
  - `prompts.ts`: `buildFofoPrompt`, regras de formatação XML e injeção de âncora de texto colado (`PASTED_MIN_CHARS = 200`).
  - `signals.ts`: `chooseMode`, `shouldSuggestLesson` e detecção de perguntas de base.
  - `ask.ts`: Comunicação com `aiRouter`, chave forte vs padrão e streaming/resposta.
  - `summary.ts`: Parser e formatador do resumo de 6 linhas para o caderno.
  - `editalMatch.ts`: Casamento léxico local de tópicos do edital.
  - `lessonPart.ts`: Leitura e continuação de aulas multipartes ("Parte N de M").
  - `demo.ts`: Respostas simuladas rotuladas para modo offline/sem chave.
- **Testes:**
  - `src/__tests__/fofoia.test.ts`: Testes unitários de prompts, sinais, cortes e modos.
  - `src/__tests__/fofoiaPanel.test.tsx`: Renderização do painel e interações.
  - `e2e/fofoia.spec.ts`: Teste ponta a ponta da conversa e do resumo.

---

## 5. Próximos Passos & Evolução do Módulo
- [ ] Conectar com repositório de legislação (`ctresb/leis`) para citações literais precisas.
- [ ] Ativação de modelo mais forte (`VITE_*_MODEL_STRONG`) para Aula Completa e Edital quando configurado.
- [ ] Perfil de bancas integrado quando o banco oficial classificado estiver populado.
