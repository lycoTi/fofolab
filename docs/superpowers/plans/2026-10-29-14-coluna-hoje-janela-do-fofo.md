# Coluna Hoje com a janela do Fofo — plano de implementação

> **Para agentes:** sub-skill obrigatória: superpowers:subagent-driven-development (recomendado) ou
> superpowers:executing-plans, tarefa por tarefa. Passos em checkbox (`- [ ]`).

**Objetivo:** reconstruir a coluna Hoje como tópico de agora → janela do Fofo (FofoDoro com cenário em pixel) → trilho do
dia, com as cores da roupa do Fofo e destaques fora das cores de status.

**Arquitetura:** o cenário é pintado por funções puras num buffer de pixels (1 pixel = 2 px de tela, igual ao Fofo de
64 px) em duas camadas (atrás e na frente do Fofo) e copiado para `<canvas>`; uma regra pura decide céu, paisagem, festa e
momento. O FofoDoro passa a ser janela + relógio em dígitos pixel + quadradinhos de pomodoro. A coluna é refeita em
componentes pequenos; o App só monta as peças.

**Stack:** React 19, TypeScript strict, Tailwind 3 (`tailwind.config.js`), Vitest (jsdom), Playwright (Edge).

**Spec:** `docs/specs/14-coluna-hoje-janela-do-fofo.md`. Referência visual e do motor de cenário (JavaScript solto):
`docs/specs/14-esbocos/coluna-v2.html` — portar a lógica, não o HTML.

## Restrições globais
- Textos de interface e comentários em pt-BR; sem jargão (lista `FORBIDDEN_JARGON` dos testes); sem emoji.
- Tempo de duração em HH:mm (`formatDuration`), relógio em mm:ss (`formatClock`), hora do dia em HH:mm (`formatTimeOfDay`, Tarefa 9).
- Sem ternário aninhado; guard clauses; componente com até ~250 linhas; comentário diz o porquê.
- Cores de status fixas: `emerald` dominado/correto · `amber` dúvida/atenção · `blue` mapeamento inicial · `rose/red` lacuna.
- Nenhum `orange-NNN` nos arquivos da coluna, do FofoDoro e da janela; destaque só por `var(--fofo-accent)`,
  `var(--fofo-accent-text)`, `var(--fofo-accent-subtle)`, `var(--fofo-ground)`, `var(--fofo-border-subtle)`.
- Pixel: escala inteira, `image-rendering: pixelated`, nada borrado; cenário parado (sem animação nesta entrega).
- Fofo só pisca durante o foco; dorme em qualquer pausa (entre pomodoros ou apertada), **menos** a pausa da olhada;
  `prefers-reduced-motion` deixa o Fofo parado.
- Commit só com o aval do dono, com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. O Antigravity pode estar
  mexendo na mesma pasta: `git add` só dos arquivos da tarefa, nunca `git add -A`.

## Foco da revisão
1. **Coluna na largura mínima (240 px):** os dígitos do relógio não cobrem o Fofo nem o Fofo sai da janela → E2E na Tarefa 12.
2. **Fuso desconhecido / virada do dia:** sem `sun`, o céu e a paisagem usam 06:00–18:00 e trocam às 22:00 → unidade na Tarefa 3.
3. **"Reduzir movimento" na pausa:** o Fofo dormindo continua de olhos fechados (não volta a abrir) → E2E na Tarefa 12.
4. **Recarregar no meio da pausa:** a janela volta com o Fofo dormindo e o trilho com horas coerentes → E2E na Tarefa 12.
5. **Bloco livre sem meta (relógio do cabeçalho, modo Livre):** trilho mostra "agora · bloco livre" sem hora de fim e sem
   `NaN` nas horas seguintes → unidade na Tarefa 9.

---

### Tarefa 1: Paletas das roupas fora das cores de status

**Arquivos:**
- Modificar: `src/features/mascot/fofoThemes.ts` (paletas `natal`, `nomeado`, `prova`, `madrugada`)
- Criar: `src/__tests__/fofoThemes.test.ts`
- Modificar: `.agents/rules/identidade-fofolab.md` (frase do FofoDoro)
- Apagar: `src/features/mascot/ThematicPerimeter.tsx` (sem uso)

**Interfaces:** produz paletas novas; nenhuma assinatura muda.

