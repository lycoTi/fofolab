import { GROUND_Y as GY, type Painter } from '../pixelBuffer';
import { pine, ridge, scatterTufts, smoothstep } from '../props';
import { FOFO_FOOT, UNDER_CLOCK_TOP, clockLeft, type LandscapePainter } from '../stage';

/**
 * Trilha do explorador (do pôr do sol às 22:00): montanhas em silhueta ao fundo,
 * bosque de pinheiros, acampamento com barraca aconchegante, fogueira de pedras,
 * chaleira, tronco de assento, placa indicadora e trilha de terra rochosa.
 */

/**
 * Montanhas da cordilheira (ao fundo):
 * Ondulação orgânica e suave com multi-harmônicos naturais, descendo suavemente
 * à direita para ficar sempre >= 47 abaixo da área reservada do relógio.
 */
function mountainBackTop(width: number): (x: number) => number {
  const left = clockLeft(width);
  return (x: number) => {
    const lift = 11.0 * (1 - smoothstep(left - 32, left, x));
    const wave = 3.5 * Math.sin(x * 0.048 + 0.9) + 2.0 * Math.cos(x * 0.11 + 2.1);
    const top = 49.0 - lift + wave;
    if (x < left) return top;
    return Math.max(UNDER_CLOCK_TOP, top);
  };
}

/**
 * Encostas intermediárias com floresta alpina:
 */
function mountainMidTop(width: number): (x: number) => number {
  const left = clockLeft(width);
  return (x: number) => {
    const lift = 6.0 * (1 - smoothstep(left - 24, left, x));
    const wave = 2.5 * Math.sin(x * 0.07 + 1.8) + 1.5 * Math.cos(x * 0.14 + 0.5);
    const top = 54.0 - lift + wave;
    if (x < left) return top;
    return Math.max(UNDER_CLOCK_TOP + 2, top);
  };
}

const PINE_STYLE = {
  trunk: '#120c06',
  shade: '#132219',
  light: '#1f3627',
};

/**
 * Barraca de expedição triangular (A-Frame Canvas Tent):
 * Fica abaixo do relógio à direita, altura 12 (topo na linha 50, bem abaixo da linha 46).
 */
function paintTent(p: Painter, tx: number): void {
  const tw = 22;
  const th = 12;
  const by = GY;
  const ty = by - th;

  // 1. Corpo da lona triangular
  for (let r = 0; r < th; r++) {
    const w = Math.round((r / th) * (tw / 2));
    const y = ty + r;
    p.rect(tx + 10 - w, y, w + 1, 1, '#785632');
    p.rect(tx + 11, y, w + 1, 1, '#543b22');
  }

  // 2. Cumeeira de reforço
  for (let r = 0; r < th; r++) {
    p.px(tx + 10, ty + r, '#946d40');
  }

  // 3. Entrada da barraca com interior aconchegante iluminado a lanterna
  const ew = 6;
  const eh = 8;
  for (let r = 0; r < eh; r++) {
    const w = Math.round((r / eh) * (ew / 2));
    const y = by - eh + r;
    p.rect(tx + 10 - w, y, w * 2 + 1, 1, '#f59e0b');
    if (r >= 2 && r <= 5) {
      p.rect(tx + 10 - (w > 1 ? 1 : 0), y, w > 1 ? 3 : 1, 1, '#fef08a');
    }
    p.px(tx + 10 - w - 1, y, '#3d2a18');
    p.px(tx + 10 + w + 1, y, '#3d2a18');
  }

  // 4. Estacas e cordas (guy lines)
  p.px(tx - 3, by - 1, '#946d40');
  p.px(tx - 2, by - 2, '#543b22');
  p.px(tx - 1, by - 3, '#543b22');

  p.px(tx + tw + 3, by - 1, '#946d40');
  p.px(tx + tw + 2, by - 2, '#543b22');
  p.px(tx + tw + 1, by - 3, '#543b22');

  // 5. Caixote de madeira de suprimentos
  p.rect(tx - 6, by - 5, 5, 5, '#5c3517');
  p.rect(tx - 6, by - 5, 5, 1, '#78461f');
  p.px(tx - 4, by - 3, '#d97706');
}

