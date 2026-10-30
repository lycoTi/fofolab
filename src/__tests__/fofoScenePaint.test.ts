import { describe, expect, it } from 'vitest';
import { FOFO_SLOT, paintScene } from '../features/fofo-window/scene/paintScene';
import {
  GROUND_Y,
  SCENE_HEIGHT,
  bufferDigest,
  createBuffer,
  painter,
  seeded,
  type PixelBuffer,
} from '../features/fofo-window/scene/pixelBuffer';
import { SKY_PALETTES, paintSky } from '../features/fofo-window/scene/sky';
import type { Landscape, SceneView, SkyPhase } from '../features/fofo-window/sceneView';

const SKIES: SkyPhase[] = ['dia', 'dourado', 'noite'];
const DRAWN: Landscape[] = ['fazenda', 'cidade'];
const ALL: Landscape[] = ['fazenda', 'cidade', 'trilha'];
// Coluna de 240 px, a do esboço e a de 520 px.
const WIDTHS = [102, 142, 242];

// Área do relógio no canto superior direito (spec 6.2, item 7).
const CLOCK_COLUMNS = 72;
const CLOCK_TOP = 5;
const CLOCK_BOTTOM = 45;

const view = (over: Partial<SceneView>): SceneView => ({
  sky: 'dia',
  landscape: 'fazenda',
  festival: null,
  moment: 'acordado',
  subjectColor: null,
  ...over,
});

const at = (buf: PixelBuffer, x: number, y: number) => buf.pixels[y * buf.width + x];
const colorsOf = (buf: PixelBuffer) => new Set(buf.pixels.filter((c): c is string => c !== null));

function luminance(hex: string): number {
  const n = Number.parseInt(hex.slice(1), 16);
  return 0.2126 * ((n >> 16) & 255) + 0.7152 * ((n >> 8) & 255) + 0.0722 * (n & 255);
}

