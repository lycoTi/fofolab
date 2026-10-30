# 🐹 Spec 14 — Coluna Hoje com a janela do Fofo

> Brainstorm de 2026-10-28 (Claude Code + dono). Esboços em `docs/specs/14-esbocos/`: `coluna-v1.html` (três caminhos)
> e `coluna-v2.html` (o escolhido, nas quatro roupas, com o motor de cenário em JavaScript que serve de referência),
> gerados por código a partir de `tools/mascote/sprites.json`. Abrir no navegador.
> Primeiro passo da reestruturação do app por roupa do Fofo: começa por esta coluna e se espalha depois, uma parte por vez.

## 1. Intenção
A coluna **Hoje** (roteiro do dia + bloco atual + FofoDoro) virou uma pilha de faixas, caixas e linhas de 1px que
competem entre si; a "des-cardização" de 28/10 trocou classes sem mudar a hierarquia. O dono quer a coluna **orgânica e
autêntica**, com a personalidade do Fofo, e quer que a **roupa do Fofo mude o ambiente** sozinha, como um tema claro/escuro
sincronizado com a hora e as festas.

No meio de um bloco, o dono olha a coluna para ver **o tópico que está estudando, o andamento do FofoDoro e o próximo
tópico**. Essa é a ordem da coluna.

## 2. Objetivos, não-objetivos e anti-objetivos
- **Objetivos:**
  - coluna em três partes: tópico de agora → janela do Fofo (FofoDoro) → trilho do resto do dia;
  - cenário em pixel na janela: céu pela hora de verdade, paisagem do período e enfeites da festa por cima;
  - Fofo por momento do bloco (antes do play, foco, pausa);
  - cores de destaque da coluna vindas da roupa (variáveis CSS), sem nenhum laranja fixo;
  - camada do Natal pronta até 01/12/2026.
- **Não-objetivos (agora):** outras partes do app com o tema da roupa; camadas de Halloween, Ano-novo, Carnaval, Junina,
  Dia da prova e Nomeado; momentos "pausa acabou", "bloco concluído", "roteiro cumprido" e "dia de folga" com Fofo
  próprio; som; animação do cenário; arte 3D (ideia guardada no BACKLOG).
- **Anti-objetivos:** Fofo bravo, cobrando ou punindo; "atrasado" em vermelho no trilho; movimento perto da leitura
  durante o foco; cor de destaque que se confunda com cor de status; a janela virar um cartão com moldura.

## 3. Regras que valem (não mudam)
- `identidade-fofolab.md`: duas zonas (a janela é zona do Fofo; tópico, trilho e números são zona de estudo), Fofo em
  pixel nítido e escala inteira, pisca só durante o foco, `prefers-reduced-motion` deixa tudo parado, fonte pixel só em
  número grande (Pixelify Sans **empacotada no app**, funciona offline), status em quadradinho + texto, sem emoji.
- `fofolab-especificos.md`: cores de status fixas — `emerald` dominado/correto · `amber` dúvida/atenção · `blue`
  mapeamento inicial · `rose/red` lacuna/prioridade alta. Tempo em HH:mm (`formatDuration`/`formatClock`).
- Regra autoral de componentes: ~250 linhas por componente; sem ternário aninhado.

## 4. Caminhos considerados (escolhido: 1)
1. **Cenário montado no app, em camadas, num canvas** — funções puras desenham céu → paisagem → festa → chão num canvas
   de baixa resolução; objetos desenhados como mapas de texto em `tools/mascote/` (mesmo formato do Fofo); o Fofo segue o
   componente atual por cima; uma segunda camada na frente dele. **Escolhido pelo dono:** qualquer hora × festa sai
   sozinha, regra testável, sem imagem binária no git; quando a arte 3D vier, troca só a camada do desenho.
2. **Imagens prontas por combinação** (PNG gerado em `tools/mascote/`): app mais simples, retoque à mão; mas a
   combinatória cresce a cada festa, binários no git e Fofo na frente dos objetos fica difícil.