/**
 * Placa de madeira indicando a trilha:
 */
function paintTrailSign(p: Painter, sx: number): void {
  const by = GY;
  p.rect(sx + 3, by - 10, 2, 10, '#3f2510');
  p.rect(sx - 1, by - 10, 8, 4, '#6b411d');
  p.rect(sx, by - 9, 7, 2, '#855227');
  p.px(sx - 2, by - 9, '#855227');
  p.px(sx - 2, by - 8, '#6b411d');
  p.px(sx + 1, by - 8, '#3f2510');
  p.px(sx + 3, by - 8, '#3f2510');
  p.px(sx + 5, by - 8, '#3f2510');
}

/**
 * Fogueira de acampamento em pixel art nítida e aconchegante:
 */
function paintCampfire(p: Painter): void {
  const cx = 44;
  const cy = GY + 4;

  // 1. Iluminação quente na terra (sem chuvisco ruidoso)
  p.ellipse(cx, cy + 1, 22, 5, '#3a1e08', 1.15);
  p.ellipse(cx, cy, 14, 3, '#5c2d0c', 1.15);
  p.ellipse(cx, cy, 8, 2, '#7c3810');

  // 2. Pedras de rio redondas ao redor do fogo
  const stones: [number, number, string, string][] = [
    [-6, 0, '#64748b', '#334155'],
    [-5, 2, '#64748b', '#334155'],
    [-2, 3, '#475569', '#1e293b'],
    [1, 3, '#64748b', '#334155'],
    [4, 2, '#64748b', '#334155'],
    [6, 0, '#64748b', '#334155'],
    [-4, -1, '#475569', '#1e293b'],
    [4, -1, '#475569', '#1e293b'],
  ];
  for (const [dx, dy, light, dark] of stones) {
    p.px(cx + dx, cy + dy, dark);
    p.px(cx + dx, cy + dy - 1, light);
  }

  // 3. Troncos cruzados na fogueira
  p.px(cx - 3, cy, '#78350f');
  p.px(cx - 2, cy - 1, '#92400e');
  p.px(cx - 1, cy - 2, '#b45309');
  p.px(cx + 3, cy, '#78350f');
  p.px(cx + 2, cy - 1, '#92400e');
  p.px(cx + 1, cy - 2, '#b45309');
  p.rect(cx - 2, cy, 5, 1, '#451a03');

  // 4. Brasas vivas na base
  p.rect(cx - 2, cy - 1, 5, 1, '#dc2626');
  p.rect(cx - 1, cy - 2, 3, 1, '#ea580c');

  // 5. Chamas vivas e bem recortadas
  p.px(cx - 2, cy - 3, '#f97316');
  p.px(cx - 1, cy - 3, '#facc15');
  p.px(cx, cy - 3, '#ffffff');
  p.px(cx + 1, cy - 3, '#facc15');
  p.px(cx + 2, cy - 3, '#f97316');

  p.px(cx - 1, cy - 4, '#f97316');
  p.px(cx, cy - 4, '#fef08a');
  p.px(cx + 1, cy - 4, '#f97316');

  p.px(cx, cy - 5, '#facc15');
  p.px(cx, cy - 6, '#fef08a');
  p.px(cx - 1, cy - 5, '#f97316');

  // Fagulhas subindo na brisa
  p.px(cx + 1, cy - 7, '#facc15');
  p.px(cx - 2, cy - 7, '#f97316');
  p.px(cx, cy - 9, '#facc15');

  // 6. Chaleira de ferro sobre pedra plana para ferver água
  const kx = cx - 9;
  const ky = cy;
  p.rect(kx, ky, 4, 2, '#475569');
  p.rect(kx, ky - 3, 4, 3, '#1e293b');
  p.px(kx - 1, ky - 2, '#334155');
  p.rect(kx + 1, ky - 4, 2, 1, '#d97706');
  p.px(kx + 1, ky - 5, '#94a3b8');
  p.px(kx + 2, ky - 6, '#cbd5e1');
}

/**
 * Tronco de madeira servindo de banco ao lado da fogueira
 */
