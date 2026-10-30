import type { Landscape, SceneView } from '../sceneView';
import { cidade } from './landscapes/cidade';
import { fazenda } from './landscapes/fazenda';
import { SCENE_HEIGHT, createBuffer, painter, seeded, type PixelBuffer } from './pixelBuffer';
import { paintSky } from './sky';
import { FOFO_FOOT, type LandscapePainter } from './stage';

export { FOFO_SLOT } from './stage';

/**
 * Pinta a janela do Fofo em duas camadas: `back` (céu, paisagem, chão e a sombra do Fofo) fica atrás do sprite e
 * `front` (o que passa na frente dele, como trigo e tufos) fica por cima. Determinística: mesma cena e mesma
 * largura dão sempre o mesmo desenho, porque o sorteio tem semente fixa e é consumido sempre na mesma ordem
 * (céu, fundo, frente).
 */

/** Semente única da cena: a janela sai igual em qualquer máquina e a cada repintura. */
const SCENE_SEED = 11;

/**
 * A trilha do explorador ainda não tem desenho aprovado (spec 7.2): enquanto isso, a janela mostra o céu da hora e
 * um chão de terra liso com a sombra do Fofo, sem fingir montanhas nem fogueira.
 */
const bareGround: LandscapePainter = {
  back(p, { rnd }) {
    p.ground('#5a4a3a', '#76624c', '#4b3d30', '#3f3328', rnd);
    p.ellipse(FOFO_FOOT.x, FOFO_FOOT.y, 11, 2, '#2e251d');
  },
  front() {},
};

const LANDSCAPES: Record<Landscape, LandscapePainter> = {
  fazenda,
  cidade,
  trilha: bareGround,
};

export function paintScene(view: SceneView, widthCells: number): { back: PixelBuffer; front: PixelBuffer } {
  const width = Math.max(1, Math.floor(widthCells));
  const back = createBuffer(width, SCENE_HEIGHT);
  const front = createBuffer(width, SCENE_HEIGHT);
  const rnd = seeded(SCENE_SEED);
  const landscape = LANDSCAPES[view.landscape];

  const behind = painter(back);
  paintSky(behind, view.sky, width, rnd);
  landscape.back(behind, { width, rnd });
  landscape.front(painter(front), { width, rnd });

  return { back, front };
}