- [ ] **Passo 1: teste que falha**

```ts
// hexToHsl e inBand vivem no próprio teste
it('nenhuma roupa usa cor de status como destaque', () => {
  for (const theme of Object.values(FOFO_THEMES)) {
    const { h, s } = hexToHsl(theme.palette.accent);
    if (s < 0.35) continue;
    expect(inBand(h, 90, 170), `${theme.id} verde`).toBe(false);
    expect(inBand(h, 190, 245), `${theme.id} azul`).toBe(false);
    expect(h >= 330 || h <= 10, `${theme.id} vermelho/rosa`).toBe(false);
  }
});
```

- [ ] **Passo 2:** `npx vitest run src/__tests__/fofoThemes.test.ts` → FALHA em `natal`, `nomeado`, `prova`, `madrugada`.
- [ ] **Passo 3: trocar as paletas** (accent / accentHover / accentText / accentSubtle / accentBorder):
  - `natal`: `#E8B64C` / `#D19E33` / `#F6DFA8` / `rgba(232, 182, 76, 0.16)` / `rgba(232, 182, 76, 0.4)`
  - `nomeado`: `#D4A72C` / `#B88F1F` / `#F3E1A6` / `rgba(212, 167, 44, 0.16)` / `rgba(212, 167, 44, 0.4)`
  - `prova`: `#F97316` / `#EA580C` / `#FED7AA` / `rgba(249, 115, 22, 0.14)` / `rgba(249, 115, 22, 0.35)`
  - `madrugada`: `#A78BFA` / `#8B5CF6` / `#E4DCFF` / `rgba(167, 139, 250, 0.16)` / `rgba(167, 139, 250, 0.4)`
  - Em `identidade-fofolab.md`, "No FofoDoro, no lugar da hora do dia, o Fofo do relógio (base)" vira "Nos avisos do
    FofoDoro, o Fofo do relógio (base); na janela do Fofo, a roupa do app".
- [ ] **Passo 4:** o teste passa; `npx vitest run src/__tests__/fofo*` continua verde.
- [ ] **Passo 5: commit** — `feat(mascot): destaques das roupas fora das cores de status`.

### Tarefa 2: Fonte pixel empacotada e Fofo dormindo na roupa

**Arquivos:**
- Modificar: `package.json` (`@fontsource/pixelify-sans`), `src/main.tsx` (import), `tailwind.config.js`
  (`fontFamily.pixel: ['"Pixelify Sans"', 'monospace']`)
- Modificar: `src/features/mascot/FofoSprite.tsx` (`FofoMotion` ganha `'asleep'`), `src/index.css`
- Teste: `src/__tests__/fofoSprite.test.tsx` (existente)

**Interfaces:** produz `type FofoMotion = 'still' | 'blink' | 'full' | 'asleep'`; `CurrentFofo` aceita `motion="asleep"`.

- [ ] **Passo 1:** `npm view @fontsource/pixelify-sans version` responde uma versão (licença OFL); senão, baixar o
  `.woff2` da Google Fonts para `public/fonts/` e declarar `@font-face` em `index.css`.
- [ ] **Passo 2: teste que falha** — `it('dormindo na roupa: o quadro de olhos fechados fica por cima', …)`:
  `render(<FofoSprite outfit="natal" motion="asleep" decorative />)` → `svg[data-motion="asleep"]` existe e o
  `data-pose` não existe (a roupa continua).
- [ ] **Passo 3:** instalar a fonte, importar `@fontsource/pixelify-sans/700.css` em `main.tsx`; em `index.css`,
  `.fofo-sprite[data-motion='asleep'] .fofo-blink { opacity: 1; }` (sem animação, então vale também com "reduzir movimento").
- [ ] **Passo 4:** `npx vitest run src/__tests__/fofoSprite.test.tsx` → PASSA; `npm run build` → PASSA.
- [ ] **Passo 5: commit** — `feat(mascot): fonte pixel no app e Fofo dormindo sem trocar a roupa`.

### Tarefa 3: Regra pura do que aparece na janela

**Arquivos:**
- Criar: `src/features/fofo-window/sceneView.ts`
- Modificar: `src/features/mascot/FofoOutfitContext.tsx` (`useFofoOutfit` devolve também `now: Date` e `sun: SunTimes | null`)
- Teste: `src/__tests__/fofoSceneView.test.ts`

