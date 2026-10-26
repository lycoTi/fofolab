# 🧭 Spec 13 — Plano de estudo: a semana dia a dia e o caminho até a prova

> Status: design **aprovado** em 25/10/2026. **13a construída** (plano `docs/superpowers/plans/2026-10-25-13a-horas-por-dia-e-sua-semana.md`). 13b e 13c ainda não.
> Brainstorm de 25/10/2026 (Claude Code + dono). Esboço aprovado: `.superpowers/brainstorm/298-1792968740/content/plano-semana-e-caminho.html` (fora do git).
> Marcação: o que o dono decidiu está escrito como fato; escolhas do Claude estão marcadas **(decisão do Claude)** e podem ser revistas.
> Skills: `brainstorming`; na construção, `impeccable`/`ux-ui-clean` (tela) e as de ciência da aprendizagem em `.agents/skills/` (`spaced-practice-scheduler`, `interleaving-unit-planner`).

## 1. Intenção
A prova da CGU é em **13/12/2026** (49 dias a partir de 25/10). O dono faz as questões no TEC e usa o FofoLab para **organizar e priorizar**: ciclo, edital, o que estudar hoje. A esposa do dono (segunda usuária) prefere planos **por dias**. Hoje a aba Ciclo divide as horas da semana entre as matérias, mas não responde as duas perguntas que importam: **o que eu faço em cada dia desta semana** e **dá tempo de ver o edital até a prova?** Cada dia vale 1/7 da semana e nada mostra o futuro.

Queremos: a aba **Ciclo vira "Plano de estudo"**, com a semana dia a dia (horas próprias por dia) e o caminho até a prova em três visões — sem virar uma grade rígida: o plano **se refaz sozinho** todo dia, com o que aconteceu de verdade.

## 2. Objetivos, não objetivos e anti-objetivos
**Objetivos**
1. **Horas por dia:** padrão de segunda a domingo; dia com 00:00 é folga; semana atípica muda só aquela semana; "hoje tenho menos tempo" / "hoje não vou estudar" muda só o dia.
2. **Sua semana:** sete dias com as horas, feito × meta e os blocos (matéria · tópico · HH:mm). Dias passados = o que foi feito; hoje = o roteiro da coluna esquerda (o mesmo, gravado); dias que vêm = **previsão** pelo mesmo planejador.
3. **Até a prova**, nas três visões do esboço (o dono escolheu as três):
   - **C "Dá tempo?"** — quanto do edital estará visto quando a reta final começar, pelo plano e pelo ritmo real; o que fazer se não der; P1/P2/P3 contra a nota mínima.
   - **A Linha do tempo por semana** — fase da semana, tópicos novos previstos, % do edital visto ao fim dela.
   - **B Mapa matéria × semana** — em que semanas cada matéria tem tópico novo e quando ela "fecha".
4. **Reta final:** nas últimas semanas (padrão 14 dias) não entra tópico novo — só revisão do que esfriou e questões.
5. **Revisão da semana:** um bloco curto no dia com mais horas.
6. **Imprevistos sem culpa:** o que não foi feito não vira dívida para o dia seguinte; o "Dá tempo?" usa o ritmo real; depois de 3 semanas abaixo do padrão, uma sugestão discreta de ajustar (quem decide é o estudante).

**Não objetivos (agora)**
- Cronograma gravado que o estudante tica dia a dia (descartado: fica velho e briga com o ciclo adaptativo).
- Vários estudantes no mesmo app (a esposa usa a própria instalação).
- Mexer na escolha do tópico do roteiro de hoje além do necessário (reta final, horas do dia).
- Simulados, discursiva (P4), metas por questões.

**Anti-objetivos** (falha mesmo funcionando)
- Punir: vermelho, contagem de falhas, "dívida" que incha o dia seguinte, frase de cobrança.
- Prometer o que o ritmo real não sustenta ("Dá tempo?" otimista com horas que o estudante não tem feito).
- Esconder tópico: o que não cabe aparece numa lista ("ficam para depois"), nunca some.
- Estudo em blocos ("semana 1 = Direito inteiro"): as matérias andam juntas, intercaladas, como o ciclo já faz.
- Jargão na tela; tempo fora de HH:mm.

