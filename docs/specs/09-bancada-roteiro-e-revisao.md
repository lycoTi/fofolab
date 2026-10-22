# 🧭 Spec 09 — Bancada única: roteiro na coluna, painéis que recolhem e Revisão do dia

> Brainstorm de 2026-10-22 (Claude Code + dono). Esboços: `.superpowers/brainstorm/` (fora do git).
> Skills: `brainstorming`, `impeccable`/`ux-ui-clean` (tela), skills de ciência da aprendizagem em `.agents/skills/` (revisão).

## 1. Intenção
O FofoLab inteiro é a bancada de trabalho do estudante e deve estar voltado para **o que fazer hoje**. Hoje há
dois modos ("Meu Dia" e "Bancada Pro"); a coluna da esquerda lista todas as disciplinas com porcentagens, como um
relatório isolado, e o "Edital Ativo" ocupa espaço com algo já decidido na calibragem. Ao abrir/fechar painéis,
eles somem sem rastro, o resto da tela salta e os botões do cabeçalho trocam de lugar — o estudante se perde.

Queremos: uma tela só, com o **roteiro do dia na coluna esquerda** (bloco atual aberto, os outros recolhidos),
painéis que **recolhem em vez de sumir**, e uma **Revisão do dia** que mantém o hábito de revisar o que foi
estudado antes — mesmo que o estudante não saiba que precisa.

## 2. Objetivos, não-objetivos e anti-objetivos
**Objetivos**
- Unificar "Meu Dia" e "Bancada Pro" numa tela só.
- Coluna esquerda = roteiro de hoje + o que estou estudando agora.
- Cabeçalho estável de ponta a ponta; painéis recolhem para um trilho com transição.
- Clicar num tópico em qualquer lugar (Mapa de Calor, Ciclo/provas, Edital) leva à bancada com ele selecionado.
- Revisão do dia com 3 a 5 questões intercaladas dos tópicos estudados que estão sendo esquecidos.

**Não-objetivos (agora)**
- Formato cronograma (planos por dias). Não existe no app; a coluna mostra o roteiro do ciclo. Item futuro do backlog.
- Deixar o estudante escolher/montar o roteiro. O motor define (ciclo, pesos, incidência, calor); ajustes só pela
  calibragem/recalibragem do perfil.
- Mudar o motor do ciclo ou o planejador (`dailyPlanner.ts`) além do necessário para ler o roteiro.

**Anti-objetivos (seria fracasso mesmo funcionando)**
- Punir ou constranger: pausa, pulo de revisão e olhadas nunca geram penalidade, alerta vermelho ou contagem de "falhas".
- Animação que atrasa o trabalho ou que ignora "reduzir movimento" do sistema.
- Perder estado ao recolher painel (conversa do Copiloto, texto do Caderno, página do PDF).
- Botão que muda de posição quando clicado.

## 3. Restrições
- Regras do projeto: sem jargão técnico na tela, tempo em HH:mm, `RichText` para texto de IA/caderno, componentes
  até ~250 linhas, TS strict, sem ternário aninhado, testes Vitest + E2E Playwright, `npm test`/`test:e2e`/`build` verdes.
- Mudança no contrato SQL → migração em `src/lib/migrations.ts` + `LATEST_SCHEMA_VERSION` (hoje 4).
- Animações só com CSS (sem biblioteca nova; bundle já ~515 kB) — **decisão do Claude**.
- Sem chave de IA o app fica em modo demonstração rotulado; nada da revisão depende de IA.

## 4. Abordagens consideradas (escolhida: 1)
1. **Três entregas: casca → roteiro → revisão** *(escolhida pelo dono)*. Cada uma usável e testada; a casca corrige o
   incômodo diário e é a base da coluna; aproveita para tirar a casca do `App.tsx` (1.177 linhas, dívida do backlog).
   Custo: a revisão (maior valor pedagógico) chega por último.