**Interfaces — produz:**
```ts
export type SkyPhase = 'dia' | 'dourado' | 'noite';
export type Landscape = 'fazenda' | 'trilha' | 'cidade';
export type Festival = 'natal' | null;
export type WindowMoment = 'ritual' | 'foco' | 'dormindo' | 'acordado';
export interface SceneInput {
  now: Date; sun: SunTimes | null; outfit: OutfitId;
  phase: BlockPhase; running: boolean; peeking: boolean; hasBlock: boolean; subjectColor: string | null;
}
export interface SceneView { sky: SkyPhase; landscape: Landscape; festival: Festival; moment: WindowMoment; subjectColor: string | null }
export function sceneViewAt(input: SceneInput): SceneView;
export function sceneKey(view: SceneView): string; // muda só quando algo visível muda
```

- [ ] **Passo 1: testes que falham** (sol de referência: nascer 06:00, pôr 18:00):
  - céu: 06:39 → `'dourado'`; 06:41 → `'dia'`; 17:21 → `'dia'`; 17:20 → `'dourado'`; 18:40 → `'dourado'`; 18:41 → `'noite'`
  - paisagem: 12:00 → `'fazenda'`; 18:00 → `'trilha'`; 21:59 → `'trilha'`; 22:00 → `'cidade'`; 05:59 → `'cidade'`
  - `sun: null` dá o mesmo que nascer 06:00 / pôr 18:00
  - festa vem da roupa: `outfit: 'natal'` em 15/03 → `'natal'`; `outfit: 'prova'` em 10/12 → `null`; `'halloween'` → `null`
  - roupa da hora fixada (`'explorador'`) ao meio-dia → paisagem `'fazenda'`
  - momento: `IDLE` → `'ritual'`; `FOCUS`+`running` → `'foco'`; `FOCUS`+`!running`+`!peeking` → `'dormindo'`;
    `FOCUS`+`!running`+`peeking` → `'foco'`; `BREAK` → `'dormindo'`; `READY` e `DONE` → `'ritual'`; `hasBlock: false` → `'acordado'`
- [ ] **Passo 2:** `npx vitest run src/__tests__/fofoSceneView.test.ts` → FALHA (módulo não existe).
- [ ] **Passo 3:** implementar. Dourado = 40 min antes até 40 min depois do nascer e do pôr do sol. Paisagem pelos mesmos
  limites de `timeOfDayOutfit` (`wardrobe.ts`), sem depender da roupa.
- [ ] **Passo 4:** PASSA.
- [ ] **Passo 5: commit** — `feat(fofo-window): regra do que aparece na janela`.

### Tarefa 4: Buffer de pixels e pincéis

**Arquivos:**
- Criar: `src/features/fofo-window/scene/pixelBuffer.ts`
- Teste: `src/__tests__/fofoScenePixels.test.ts`

**Interfaces — produz:**
```ts
export interface PixelBuffer { width: number; height: number; pixels: (string | null)[] } // cor '#rrggbb' ou vazio
export function createBuffer(width: number, height: number): PixelBuffer;
export function painter(buf: PixelBuffer): Painter; // px, rect, map, gradV, disc, glow, ellipse, hills, ground (como no esboço v2)
export function seeded(seed: number): () => number; // sorteio determinístico
export function bufferDigest(buf: PixelBuffer): string; // FNV-1a dos pixels
export const SCENE_HEIGHT = 80; export const GROUND_Y = 62;
```

- [ ] **Passo 1: testes que falham:** `px` fora da borda não escreve; `gradV` com 2 cores pinta a linha de cima com a 1ª e
  a de baixo com a 2ª e mistura por Bayer 4×4 no meio; `bufferDigest` igual para dois buffers pintados igual e diferente
  quando 1 pixel muda; `seeded(11)` repete a sequência.
- [ ] **Passo 2:** FALHA. **Passo 3:** portar o `Painter` do esboço v2 escrevendo no buffer (não no canvas).
- [ ] **Passo 4:** PASSA. **Passo 5: commit** — `feat(fofo-window): buffer de pixels do cenário`.

### Tarefa 5: Céu, fazenda, cidade e chão

**Arquivos:**
- Criar: `src/features/fofo-window/scene/sky.ts`, `scene/landscapes/fazenda.ts`, `scene/landscapes/cidade.ts`,
  `scene/paintScene.ts`