3. **SVG de retângulos**, como o Fofo: descartado — milhares de elementos numa coluna aberta o dia todo.

## 5. A coluna (decisões do dono)
De cima para baixo, sem caixas: espaço em branco, rótulos pequenos e, no máximo, uma linha de 1px entre as partes.

1. **Cabeçalho:** `Hoje 04:30` + "Mudar" (o controle de tempo de hoje que já existe).
2. **Agora:** matéria (quadradinho na cor da matéria + nome), **nome inteiro do tópico** (código na cor de destaque,
   título em 15px semibold, quebra linha, nunca corta), e **PDF · questões · Caderno** como links de texto na mesma linha.
   A árvore de subtópicos (`TopicTree`) continua acessível a partir do tópico.
3. **Janela do Fofo** (seção 6): cenário + relógio em dígitos pixel. Abaixo dela: pomodoros em **quadradinhos, um por
   pomodoro do bloco** (`totalPomodoros`: feitos cheios, o atual com contorno e preenchimento parcial, os que faltam
   vazios; no modo Livre, sem quadradinhos) + `Pomodoro 2 de 4 · 00:47 de 02:00`, e as ações — **um botão principal** (Iniciar bloco / Pausar /
   Continuar / Começar o próximo pomodoro / Encerrar pausa), "Concluir bloco" em texto, e "Pular matéria" e "Zerar" num
   menu "···".
4. **Trilho do dia** (seção 8): linha vertical com paradas, de "agora" até "fim do roteiro".
5. **Rodapé:** `Semana: 00:47 de 31:30` (só texto, como hoje — sem quadradinho por dia, que exigiria dado por dia e
   lembraria "sequência perdida"); links "Plano de estudo" e "Edital"; "Registrar questões de fora" (link, ver 10.5);
   o botão de modo admin, discreto (ver 10.5); o aviso de recalibrar continua aqui quando existir; "Meta da semana
   cumprida." com o Fofo comemorando continua aqui.

**Sai da coluna** (dono concordou com a lista na conversa):
- textos que repetem a regra do FofoDoro ("Depois: pausa de 06:00", "Pausa longa de 20:00 depois do 4º seguido") — além
  de repetidos, `06:00`/`20:00` parecem hora do dia;
