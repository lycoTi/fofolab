import type { SkyPhase } from '../sceneView';
import { cloud, type CloudColors } from './props';
import { GROUND_Y, type Painter } from './pixelBuffer';
import { clockLeft } from './stage';

/**
 * Céu pela hora de verdade (spec 7.1): degradê em faixas pontilhadas do topo até o chão, sol ou lua com halo
 * pontilhado no alto à esquerda (acima do Fofo, longe do relógio) e estrelas à noite. Dia e noite vêm do esboço
 * `coluna-v2.html` (fazenda e madrugada); o dourado (amanhecer e entardecer) não tinha esboço.
 */

interface Sun {
  x: number;
  y: number;
  r: number;
  glow: string;
  disc: string;
  /** Miolo mais claro, um pouco acima e à esquerda do centro. */
  core: string;
}

export const SKY_PALETTES = {
  dia: {
    gradient: ['#3a7fbf', '#4a8fcb', '#5fa0d6', '#7db6e0', '#a2cceb', '#cde3f2'],
    sun: { x: 20, y: 13, r: 6, glow: '#9fd0ee', disc: '#ffe27a', core: '#fff4c2' },
    clouds: { body: '#ffffff', shade: '#d3e5f2' },
  },
  dourado: {
    gradient: ['#2a2c5a', '#4b3d73', '#7c4c7d', '#b65e74', '#e3805f', '#f6b26b'],
    // Sol mais baixo e maior, ainda acima da cabeça do Fofo e longe da lâmpada do poste da cidade.
    sun: { x: 22, y: 24, r: 7, glow: '#e98a6a', disc: '#ffb347', core: '#ffe3a3' },
    clouds: { body: '#f4b08a', shade: '#c8707a' },
  },
  noite: {
    gradient: ['#020308', '#040619', '#070a24', '#0b0f31', '#111740', '#19204f'],
    // A lua crescente é um disco claro mordido por um disco da cor do céu.
    moon: { x: 18, y: 13, r: 6, glow: '#161d4a', disc: '#dfe2ff', cut: '#070a24' },
    stars: ['#d6dcff', '#5d66b8'],
    brightStar: { core: '#ffffff', rays: '#8f99e8' },
  },
} as const;

// Nuvens (x, y, escala) presas à esquerda; as que cairiam atrás dos dígitos do relógio ficam de fora.
const CLOUD_SPOTS = [
  [34, 6, 1],
  [50, 20, 0.8],
  [96, 9, 0.9],
  [128, 22, 0.7],
] as const;

/** Largura de uma nuvem de escala 1 (bolha mais à direita: deslocamento 13 + raio 2,5). */
const CLOUD_REACH = 16;

// Estrelas grandes em cruz, fixas no alto à esquerda, perto da lua.
const BRIGHT_STARS = [
  [44, 8],
  [36, 27],
  [58, 16],
] as const;

/** Estrelas miúdas por 142 colunas (a largura do esboço); janela mais larga ganha mais, na mesma densidade. */
const STARS_PER_142 = 46;

function paintSun(p: Painter, sun: Sun): void {
  p.glow(sun.x, sun.y, sun.r + 1, sun.r * 2 + 1, sun.glow);
  p.disc(sun.x, sun.y, sun.r, sun.disc);
  p.disc(sun.x - 1, sun.y - 1, 3, sun.core);
}

function paintClouds(p: Painter, width: number, colors: CloudColors): void {
  for (const [x, y, scale] of CLOUD_SPOTS) {
    if (x + CLOUD_REACH * scale >= clockLeft(width)) continue;
    cloud(p, x, y, scale, colors);
  }
}

function paintNight(p: Painter, width: number, rnd: () => number): void {
  const { moon, stars, brightStar } = SKY_PALETTES.noite;
  p.glow(moon.x, moon.y, moon.r + 1, moon.r * 2 + 1, moon.glow);
  p.disc(moon.x, moon.y, moon.r, moon.disc);
  p.disc(moon.x + 3, moon.y - 2, moon.r - 1, moon.cut);
  // Sorteia x antes de y e só então a cor, na ordem do esboço, para o céu de 142 colunas bater com ele.
  const count = Math.round((STARS_PER_142 * width) / 142);
  for (let i = 0; i < count; i++) {
    const x = rnd() * width;
    const y = rnd() * 44;
    p.px(x, y, rnd() > 0.6 ? stars[0] : stars[1]);
  }
  for (const [x, y] of BRIGHT_STARS) {
    p.px(x, y, brightStar.core);
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) p.px(x + dx, y + dy, brightStar.rays);
  }
}

/** Pinta o céu do topo até a linha do chão, na largura toda. É sempre a primeira coisa pintada na cena. */
export function paintSky(p: Painter, sky: SkyPhase, width: number, rnd: () => number): void {
  p.gradV(0, GROUND_Y, SKY_PALETTES[sky].gradient);
  if (sky === 'noite') {
    paintNight(p, width, rnd);
    return;
  }
  const palette = SKY_PALETTES[sky];
  paintSun(p, palette.sun);
  paintClouds(p, width, palette.clouds);
}