## 3. Abordagens consideradas (escolhida: 2)
1. **Simular os 49 dias com o motor do ciclo atual.** Uma fonte só de decisão; mas o motor (`cycleEngine.ts`, 675 linhas) calcula o "agora" e teria de inventar domínio/esquecimento futuros — lento e arriscado a 7 semanas da prova.
2. **Duas camadas** *(escolhida pelo dono)*: **esta semana** pelo planejador atual (`planDailyBlocks`), agora com as horas de cada dia; **até a prova** por um **projetor** novo, puro e enxuto, que distribui os tópicos que faltam pelas semanas. O motor quase não muda; tudo testável; entrega em partes. Custo: o caminho até a prova é **projeção** (ordem e ritmo), não a escolha exata de cada dia — mitigado usando a mesma ordem de prioridade do motor e refazendo a projeção todo dia.
3. **Cronograma gravado que se refaz ao atrasar.** Estável, mas contradiz "se refaz sozinho". Descartada.

## 4. Como funciona

### 4.1 Horas por dia
- **Padrão:** sete valores em minutos (seg–dom), editados no "Ajustar" do Plano e no Wizard (onde hoje se escolhe as horas da semana). Planos antigos: o padrão nasce de `weekly_hours_target ÷ 7` em todos os dias (migração), então nada muda até o estudante editar.
- **Dias de estudo e folgas fixas (pedido do dono, 25/10):** um controle só (26/10): cada dia é uma coluna, com o botão do dia (liga/desliga) em cima e o tempo logo embaixo; desligado mostra "Folga". Atalhos "mesmo tempo nos dias de estudo" embaixo. Dia desligado é **folga fixa** (00:00 no padrão); na Sua semana ele aparece como "Folga", em tom neutro, nunca como dia perdido. Motivo: escolher os dias sustenta a constância (autonomia — teoria da autodeterminação; plano concreto de quando estudar — intenções de implementação, Gollwitzer & Sheeran 2006), descanso faz parte do aprendizado (consolidação no sono, Diekelmann & Born 2010) e um dia sem estudo não quebra o hábito (Lally et al. 2010). O app não insiste em "todo dia" nem avisa contra folgas; menos dias só deixa cada dia mais longo (o teto de 02:00 por bloco mantém a intercalação).
- **Total da semana = soma dos dias** daquela semana (padrão + exceções). O motor continua com o orçamento semanal fixo e soma zero (a invariante do projeto), agora recebendo como orçamento **a soma dos sete dias da semana corrente**; `weekly_hours_target` fica gravado como a soma do padrão, para o código antigo seguir funcionando. "Hoje não vou estudar" ou uma semana atípica diminuem o orçamento **daquela** semana — por isso não sobra "dívida" **(decisão do Claude)**.
- **Wizard:** o passo das horas passa a perguntar os dias de estudo e depois as horas de cada dia ligado, já preenchidas a partir de um total rápido ("mesmo tempo nos dias de estudo"), editáveis um a um **(decisão do Claude)**.
- Mudar o padrão muda a assinatura do perfil (`profile_key`), então o roteiro de hoje é regravado pelo mecanismo que já existe (spec 09 §5.3.1).
- **Semana atípica:** mudar as horas de uma semana específica sem tocar no padrão.
- **Hoje:** no topo da coluna ("Hoje · HH:mm"), a ação **"Mudar o tempo de hoje"** — escolher HH:mm ou "Hoje não vou estudar". Regrava o roteiro gravado do dia (`daily_plans`), mantendo os blocos já feitos e encolhendo o resto, com a matéria de maior prioridade primeiro.
- Guardar como **exceções por data** (`plan_day_overrides`: plano, data, minutos): a semana atípica grava os sete dias dela; "hoje" grava um **(decisão do Claude)**.

