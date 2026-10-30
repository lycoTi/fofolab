import { GROUND_Y as GY, type Painter } from '../pixelBuffer';
import { pine, ridge, scatterTufts, smoothstep } from '../props';
import { FOFO_FOOT, UNDER_CLOCK_TOP, clockLeft, type LandscapePainter } from '../stage';

/**
 * Trilha do explorador (do pôr do sol às 22:00): montanhas em silhueta ao fundo, pinheiros,
 * trilha de terra rochosa, uma fogueira de acampamento acesa ao lado do Fofo iluminando o chão
 * e vegetação rústica na frente.
 */

/** Posição da fogueira de acampamento: à direita do Fofo, perto para aquecer. */
const CAMPFIRE = { x: 42, footY: GY + 5 };

/**
 * Topo da cordilheira de trás: montanhas com picos angulares de alturas variadas.
 * Antes da área do relógio o topo pode subir até a linha 35;
 * sob o relógio (x >= clockLeft) baixa suavemente para ficar em UNDER_CLOCK_TOP (46).
 */
function mountainBackTop(width: number): (x: number) => number {
  const left = clockLeft(width);
  return (x) => {
    // Três frequências para criar montanhas rochosas imponentes
    const p1 = Math.abs(((x * 0.065) % 2) - 1) * 12;
    const p2 = Math.abs((((x + 14) * 0.04) % 2) - 1) * 8;
    const peak = 34 + p1 + p2;
    const lift = 9 * (1 - smoothstep(left - 22, left, x));
    const top = peak - lift;
    if (x < left) return top;
    return Math.max(UNDER_CLOCK_TOP, top);
  };
}

/**
 * Topo dos morros intermediários: encostas rochosas que sustentam os pinheiros.
 */
function mountainMidTop(width: number): (x: number) => number {
  const left = clockLeft(width);
  return (x) => {
    const wave = 3 * Math.sin(x * 0.07 + 1.2) + 1.8 * Math.sin(x * 0.15 + 2.5);
    const top = 53 + wave;
    if (x < left) return top;
    return Math.max(UNDER_CLOCK_TOP + 2, top);
  };
}

const PINE_SILHOUETTE = {
  trunk: '#0a0d18',
  shade: '#0f1424',
  light: '#182138',
};

/** Pinta pinheiros em silhueta respeitando rigorosamente o teto da área do relógio. */
function paintPineSilhouettes(p: Painter, width: number): void {
  const left = clockLeft(width);

  // Pinheiros à esquerda atrás do Fofo
  pine(p, 1, GY - 2, 11, PINE_SILHOUETTE);
  pine(p, 25, GY - 4, 9, PINE_SILHOUETTE);

  // Pinheiro expressivo logo atrás da fogueira/direita
  const midX = 56;
  const midBase = GY - 2;
  const maxMidH = midX >= left ? Math.max(5, midBase - 3 - UNDER_CLOCK_TOP) : 14;
  pine(p, midX, midBase, maxMidH, PINE_SILHOUETTE);

  // Pinheiros distribuídos ao longo da largura (quando houver espaço)
  if (width >= 130) {
    const x75 = 75;
    const base75 = GY - 2;
    const h75 = x75 >= left ? Math.max(5, base75 - 3 - UNDER_CLOCK_TOP) : 12;
    pine(p, x75, base75, h75, PINE_SILHOUETTE);
  }
  if (width >= 180) {
    const x115 = 115;
    const base115 = GY - 3;
    const h115 = x115 >= left ? Math.max(5, base115 - 3 - UNDER_CLOCK_TOP) : 13;
    pine(p, x115, base115, h115, PINE_SILHOUETTE);
  }
}

