import type { Painter } from './pixelBuffer';

/**
 * Peças de cenário que mais de um lugar usa (nuvem, pinheiro, tufo de grama, espiga), com as cores sempre vindas
 * de quem chama: a mesma forma serve de dia, de noite e com neve. Formas portadas do esboço `coluna-v2.html`.
 */

export interface CloudColors {
  body: string;
  /** Pixel mais baixo de cada coluna: a barriga sombreada da nuvem. */
  shade: string;
}

// Quatro bolhas (deslocamento x, deslocamento y, raio) que, achatadas embaixo, formam a nuvem do esboço.
const CLOUD_PUFFS = [
  [0, 3, 3],
  [4, 1, 4],
  [9, 2, 3.5],
  [13, 4, 2.5],
] as const;

/** Nuvem de base reta com `scale` 1 ocupando cerca de 17 × 8 pixels a partir de (x, y). */
export function cloud(p: Painter, x: number, y: number, scale: number, colors: CloudColors): void {
  // 1. junta as bolhas numa máscara (base cortada uma linha abaixo do centro de cada bolha)
  const mask = new Map<string, [number, number]>();
  for (const [dx, dy, radius] of CLOUD_PUFFS) {
    const r = radius * scale;
    for (let yy = -r; yy <= r; yy++) {
      for (let xx = -r; xx <= r; xx++) {
        if (xx * xx + yy * yy > r * r || yy > 1) continue;
        const cx = (x + dx * scale + xx) | 0;
        const cy = (y + dy * scale + yy) | 0;
        mask.set(`${cx},${cy}`, [cx, cy]);
      }
    }
  }
  // 2. acha o pixel mais baixo de cada coluna, que leva a sombra
  const lowest = new Map<number, number>();
  for (const [cx, cy] of mask.values()) lowest.set(cx, Math.max(lowest.get(cx) ?? -1, cy));
  // 3. pinta
  for (const [cx, cy] of mask.values()) p.px(cx, cy, cy === lowest.get(cx) ? colors.shade : colors.body);
}

export interface PineColors {
  trunk: string;
  /** Metade esquerda da copa (lado da sombra). */
  shade: string;
  /** Metade direita da copa. */
  light: string;
  /** Neve pontilhada na borda de cada andar; sem ela, pinheiro sem neve. */
  snow?: string;
  /** Estrela de 2 pixels na ponta; sem ela, ponta lisa. */
  star?: string;
}

/**
 * Pinheiro em andares de 5 linhas, cada andar mais largo que o de cima. `x` é a coluna esquerda do tronco (2 de
 * largura), `base` a linha onde o tronco toca o chão e `height` a altura da copa.
 */
export function pine(p: Painter, x: number, base: number, height: number, colors: PineColors): void {
  p.rect(x, base - 3, 2, 3, colors.trunk);
  const top = base - 3 - height;
  for (let r = 0; r < height; r++) {
    const tier = r % 5;
    const w = tier + Math.floor(r / 5) * 2;
    for (let i = -w; i <= w + 1; i++) p.px(x + i, top + r, i <= 0 ? colors.shade : colors.light);
    if (tier !== 0 || !colors.snow) continue;
    for (let i = -w; i <= w + 1; i++) if ((i + r) % 2 === 0) p.px(x + i, top + r, colors.snow);
  }
  if (!colors.star) return;
  p.px(x, top - 1, colors.star);
  p.px(x + 1, top - 1, colors.star);
}

/** Tufo de grama de 5 × 3 que vai na camada da frente, para o chão ter primeiro plano. */
export const TUFT = ['.x.x.', 'x.xx.', 'xxxxx'] as const;

/** Espiga de trigo de 1 × 4 (claro e escuro alternados), posta no alto do talo. */
export const WHEAT_HEAD = ['y', 'Y', 'y', 'Y'] as const;

/**
 * Tufos espalhados pela largura: cada ponto é (fração da largura, linha), para que a frente acompanhe a janela
 * larga ou estreita sem amontoar.
 */
export function scatterTufts(
  p: Painter,
  width: number,
  spots: readonly (readonly [fraction: number, y: number])[],
  color: string,
): void {
  for (const [fraction, y] of spots) p.map(TUFT, { x: color }, Math.round(fraction * width), y);
}

/** Trigo com talo de `height` pixels e espiga em cima, com o pé na linha `footY`. */
export function wheat(p: Painter, x: number, footY: number, height: number, colors: { stalk: string; light: string; dark: string }): void {
  p.rect(x, footY - height + 1, 1, height, colors.stalk);
  p.map(WHEAT_HEAD, { y: colors.light, Y: colors.dark }, x, footY - height - 3);
}

/**
 * Morro (ou serra) com o topo dado coluna a coluna, cheio até a linha `to`, com borda clara de 1 pixel no topo.
 * Serve quando a soma de senos de `hills` não basta: morro que baixa perto do relógio, montanha com pico.
 */
export function ridge(
  p: Painter,
  width: number,
  topAt: (x: number) => number,
  colors: { fill: string; edge: string },
  to: number,
): void {
  for (let x = 0; x < width; x++) {
    const top = Math.round(topAt(x));
    p.rect(x, top, 1, to - top + 1, colors.fill);
    p.px(x, top, colors.edge);
  }
}

/** Transição suave de 0 a 1 (sem degrau), para formas que mudam de altura ao longo da largura. */
export function smoothstep(edge0: number, edge1: number, value: number): number {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}