- Teste: `src/__tests__/fofoScenePaint.test.ts`

**Interfaces — produz:**
```ts
export const FOFO_SLOT = { x: 5, feetY: GROUND_Y + 6 }; // Fofo de 32 células com os pés 6 linhas dentro do chão
export function paintScene(view: SceneView, widthCells: number): { back: PixelBuffer; front: PixelBuffer };
```
Consome: `pixelBuffer.ts` (Tarefa 4), `SceneView` (Tarefa 3).

- [ ] **Passo 1: testes que falham:**
  - `paintScene(v, 142)` duas vezes → mesmo `bufferDigest` (determinístico)
  - larguras 102 e 242 (coluna de 240 e 520 px) não quebram e preenchem a largura toda do céu
  - há sombra (pixel não vazio, mais escuro que o chão) em `(FOFO_SLOT.x + 15, FOFO_SLOT.feetY)` na fazenda e na cidade
  - nenhum objeto da paisagem na área do relógio: colunas `width − 72 … width − 1`, linhas `5 … 45` só têm céu
  - `sky: 'noite'` não pinta sol; `'dia'` não pinta estrelas (conferir pela cor do disco)
- [ ] **Passo 2:** FALHA. **Passo 3:** portar do esboço v2 o céu (3 paletas: dia, dourado, noite), a fazenda e a cidade
  (poste com a poça de luz onde o Fofo pisa). Objetos ancorados: Fofo e frente à esquerda; celeiro e prédios à direita,
  abaixo da linha 45. Semente fixa (`seeded(11)`).
- [ ] **Passo 4:** PASSA. **Passo 5: commit** — `feat(fofo-window): céu pela hora, fazenda e cidade`.

### Tarefa 6: Trilha do explorador (com aprovação do dono)

**Arquivos:** criar `src/features/fofo-window/scene/landscapes/trilha.ts`; teste em `fofoScenePaint.test.ts`.

- [ ] **Passo 1:** acrescentar `'trilha'` aos testes de determinismo, sombra e área do relógio da Tarefa 5 → FALHA.
- [ ] **Passo 2:** desenhar: montanhas e pinheiros em silhueta, trilha de terra sob o Fofo, ponto de luz quente (lanterna
  ou fogueira) perto dele com poça de luz no chão; céu dourado e noite.
- [ ] **Passo 3:** PASSA.
- [ ] **Passo 4: mostrar ao dono** — página de captura (como o esboço v2) com a trilha no dourado e na noite; seguir só
  com o aval dele (a spec pede o desenho aprovado).
- [ ] **Passo 5: commit** — `feat(fofo-window): trilha do explorador`.

### Tarefa 7: Camada do Natal e objetos de cada momento

**Arquivos:**
- Criar: `src/features/fofo-window/scene/festivals.ts`, `src/features/fofo-window/scene/moments.ts`
- Modificar: `scene/paintScene.ts`
- Teste: `fofoScenePaint.test.ts`

**Interfaces:** `paintScene` passa a aplicar festa e momento; nenhuma assinatura nova exportada.

- [ ] **Passo 1: testes que falham:**
  - `festival: 'natal'` em qualquer paisagem: linha `GROUND_Y` vira neve (cor clara) e há presente no buffer `front`
  - Natal de dia não acende luzinhas; à noite acende (há pixel de luzinha no `back`)
  - `'ritual'`: caneca e livro fechado ao lado do Fofo; a capa do livro tem `subjectColor`; `subjectColor: null` usa cinza
  - `'foco'`: livro aberto à frente (no `front`); `'dormindo'`: "Zz" em pixel acima da cabeça (no `back`)
  - `'acordado'`: nenhum desses objetos
- [ ] **Passo 2:** FALHA. **Passo 3:** a neve recolore chão e borda dos morros; pinheiros e presente em faixas fixas que
  as paisagens deixam livres; objetos do momento em mapas de texto (mesmo formato do Fofo).
- [ ] **Passo 4:** PASSA. **Passo 5: commit** — `feat(fofo-window): Natal e objetos do momento`.

### Tarefa 8: Componente da janela

