# Fofo — o mascote em pixel art

O hamster do FofoDeck redesenhado em pixel art 32×32, pixel a pixel, com um guarda-roupa. Fica **fora do app**:
nada em `src/` importa esta pasta. O gerador também escreve `src/features/mascot/fofoSprites.generated.ts`, a cópia
tipada que o app usa (quando quem escolhe a roupa está em `src/features/mascot/wardrobe.ts`).
Como e onde ele aparece (zonas, voz, ordem e calendário das roupas): `.agents/rules/identidade-fofolab.md`.

## Roupas
| id | Roupa | Quando |
|---|---|---|
| `fofodeck` | Base (fone e relógio "25") | FofoDoro (aviso do fim do foco e da pausa) |
| `fazendeiro` | Fazendeiro | do nascer ao pôr do sol |
| `explorador` | Explorador | do pôr do sol às 22:00 |
| `madrugada` | Estudante da madrugada | das 22:00 ao nascer do sol |
| `halloween` | Fantasminha de lençol | outubro |
| `natal` | Natal (o do FofoDeck de Natal) | 1º a 30/12 |
| `anonovo` | Ano-novo | 31/12 a 31/01 |
| `carnaval` | Carnaval | 2 semanas antes até a Quarta-feira de Cinzas |
| `junina` | Festa junina | junho |
| `prova` | Dia da prova | data da prova cadastrada |
| `nomeado` | Nomeado | até desligar ou cadastrar prova nova |

## Poses (`FOFO_POSES`)
| id | Quando |
|---|---|
| `pensando` | FofoIA respondendo ("A FofoIA está pensando…") |
| `dormindo` | aviso do começo da pausa do FofoDoro |
| `comemorando` | meta da semana cumprida (pé da coluna do roteiro) |

## Comandos (na raiz do projeto)
- `node tools/mascote/gen.cjs` — redesenha tudo e grava `sprites.json`, a cópia do app
  (`src/features/mascot/fofoSprites.generated.ts`) e `preview.html` para conferir. Mudou um desenho? Rode e commite os dois.
- `node tools/mascote/build.cjs` — monta `mascote-fofolab.html`, a página de comparação (sprites + originais do FofoDeck).
- `node tools/mascote/zoom.cjs prova nomeado` — `zoom.html` com as roupas pedidas ampliadas 10×.
- `node tools/mascote/shot.cjs entrada.html saida.png [largura]` e `mobile.cjs` — prints pelo Edge (conferir a 375 px).
- `node tools/mascote/icon.cjs` — ícone de 16 px (só a cabeça com o fone): grava `public/favicon-fofolab.svg` e
  `icone-1024.png`; depois `npx tauri icon tools/mascote/icone-1024.png` refaz os ícones do app de desktop
  (apague as pastas `android/` e `ios/` que ele cria: o app é só desktop).
- `node tools/mascote/thumb.cjs imagem.png saida.txt 256 [x y lado]` — reduz uma imagem de referência para embutir.

## Como o desenho funciona (`gen.cjs`)
- Cada sprite é uma grade de 32 linhas de caracteres; cada caractere é uma cor da paleta do sprite, `.` é transparente.
- `hamsterBody()` faz a silhueta, a sombra e o creme; `face()` o rosto; `headphones()` o fone (as orelhas ficam na
  frente do arco); `outline()` contorna cada camada; `over`/`under` empilham camadas.
- Quadros A e B alternam na animação; `closed` é a camada dos olhos fechados (piscar).
- **Pata segurando** (`grip()`): a palma fica na borda de fora do objeto e os dedos dobram para a frente dele, com o
  objeto entre a pata e o centro do corpo. Pata entre o corpo e o objeto parece segurar com as costas da mão.
- Escala só inteira (1×, 2×, 4×, 8×) e sem suavização (`shape-rendering="crispEdges"`).

## Roupa nova
Função de desenho + entrada na lista `sprites` de `gen.cjs` (id, paleta), seção e linha da tabela em `template.html`,
nome em `NAMES`/`SHORT`; no app, a regra de quando aparece + teste (ver a regra de identidade).

Referências: `ref-fofodeck*.txt` são as imagens originais do FofoDeck, reduzidas, só para comparação na página.