function paintLogBench(p: Painter, lx: number): void {
  const ly = GY + 2;
  p.rect(lx, ly, 11, 4, '#4a2c16');
  p.rect(lx + 2, ly, 8, 1, '#784a28');
  p.rect(lx + 1, ly + 1, 9, 2, '#5e381c');
  p.rect(lx, ly, 2, 4, '#8a522a');
  p.px(lx + 1, ly + 1, '#a66838');
  p.px(lx, ly + 2, '#3b2010');
}

export const trilha: LandscapePainter = {
  back(p, { width, rnd }) {
    // 1. Cordilheira distante (suave e imponente)
    const mountainColors = { fill: '#1e162f', edge: '#382856' };
    ridge(p, width, mountainBackTop(width), mountainColors, GY);

    // 2. Encostas com floresta alpina
    const midColors = { fill: '#141022', edge: '#241a38' };
    ridge(p, width, mountainMidTop(width), midColors, GY);

    // 3. Pinheiros nas encostas
    const left = clockLeft(width);
    const maxPineH = (x: number, base: number, h: number) =>
      x >= left ? Math.min(h, base - 3 - UNDER_CLOCK_TOP) : h;

    // Bosque atrás do Fofo
    pine(p, 1, GY - 2, 13, PINE_STYLE);
    pine(p, 20, GY - 3, 10, PINE_STYLE);

    // Pinheiros perto do centro
    const base58 = GY - 2;
    pine(p, 58, base58, maxPineH(58, base58, 14), PINE_STYLE);

    // Pinheiros emoldurando a barraca à direita
    if (width >= 130) {
      const base12 = GY - 2;
      pine(p, width - 12, base12, maxPineH(width - 12, base12, 14), PINE_STYLE);
      const base40 = GY - 3;
      pine(p, width - 40, base40, maxPineH(width - 40, base40, 11), PINE_STYLE);
    }
    if (width >= 180) {
      const base68 = GY - 2;
      pine(p, width - 68, base68, maxPineH(width - 68, base68, 12), PINE_STYLE);
    }

    // 4. Barraca aconchegante à direita (em 120+ colunas)
    if (width >= 120) {
      const tentX = width - 36;
      paintTent(p, tentX);
    }

    // 5. Placa da trilha (seta de madeira)
    const signX = width >= 120 ? width - 48 : width - 20;
    if (signX > 54) {
      paintTrailSign(p, signX);
    }

    // 6. Chão de terra da trilha
    p.ground('#221912', '#36281c', '#1b130e', '#130e09', rnd);

    // 7. Trilha de terra batida e pedras
    for (let x = 0; x < width; x++) {
      const top = GY + 6 + Math.round(Math.sin(x * 0.08) * 1.4);
      const h = 4 + Math.round(Math.sin(x * 0.04 + 1.5));
      p.rect(x, top, 1, h, '#3a2b1e');
      p.px(x, top, '#523d2b');
      if (rnd() > 0.65) p.px(x, top + 1, '#664c36');
      if (rnd() > 0.85) p.px(x, top + 2, '#7a5e43');
    }

    // Pedras planas na trilha
    const steppingStones: [number, number][] = [
      [12, GY + 7],
      [26, GY + 8],
      [62, GY + 8],
      [76, GY + 7],
      [102, GY + 8],
    ];
    for (const [sx, sy] of steppingStones) {
      if (sx < width - 6) {
        p.rect(sx, sy, 3, 1, '#475569');
        p.px(sx + 1, sy - 1, '#64748b');
        p.px(sx + 2, sy, '#334155');
      }
    }

    // 8. Fogueira e tronco
    paintCampfire(p);
    paintLogBench(p, 56);

    // 9. Sombra do Fofo
    p.ellipse(FOFO_FOOT.x, FOFO_FOOT.y, 11, 2, '#120d08');
  },
  front(p, { width }) {
    scatterTufts(p, width, [[4 / 142, 76], [16 / 142, 77], [68 / 142, 76], [115 / 142, 77]], '#162414');

    // Moledro de pedras na frente
    const cairnX = 33;
    p.rect(cairnX, GY + 9, 3, 2, '#334155');
    p.px(cairnX + 1, GY + 8, '#475569');
    p.rect(cairnX, GY + 7, 2, 1, '#64748b');
  },
};