2. Três entregas com a revisão primeiro, no "Meu Dia" atual. Custo: retrabalho ao fundir as telas; os saltos visuais
   continuam por mais tempo.
3. Tudo de uma vez. Custo: semanas sem tela utilizável, risco alto com a prova próxima. Descartada.

## 5. O que foi decidido

### 5.1 Entrega 9a — Casca (layout e movimento; sem mudança de dados)
- **Cabeçalho de ponta a ponta**, fora da coluna central, sem quebra de linha. Conteúdo fixo, da esquerda para a
  direita: concurso (órgão + cargo), dias até a prova, quanto de cada prova já foi visto (P1/P2…), status de
  gravação, "Recalibrar perfil", relógio do bloco. A troca "Meu Dia / Bancada Pro" sai (telas unificadas).
- **Painéis laterais recolhem para um trilho** (~44 px) no mesmo lugar: esquerda (roteiro) e direita. A seta de
  recolher fica na borda do próprio painel; recolhido, o trilho mostra os ícones do painel (clicar reabre). Os botões
  "Tópicos", "Caderno" e "Copiloto IA" saem do cabeçalho.
- **Transição** de largura (~220 ms, `ease`) com o conteúdo de largura fixa durante a animação (sem refluxo de
  texto); conteúdo do painel some/aparece por opacidade; o centro cresce/encolhe junto. `prefers-reduced-motion` → 0 ms.
- **Copiloto e Caderno dividem a coluna da direita**, alternados por abas; ambos permanecem montados (sem perder
  conversa/texto) — escondidos, não desmontados.
- "Edital Verticalizado" (gestão do edital) vira link no pé da coluna esquerda.
- Larguras redimensionáveis e lembradas continuam valendo (já existe `useResizableWidth`).
- Leitura ampliada do PDF continua escondendo cabeçalho/painéis como hoje, com a mesma transição.

### 5.2 Entrega 9b — Roteiro na coluna esquerda
- Substitui a lista de disciplinas (`SyllabusTreeDock`). Some o cartão "Edital Ativo" (seletor de plano vai para a
  recalibragem/gestão do edital).
- **Topo: "Hoje · HH:mm"** com os blocos do `planDailyBlocks` (hoje até 2 blocos):
  - bloco **feito**: marcado e esmaecido;
  - bloco **atual** (em andamento, ou o próximo a fazer): **aberto**, com o tópico, os **subtópicos** e o status de
    cada um (nunca visto / em andamento / visto) e atalhos de material — página do PDF, nº de questões, nº de notas.
    Clicar num atalho abre a aba certa no centro (PDF, Questões, Caderno). Clicar num subtópico seleciona-o;
  - bloco **próximo**: recolhido, com o motivo curto (o "Por que hoje?" atual).
- **Pé:** meta da semana (HH:mm feito / meta) com link para o Ciclo; link "Edital".
- **O bloco é um tópico "folha"** (tópicos pai são agrupadores, fora do calor) — decisão do dono, opção (a), fiel ao
  motor. Na coluna, os **irmãos** (mesmo pai) aparecem só como contexto; clicar num irmão é **olhada** (pausa o
  relógio), com o aviso discreto "Olhar ‹irmão› não conta para o bloco de hoje".
- **Tópico sem questão:** a aba Questões do bloco mostra as do tópico; se não houver, sobe para o **nível do pai**
  com o rótulo "Questões do grupo ‹código pai›". Tópicos relacionados de outras matérias ficam para quando o banco
  estiver classificado (épico do banco de questões).
- **Sem questão ≠ esconder:** tópico sem questões continua no roteiro/edital; baixa incidência deve reduzir a
  prioridade no motor (spec 08), não ocultar o tópico.