**Arquivos:**
- Criar: `src/features/fofo-window/SceneCanvas.tsx`, `src/features/fofo-window/FofoWindow.tsx`
- Teste: `src/__tests__/fofoWindow.test.tsx`

**Interfaces — produz:**
```ts
export function FofoWindow(props: { view: SceneView; clock: ReactNode | null }): JSX.Element;
```
Consome: `paintScene`, `sceneKey`, `CurrentFofo` (lê a roupa `app` do contexto).

- [ ] **Passo 1: testes que falham:**
  - canvases com `aria-hidden="true"`; o Fofo (`svg.fofo-sprite`) fica entre o canvas de trás e o da frente
  - `moment: 'dormindo'` → `svg[data-motion="asleep"]`; `'foco'` → não é `asleep`
  - `clock` aparece no canto superior direito; `clock={null}` não renderiza a área do relógio
  - sem `ResizeObserver` (jsdom) usa 142 células e não quebra; `getContext` nulo não lança erro
- [ ] **Passo 2:** FALHA. **Passo 3:** largura = `Math.floor((largura do elemento) / 2)` via `ResizeObserver`; altura fixa
  160 px; canvas redesenha só quando `sceneKey` ou a largura mudam; Fofo com `scale={2}` posicionado em
  `left = FOFO_SLOT.x × 2`, `top = (FOFO_SLOT.feetY − 30) × 2`; sem borda, sombra ou cantos arredondados.
- [ ] **Passo 4:** PASSA. **Passo 5: commit** — `feat(fofo-window): janela do Fofo`.

### Tarefa 9: Trilho do dia (regra pura)

**Arquivos:**
- Modificar: `src/features/study-block/studyBlockMachine.ts` (nova função), `src/lib/timeFormat.ts` (nova função)
- Criar: `src/lib/nowBlock.ts`, `src/lib/dayTrack.ts`
- Testes: `src/__tests__/studyBlockMachine.test.ts` (existente), `src/__tests__/dayTrack.test.ts`

**Interfaces — produz:**
```ts
// studyBlockMachine.ts — quanto falta do bloco rodando (pomodoros + pausas), ou null se não dá para saber
export function remainingBlockMs(state: BlockState, now: number): number | null;
// timeFormat.ts
export function formatTimeOfDay(date: Date): string; // '16:10'
// nowBlock.ts — "Agora" é sempre o bloco rodando, senão o atual do roteiro (ou o extra)
export type NowTag = 'fora do roteiro' | 'meta cumprida' | null;
export interface NowBlock { subject: Subject; topic: Topic | null; item: RoutineItem | null; tag: NowTag; running: boolean }
export function pickNowBlock(input: { items: RoutineItem[]; extra: RoutineItem | null; block: BlockTarget | null; active: boolean; subjects: Subject[]; topics: Topic[] }): NowBlock | null;
// dayTrack.ts
export const BETWEEN_BLOCKS_MINUTES = 10;
export interface TrackStop { item: RoutineItem; startsAt: Date; emphasis: 'next' | 'later' }
export interface DayTrack { done: { count: number; minutes: number } | null; nowEndsAt: Date | null; upcoming: TrackStop[]; endsAt: Date | null }
export function buildDayTrack(input: { items: RoutineItem[]; extra: RoutineItem | null; nowBlock: NowBlock | null; block: BlockState; now: Date }): DayTrack;
export function roundToFiveMinutes(date: Date): Date;
export function humanReason(reasonText: string): string | null;
```

