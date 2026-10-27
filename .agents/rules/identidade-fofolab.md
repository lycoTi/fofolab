# Identidade do FofoLab: anti-IA com personalidade

Complementa a skill global `ux-ui-clean` (anti-IA, modo Operate), que continua valendo inteira, com duas
exceções decididas aqui (regra local > global): a paleta é a escura do FofoLab (`fofolab-especificos.md`),
não a institucional; e existe uma zona com personalidade, onde mora o Fofo.

## Duas zonas
- **Zona de estudo (séria):** enunciado, alternativas, gabarito, correção, diagnóstico, números, tabelas, plano,
  edital, PDF e caderno. Densa e sóbria, linhas de 1px, sem mascote, piada ou animação decorativa.
- **Zona do Fofo:** cabeçalho, FofoDoro, FofoIA, telas vazias, avisos, boas-vindas e conquistas reais.
  Aqui entram a pixel art, a voz do Fofo e a animação em quadros.
- Na dúvida, é zona de estudo.

## O Fofo
- Um personagem só: o hamster do FofoDeck em pixel art 32×32, desenhado pixel a pixel (SVG com `crispEdges`).
  Sem imagem gerada por IA, foto, 3D ou outro estilo misturado.
- Escala só inteira e sem suavização: 32 px no cabeçalho, 64 px na FofoIA e no FofoDoro, 128 px em tela vazia
  e conquista. O ícone de 16 px tem desenho próprio.
- **Guarda-roupa:** a roupa sai de uma função pura com teste (`src/features/mascot/wardrobe.ts`). Ordem: roupa fixa
  (clicar no Fofo do cabeçalho) > marco do concurso (dia da prova, nomeado) > data especial > hora do dia, pelo sol do
  fuso do computador: fazendeiro do nascer ao pôr do sol, explorador do pôr do sol às 22:00, madrugada das 22:00 ao
  nascer do sol. No FofoDoro, no lugar da hora do dia, o Fofo do relógio (base). Roupa fixa e nomeado ficam neste
  computador (preferência); o nomeado vale para o plano e a data de prova de quando foi marcado.
  Roupa nova = sprite + regra + teste.
- **Calendário (cerca de um mês por festa, para as roupas de momento aparecerem no resto do ano):** Halloween em
  outubro; Natal de 1º a 30/12; Ano-novo de 31/12 a 31/01; Carnaval das 2 semanas antes até a Quarta-feira de
  Cinzas (calculado pela Páscoa); Festa junina em junho; Dia da prova na data cadastrada; Nomeado até o estudante
  desligar ou cadastrar uma prova nova (concurso escada).
- **Poses com função:** pensando (FofoIA respondendo), dormindo (pausa do FofoDoro), comemorando (marco real).
- **Movimento:** o Fofo se mexe o tempo todo, menos durante um bloco de foco do FofoDoro, quando só pisca
  (movimento na visão periférica puxa o olho da leitura). Passar o mouse num Fofo clicável faz ele se mexer.
  Respeita `prefers-reduced-motion` (parado). O resto da interface segue 150–250 ms, sem quadros.

## Voz do Fofo
- Fala só na zona do Fofo, em frase curta, de adulto para adulto: acolhe e aponta o próximo passo.
- Nunca infantiliza, nunca pune, nunca inventa progresso nem elogia o que não aconteceu.
- Bom: "Primeira vez neste tópico: errar agora ajuda a fixar depois." Ruim: "Ops! Você errou 😢 Bora, campeão!"

## Toques de pixel fora do Fofo (só quando carregam informação)
- Números grandes do FofoDoro em dígitos de pixel, iguais ao "25" do relógio do Fofo.
- Status em quadradinho de pixel + texto, no lugar de 🟢🟡🔴 (cores de status em `fofolab-especificos.md`).
- Barra em blocos quando cada bloco é uma unidade real (1 pomodoro, 1 tópico, 1 dia).
- Fonte pixel (Pixelify Sans, empacotada no app para funcionar offline) só na marca e em número grande;
  texto corrido, rótulos e botões ficam na fonte do sistema.
- Ícones de ação continuam `lucide-react`.

## Proibido (além da lista da `ux-ui-clean`)
- Emoji em texto de interface; conteúdo do aluno e do exemplo inicial (como 📌) pode. Um teste de auditoria de
  UI reprova emoji em texto de interface (entra junto com a troca dos emojis).
- Mascote em toda tela, mascote na zona de estudo, animação contínua perto de leitura.
- Gamificação que tira a seriedade ou pune: XP, níveis, moedas, vidas, "sequência perdida".
- Confete, partículas, comemoração por clique. Comemoração só em marco real (meta da semana, dia da prova,
  aprovação), curta e sem travar o trabalho.
- Sprite borrado, esticado ou em escala quebrada.