/** Cor mais comum de uma linha na metade direita, longe do Fofo: a cor do chão daquela paisagem. */
function groundColor(buf: PixelBuffer, y: number): string {
  const count = new Map<string, number>();
  for (let x = Math.floor(buf.width / 2); x < buf.width; x++) {
    const c = at(buf, x, y);
    if (c) count.set(c, (count.get(c) ?? 0) + 1);
  }
  return [...count.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

/** Só o céu, pintado do mesmo jeito que a cena começa (mesma semente). */
function skyOnly(sky: SkyPhase, width: number): PixelBuffer {
  const buf = createBuffer(width, SCENE_HEIGHT);
  paintSky(painter(buf), sky, width, seeded(11));
  return buf;
}

describe('cenário pintado: céu, fazenda e cidade', () => {
  it('o Fofo fica à esquerda com os pés 6 linhas dentro do chão', () => {
    expect(FOFO_SLOT).toEqual({ x: 5, feetY: GROUND_Y + 6 });
  });

  it('pintar a mesma cena duas vezes dá o mesmo desenho', () => {
    for (const landscape of ALL) {
      for (const sky of SKIES) {
        const a = paintScene(view({ landscape, sky }), 142);
        const b = paintScene(view({ landscape, sky }), 142);
        expect(bufferDigest(a.back), `${landscape}/${sky}`).toBe(bufferDigest(b.back));
        expect(bufferDigest(a.front), `${landscape}/${sky}`).toBe(bufferDigest(b.front));
      }
    }
  });

  it('nas larguras da coluna, a camada de trás cobre a janela inteira e a da frente tem o mesmo tamanho', () => {
    for (const width of WIDTHS) {
      for (const landscape of ALL) {
        const { back, front } = paintScene(view({ landscape, sky: 'dourado' }), width);
        expect([back.width, back.height]).toEqual([width, SCENE_HEIGHT]);
        expect([front.width, front.height]).toEqual([width, SCENE_HEIGHT]);
        expect(back.pixels.every((c) => c !== null), `${landscape} em ${width}`).toBe(true);
      }
    }
  });

  it('dia, dourado e noite dão céus diferentes', () => {
    for (const landscape of DRAWN) {
      const digests = SKIES.map((sky) => bufferDigest(paintScene(view({ landscape, sky }), 142).back));
      expect(new Set(digests).size).toBe(3);
    }
  });

  it('trocar só o céu não mexe na paisagem: chão e frente ficam iguais', () => {
    for (const width of WIDTHS) {
      for (const landscape of ALL) {
        const [first, ...others] = SKIES.map((sky) => paintScene(view({ landscape, sky }), width));
        const groundOf = (buf: PixelBuffer) => buf.pixels.slice(GROUND_Y * width);
        for (const other of others) {
          expect(groundOf(other.back), `${landscape} em ${width}`).toEqual(groundOf(first.back));
          expect(other.front.pixels, `${landscape} em ${width}`).toEqual(first.front.pixels);
        }
      }
    }
  });

  it('há sombra sob os pés do Fofo, mais escura que o chão, na fazenda e na cidade', () => {
    const foot = { x: FOFO_SLOT.x + 15, y: FOFO_SLOT.feetY };
    for (const width of WIDTHS) {
      for (const landscape of DRAWN) {
        for (const sky of SKIES) {
          const { back } = paintScene(view({ landscape, sky }), width);
          const shadow = at(back, foot.x, foot.y);
          const label = `${landscape}/${sky} em ${width}`;
          expect(shadow, label).not.toBeNull();
          expect(luminance(shadow as string), label).toBeLessThan(luminance(groundColor(back, GROUND_Y + 3)));
        }
      }
    }
  });

  it('na área do relógio só há céu: nada da paisagem nem da frente', () => {
    for (const width of WIDTHS) {
      const sky = skyOnly('dia', width);
      for (const skyPhase of SKIES) {
        const reference = skyPhase === 'dia' ? sky : skyOnly(skyPhase, width);
        for (const landscape of ALL) {
          const { back, front } = paintScene(view({ landscape, sky: skyPhase }), width);
          for (let y = CLOCK_TOP; y <= CLOCK_BOTTOM; y++) {
            for (let x = width - CLOCK_COLUMNS; x < width; x++) {
              const label = `${landscape}/${skyPhase} em ${width}: (${x}, ${y})`;
              expect(at(back, x, y), label).toBe(at(reference, x, y));
              expect(at(front, x, y), label).toBeNull();
            }
          }
        }
      }
    }
  });

  it('de noite não há sol; de dia não há estrelas nem lua', () => {
    const suns = [SKY_PALETTES.dia, SKY_PALETTES.dourado].flatMap((p) => [p.sun.disc, p.sun.core]);
    const night = SKY_PALETTES.noite;
    for (const landscape of DRAWN) {
      const nightColors = colorsOf(paintScene(view({ landscape, sky: 'noite' }), 142).back);
      for (const color of suns) expect(nightColors.has(color), `${landscape} noite: ${color}`).toBe(false);
      expect(nightColors.has(night.moon.disc)).toBe(true);
      expect(night.stars.some((c) => nightColors.has(c))).toBe(true);

      const dayColors = colorsOf(paintScene(view({ landscape, sky: 'dia' }), 142).back);
      expect(dayColors.has(SKY_PALETTES.dia.sun.disc)).toBe(true);
      expect(dayColors.has(night.moon.disc), `${landscape} dia: lua`).toBe(false);
      for (const color of night.stars) expect(dayColors.has(color), `${landscape} dia: ${color}`).toBe(false);
    }
  });

  it('o centro do sol tem o miolo claro, de dia e no dourado', () => {
    for (const sky of ['dia', 'dourado'] as const) {
      const { sun } = SKY_PALETTES[sky];
      const { back } = paintScene(view({ landscape: 'fazenda', sky }), 142);
      expect(at(back, sun.x, sun.y), sky).toBe(sun.core);
    }
  });

  it('a frente tem trigo e tufos diante do Fofo na fazenda e fica vazia acima do chão', () => {
    const { front } = paintScene(view({ landscape: 'fazenda' }), 142);
    let wheatInFront = 0;
    for (let y = GROUND_Y - 4; y < SCENE_HEIGHT; y++) {
      for (let x = FOFO_SLOT.x + 32; x < FOFO_SLOT.x + 50; x++) if (at(front, x, y)) wheatInFront++;
    }
    expect(wheatInFront).toBeGreaterThan(10);
    for (let y = 0; y < GROUND_Y - 8; y++) {
      for (let x = 0; x < front.width; x++) expect(at(front, x, y)).toBeNull();
    }
  });

  it('a cidade acende uma poça de luz no chão onde o Fofo está, mais clara que o chão longe dele', () => {
    for (const width of WIDTHS) {
      const { back } = paintScene(view({ landscape: 'cidade', sky: 'noite' }), width);
      const far = luminance(groundColor(back, GROUND_Y + 3));
      let lit = 0;
      for (let x = FOFO_SLOT.x; x < FOFO_SLOT.x + 32; x++) {
        const c = at(back, x, GROUND_Y + 3);
        if (c && luminance(c) > far) lit++;
      }
      expect(lit, `largura ${width}`).toBeGreaterThan(8);
    }
  });

  it('a cerca da fazenda só aparece quando cabe: na janela estreita não sobra um toco', () => {
    const FENCE_POST = '#7a5a35';
    expect(colorsOf(paintScene(view({ landscape: 'fazenda' }), 102).back).has(FENCE_POST)).toBe(false);
    expect(colorsOf(paintScene(view({ landscape: 'fazenda' }), 142).back).has(FENCE_POST)).toBe(true);
  });

  it('a trilha ainda não tem desenho: só céu e chão, sem nada na frente', () => {
    for (const width of WIDTHS) {
      for (const sky of SKIES) {
        const { back, front } = paintScene(view({ landscape: 'trilha', sky }), width);
        const reference = skyOnly(sky, width);
        for (let y = 0; y < GROUND_Y; y++) {
          for (let x = 0; x < width; x++) expect(at(back, x, y)).toBe(at(reference, x, y));
        }
        expect(front.pixels.every((c) => c === null)).toBe(true);
      }
    }
  });
});