- [ ] **Passo 1: testes que falham:**
  - `remainingBlockMs`: foco 30, ajustes padrão (curta 6, longa 20 a cada 4), meta 120, `FOCUS` com 1 feito,
    `cyclePomodoros: 1` e 10 min restantes → `82 min`; `BREAK` curta com 4 min restantes, 2 feitos, `cyclePomodoros: 2` → `70 min`;
    `READY` com 3 feitos de 4 → `30 min`; modo Livre com meta 60 e 45 focados → `15 min`; Livre sem meta → `null`
  - `formatTimeOfDay(new Date(2026, 9, 29, 9, 5))` → `'09:05'`
  - `pickNowBlock`: sem bloco rodando → item `current` com `tag: null`; bloco rodando no item `done` (meta cumprida na
    pausa) → esse item com `tag: 'meta cumprida'`; bloco rodando fora do roteiro → `tag: 'fora do roteiro'`, `item: null`,
    matéria e tópico achados por id; roteiro cumprido sem rodar → o `extra`; nada → `null`
  - `buildDayTrack` (agora 14:00, foco 30, padrão): antes do play com 120 min no atual → `nowEndsAt` 16:18 →
    próximo começa ≈ 16:30 (16:28 arredondado); 2 feitos de 50 e 40 min estudados → `done = { count: 2, minutes: 90 }`;
    Livre sem meta rodando → `nowEndsAt: null` e próximo começa ≈ 14:10; nenhuma `Date` inválida em nenhum caso
  - `humanReason('Faltam 08:45 desta matéria na sua meta da semana • Peso 1.5x • Domínio 64%.')` →
    `'Faltam 08:45 desta matéria na sua meta da semana.'`; `'Meta da semana cumprida — bloco extra na matéria de maior
    prioridade (peso 2x).'` → sem `(peso 2x)`; texto de Revisão da semana fica igual
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. Pausas pelo contador do ciclo, como `planPreview`
  (`(cyclePomodoros + i) % longEvery === 0` → longa). Blocos seguintes: `planPreview(item.remainingMinutes, …, 0).totalMinutes`
  no modo pomodoro, `item.remainingMinutes` no Livre; `BETWEEN_BLOCKS_MINUTES` entre blocos; horas exibidas por
  `roundToFiveMinutes`.
- [ ] **Passo 4:** PASSA. **Passo 5: commit** — `feat(roteiro): trilho do dia com horas estimadas`.

### Tarefa 10: FofoDoro na janela

**Arquivos:**
- Modificar: `src/features/fofodoro/FofoDoro.tsx` (refeito), `src/features/fofodoro/FofoDoroPreview.tsx` (vira os
  controles de antes do play, embaixo da janela; `describePlan` continua exportado), `src/features/study-block/StudyBlockParts.tsx` (sem laranja fixo)
- Criar: `src/features/fofodoro/FofoClock.tsx`, `src/features/fofodoro/PomodoroBlocks.tsx`
- Apagar: `src/features/fofodoro/FofoDoroRing.tsx`
- Teste: `src/__tests__/fofodoro.test.tsx` (atualizar)

**Interfaces — produz:**
```ts
export function FofoDoro(props: {
  controller: StudyBlockController;
  scene: { now: Date; sun: SunTimes | null; outfit: OutfitId };
  subjectColor: string | null;
  peeking: boolean;
  /** Antes do play: meta do bloco e como começar (null = sem bloco hoje: só cenário). */
  start: { targetMinutes: number | null; label: string; onStart: () => void } | null;
}): JSX.Element;
```
Consome: `FofoWindow`, `sceneViewAt` (Tarefas 3 e 8).

- [ ] **Passo 1: atualizar os testes (falham):**
  - grupo `role="group"` com nome `FofoDoro` e `data-fofodoro` (o relógio do cabeçalho rola até ele)
  - relógio `role="img"` com o mesmo rótulo do anel antigo: `/^Foco: 18:42 restantes/`, `/^Pausa:/`, `/^Pausa longa:/`, `/^Pronto:/`
  - dígitos com a classe `font-pixel`; fase escrita ("foco", "foco pausado", "pausa", "pausa longa", "pronto")
  - quadradinhos: 4 pomodoros com 1 feito em foco → `aria-label="Pomodoro 2 de 4"` e texto `Pomodoro 2 de 4 · 00:47 de 02:00`;
    container `role="progressbar"` com nome `Progresso do bloco`; modo Livre sem quadradinhos
  - um botão principal por fase (Iniciar bloco / Pausar / Continuar / Começar o próximo pomodoro / Encerrar pausa);
    "Concluir bloco" em texto; "Pular matéria" e "Zerar" dentro do menu "Mais ações"
  - `READY` mostra "Pronto quando você estiver"; não existem mais "Depois: pausa" nem "Pausa longa de 20:00 depois do 4º seguido"
  - o teste "bolinhas do ciclo … até a pausa longa" sai junto com as bolinhas (spec §5); os de ajustes, aviso (toast) e
    Fofo no aviso continuam como estão
  - antes do play: `describePlan`, seletor 25/30/50/Livre, ajustes e **Iniciar bloco** chamando `start.onStart`
  - auditoria de jargão e de emoji continua; nenhum `orange-NNN` em `FofoDoro.tsx`, `FofoClock.tsx`, `PomodoroBlocks.tsx`, `FofoDoroPreview.tsx`, `StudyBlockParts.tsx`
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar; textos do relógio reaproveitam `phaseLabel`/`ringTime` do
  `FofoDoro.tsx` atual; cores por `var(--fofo-*)`; botão principal com `active:scale-[0.97]` e 150 ms.