### 4.2 Sua semana (dia a dia) — entrega 13a
- Sete cartões seg–dom (esboço, parte 1): horas do dia, barra feito × meta, blocos.
- **Dias passados:** sessões registradas (o que foi feito, com HH:mm). **Hoje:** o roteiro gravado (o mesmo da coluna). **Dias que vêm:** previsão — `planDailyBlocks` rodado dia a dia com o orçamento **daquele dia**, descontando da semana de cada matéria o que já foi feito e o que os dias anteriores da previsão já usaram; tópico não se repete na semana enquanto houver outro **(decisão do Claude)**.
- **O que não foi feito não vira dívida:** os dias que vêm só usam as próprias horas; se a semana não fecha, a sobra fica para o projetor (§4.3), não para amanhã.
- **Dia longo, blocos menores:** hoje o roteiro tem até 2 blocos (60% / 40% do dia). Com horas por dia, um sábado de 06:00 viraria dois blocos de 03:00 — estudo em bloco. Regra nova: **bloco de no máximo 02:00**; o dia ganha quantos blocos precisar (até 4), sem repetir matéria enquanto houver outra com tempo na semana **(decisão do Claude**, pela intercalação**)**. Dia de até 03:00 continua como hoje (até 2 blocos, 60% / 40%), mas se as matérias desses blocos têm pouco tempo sobrando na semana, outras completam o dia (até 4 blocos) — senão o fim de semana ficava pela metade.
- **Revisão da semana:** um **bloco do roteiro** do dia com mais horas (empate: o mais tarde), ~10% da semana entre 00:30 e 01:30, tirado do orçamento da semana (soma zero). É um bloco **normal** do roteiro (matéria + tópico, relógio, sessão contada na matéria como qualquer bloco), no **tópico estudado que mais esfriou** (`R(Δt)` menor, já calculado), com o rótulo "Revisão da semana" e o motivo "‹tópico› foi estudado há N dias"; "Fiz questões fora do app" funciona como nos outros blocos. Sem tópico estudado, não há bloco de revisão e o tempo vai para estudo. (Ajuste do plano da 13a: um tópico por bloco, em vez de uma lista, reaproveita o roteiro gravado, o relógio e a contagem que já existem.) Some quando a Revisão do dia está desligada ("tenho meu próprio método", `daily_review_enabled = 0`) **(decisão do Claude)**.
- **Cartões enxutos + detalhe do dia (opção A do dono, 26/10):** na grade, uma linha por bloco — cor e nome curto da matéria (`shortSubjectName`: tira "Fundamentos de…", corta em vírgula/palavra, até 22 letras), HH:mm; o nome inteiro e o tópico ficam no **detalhe do dia escolhido**, embaixo da grade (hoje vem aberto; clicar noutro dia troca). Dia futuro sem bloco porque a semana já foi cumprida diz "semana cumprida". Cartões entram um a um; o detalhe troca com fade curto; parado com "menos movimento".
- A aba **"Ciclo" vira "Plano de estudo"** (se o rótulo quebrar a barra de abas a 1.440 px, usar "Plano"). Saem os totais "Hoje / Esta semana / Este ano / Desde o começo" (o Início já mostra as últimas 4 semanas). A divisão da semana por matéria (lista atual por prova) fica no pé da aba.

### 4.3 Até a prova — entregas 13b e 13c
**Projetor** (módulo puro novo): entrada = tópicos folha ainda não vistos (mesmo critério de "visto" de `editalProgress`), a divisão por matéria do ciclo, a ordem de prioridade do motor (`topicHeatmapRanking`), as horas das semanas que faltam (padrão + exceções), o tempo estimado por tópico e a data da reta final. Saída = uma linha por semana (fase, tópicos novos, % visto ao fim) e a matéria × semana. Refeito a cada abertura e a cada mudança, como o resto do Plano.
- **Tempo por tópico (decisão do Claude):** começa pela autoavaliação — Nunca vi 02:00 · Já vi por cima 01:30 · Sei bem 01:00 · Domino 00:30 — e passa a usar o ritmo real do estudante, misturado pela confiança `C = n ÷ (n + 5)` (n = tópicos medidos), como a regra de amostra pequena do projeto — nada de limiar mágico. **Ritmo real:** para cada tópico visto pela primeira vez nas últimas 4 semanas, os minutos das sessões nele dentro da janela; média desses tópicos. Tópico que só tem registro de questões de fora (sem minutos) não entra na média. O "ⓘ" diz de onde vem o número.
- **Divisão por matéria:** cada semana, a matéria recebe a parte dela (do ciclo) e consome os próprios tópicos na ordem de prioridade; matéria que fecha devolve o tempo às outras com tópico sobrando, na proporção delas **(decisão do Claude)**.
- **Reta final:** padrão 14 dias antes da prova, ajustável de 7 a 21 no "Ajustar"; começa exatamente N dias antes (por dia, não por semana). Na linha do tempo, a semana que contém o começo dela aparece como "Últimos tópicos"; as seguintes, "Reta final: revisão". Durante ela o projetor não põe tópico novo, e **o roteiro do dia também não**: `planDailyBlocks` escolhe só tópicos já vistos, os que mais esfriaram (`R` menor) — junto com as horas do dia e o teto de 02:00 por bloco, as únicas mudanças no planejador.