/** Pinta a fogueira de acampamento em pixel art nítida: pedras, lenha, brasas e labaredas vivas. */
function paintCampfire(p: Painter): void {
  const cx = CAMPFIRE.x;
  const cy = CAMPFIRE.footY;

  // 1. Círculo de pedras rústicas na base
  p.px(cx - 5, cy, '#3e3b38');
  p.px(cx - 4, cy, '#5e5852');
  p.px(cx - 4, cy + 1, '#47423d');
  p.px(cx - 3, cy + 1, '#7a7269');
  p.px(cx + 3, cy + 1, '#7a7269');
  p.px(cx + 4, cy + 1, '#47423d');
  p.px(cx + 4, cy, '#5e5852');
  p.px(cx + 5, cy, '#3e3b38');
  p.px(cx - 2, cy + 2, '#47423d');
  p.px(cx + 2, cy + 2, '#47423d');

  // 2. Toras de lenha cruzadas em fogueira
  p.px(cx - 3, cy, '#3b2010');
  p.px(cx - 2, cy - 1, '#5a341a');
  p.px(cx - 1, cy - 2, '#7b4825');
  p.px(cx + 3, cy, '#3b2010');
  p.px(cx + 2, cy - 1, '#5a341a');
  p.px(cx + 1, cy - 2, '#7b4825');
  p.rect(cx - 1, cy, 3, 1, '#3b2010');

  // 3. Brasas incandescentes na base do fogo
  p.rect(cx - 2, cy - 1, 5, 1, '#c92a2a');
  p.rect(cx - 1, cy - 2, 3, 1, '#e8590c');

  // 4. Labaredas de fogo vivas (laranja, amarelo dourado e núcleo brilhante)
  p.px(cx - 2, cy - 3, '#f76707');
  p.px(cx - 1, cy - 3, '#fab005');
  p.px(cx, cy - 3, '#fff3bf');
  p.px(cx + 1, cy - 3, '#fab005');
  p.px(cx + 2, cy - 3, '#f76707');

  p.px(cx - 1, cy - 4, '#f76707');
  p.px(cx, cy - 4, '#fab005');
  p.px(cx + 1, cy - 4, '#f76707');

  p.px(cx, cy - 5, '#fab005');
  p.px(cx, cy - 6, '#ffd43b');
  p.px(cx - 1, cy - 5, '#f76707');

  // 5. Faíscas sutis subindo na brisa
  p.px(cx + 1, cy - 7, '#fab005');
  p.px(cx - 2, cy - 6, '#f76707');
}

/** Trilha de terra e pedregulhos batidos. */
function paintTrailPath(p: Painter, width: number, rnd: () => number): void {
  for (let x = 0; x < width; x++) {
    const top = GY + 6 + Math.round(Math.sin(x * 0.08) * 1.5);
    const h = 4 + Math.round(Math.sin(x * 0.04 + 2));
    p.rect(x, top, 1, h, '#3a3024');
    p.px(x, top, '#524434');
    if (rnd() > 0.75) p.px(x, top + 1, '#665541');
    if (rnd() > 0.9) p.px(x, top + 2, '#7a6850');
  }
}

export const trilha: LandscapePainter = {
  back(p, { width, rnd }) {
    // 1. Cordilheira de montanhas com picos
    ridge(p, width, mountainBackTop(width), { fill: '#16192c', edge: '#2b3254' }, GY);
    ridge(p, width, mountainMidTop(width), { fill: '#0f1222', edge: '#1d233e' }, GY);

    // 2. Pinheiros em silhueta
    paintPineSilhouettes(p, width);

    // 3. Chão com grama de montanha/terra e a trilha batida
    p.ground('#262017', '#3a3224', '#1f1a13', '#16130e', rnd);
    paintTrailPath(p, width, rnd);

    // 4. Luz quente acolhedora da fogueira projetada no chão e nos pés do Fofo
    const cx = CAMPFIRE.x;
    const cy = CAMPFIRE.footY;
    p.ellipse(cx, cy + 2, 28, 6, '#28170c', 1.0);
    p.ellipse(cx, cy + 1, 18, 4, '#381f10', 1.0);
    p.ellipse(cx, cy, 10, 3, '#4d2914', 1.1);
    p.glow(cx, cy - 3, 2, 8, '#3d2010');

    // 5. A fogueira de acampamento
    paintCampfire(p);

    // 6. Sombra do Fofo sobre a trilha
    p.ellipse(FOFO_FOOT.x, FOFO_FOOT.y, 11, 2, '#120f0a');
  },
  front(p, { width }) {
    // Tufos de vegetação rústica na frente
    scatterTufts(p, width, [[6 / 142, 76], [34 / 142, 77], [80 / 142, 76], [122 / 142, 77]], '#141812');
  },
};