- [ ] **Passo 4:** `npx vitest run src/__tests__/fofodoro.test.tsx` → PASSA.
- [ ] **Passo 5: commit** — `feat(fofodoro): FofoDoro na janela do Fofo`.

### Tarefa 11: A coluna nova

**Arquivos:**
- Modificar: `src/features/routine/RoutineColumn.tsx` (casca), `src/features/routine/QuestionLogPanel.tsx` (controlado),
  `src/features/routine/TodayTimeControl.tsx`, `TopicTree.tsx`, `PeekBanner.tsx` (sem laranja fixo)
- Criar: `src/features/routine/NowSection.tsx`, `src/features/routine/DayTrackList.tsx`, `src/features/routine/ColumnFooter.tsx`
- Apagar: `src/features/routine/RoutineBlockItem.tsx`
- Testes: `src/__tests__/routineColumn.test.tsx`, `src/__tests__/questionLogPanel.test.tsx` (atualizar)

**Interfaces — `RoutineColumnProps` passa a ser:**
```ts
{
  dayTotalMinutes: number; weekStudiedMinutes: number; weekTargetMinutes: number; todayStudiedMinutes?: number;
  todayTime?: TodayTime;
  nowBlock: NowBlock | null; track: DayTrack; items: RoutineItem[]; extraBlock: RoutineItem | null;
  group: TopicGroup; selectedTopicId: string | null; materials: RoutineMaterials;
  blockRunning: boolean; peek: PeekInfo | null; hint: string | null;
  fofodoro: ReactNode;               // sempre presente (a janela)
  questionLog: QuestionLogPanelProps; // agora com open/onOpenChange
  onSelectTopic; onReturnToBlock; onOpenMaterial; onOpenPlan: () => void; onOpenEdital; onRecalibrate;
  adminToggle: ReactNode;
}
// QuestionLogPanelProps ganha: open: boolean; onOpenChange: (open: boolean) => void (o convite abre pelo pai)
// RoutineMaterials sai de RoutineBlockItem.tsx e passa a ser exportado por NowSection.tsx
```

- [ ] **Passo 1: atualizar os testes (falham):**
  - ordem no DOM: cabeçalho `Hoje · 02:50` → "Agora" → `[data-fofodoro]` → trilho → rodapé
  - "Agora": matéria, tópico inteiro `2.2.1 OWASP Top 10` sem `truncate`; botão `Subtópicos de 2.2 Segurança de
    aplicações` abre a árvore; links "PDF p. 12/40", "8 questões", "Caderno" chamam `onOpenMaterial`
  - tag "fora do roteiro" / "meta cumprida" aparece quando `nowBlock.tag` existe
  - trilho: `<ol>`; "2 blocos feitos · 01:30"; "agora · até ≈ 16:20"; próximo com hora, `02:00`, matéria, tópico e
    `humanReason`; seguintes em uma linha; "≈ 19:00 · fim do roteiro"; sem "atrasado"; paradas mantêm
    `data-testid="routine-item-N"` e `data-status`
  - roteiro cumprido mostra o resumo do dia e o extra; folga e roteiro vazio mantêm os textos de hoje
  - rodapé: `Semana: 04:20 de 14:00`, links "Plano de estudo", "Edital", "Registrar questões de fora", o `adminToggle`
  - convite de registro (`invite: true`) aparece logo abaixo da janela; sem convite, o formulário só abre pelo link do rodapé
  - auditoria: `FORBIDDEN_JARGON` e nenhum `orange-NNN` em `src/features/routine/*.tsx` (lendo os arquivos com `fs`)
- [ ] **Passo 2:** FALHA. **Passo 3:** implementar. Sem caixas: espaço, rótulos pequenos ("Agora", "Depois") e no máximo
  uma linha de 1px (`var(--fofo-border-subtle)`) entre as partes; fundo `bg-[var(--fofo-ground)]` na raiz da coluna;
  tópico em 15px semibold com o código em `var(--fofo-accent-text)`.
