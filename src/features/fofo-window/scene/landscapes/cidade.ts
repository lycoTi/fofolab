import { GROUND_Y as GY, type Painter } from '../pixelBuffer';
import { scatterTufts } from '../props';
import { FOFO_FOOT, clockLeft, type LandscapePainter } from '../stage';

/**
 * Cidade da madrugada (22:00 ao nascer do sol): prédios ao fundo com janelas acesas, morro escuro e um poste
 * cuja luz faz uma poça no chão onde o Fofo está. Cores e formas do esboço `coluna-v2.html`.
 */

/** Os prédios começam depois do Fofo e do poste. */
const SKYLINE_START = 52;
/**
 * Altura sorteada além das 6 linhas mínimas. Prédio inteiro fora do relógio sobe até 19 linhas (topo na 43);
 * prédio que entra debaixo do relógio fica com até 16 (topo na 46).
 */
const TALL_EXTRA = 14;
const LOW_EXTRA = 11;

function paintSkyline(p: Painter, width: number, rnd: () => number): void {
  let bx = SKYLINE_START;
  while (bx < width) {
    // Sorteia na ordem do esboço (largura, altura, cor, janelas) para a janela de 142 colunas lembrar ele.
    const bw = 5 + ((rnd() * 6) | 0);
    let extra = LOW_EXTRA;
    if (bx + bw <= clockLeft(width)) extra = TALL_EXTRA;
    const bh = 6 + ((rnd() * extra) | 0);
    p.rect(bx, GY - bh, bw, bh + 1, rnd() > 0.5 ? '#0d1232' : '#10163a');
    for (let y = GY - bh + 2; y < GY - 1; y += 2) {
      for (let x = bx + 1; x < bx + bw - 1; x += 2) {
        const v = rnd();
        if (v < 0.13) p.px(x, y, '#f3cf7a');
        else if (v < 0.17) p.px(x, y, '#7f8be0');
      }
    }
    bx += bw + 1;
  }
}

/** Centro da poça: sob os pés do Fofo, larga o bastante para aparecer dos dois lados dele. */
const POOL_X = FOFO_FOOT.x;

/**
 * Poste à esquerda do Fofo com um braço reto que avança por cima dele e a lâmpada pendurada na ponta. No esboço o
 * poste ficava à direita (coluna 46, topo na linha 36), o que cai debaixo do relógio na coluna estreita; à esquerda
 * ele cabe em qualquer largura.
 */
function paintStreetLamp(p: Painter): void {
  const post = '#2a2f55';
  p.rect(2, GY - 30, 1, 34, post);
  p.rect(2, GY - 30, 10, 1, post);
  p.rect(9, GY - 29, 5, 2, post);
  p.rect(10, GY - 27, 3, 1, '#ffe6a0');
  p.glow(11, GY - 26, 1, 6, '#3a3a5c');
}

export const cidade: LandscapePainter = {
  back(p, { width, rnd }) {
    // 1. prédios e morro escuro na frente deles
    paintSkyline(p, width, rnd);
    p.hills(58, [[1.5, 0.08, 0], [1, 0.21, 1]], '#0a0d24', '#161b3d');
    // 2. chão e poça de luz em dois tons pontilhados
    p.ground('#10142c', '#262d58', '#0c1024', '#0a0d20', rnd);
    p.ellipse(POOL_X, GY + 6, 32, 6, '#1c2250', 1.1);
    p.ellipse(POOL_X, GY + 6, 22, 4, '#262d62', 1.1);
    // 3. poste e sombra do Fofo
    paintStreetLamp(p);
    p.ellipse(FOFO_FOOT.x, FOFO_FOOT.y, 11, 2, '#0a0d22');
  },
  front(p, { width }) {
    scatterTufts(p, width, [[2 / 142, 76], [58 / 142, 75], [90 / 142, 77], [128 / 142, 76]], '#0a0d22');
  },
};
