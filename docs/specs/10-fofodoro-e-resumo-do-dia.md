# 🐹 Spec 10 — FofoDoro na coluna Hoje e resumo do dia

> Brainstorm de 2026-10-23 (Claude Code + dono). Esboço: `.superpowers/brainstorm/` (fora do git), opção **A** escolhida.

## 1. Intenção
O que é "agora, em minutos" fica na coluna **Hoje**; o que é semanal fica na aba **Ciclo**. O cartão "Bloco atual" (relógio,
pomodoros, pausar/concluir) hoje mora no Ciclo e parece deslocado. Ele vira o **FofoDoro**, dentro do bloco atual da
coluna, mais explicativo e configurável: o estudante vê quanto vai estudar e pausar, entende a pausa longa, e recebe
avisos acolhedores nas transições. No fim do dia, um resumo comemora o que foi feito e aponta o próximo passo.

## 2. Objetivos / não-objetivos / anti-objetivos
- **Objetivos:** FofoDoro no bloco atual (opção A); relógio analógico em anel; pausa curta calculada pelo foco e pausa longa
  a cada N pomodoros; parâmetros configuráveis; prévia do plano do bloco; toasts nas transições; resumo do dia e totais.
- **Não-objetivos:** som/notificação do sistema; estatísticas por hora do dia; cronograma.
- **Anti-objetivos:** o foco recomeçar sozinho depois da pausa; avisos durante o foco; tom de cobrança; animação que
  ignora "reduzir movimento".

## 3. Decisões
### 3.1 Onde e transições (decisão do Claude, delegada pelo dono)
- O FofoDoro aparece **dentro do item do roteiro** cujo bloco está rodando (mesma matéria e tópico do bloco). Rodando,
  a árvore de tópicos se recolhe numa linha ("1.1 Monolitos… ▾", clicar abre) e aparecem anel, pomodoros e botões.
- **Concluir o bloco:** o item vira "feito" (recolhe com animação de altura) e o próximo se abre com tópicos e
  "Iniciar bloco". O FofoDoro só aparece no próximo quando o estudante der play.
- **Bloco começado fora do roteiro** (pelo relógio do cabeçalho num tópico de olhada): FofoDoro num cartão "Bloco livre"
  no topo da coluna.
- **Relógio do cabeçalho** continua; clicar nele abre a coluna (se recolhida) e leva o foco ao FofoDoro. A aba Ciclo
  deixa de ter o cartão do bloco.
- A **contagem para a pausa longa continua entre blocos** no mesmo dia (o cansaço é do estudante, não do tópico); zera
  depois de uma pausa longa ou na virada do dia.

### 3.2 Regras do pomodoro
- Foco: 20, 25, 30, 50 min (padrão 25) ou relógio livre.
- Pausa curta automática: `max(5, round(foco / 5))` min (20→5, 25→5, 30→6, 50→10); pode ser ajustada à mão (3–15).
- Pausa longa: padrão 20 min (10–30), a cada 4 pomodoros (2–6).
- Depois de qualquer pausa o FofoDoro fica **"Pronto quando você estiver"** — o foco nunca recomeça sozinho.
- Preferências do FofoDoro ficam neste computador (`localStorage`, como a largura das colunas).
- **Prévia antes do play:** "4 pomodoros de 25 + 3 pausas de 5 → 01:55 (pausa longa depois do 4º)" para a meta do bloco.

### 3.3 Relógio em anel
- SVG; o arco se completa no sentido horário. Foco = laranja, pausa = azul, pausa longa = verde-água. Tempo no centro e a
  fase abaixo. Ao lado: "Pomodoro 2 de 4", próxima pausa, quando vem a pausa longa e as bolinhas do ciclo.
- `prefers-reduced-motion`: o arco muda sem transição.

### 3.4 Avisos (toasts)
- Só nas transições: fim do foco ("Parabéns: 25 minutos de foco! Que tal 5 minutos de pausa?"), início da pausa longa
  ("4 pomodoros seguidos! Pausa longa de 20 minutos — você mereceu."), fim da pausa ("Pausa concluída. Comece o próximo
  pomodoro quando estiver pronto."), bloco concluído ("Bloco concluído: 01:40 de foco em ‹matéria›.").
- Canto inferior esquerdo, `aria-live="polite"`, some em 7 s, botão de fechar, um por vez.

### 3.5 Resumo do dia e totais (entrega 10b)
- **Roteiro cumprido:** o cartão do fim do dia diz "Parabéns: 04:10 de estudo hoje! Amanhã tem mais." e o próximo
  tópico que o motor indicaria agora (o mesmo do bloco extra).
- **Totais** na aba Ciclo: "Seu estudo registrado: hoje · esta semana · este ano · desde o começo" (soma de `study_sessions`,
  tipo revisão incluído).
- **Semana cumprida** (`weekCompleted`): parabéns discreto no topo do Ciclo.

## 4. Abordagens
Opção **A** (escolhida): o bloco atual vira o FofoDoro ao dar play — um lugar só para o "agora". **B** (descartada):
cartão separado abaixo da lista — mantém tópicos abertos, mas divide a atenção entre dois cartões.

## 5. Deixado ao construtor
Medidas finas do anel; texto exato dos toasts dentro do tom acima; posição do botão de ajustes; como a árvore recolhida
mostra o tópico selecionado.