- [ ] **Passo 4:** `npx vitest run src/__tests__/routineColumn.test.tsx src/__tests__/questionLogPanel.test.tsx` → PASSA.
- [ ] **Passo 5: commit** — `feat(roteiro): coluna Hoje com agora, janela e trilho`.

### Tarefa 12: Ligar no App, relógio do cabeçalho e E2E

**Arquivos:**
- Modificar: `src/App.tsx` (bloco de props da `RoutineColumn`, ~linhas 1146–1200, e o `FofoDoro`), `src/features/study-block/StudyBlockMini.tsx`
- Testes: `e2e/fofodoro.spec.ts`, `e2e/roteiro.spec.ts`, `e2e/bancada.spec.ts` (atualizar); criar `e2e/janela-fofo.spec.ts`

**Interfaces:** `StudyBlockMini` ganha `hideRunningClock?: boolean` (com bloco rodando e `true`, não renderiza nada;
"Começar bloco" continua quando não há bloco). Consome `pickNowBlock`, `buildDayTrack`, `FofoDoro`, `useFofoOutfit().now/.sun`.

- [ ] **Passo 1: E2E que falham** (`e2e/janela-fofo.spec.ts`):
  - iniciar bloco → janela com Fofo piscando → **Pausar** → `svg[data-motion="asleep"]` na janela → Continuar → não
    `asleep`; olhar outro tópico (olhada) → Fofo acordado; concluir → trilho anda (próximo vira "agora")
  - com `emulateMedia({ reducedMotion: 'reduce' })`, pausado: `.fofo-blink` da janela com `opacity` 1
  - pausar, recarregar a página → janela volta com o Fofo dormindo e as horas do trilho sem `NaN`
  - trocar a roupa no guarda-roupa (fixar `natal`) → `--fofo-accent` muda e o botão principal da janela usa a cor nova
  - largura mínima da coluna (arrastar até 240 px): caixa dos dígitos e caixa do Fofo não se cruzam e ficam dentro da janela
  - coluna aberta com bloco rodando: o cabeçalho não mostra `Relógio do bloco`; coluna recolhida: mostra
- [ ] **Passo 2:** `npm run test:e2e -- janela-fofo` → FALHA.
- [ ] **Passo 3:** no App, calcular `nowBlock` e `track` com as funções da Tarefa 9 (substituem `runningOnRoutineBlock`,
  `freeBlock`, `freeBlockTitle`, `preview`); `FofoDoro` com `scene={{ now: fofo.now, sun: fofo.sun, outfit: fofo.app }}`,
  `peeking={peek.kind !== 'none'}`, `start` montado de `startRoutineBlock`; `StudyBlockMini` com
  `hideRunningClock={leftPanel.open && !readerExpanded}`.
- [ ] **Passo 4:** atualizar os E2E antigos: `fofodoro.spec.ts:39` (sem "Depois: pausa de 05:00"), `roteiro.spec.ts`
  (`routine-item-N` e `Progresso do bloco` continuam; conferir os seletores do trilho), `bancada.spec.ts:360`.
- [ ] **Passo 5:** `npm run test:e2e` → todos PASSAM (duas rodadas). **Passo 6: commit** — `feat(app): coluna Hoje com a janela do Fofo`.

### Tarefa 13: Verificação e entrega

- [ ] **Passo 1:** `npm test`, `npm run test:e2e` e `npm run build` → todos verdes (anotar os números).
- [ ] **Passo 2:** página de capturas (Playwright, `e2e/.screens/`) da coluna: fazenda (dia e dourado), trilha (dourado e
  noite), cidade (noite), e Natal sobre cada paisagem; momentos ritual, foco e dormindo. Mostrar ao dono e esperar o aval.
- [ ] **Passo 3:** dados reais: abrir com o banco do dono, fechar e abrir o app no meio de um bloco.
- [ ] **Passo 4:** BACKLOG (item "Coluna Hoje com a janela do Fofo": [DONE] só com os 4 critérios; senão [PARCIAL] com o
  que falta), entrada `[Claude Code]` com data, e `graphify update .`.
- [ ] **Passo 5: commit** — `docs: coluna Hoje com a janela do Fofo verificada`.