- motivo do bloco em linguagem de motor ("Peso 1.5x • Domínio 64%"): o trilho mostra só a parte humana ("Faltam 08:45
  desta matéria na sua meta da semana.") — ver 10.4;
- as bolinhas do ciclo rumo à pausa longa (`CycleDots`): os quadradinhos passam a contar os pomodoros do bloco; a pausa
  longa continua acontecendo e aparece como "pausa longa" na fase do relógio;
- o relógio repetido no cabeçalho do app enquanto a coluna está aberta (ver 10.6);
- a faixa fixa "Registrar questões feitas fora do app" no topo (ver 10.5).

## 6. A janela do Fofo
### 6.1 Medidas e pixel
- **1 pixel do cenário = 2 px de tela**, o mesmo do Fofo de 64 px (sprite 32×32 em escala 2). Pixels de tamanhos
  diferentes fazem o Fofo parecer colado; foi o problema do primeiro esboço.
- Altura fixa: 80 pixels de cenário (160 px). Largura acompanha a coluna (largura da coluna − 36 px, arredondada para
  número par); a coluna vai de 240 a 520 px.
- Sem moldura, sem borda, sem sombra, sem cantos arredondados: é uma janela, não um cartão.
- Canvas com `image-rendering: pixelated`, desenhado de novo só quando muda o que aparece (seção 7.4), nunca por quadro.

### 6.2 Camadas (de trás para a frente)
1. **Céu** pela hora (seção 7.1): degradê em faixas com pontilhado (matriz de Bayer 4×4), sol ou lua com halo
   pontilhado, estrelas à noite.
2. **Paisagem** do período (seção 7.2): morros em duas camadas (silhueta com borda clara de 1 pixel), objetos do lugar.
3. **Festa** (seção 7.3): enfeites por cima da paisagem, ajustados à hora.
4. **Chão** com profundidade: linha clara no topo, textura, escurecimento pontilhado para baixo; mancha de terra e
   **sombra elíptica sob os pés do Fofo**.
5. **Fofo** — o componente atual (`CurrentFofo`/`FofoSprite`), posicionado no grade de 2 px, **pés 6 pixels dentro do
   chão**. Continua com piscar, movimento, "reduzir movimento" e as regras de quando se mexe.
6. **Frente:** objetos que passam na frente do Fofo (tufos de grama, trigo, presente) — dão profundidade e o "pé no chão".
7. **Relógio** (HTML, não canvas): dígitos em Pixelify Sans ~46px, branco com sombra dura de 3px na cor do céu; abaixo, a
   fase ("foco", "pausa", "pronto"). Canto superior direito; os objetos altos da paisagem ficam fora dessa área.

### 6.3 Fofo por momento (primeira entrega)
Pausa apertada não é fase: o estado continua `FOCUS` com `running: false` (`studyBlockMachine.ts`). A regra de
identidade já decide: o Fofo dorme **em qualquer pausa — entre pomodoros ou apertada; a pausa automática da olhada não
conta**.

| Momento | Janela |
|---|---|
| Antes do play (`IDLE`) | **Ritual de começo:** caneca de café com fumaça (parada) e livro fechado na **cor da matéria do bloco** ao lado do Fofo; relógio mostra o tamanho do pomodoro (`30:00`); fase "pronto para começar". Abaixo da janela: o plano (`describePlan`, como hoje), o seletor 25/30/50/Livre, os ajustes e **Iniciar bloco**. |
| Foco rodando (`FOCUS`, `running`) | Fofo só pisca; livro aberto à frente dele; relógio em contagem regressiva (ou progressiva no modo Livre); fase "foco". |
| Foco pausado pelo estudante (`FOCUS`, `!running`, sem olhada) | Fofo **dorme** (como na pausa); livro continua aberto; relógio parado; fase "foco pausado". |
| Olhada (pausa automática por abrir outro tópico) | Como "foco rodando", com o relógio parado e a fase "foco pausado"; Fofo acordado. |
| Pausa (`BREAK`) | Fofo **dorme**: olhos fechados (quadro `closed` do sprite da roupa) + "Zz" em pixel no cenário; relógio da pausa; fase "pausa" / "pausa longa". |
| Pausa acabou (`READY`) e bloco concluído (`DONE`) | Por enquanto, como "antes do play" (Fofo acordado, sem objetos novos). Fofo próprio fica para depois. |
| Sem bloco (folga, roteiro vazio, roteiro cumprido sem extra) | Cenário e Fofo acordado, sem relógio; os textos abaixo continuam os de hoje. |

**Decisão do Claude:** os momentos saem de **objetos no cenário + quadros que o sprite da roupa já tem** (`A`, `B`,
`closed`), não de poses novas. Hoje uma pose (`dormindo`, `pensando`) substitui a roupa inteira; na janela isso tiraria a
fantasia do Fofo no meio da festa. Desenhar cada pose × cada roupa seriam 77 desenhos; isso espera a arte em camadas (ou a
3D). O "fone no pescoço" do ritual fica para essa fase.

## 7. O que aparece na janela
### 7.1 Céu pela hora de verdade (decisão do dono: o céu segue a hora; a festa entra por cima)
Usa o nascer e o pôr do sol de `sun.ts` (fuso desconhecido = 06:00–18:00, como no guarda-roupa).
- **Dia:** do nascer + 40 min ao pôr − 40 min.
- **Dourado:** 40 min antes até 40 min depois do nascer e do pôr do sol (paleta de entardecer).
- **Noite:** o resto.

### 7.2 Paisagem pelo período do guarda-roupa
Mesmos períodos de `timeOfDayOutfit` em `wardrobe.ts`:
- **Fazenda** (do nascer ao pôr do sol; Fofo fazendeiro): morros verdes, cerca, plantação de trigo, celeiro, trilha de
  terra onde o Fofo pisa, trigo na frente.
- **Trilha do explorador** (do pôr do sol às 22:00): montanhas e pinheiros em silhueta, trilha, um ponto de luz quente
  (lanterna ou fogueira) perto do Fofo. **Ainda sem esboço:** desenhar e mostrar ao dono antes de fechar.
- **Cidade da madrugada** (22:00 ao nascer do sol): prédios ao fundo com janelas acesas, morro escuro, poste com poça de
  luz no chão onde o Fofo está.

### 7.3 Festa por cima (primeira entrega: Natal)
**Quem decide a festa é a roupa, não o calendário** (decisão do Claude, pelo princípio do dono "a roupa muda o
ambiente"; céu e paisagem seguem sempre o relógio):
- roupa `natal` (01/12 a 30/12 no automático, ou fixa no guarda-roupa em qualquer mês) → camada do Natal;
- dia da prova e nomeado vencem o Natal no guarda-roupa (`pickOutfit`) e, nesta entrega, não têm camada → sem neve;
- roupa de festa ainda sem camada (Halloween, Ano-novo, Carnaval, Junina) → só céu e paisagem;
- roupa da hora fixada no guarda-roupa (ex.: explorador ao meio-dia) → paisagem e céu do relógio (fazenda de dia), com o
  Fofo na roupa fixada.

- **O dia todo:** chão e topo dos morros cobertos de neve (troca as cores do chão e da borda dos morros), flocos parados
  no céu, pinheiros com neve, presente na frente do Fofo.
- **À noite:** luzinhas coloridas acesas (na casa ou nos pinheiros), janela acesa com halo.
- Combina com qualquer paisagem: os enfeites não dependem de qual paisagem está por baixo (neve recolore; pinheiros e
  presente ocupam faixas fixas do cenário que as paisagens deixam livres).
- Halloween (outubro) acaba antes desta entrega e fica para o próximo ano, no mesmo modelo; o esboço `coluna-v2.html`
  serve de referência.

### 7.4 Regra pura e redesenho
Uma função pura decide **o que aparece agora**: `{ sky, landscape, festival, moment, subjectColor }` a partir de
`{ now, sun, outfit, phase, running, peeking, hasBlock, subjectColor }` (`outfit` = a roupa do Fofo na janela; `peeking`
= olhada em andamento; `hasBlock` = existe bloco atual ou rodando). O canvas só redesenha quando essa chave muda (o contexto da roupa já recalcula a
cada minuto). As funções de desenho recebem a chave e a largura e são determinísticas (sorteio com semente fixa).

## 8. Trilho do dia (decisão do dono: mostrar de onde parte até onde termina)
- Paradas: **feitos** (uma linha só no topo, apagada: "2 blocos feitos · 02:30"), **agora** (marcador cheio na cor de
  destaque; "agora · até ≈ 16:10"), **próximo** (completo: hora, duração, matéria, tópico, motivo humano), **depois**
  (apagados, uma linha cada) e **fim do roteiro** ("≈ 19:00 · fim do roteiro").
- **Hora estimada:**
  - fim do bloco atual = agora + o que falta dele (pomodoros e pausas que faltam pelo `planPreview`; no modo Livre, o
    tempo que falta até a meta);
  - antes do play, o bloco atual começa agora;
  - entre blocos, o intervalo sugerido de 10 min que o roteiro já usa;
  - cada bloco seguinte dura o total do `planPreview` da sua duração (pomodoros + pausas) — vale esta regra, não a soma
    simples do esboço;
  - arredondada para 5 min e marcada com "≈".
- **A duração ao lado da hora é a meta de foco do bloco** (`02:00`), como no roteiro de hoje; a hora já embute as pausas.
- **"Agora" é sempre o bloco que está rodando** (ou o atual do roteiro, se nada roda):
  - bloco do roteiro cuja meta foi cumprida na pausa (o roteiro já passou o "atual" para o próximo): a parada "agora" é
    o bloco rodando ("agora · meta cumprida"), e o próximo do trilho é o novo atual do roteiro;
  - bloco livre (olhada, sem meta): a parada "agora" mostra o tópico do bloco livre ("agora · bloco livre", sem hora de
    fim); as horas dos blocos do roteiro contam como se ele terminasse agora (e andam a cada minuto, como sempre).
- **Sempre a partir de agora:** se o estudante atrasa, as horas só andam. Nunca "atrasado", nunca vermelho.
- Roteiro cumprido: o trilho mostra o resumo do dia que existe hoje e o bloco extra sugerido.
- Dia de folga e roteiro vazio: os textos de hoje continuam (sem Fofo próprio nesta entrega).

## 9. Cores da roupa (tema)
- Toda cor de destaque da coluna e do FofoDoro vem das variáveis CSS que `applyFofoThemeToDom` já põe no `<html>`
  (`--fofo-accent`, `--fofo-accent-text`, `--fofo-accent-subtle`, `--fofo-ground`, `--fofo-border-subtle`). Nenhum
  `orange-*`/`amber-*` fixo nos arquivos da coluna e do FofoDoro (hoje são ~49). Cores de status continuam fixas.
- **Destaques fora das cores de status** (proposta do Claude, sem objeção do dono). Critério testável pelo matiz (HSL)
  do `accent` de cada roupa em `fofoThemes.ts`: proibido **verde 90°–170°**, **azul 190°–245°** e **vermelho/rosa
  330°–360° e 0°–10°**. Âmbar e amarelo são permitidos: o laranja/âmbar já é o destaque da marca, e o status `amber`
  sempre vem com quadradinho + texto. Pelo critério mudam: `natal` (`#F43F5E`, rosa → dourado), `nomeado` (`#10B981`,
  verde), `prova` (`#0284C7`, azul) e `madrugada` (`#818CF8`, 235° → violeta, ex.: `#A78BFA`, 255°). O vermelho e o
  verde da festa ficam só no cenário. Um teste confere todas as paletas. As paletas são globais (cabeçalho e fundo já as
  usam); mudar os valores é desejado, porque a confusão com status vale para o app inteiro — o que fica fora desta
  entrega é passar outros componentes para as variáveis.
- A coluna ganha fundo sólido `--fofo-ground` no próprio componente (cobrindo o vidro do painel). O `SidePanel`, que é
  compartilhado com a coluna direita, não muda nesta entrega.

## 10. Decisões do Claude (o dono pode mudar)
1. Momentos por objetos + quadros existentes (6.3).
2. Trilho arredondado em 5 min; feitos recolhidos numa linha (8).
3. Cenário parado nesta entrega; neve caindo, fumaça subindo etc. ficam para depois e, quando vierem, nunca durante o foco.
4. Motivo humano do bloco: o `reasonText` até o primeiro " • ", com ponto final (`describeReason` em
   `src/lib/dailyPlanner.ts` monta "Faltam … na sua meta da semana • Peso …x • Domínio …%."); peso e domínio ficam no
   "ⓘ" do Ciclo, onde já são explicados. O motivo do bloco extra ("Meta da semana cumprida — bloco extra … (peso Xx).")
   perde o "(peso Xx)". Reta final e Revisão da semana já são humanos e ficam inteiros. O texto é o do roteiro congelado
   de manhã (`dailyRoutine.ts`); aceito, porque o próximo bloco quase sempre é de outra matéria e o número não muda no dia.
5. "Registrar questões feitas fora do app": vira link discreto no rodapé; o convite que abre sozinho ao concluir um bloco
   continua e aparece logo abaixo da janela. O botão de modo admin **continua no rodapé da coluna** (é a única volta do
   modo admin, porque o cabeçalho some nesse modo), só que discreto: ícone com rótulo para leitor de tela.
6. Relógio do cabeçalho (`StudyBlockMini`): com a coluna aberta, o relógio de um bloco rodando some do cabeçalho (fica
   na janela); com a coluna recolhida, volta. O botão "Começar bloco" do cabeçalho (olhada) continua.
7. Bloco fora do roteiro ("Bloco livre") e bloco com meta cumprida: a mesma janela; a parte "Agora" mostra o tópico do
   bloco rodando (com o rótulo "fora do roteiro" no bloco livre); o trilho segue a seção 8.
8. `ThematicPerimeter.tsx` não é usado em lugar nenhum: sai.
9. Acessibilidade: canvas `aria-hidden`; o relógio vira um grupo com rótulo equivalente ao do anel de hoje ("Foco: 18:42
   restantes"); pomodoros com rótulo ("2 de 4 pomodoros"); o trilho é uma lista ordenada.

## 11. Decisão do dono: a janela usa a roupa da hora
Em dia comum, a janela mostra a roupa da hora, a mesma do resto do app (`place: 'app'`): fazendeiro de dia, explorador do
pôr do sol às 22:00, madrugada até o nascer do sol; em festa, a roupa da festa. O Fofo base (fone e relógio "25", vindo
da imagem do FofoDeck) fica só nos avisos de fim de foco e de pausa (`place: 'fofodoro'`) e nas telas de carregar/erro.
Quem construir atualiza a frase de `identidade-fofolab.md` ("No FofoDoro, no lugar da hora do dia, o Fofo do relógio")
para "Nos avisos do FofoDoro, o Fofo do relógio; na janela do Fofo, a roupa do app", e o teste do guarda-roupa que
conferir isso.

## 12. Testes e pronto
- **Unidade (Vitest):** a regra "o que aparece agora" (céu nas bordas do nascer/pôr, paisagem nas viradas de 22:00,
  Natal em 30/11, 01/12 e 31/12, momento por fase, cor do livro pela matéria); estimativas do trilho (antes do play,
  rodando, pausa, Livre, atraso não mostra "atrasado"); paletas fora das cores de status; desenho determinístico (mesma
  chave → mesmos pixels, conferido por um resumo do canvas); auditoria de jargão e emoji na coluna; nenhum laranja fixo nos
  arquivos da coluna e do FofoDoro.
- **E2E (Playwright):** iniciar bloco → pausar → pausa (Fofo dormindo na janela) → continuar → concluir, com o trilho
  andando; trocar a roupa no guarda-roupa muda as cores da coluna; fechar e abrir mantém o bloco e a janela certa.
  Os testes atuais que conferem textos removidos (`fofodoro.test.tsx`, `questionLogPanel.test.tsx`,
  `routineColumn.test.tsx`, `e2e/fofodoro.spec.ts`, `e2e/bancada.spec.ts`) são atualizados para o novo comportamento,
  não apagados.
- **Visual:** capturas da coluna nas três paisagens × céus, e com o Natal, mostradas ao dono antes de marcar pronto.
- **Pronto** segue `definition-of-done.md` (`npm test`, `npm run test:e2e`, `npm run build`, dados reais, fechar e abrir).

## 13. Fica com quem construir
Organização dos arquivos (sugestão: `src/features/today-column/` para a coluna e `src/features/fofo-window/` para a janela
e o motor de cenário, com os mapas de objetos gerados por `tools/mascote/`); paletas exatas de cada céu e paisagem;
desenho dos objetos; o desenho da trilha do explorador (mostrar ao dono); como empacotar a Pixelify Sans
(`@fontsource/pixelify-sans` ou arquivo em `public/`, licença OFL); ordem das fatias do plano.