**C "Dá tempo?"** (esboço, opção C):
- Linha principal: "‹N›% do edital visto até ‹véspera da reta final›" pelo **plano**. Se o **ritmo real** (horas feitas nas últimas 2 semanas, ou desde a primeira sessão se faz menos tempo; só com 7 dias ou mais de uso) for ≥ 10% menor que o plano, mostrar os dois: "no plano, 80%; no seu ritmo das últimas 2 semanas (15:30 por semana), 65%" **(decisão do Claude** nos limiares**)**.
- Se não chega a 100%: as duas saídas — **"+HH:mm por semana"** para ver tudo antes da reta final (botão leva ao "Ajustar") e **"‹N› tópicos de menor prioridade ficam para depois"** com a lista (abre/fecha). Nenhum estado novo: é informação; quem decide é o estudante.
- P1/P2/P3: % visto projetado ao início da reta final, com o aviso da prova com nota mínima ficando para trás pela regra que já existe (`examSituation`, 20 pontos abaixo das outras). Cores do projeto: emerald / amber / orange (foco); sem vermelho.

**A Linha do tempo** e **B Mapa matéria × semana** como no esboço; o mapa fica recolhido por padrão.

**Sugestão de ajustar o padrão:** depois de **3 semanas completas seguidas** com o feito abaixo de 80% do planejado, uma linha discreta no topo do Plano: "Suas semanas têm ficado perto de ‹média, arredondada a 00:30› — ajustar o padrão?" (abre o "Ajustar"; "Agora não" esconde até a próxima semana abaixo) **(decisão do Claude** nos números**)**.

### 4.4 Ordem do Plano na tela
Sua semana → Dá tempo? → Linha do tempo → Mapa matéria × semana (recolhido) → divisão da semana por matéria. A sugestão de ajustar o padrão, quando houver, fica acima de tudo.

## 5. Dados (contrato SQL → migração v11, como manda o CLAUDE.md)
- `study_plans.weekday_minutes_json TEXT` — sete inteiros seg–dom; NULL (planos antigos e sem padrão gravado) = `weekly_hours_target ÷ 7` em todos os dias, calculado na leitura (`parseWeekdayMinutes`) — a migração não precisa copiar dado.
- `study_plans.final_stretch_days INTEGER NOT NULL DEFAULT 14`.
- `plan_day_overrides (plan_id, date 'YYYY-MM-DD', minutes INTEGER, PRIMARY KEY (plan_id, date))`.
- O "Agora não" da sugestão: data guardada em `study_plans` ou na preferência local — escolha do construtor.

## 6. Entregas (cada uma usável sozinha)
- **13a — Horas por dia + Sua semana:** §4.1, §4.2 (com a Revisão da semana), nome da aba, saída dos totais, migração v11.
- **13b — "Dá tempo?" + Linha do tempo + reta final:** projetor, tempo por tópico com ritmo real, reta final no roteiro do dia.
- **13c — Mapa matéria × semana + sugestão de ajustar o padrão.**

## 7. Deixado ao construtor
Layout fino dos cartões e da linha do tempo (seguir o esboço e a paleta do projeto); onde exatamente fica "Mudar o tempo de hoje" na coluna; como mostrar o roteiro previsto ao clicar num dia; a quebra do `CycleView` em componentes de ~250 linhas em `src/features/study-plan/`; o arredondamento dos blocos previstos (5 min, como hoje).

## 8. Pronto quando (definição de pronto do projeto)
- Unit: dias de estudo (folga fixa), padrão de horas e exceções (semana atípica, hoje) e o orçamento da semana como soma dos dias; previsão da semana respeita as horas de cada dia e a soma zero, não repete tópico, não transfere sobra para o dia seguinte; bloco de no máximo 02:00 em dia longo; Revisão da semana no dia certo e desligada junto com a Revisão do dia; projetor (fases, % por semana, matéria que fecha devolve tempo, nada novo na reta final, ritmo real misturado pela confiança, lista do que fica para depois); reta final no roteiro do dia só com tópicos vistos; migração v11 (os dois caminhos do teste de migrações).
- E2E: desligar o domingo e editar as horas → a semana mostra "Folga" e muda → "Mudar o tempo de hoje" encolhe o roteiro → recarregar e continua; "Dá tempo?" e linha do tempo com o plano real da CGU.
- Auditoria de UI limpa (termos proibidos), tempo em HH:mm.
- `npm test`, `npm run test:e2e`, `npm run build` passam.
