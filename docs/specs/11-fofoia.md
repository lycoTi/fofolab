# 🐹 Spec 11 — FofoIA: um só professor, aula sob medida e diagnóstico pela confiança

> Brainstorm de 2026-10-24 (Claude Code + dono). Status: **design aprovado pelo dono (24/10/2026), com a revisão do construtor incorporada.**
> Marcação: o que o dono decidiu está escrito como fato; escolhas do Claude estão marcadas **(decisão do Claude)**.
> Skills: `brainstorming`, `impeccable`/`ux-ui-clean`, regra autoral de prompts (`~/.agents/AGENTS.md`),
> `productive-failure-desirable-difficulty-designer`, `progressive-hint-ladder`, `confidence-calibration-check`,
> `retrieval-practice-generator` (`.agents/skills/`).

## 1. Intenção
Hoje há duas IAs que se repetem: o painel **"Explicação & Estudo Reverso"** ao lado da questão (aba Questões,
`src/components/QuestionWorkbench.tsx`) e o **Copiloto** da coluna direita (`src/features/ai-copilot/AiCopilotDockPanel.tsx`).
O dono quer **um professor só, a FofoIA** (voz do hamster), que libera o espaço ao lado da questão.

**Quando o estudante a usa:** depois de resolver questões (no app ou em outro site), como **professor e tira-dúvidas
completo** — explicar tópicos, conceitos, "uma aula completa mesmo". Questões de outros sites **não entram** na FofoIA (os
Termos de Uso do TEC §18.8 proíbem processá-las com IA): o estudante traz a dúvida com as próprias palavras. Quando o
banco de questões próprio existir (épico das provas oficiais), a FofoIA trabalha em cima dessas questões.

Junto vem uma mudança pedida pelo dono: **o diagnóstico depois de cada questão passa a nascer da confiança marcada antes
de responder** (o método dele: marcar o que sabe, depois como foi o acerto), na aba Questões e na Revisão do dia.

## 2. Objetivos, não-objetivos e anti-objetivos
**Objetivos**
- Uma FofoIA na coluna direita, no lugar do Copiloto; o painel de IA sai da aba Questões.
- Dois modos de resposta: **explicação rápida** (padrão) e **aula completa** (sempre a um botão; sugerida por sinais).
- Contexto enxuto e útil: tópico, domínio, pontos fortes, trecho do caderno do tópico, questão ativa do app.
- Proteção da falha produtiva sem ser invasiva (três camadas, §5.4).
- Confiança antes de responder também na aba Questões; diagnóstico deduzido, um toque só quando erra (§5.5).
- Deixar o lugar pronto para a **letra da lei** (próxima fatia, §8).

**Não-objetivos (agora)**
- Integrar o repositório de leis `ctresb/leis` (fatia própria, §8).
- Perfil de pegadinhas **por banca** (depende do banco de questões classificado — spec 08).
- Guardar o histórico das conversas.
- Ler questões de sites externos.

**Anti-objetivos (fracasso mesmo funcionando)**
- A FofoIA entregar o gabarito de uma questão do app antes de o estudante tentar.
- Inventar número de artigo/inciso ou atribuir uma "pegadinha típica" à banca sem dados.
- Resposta simulada (sem chave) com cara de real, ou gravada como explicação real.
- Encher o caderno com aulas inteiras (a revisão vira um inferno — palavras do dono).
- Aviso, bloqueio ou tom de cobrança: a proteção sugere, nunca impede; tudo tem saída sem penalidade.
- Gasto de IA desnecessário (o dono usa limite gratuito): nada de chamada extra só para classificar a pergunta.

## 3. Restrições
- Regras do projeto: sem jargão na tela, tempo em HH:mm, texto da IA só por `RichText`, componentes ≤ ~250 linhas,
  TS strict, sem ternário aninhado, Vitest + Playwright, `npm test`/`test:e2e`/`build` verdes.
