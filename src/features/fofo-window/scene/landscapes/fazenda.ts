import { GROUND_Y as GY, type Painter } from '../pixelBuffer';
import { ridge, scatterTufts, smoothstep, wheat } from '../props';
import { FOFO_FOOT, UNDER_CLOCK_TOP, clockLeft, type LandscapePainter } from '../stage';

/**
 * Fazenda do Fofo fazendeiro (do nascer ao pôr do sol): morros verdes, cerca, plantação de trigo, celeiro à
 * direita, trilha de terra onde o Fofo pisa e trigo na frente dele. Cores e formas do esboço `coluna-v2.html`.
 */

const STALK = '#a88f3a';
const WHEAT_FIELD = { stalk: STALK, light: '#e6b84c', dark: '#c8932f' };
const WHEAT_FRONT = { stalk: STALK, light: '#f0c55a', dark: '#c8932f' };

/** Distância do celeiro à borda direita (no esboço de 142 colunas ele começa na coluna 104). */
const BARN_FROM_RIGHT = 38;
const BARN = { width: 22, wall: 9, roofRows: 7 };
/** A cerca e a plantação começam logo depois do trigo da frente. */
const FIELD_START = 56;

/**
 * Celeiro baixo: parede de 9 linhas e telhado de 7, para o topo ficar na linha 46, abaixo do relógio (o do
 * esboço tinha 19 linhas e subia até a linha 43).
 */
function paintBarn(p: Painter, bx: number): void {
  const { width: bw, wall: bh, roofRows } = BARN;
  // 1. parede com tábuas
  p.rect(bx, GY - bh, bw, bh, '#a8432f');
  for (let i = bx + 1; i < bx + bw; i += 3) p.rect(i, GY - bh, 1, bh, '#923826');
  // 2. telhado em degraus: 3 linhas que recuam 1 pixel e as demais 2 pixels, beiral mais escuro
  for (let r = 0; r < roofRows; r++) {
    let inset = r;
    if (r >= 3) inset = 3 + (r - 3) * 2;
    p.rect(bx - 1 + inset, GY - bh - 1 - r, bw + 2 - inset * 2, 1, r === 0 ? '#4a2018' : '#5e2a20');
  }
  // 3. porta com o X branco e o alçapão do feno no telhado
  p.rect(bx + 8, GY - 7, 6, 7, '#7a2c1e');
  for (let i = 0; i < 6; i++) {
    p.px(bx + 8 + i, GY - 7 + i, '#f2e8dc');
    p.px(bx + 13 - i, GY - 7 + i, '#f2e8dc');
  }
  p.rect(bx + 8, GY - 7, 6, 1, '#f2e8dc');
  p.rect(bx + 9, GY - bh - 4, 4, 2, '#f2e8dc');
}

/**
 * Topo do morro de trás: o do esboço (até a linha 42) à esquerda, baixando com suavidade nas 24 colunas antes do
 * relógio; debaixo dele nunca passa da linha 46.
 */
function backHillTop(width: number): (x: number) => number {
  const left = clockLeft(width);
  return (x) => {
    const wave = 3 * Math.sin(x * 0.05 + 1) + 2 * Math.sin(x * 0.11 + 3);
    const lift = 3.5 * (1 - smoothstep(left - 24, left, x));
    const top = 50.5 - lift + wave;
    if (x < left) return top;
    return Math.max(UNDER_CLOCK_TOP, top);
  };
}

function paintFence(p: Painter, end: number): void {
  for (let x = FIELD_START; x < end; x++) {
    if ((x - FIELD_START) % 6 === 0) p.rect(x, GY - 5, 1, 6, '#7a5a35');
    p.px(x, GY - 4, '#9a7448');
    p.px(x, GY - 2, '#9a7448');
  }
}

/** Trilha de terra ondulada que atravessa a janela na altura dos pés do Fofo. */
function paintDirtPath(p: Painter, width: number, rnd: () => number): void {
  for (let x = 0; x < width; x++) {
    const top = GY + 7 + Math.round(Math.sin(x * 0.09) * 1.2);
    const h = 4 + Math.round(Math.sin(x * 0.05 + 1));
    p.rect(x, top, 1, h, '#a5814f');
    p.px(x, top, '#bf9a63');
    if (rnd() > 0.85) p.px(x, top + 2, '#8c6b40');
  }
}

export const fazenda: LandscapePainter = {
  back(p, { width, rnd }) {
    const bx = width - BARN_FROM_RIGHT;
    // 1. morros
    ridge(p, width, backHillTop(width), { fill: '#86b663', edge: '#a3cf7c' }, GY);
    p.hills(54, [[2, 0.07, 2], [1, 0.17, 0]], '#6a9c45', '#84b85a');
    // 2. celeiro e cerca
    paintBarn(p, bx);
    paintFence(p, bx - 2);
    // 3. chão com capim na borda e a trilha de terra
    p.ground('#5d8c33', '#7fae4a', '#4f7a2a', '#456c24', rnd);
    for (let x = 0; x < width; x += 2) if (rnd() > 0.4) p.px(x, GY - 1, '#7fae4a');
    paintDirtPath(p, width, rnd);
    // 4. plantação entre a cerca e o celeiro
    for (let x = FIELD_START + 4; x < bx - 4; x += 2) wheat(p, x, GY, 3 + (x % 4 === 0 ? 1 : 0), WHEAT_FIELD);
    // 5. sombra do Fofo na terra
    p.ellipse(FOFO_FOOT.x, FOFO_FOOT.y + 1, 11, 2, '#7d613a');
  },
  front(p, { width }) {
    for (let x = 38; x < 54; x += 2) wheat(p, x, GY + 7, 5 + (x % 4 === 0 ? 2 : 0), WHEAT_FRONT);
    scatterTufts(p, width, [[0, 76], [62 / 142, 77], [96 / 142, 76], [130 / 142, 77]], '#4a7a28');
  },
};