- **Fim de um bloco:** o bloco vira "feito" e o próximo abre sozinho, com a pausa sugerida que o "Meu Dia" já mostra.
- **Meta da semana cumprida:** roteiro mostra os blocos extras que o planejador já gera (`weekCompleted`).
- **"Olhada" (tópico fora do roteiro):** clicar num tópico no Mapa de Calor, no Ciclo (tópicos das provas passam a
  ser clicáveis) ou no Edital seleciona-o na bancada **sem mexer no roteiro**.
  - Faixa discreta no topo da coluna: "Dando uma olhada em ‹código título› · fora do roteiro de hoje" + **"Voltar ao bloco"**.
  - Se o bloco estava em foco, o relógio **pausa automaticamente** ("pausado · olhada"); "Voltar ao bloco" retoma
    sozinho. Pausa manual anterior não é retomada pela olhada.
  - Após ~3 min de olhada, **uma** linha factual na faixa: "Seu bloco de ‹matéria› está esperando: faltam HH:mm".
    Não repete, não pisca, sem penalidade.
  - Navegar entre subtópicos **do tópico do bloco atual** não é olhada (relógio segue).
  - Questões respondidas na olhada contam normalmente para domínio/calor do tópico olhado.
- **Aviso de recalibrar:** quando o desempenho de uma matéria contrariar muito a autoavaliação (ex.: "domino" e
  errando muito), mostrar sugestão discreta de recalibrar o perfil. Limiar: decisão do construtor (ver §6).

### 5.3 Entrega 9c — Revisão do dia (topo do "Bom dia")
- **Quando:** ao abrir o app sem bloco em andamento, o centro mostra o "Bom dia" (spec 07 §5.5) até o primeiro bloco
  começar; depois vira área de trabalho. A Revisão substitui o "Relembrar" da spec 07.
- **O quê:** 3 a 5 questões **intercaladas**, só de tópicos **já estudados** (nunca visto não entra):
  1 a 2 do(s) tópico(s) estudado(s) no dia de estudo anterior; o restante dos tópicos **esfriando** — menor
  probabilidade de lembrar `R(Δt) = 2^(−Δt/h)` (já calculada em `cycleEngine.ts`). "Frio" aqui = estudado há tempo e
  sendo esquecido, **não** baixa urgência.
- **Questões preferidas:** ainda não respondidas do tópico; se não houver, as respondidas há mais tempo.
- **Confiança antes de responder:** um toque — "Tenho certeza" / "Acho que sei" / "Chutei". Gravada na tentativa.
- **Correção imediata** após cada questão, com explicação curta (a oficial/comentada que já existir; sem IA obrigatória).
- **Efeito:** grava em `question_attempts` como qualquer tentativa (alimenta domínio, meia-vida e calor) e registra
  uma `study_sessions` com `session_type = 'REVIEW'` (o tempo conta na meta da semana).
- **Sem questão no tópico:** pergunta aberta "O que você lembra de ‹tópico›?" com campo de texto livre; depois o
  botão "Ver minhas anotações" mostra o trecho do caderno do tópico, e o estudante se avalia em um toque:
  "Lembrei bem" / "Lembrei em parte" / "Não lembrei" — decisão do dono: **conta como revisão** (atualiza
  `last_studied_at` e a meia-vida), com **peso menor** que uma questão respondida, porque é autoavaliação.
  É só um recurso de transição: sempre que o tópico tiver questão, a revisão usa a questão (prova real de que lembrou);
  a pergunta aberta some sozinha conforme o banco de questões cresce.
- **Pular** sem penalidade: os tópicos voltam no dia seguinte.
- **Desligar a Revisão do dia** ("tenho meu próprio método de revisão") na calibragem/recalibragem do perfil — decisão
  do dono. Desligada, o "Bom dia" não mostra a revisão; o motor segue usando a meia-vida normalmente.
- Resto do "Bom dia" (Hoje, Situação, linha de ânimo factual) conforme spec 07 §5.5.