- Regra autoral de prompts: dizer qual fonte é verdade imutável (gabarito oficial `final_answer` e enunciado
  `statement`); separar texto da fonte, interpretação e raciocínio; abstenção ("se o artigo exato não estiver
  confirmado, explique o conceito sem inventar número"); sem chave = modo demonstração rotulado.
- Provedores atuais em `src/lib/aiRouter.ts` (Gateway → Groq → Gemini → DeepSeek); Groq grátis é o usado.
- Mudança no contrato SQL → nova migração + `LATEST_SCHEMA_VERSION` (hoje 8). `self_diagnosis` é `TEXT` sem `CHECK`:
  novos valores não exigem migração estrutural, mas o contrato (`01-database-schema.sql`) documenta os valores.
- Animações: `Collapse`/`.fofolab-enter` existentes, respeitando "menos movimento".

## 4. Abordagens consideradas (escolhida: A, pelo dono)
- **A. Tudo na coluna direita** *(escolhida)*: FofoIA ocupa a aba do Copiloto (Copiloto e Caderno continuam como abas);
  rápida, pistas, aula e resumo na mesma conversa; ao pedir a aula completa a coluna se alarga se estiver estreita.
  Ganha: um lugar só e a questão/PDF visível ao lado para comparar (em monitor pequeno, rolar é melhor do que esconder —
  dono). Custa: leitura longa numa coluna (mitigada pela largura).
- **B. Conversa na direita, aula no centro:** melhor leitura, mas cobre o que o estudante quer comparar e divide a FofoIA
  em dois lugares.
- **Descartada:** manter um painel de IA também na aba Questões — contraria o motivo da mudança.

## 5. O que foi decidido

### 5.1 Lugar e voz
- A aba **"Copiloto"** da coluna direita vira **"FofoIA"** (ícone do hamster 🐹). O painel "Explicação & Estudo
  Reverso" sai da aba Questões; a questão ganha a largura.
- Voz: o hamster professor — acolhedor, direto, sem infantilizar; trata o estudante por "você". **(decisão do Claude)**
- **Aula completa alarga a coluna:** se a coluna estiver mais estreita que **560 px**, vai para 560 px enquanto a aula é
  lida; o estudante pode ajustar depois (largura lembrada como hoje). **(decisão do Claude: 560 px)**

### 5.2 Dois modos de resposta
- **Explicação rápida (padrão):** resposta curta e direta à pergunta (alvo: até ~120 palavras **(decisão do Claude)**).
- **Aula completa:** botão **"Aula completa"** sempre disponível (no fim de cada resposta rápida e nos atalhos). Formato
  fixo, igual para todos os estudantes (o dono: "outras pessoas vão usar"):
  1. **O essencial** em 2–3 linhas;
  2. **Explicação com exemplo concreto**, de preferência ligado a um ponto forte do estudante;
  3. **Camadas:** Direito → letra da lei/normativo → jurisprudência dominante (STF/STJ/TCU) → como costuma ser cobrado;
     TI e demais → conceito → exemplo → como costuma ser cobrado;
  4. **Cuidados em prova:** nesta fatia, **"Cuidados comuns em provas"**, sem atribuir nada à banca; quando a conversa
     é sobre a questão ativa e ela tem explicação guardada, os padrões dessa explicação. Padrões por tópico/banca a partir
     das questões catalogadas ficam para o banco classificado (mandar todas as explicações do tópico gastaria o limite)
     **(decisão do Claude)**;
  5. **1–2 perguntas de recuperação** no fim (o estudante responde de cabeça; a FofoIA corrige se ele responder no chat).
- **Sugestão de aula sem chamada extra de IA:** o app sugere ("Parece que vale a aula completa sobre ‹tópico›") quando
  há sinais que ele já tem:
  - a pergunta é de base ("o que é", "não entendi", "não sei nada", "me explica do zero"…);
  - domínio baixo (< 30) ou tópico em primeiro contato;
  - 2 ou mais perguntas seguidas na mesma conversa;
  - erro com "Sei" (falsa certeza) ou "Confundi com outra coisa" na questão ativa.
  A sugestão é um destaque discreto com o botão; quem decide é o estudante. **(decisão do Claude: limiares)**

### 5.2.1 Jeitos da FofoIA (personas do grupo de estudos, 24/10/2026)
Um amigo do dono estuda com quatro prompts-professores (Diana, Bill, Dora, Jorge) e um "chat só do edital". O que eles
fazem de bom virou **jeitos de ensinar de um personagem só** — escolhidos pelos sinais que o app já tem, sem o estudante
acionar nada, e visíveis num **selinho** discreto no topo da resposta (trocável num toque). Créditos: Diana, Bill, Dora e
Jorge, do grupo de estudos do dono. **Decisão do dono:** um personagem (FofoIA), jeitos nomeados pelo que fazem — sem
"FofoDora/FofoJorge" (piada interna que confunde quem chega de fora); o hamster muda de expressão em cada jeito.

| Jeito (selinho) | Inspirado em | Entra quando | Como responde |
|---|---|---|---|
| 🐹💡 **Rápida** | Bill | padrão | curta e direta, com uma analogia; siglas de TI expandidas; fecha com até 5 palavras-chave |
| 🐹🌱 **Do zero** | Jorge | pergunta de base ("não entendi nada", "o que é"), domínio < 30, 1º contato, falsa certeza ou "Confundi" | começa por uma metáfora e pelo porquê daquilo importar; linguagem simples; se falta um **pré-requisito** (ligações entre tópicos do app), pergunta se quer vê-lo antes; termina oferecendo um assunto relacionado |
| 🐹📚 **Aula completa** | Diana | botão ou sugestão de aula | o formato de §5.2, fundamentado na definição formal; começa pelo conceito básico; **em partes** se for longa ("Parte 1 de 3" + "Continuar") |
| 🐹📝 **Resumo** | Dora | "Salvar resumo de revisão" | formato fixo abaixo |
| 🐹🧭 **Cai no meu edital?** | chat do edital | atalho | diz se o assunto descrito está no edital do plano e onde (tópico, prova, peso), ou que não aparece e pode esperar |

- **Resumo no formato da Dora** (vai ao caderno do tópico depois de o estudante confirmar; ≤ 6 linhas):
  `**‹Título com emoji›**` · **Palavras-chave:** … · **Conceito curto:** (máx. 2 frases) · **Uso funcional:** … ·
  **Analogia:** … · **Cuidado em prova:** … (só cuidados gerais ou da questão ativa — §5.2 item 4).
- **Regras de estilo de todos os jeitos:** listas em vez de tabelas (o app não desenha tabelas e a coluna é estreita);
  emojis com parcimônia (só nos rótulos e no título); siglas de TI expandidas na primeira menção; fundamentar na definição
  formal/doutrina e dizer quando há divergência ou mudança recente, nunca "ignorar a aplicabilidade atual".
- **O que fica de fora (máscaras):** títulos grandiosos ("o melhor professor do mundo", "especialista FGV" — não dão
  conhecimento, só confiança no tom); "pegadinhas/pontos mais cobrados da banca" sem dados; perguntar concurso e banca (o
  plano já sabe).
- **"Cai no meu edital?":** o estudante descreve o assunto com as próprias palavras. O app **filtra localmente** os tópicos
  do plano por palavras em comum (até 20 candidatos, com matéria, prova e peso) e manda só esses e os nomes das matérias —
  não o edital inteiro **(decisão do Claude, para economizar o limite)**. Fonte imutável: a lista de tópicos do plano;
  abstenção ("não encontrei no seu edital; se for parte de ‹matéria›, confira o tópico X") em vez de inventar.
- **Dois níveis de modelo (ideia do amigo: "rápido" no dia a dia, "pensar mais" no elaborado):** Rápida, Do zero e Resumo
  usam o modelo atual (rápido); Aula completa e "Cai no meu edital?" podem usar um **modelo mais forte**, se configurado
  (`VITE_*_MODEL_STRONG` no `.env`, documentado no `.env.example`); sem ele, usam o mesmo modelo **(decisão do Claude)**.
- **Professores personalizados** (cada estudante escrever o próprio estilo, com as regras de segurança fixas por baixo):
  ideia para depois, fora desta fatia.

### 5.3 O que a FofoIA sabe e o que guarda
- **Contexto de cada pergunta:** plano (órgão/banca), tópico atual (código, título), domínio e confiança da amostra,
  pontos fortes (para analogias), **trecho do caderno do tópico atual** (até **1.500 caracteres**, do começo — **decisão
  do Claude**) e, se houver, a **questão ativa do app** (enunciado e gabarito oficiais; gabarito só depois de respondida).
- **Aviso visível** sob o campo de pergunta: "Suas anotações deste tópico vão junto com a pergunta para a IA." Só o caderno
  do tópico atual.
- **Conversa começa do zero** (decisão do dono: os tópicos são muitos e o histórico gastaria o limite de uso).
  Dentro da conversa atual, as mensagens anteriores vão junto (é uma conversa); trocar de tópico ou recarregar começa
  outra. Mudar de tópico com uma conversa aberta: a conversa some com um aviso de uma linha **(decisão do Claude)**.
- **Explicação-base da questão continua guardada** (`ai_dissections`, cache já existente), para não pagar duas vezes a
  mesma explicação. O chat por questão (`chat_history_json`) deixa de ser gravado.
- **Onde aparece a explicação-base (decisão do Claude):** na **própria correção, embaixo da questão** (como na Revisão do
  dia), com os conceitos-chave; sem explicação guardada, o botão "Gerar explicação" fica ali (gasta IA só quando pedido).
  A FofoIA é para ir além dela ("Aprofundar com a FofoIA" abre a conversa já sobre essa questão).
- **Questão ativa e tópico atual (decisão do Claude):** questão ativa = a questão **na tela da aba Questões** (corrige o
  envio de hoje, que manda a primeira da lista). Na Revisão do dia a FofoIA não recebe a questão (a revisão tem o próprio
  fluxo). Tópico atual = o tópico **da questão ativa**, se houver; senão o tópico selecionado. A conversa recomeça quando
  esse tópico muda.
- **Caderno é escolha do estudante.** No fim de uma aula completa (e como ação em qualquer resposta), **"Salvar resumo de
  revisão"**: a FofoIA gera o resumo no **formato da Dora** (§5.2.1) e o estudante confirma antes de ir para o caderno do
  tópico. Aula inteira nunca vai para o caderno.

### 5.4 Falha produtiva sem ser invasiva (três camadas)
1. **Pergunta sobre a questão ativa ainda não respondida:** o gabarito **não é enviado à IA** enquanto o estudante não
   responde; o prompt manda dar pista, nunca a alternativa, e há um botão próprio **"Pedir pista"**. Limite honesto: o
   modelo ainda pode deduzir a resposta sozinho — o que o app garante é não entregar o gabarito e pedir pista; o teste
   cobre o prompt e o modo demonstração **(decisão do Claude)**. A FofoIA não dá o gabarito. Responde com uma linha ("Marque
   sua resposta e a confiança primeiro — mesmo chutando: errar agora ajuda a fixar depois.") e oferece **pistas em
   degraus**: 1ª conceitual, 2ª mais concreta, nunca a alternativa certa. Saída sempre disponível: **"Ver explicação mesmo
   assim"** — registra primeiro contato (como hoje), sem penalidade.
2. **Confiança antes de responder na aba Questões** (igual à Revisão do dia), §5.5.
3. **Aula completa num tópico nunca tentado** (sem tentativa no app, sem registro de fora, sem estudo): antes da aula, **uma
   pergunta de aquecimento** ("Antes de começar: o que você acha que…?"), que dá para pular; se o tópico tem questões no
   app, o convite **"Tentar 3 questões antes da aula"** ao lado de **"Ver a aula agora"**. Aparece **uma vez por tópico**,
   nunca bloqueia. Desligável na calibragem ("Tenho meu método"), como a Revisão do dia.
- Ler o PDF é sempre livre.

### 5.5 Confiança e diagnóstico (aba Questões e Revisão do dia)
- **Antes de responder, três toques:** **Sei** · **Acho que sei** · **Vou chutar** (valores gravados continuam
  `SURE`/`THINK`/`GUESS`; só os rótulos mudam — a Revisão do dia passa a usá-los).
- **Obrigatório também na aba Questões (decisão do dono):** as alternativas só aparecem depois da confiança, como na
  Revisão do dia. É um toque e é o que faz o "acertei no chute" e a falsa certeza existirem. O "Ver explicação antes de
  responder" (1º contato) continua disponível sem confiança.
- **Acerto: zero toques**, deduzido e trocável:
  - Sei + acertou → **Dominei** (`MASTERED`);
  - Acho que sei + acertou → **Acertei na dúvida** (`DOUBT`);
  - Vou chutar + acertou → **Acertei no chute** (novo: `LUCKY_GUESS`).
- **Erro: um toque — "Por quê?"**
  - **Não sabia** (`BASE_GAP`) → a FofoIA sugere a aula do tópico;
  - **Confundi com outra coisa** (novo: `MISCONCEPTION`) → sugere uma aula comparando os dois conceitos;
  - **Pegadinha ou desatenção** (`BOARD_TRAP`) → não reduz a teoria.
- **Falsa certeza (Sei + erro):** a correção ganha a linha "Você tinha certeza. Vale entender de onde veio essa ideia."
  (efeito de hipercorreção) e pesa mais no motor que um chute errado.
- **Chute errado:** acolhido como primeiro contato (tom de `blue`, "Em mapeamento inicial"), sem cobrança.
- **Questão do app sem marcar confiança** (ex.: abriu a explicação antes — 1º contato): segue como hoje (`BASE_GAP`).
- **Efeito no motor (decisão do Claude, ajustável pelo construtor com teste):**
  - `LUCKY_GUESS`: domínio **+1** (não +2 da dúvida), **não** conta como "dominei" na meia-vida; conta na amostra.
  - `MISCONCEPTION`: como lacuna na meia-vida (×0,75) e no calor, com peso de diagnóstico **maior** que `BASE_GAP`.
  - Falsa certeza (`confidence = SURE` + erro): peso extra no calor do tópico (≈ +50% do peso da lacuna).
  - `isDiagnosisAllowed`: acerto → `MASTERED`/`DOUBT`/`LUCKY_GUESS`; erro → `BASE_GAP`/`MISCONCEPTION`/`BOARD_TRAP`;
    1º contato → só `BASE_GAP`.
- **Calibração do Início** passa a usar os rótulos novos.
- **Quando grava (decisão do Claude):** a tentativa é gravada **assim que o estudante responde**, com o diagnóstico
  deduzido (acerto) ou `BASE_GAP` por padrão (erro) — a aba Questões não tem "Próxima" obrigatório e trocar de questão não
  pode perder a tentativa. Trocar o diagnóstico depois (o "trocável" e o "Por quê?" do erro) **corrige a mesma tentativa**:
  função nova no banco que desfaz o delta de domínio antigo e aplica o novo. Errou e nunca tocou em "Por quê?" → fica
  `BASE_GAP`.
- **Falsa certeza + "Pegadinha ou desatenção":** sem o peso extra de falsa certeza (o estudante disse que leu errado, não
  que tinha a ideia errada) **(decisão do Claude)**.
- **Revisão do dia:** mesmo fluxo — erro vem com `BASE_GAP` marcado e o "Por quê?" com as três causas; acerto deduzido.

### 5.6 Modo demonstração e falhas
- Sem chave: respostas marcadas "Exemplo simulado — a IA ainda não está configurada" (texto que já existe), inclusive aula,
  pistas e resumo; resumo simulado **não** vai para o caderno sem o rótulo de exemplo (ou fica bloqueado — **decisão do
  Claude: o botão "Salvar resumo" fica desabilitado no modo demonstração**).
- Erro do provedor: uma linha acolhedora ("Não consegui falar com a IA agora. Tente de novo em instantes.") + nova tentativa;
  detalhe técnico só no console.

## 6. Dados
- `self_diagnosis`: novos valores `LUCKY_GUESS` e `MISCONCEPTION` (documentar no contrato SQL). Como não há `CHECK`, a
  coluna aceita sem migração; **se** o construtor precisar de migração (ex.: nada), segue a regra da v9.
- `ai_dissections.chat_history_json`: deixa de ser escrito (coluna fica; dados antigos ignorados).
- Preferência "Tenho meu método" (camada 3 de §5.4): `study_plans.productive_failure_hints INTEGER NOT NULL DEFAULT 1`
  (migração **v9**) **(decisão do Claude: por plano, como a Revisão do dia)**.
- "Uma vez por tópico" da camada 3: guardar quais tópicos já mostraram o convite — **por computador** (`localStorage`),
  pois é conforto de tela, não dado de estudo **(decisão do Claude)**.

## 7. Deixado ao construtor
- Como dividir `QuestionWorkbench.tsx` (735 linhas) e `AiCopilotDockPanel.tsx` ao tirar o painel e criar a FofoIA
  (respeitando ~250 linhas por componente; fatia `src/features/fofoia/`).
- Texto exato dos prompts (seguindo a regra autoral) e dos sinais de pergunta "de base".
- Como mostrar as pistas em degraus (mensagens da FofoIA com um botão "Outra pista").
- Ajuste fino dos pesos de §5.5 dentro do sentido descrito, com teste do motor.

## 8. Próxima fatia: FofoIA com a letra da lei (fora deste escopo)
O repositório público `ctresb/leis` (Constituição + ~29 mil normas federais em Markdown com cabeçalho e link da fonte
oficial) pode ancorar as aulas de Direito: o app entrega à IA o **texto exato** do artigo e pede que explique só a partir
dele. Cuidados: textos federais vêm do compilado oficial (bom); estaduais escaneados têm OCR com erros; projeto de uma
pessoa; acervo enorme → trazer só as leis do edital, com link da fonte. Nesta fatia a FofoIA já separa "fonte" de
"explicação" no prompt para encaixar isso depois. Brainstorm próprio.

## 9. Testes mínimos
- **Unit:** dedução do diagnóstico (6 combinações + erro → 3 causas); `isDiagnosisAllowed` com os novos valores; pesos do
  motor (`LUCKY_GUESS` não alonga a meia-vida; `MISCONCEPTION` e falsa certeza esquentam mais); sinais da sugestão de aula;
  montagem do contexto (caderno cortado em 1.500, gabarito ausente antes de responder); pistas nunca contêm a letra certa
  (teste do prompt e do modo demonstração); escolha do jeito pelos sinais (Do zero com domínio baixo/falsa certeza);
  resumo no formato da Dora (≤ 6 linhas, campos fixos); filtro local do "Cai no meu edital?" (candidatos por palavras em
  comum, máx. 20); prompts sem tabela e sem "pegadinha da banca" sem dados; auditoria de jargão.
- **E2E:** questão do app — confiança → resposta → diagnóstico deduzido / um toque no erro; perguntar à FofoIA antes de
  responder dá pista, não gabarito; "Ver explicação mesmo assim"; aula completa alarga a coluna; salvar resumo vai ao
  caderno; Revisão do dia com os rótulos novos; modo demonstração rotulado.
