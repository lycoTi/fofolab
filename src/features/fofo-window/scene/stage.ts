import type { Painter } from './pixelBuffer';
import { GROUND_Y } from './pixelBuffer';

/**
 * Onde as coisas ficam na janela, em pixels do cenário. A largura varia com a coluna (102 a 242 pixels), então
 * nada é posicionado pela largura do esboço: o Fofo e o que passa na frente dele ficam presos à esquerda; o que é
 * do fundo e fica à direita se prende à borda direita, baixo, para não ficar atrás dos dígitos do relógio.
 */

/** Fofo de 32 pixels com os pés (linha 30 do sprite) 6 linhas dentro do chão. */
export const FOFO_SLOT = { x: 5, feetY: GROUND_Y + 6 } as const;

/** Ponto entre os pés do Fofo: centro da sombra no chão. */
export const FOFO_FOOT = { x: FOFO_SLOT.x + 15, y: FOFO_SLOT.feetY } as const;

/** Canto do relógio (HTML por cima): só céu nas últimas 72 colunas, das linhas 5 a 45. */
export const CLOCK_AREA = { columns: 72, top: 5, bottom: 45 } as const;

/** Primeira coluna da área do relógio nesta largura; dali para a direita, acima da linha 46, só céu. */
export function clockLeft(width: number): number {
  return width - CLOCK_AREA.columns;
}

/** Linha mais alta que a paisagem pode ocupar debaixo do relógio. */
export const UNDER_CLOCK_TOP = CLOCK_AREA.bottom + 1;

export interface LandscapeContext {
  width: number;
  rnd: () => number;
}

/** Uma paisagem pinta o fundo (atrás do Fofo, já com a sombra dele) e a frente (o que passa diante dele). */
export interface LandscapePainter {
  back(p: Painter, ctx: LandscapeContext): void;
  front(p: Painter, ctx: LandscapeContext): void;
}
