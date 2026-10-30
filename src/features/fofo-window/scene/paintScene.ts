import type { Landscape, SceneView } from '../sceneView';
import { cidade } from './landscapes/cidade';
import { fazenda } from './landscapes/fazenda';
import { trilha } from './landscapes/trilha';
import { SCENE_HEIGHT, createBuffer, painter, seeded, type PixelBuffer } from './pixelBuffer';
import { paintSky } from './sky';
import { FOFO_FOOT, type LandscapePainter } from './stage';

export { FOFO_SLOT } from './stage';

/** Semente da cena: a janela sai igual em qualquer máquina e a cada repintura. */
const SCENE_SEED = 11;

const LANDSCAPES: Record<Landscape, LandscapePainter> = {
  fazenda,
  cidade,
  trilha,
};

/**
 * Pinta a janela do Fofo em duas camadas: `back` (céu, paisagem, chão e a sombra do Fofo) fica atrás do sprite e
 * `front` (o que passa na frente dele, como trigo e tufos) fica por cima. Determinística: mesma cena e mesma
 * largura dão sempre o mesmo desenho. Céu, fundo e frente têm cada um o seu sorteio (sementes vizinhas), para que
 * a troca do céu (estrelas só à noite) não mude os prédios, o chão nem a frente.
 */
export function paintScene(view: SceneView, widthCells: number): { back: PixelBuffer; front: PixelBuffer } {
  const width = Math.max(1, Math.floor(widthCells));
  const back = createBuffer(width, SCENE_HEIGHT);
  const front = createBuffer(width, SCENE_HEIGHT);
  const landscape = LANDSCAPES[view.landscape];

  const behind = painter(back);
  paintSky(behind, view.sky, width, seeded(SCENE_SEED));
  landscape.back(behind, { width, rnd: seeded(SCENE_SEED + 1) });
  landscape.front(painter(front), { width, rnd: seeded(SCENE_SEED + 2) });

  return { back, front };
}