### 5.3.1 Respostas à revisão do construtor (decisões do Claude, salvo onde indicado)
- **Roteiro do dia congelado.** `planDailyBlocks` recalcula a cada mudança (o orçamento do dia não desconta o que já
  foi estudado hoje), então feito/atual/próximo quebraria. Na primeira abertura do dia o roteiro é **gravado**
  (tabela `daily_plans`, migração v5) e a coluna lê o roteiro gravado. Recalibrar o perfil regrava o do dia.
  Cumpridos os blocos de hoje, a coluna mostra "Roteiro de hoje cumprido" e oferece **um bloco extra** escolhido pelo
  motor (mesma regra do `weekCompleted`), nunca uma lista para o estudante escolher.
- **Início do bloco:** pelo botão "Iniciar" no bloco atual da coluna (o cartão do bloco sai do centro).
- **9a mantém a troca "Meu Dia / Bancada Pro"**; ela só sai em 9b, quando o roteiro chega à coluna.
  O "Meu Dia" atual continua funcionando até lá.
- **Diagnóstico das tentativas da revisão** (`self_diagnosis` é obrigatório e alimenta a meia-vida): derivado da
  confiança + acerto, já preenchido e editável num toque após a correção —
  certeza+acerto → `MASTERED`; acho/chutei+acerto → `DOUBT`; erro → `BASE_GAP` (o estudante pode trocar para
  `BOARD_TRAP`). Motivo: manter a revisão em 1 toque por questão sem perder o sinal para o motor.
- **"Já estudado"** (elegível para a revisão) = `last_studied_at` preenchido **ou** alguma tentativa no tópico — o
  mesmo critério de cobertura de `database.ts`. Tópicos "pai" (agrupadores) não entram, como no motor.
- **Escopo do 9c:** só a Revisão do dia + a moldura do "Bom dia". "Hoje" já está na coluna; "Situação" e a linha de
  ânimo seguem na fatia 7b. O registro rápido do TEC (`question_logs`, 7b) ainda não existe; quando existir, conta
  como "já estudado".

### 5.4 Dados
- `question_attempts`: nova coluna `confidence TEXT NULL` (`'SURE' | 'THINK' | 'GUESS'`) + `source TEXT NULL`
  (`'DAILY_REVIEW'` quando vier da revisão) — migração v5.
- `daily_plans` (nova, v5): `plan_id, date (YYYY-MM-DD), blocks_json, created_at` — roteiro congelado do dia.
- Resposta livre da pergunta aberta: **não** é gravada como tentativa (não há correção); fica só na tela.
  *(decisão do Claude: guardar texto livre sem uso definido só aumenta o banco.)*

## 6. Deixado ao construtor
- Limiar exato do "aviso de recalibrar" (sugestão: confiança amostral ≥ 50% e domínio ≥ 30 pontos abaixo do
  nível declarado).
- Quantas questões entre 3 e 5 (sugestão: 1 por tópico elegível, até 5; mínimo 3 quando houver tópicos suficientes).
- Ícones dos trilhos, textos finos, posição do link "Edital".
- Como dividir o `App.tsx` (casca/slots), desde que cada componente fique ≤ ~250 linhas.
- Como marcar "bloco feito" a partir das `study_sessions` do dia.

## 7. Testes mínimos
- **9a:** unit — estado recolhido/aberto lembrado; Copiloto/Caderno mantêm estado ao alternar; E2E — recolher e
  reabrir cada painel; posição dos controles do cabeçalho idêntica antes/depois de recolher (bounding box).
- **9b:** unit — classificação feito/atual/próximo; regra de olhada (dentro/fora do tópico do bloco); pausa e retomada
  automáticas sem afetar pausa manual; E2E — clicar tópico no Mapa de Calor e no Ciclo → bancada com tópico
  selecionado e faixa de olhada → "Voltar ao bloco".
- **9c:** unit — seleção da revisão (só estudados, mistura ontem/esfriando, preferência por não respondidas,
  fallback pergunta aberta); migração v5 nos dois caminhos; E2E — revisão de ponta a ponta sobrevive a fechar/abrir.
