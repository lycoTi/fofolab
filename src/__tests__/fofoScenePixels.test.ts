import { describe, expect, it } from 'vitest';
import {
  GROUND_Y,
  SCENE_HEIGHT,
  bayerThreshold,
  bufferDigest,
  createBuffer,
  painter,
  seeded,
  toPixelColor,
  type PixelBuffer,
} from '../features/fofo-window/scene/pixelBuffer';

// Impressão digital da cena composta, gravada antes de otimizar os pincéis: otimização não muda o desenho.
const GOLDEN_DIGEST = 'ac8b9f3f';

const at = (buf: PixelBuffer, x: number, y: number) => buf.pixels[y * buf.width + x];
const painted = (buf: PixelBuffer) => buf.pixels.filter((c) => c !== null).length;

describe('buffer de pixels do cenário', () => {
  it('cenário tem 80 linhas e o chão começa na linha 62', () => {
    expect(SCENE_HEIGHT).toBe(80);
    expect(GROUND_Y).toBe(62);
  });

  it('buffer novo nasce vazio e com o tamanho pedido', () => {
    const buf = createBuffer(5, 3);
    expect(buf.width).toBe(5);
    expect(buf.height).toBe(3);
    expect(buf.pixels).toHaveLength(15);
    expect(painted(buf)).toBe(0);
  });

  it('px fora da borda não escreve', () => {
    const buf = createBuffer(4, 4);
    const p = painter(buf);
    p.px(-1, 0, '#ffffff');
    p.px(0, -1, '#ffffff');
    p.px(4, 0, '#ffffff');
    p.px(0, 4, '#ffffff');
    expect(painted(buf)).toBe(0);
  });

  it('px trunca a coordenada e grava a cor em #rrggbb minúsculo', () => {
    const buf = createBuffer(4, 4);
    const p = painter(buf);
    p.px(1.9, 2.2, '#ABCDEF');
    p.px(3, 3, '#F0a');
    expect(at(buf, 1, 2)).toBe('#abcdef');
    expect(at(buf, 3, 3)).toBe('#ff00aa');
  });

  it('px sem cor não apaga o que já estava pintado', () => {
    const buf = createBuffer(2, 2);
    const p = painter(buf);
    p.px(0, 0, '#112233');
    p.px(0, 0, null);
    p.px(0, 0, '');
    expect(at(buf, 0, 0)).toBe('#112233');
  });

  it('cor fora do formato hexadecimal é erro (não pinta lixo calado)', () => {
    const p = painter(createBuffer(2, 2));
    expect(() => p.px(0, 0, 'rgba(0,0,0,.5)')).toThrow();
  });

  it('cor inválida é erro mesmo fora da borda (não depende da largura do buffer)', () => {
    const p = painter(createBuffer(2, 2));
    expect(() => p.px(-5, -5, 'rgba(0,0,0,.5)')).toThrow();
    expect(() => p.px(99, 0, 'laranja')).toThrow();
    expect(() => p.rect(10, 10, 2, 2, '#12')).toThrow();
  });

  it('rect pinta o retângulo e corta na borda', () => {
    const buf = createBuffer(4, 4);
    painter(buf).rect(2, 1, 5, 2, '#00ff00');
    expect(at(buf, 2, 1)).toBe('#00ff00');
    expect(at(buf, 3, 2)).toBe('#00ff00');
    expect(at(buf, 1, 1)).toBeNull();
    expect(at(buf, 2, 3)).toBeNull();
    expect(painted(buf)).toBe(4);
  });

  it('map pinta só os caracteres que têm cor na paleta', () => {
    const buf = createBuffer(4, 2);
    painter(buf).map(['a.b', 'zab'], { a: '#111111', b: '#222222' }, 1, 0);
    expect(at(buf, 1, 0)).toBe('#111111');
    expect(at(buf, 2, 0)).toBeNull();
    expect(at(buf, 3, 0)).toBe('#222222');
    expect(at(buf, 1, 1)).toBeNull();
    expect(at(buf, 2, 1)).toBe('#111111');
  });

  it('gradV com 2 cores: 1ª em cima, 2ª embaixo e Bayer 4x4 no meio', () => {
    const buf = createBuffer(4, 5);
    painter(buf).gradV(0, 5, ['#000000', '#ffffff']);
    for (let x = 0; x < 4; x++) {
      expect(at(buf, x, 0)).toBe('#000000');
      expect(at(buf, x, 4)).toBe('#ffffff');
    }
    // Linha 2 está no meio (50%); limiares Bayer da linha 2: 3, 11, 1, 9 (de 16).
    expect([0, 1, 2, 3].map((x) => at(buf, x, 2))).toEqual(['#ffffff', '#000000', '#ffffff', '#000000']);
  });

  it('limiar Bayer segue a matriz 4x4 e se repete a cada 4 pixels', () => {
    expect(bayerThreshold(0, 0)).toBeCloseTo(0.5 / 16);
    expect(bayerThreshold(1, 0)).toBeCloseTo(8.5 / 16);
    expect(bayerThreshold(2, 3)).toBeCloseTo(13.5 / 16);
    expect(bayerThreshold(6, 7)).toBe(bayerThreshold(2, 3));
  });

  it('disc pinta o disco cheio com a folga do esboço', () => {
    const buf = createBuffer(9, 9);
    painter(buf).disc(4, 4, 2, '#ffee00');
    expect(at(buf, 4, 4)).toBe('#ffee00');
    expect(at(buf, 6, 4)).toBe('#ffee00');
    // (2,1): 4 + 1 = 5 <= 4 + 1.6
    expect(at(buf, 6, 5)).toBe('#ffee00');
    // (2,2): 8 > 5.6
    expect(at(buf, 6, 6)).toBeNull();
    expect(at(buf, 7, 4)).toBeNull();
  });

  it('glow é um anel pontilhado: miolo vazio, perto do miolo cheio, borda rala', () => {
    const buf = createBuffer(21, 21);
    painter(buf).glow(10, 10, 3, 8, '#334455');
    expect(at(buf, 10, 10)).toBeNull();
    expect(at(buf, 12, 10)).toBeNull();
    // d = 4: força (1 - 1/5) * .85 = .68 > limiar Bayer de (14,10) = 1.5/16
    expect(at(buf, 14, 10)).toBe('#334455');
    // d = 8: força 0, nunca pinta
    expect(at(buf, 18, 10)).toBeNull();
    expect(at(buf, 19, 10)).toBeNull();
  });

  it('ellipse cheia e pontilhada', () => {
    const solid = createBuffer(11, 5);
    painter(solid).ellipse(5, 2, 4, 1, '#aa0000');
    expect(at(solid, 1, 2)).toBe('#aa0000');
    expect(at(solid, 9, 2)).toBe('#aa0000');
    expect(at(solid, 5, 1)).toBe('#aa0000');
    expect(at(solid, 0, 2)).toBeNull();
    expect(at(solid, 1, 1)).toBeNull();

    const dotted = createBuffer(11, 5);
    painter(dotted).ellipse(5, 2, 4, 1, '#aa0000', 1);
    // Na borda (v = 1) o pontilhado nunca pinta; no centro sempre.
    expect(at(dotted, 1, 2)).toBeNull();
    expect(at(dotted, 5, 2)).toBe('#aa0000');
  });

  it('ellipse com raio zero não pinta nada', () => {
    const buf = createBuffer(5, 5);
    const p = painter(buf);
    p.ellipse(2, 2, 0, 1, '#aa0000');
    p.ellipse(2, 2, 1, 0, '#aa0000');
    p.ellipse(2, 2, 0, 0, '#aa0000', 1);
    expect(painted(buf)).toBe(0);
  });

  it('hills pinta do topo da onda até a linha de baixo, com borda clara', () => {
    const buf = createBuffer(3, SCENE_HEIGHT);
    painter(buf).hills(50, [[0, 0, 0]], '#336633', '#88cc88');
    for (let x = 0; x < 3; x++) {
      expect(at(buf, x, 49)).toBeNull();
      expect(at(buf, x, 50)).toBe('#88cc88');
      expect(at(buf, x, 51)).toBe('#336633');
      expect(at(buf, x, GROUND_Y)).toBe('#336633');
      expect(at(buf, x, GROUND_Y + 1)).toBeNull();
    }
  });

  it('hills soma as ondas de seno e respeita o limite de baixo', () => {
    const buf = createBuffer(2, SCENE_HEIGHT);
    // x = 0: 40 + 3·sen(π/2) = 43; x = 1: 40 + 3·sen(1 + π/2) ≈ 41.62 → 42
    painter(buf).hills(40, [[3, 1, Math.PI / 2]], '#111111', undefined, 45);
    expect(at(buf, 0, 42)).toBeNull();
    expect(at(buf, 0, 43)).toBe('#111111');
    expect(at(buf, 1, 42)).toBe('#111111');
    expect(at(buf, 1, 41)).toBeNull();
    expect(at(buf, 0, 45)).toBe('#111111');
    expect(at(buf, 0, 46)).toBeNull();
  });

  it('ground pinta o chão, a borda clara no topo e escurece para baixo', () => {
    const buf = createBuffer(8, SCENE_HEIGHT);
    painter(buf).ground('#5d8c33', '#7fae4a', '#4f7a2a', '#456c24', seeded(11), 0);
    expect(at(buf, 0, GROUND_Y - 1)).toBeNull();
    expect(at(buf, 3, GROUND_Y)).toBe('#7fae4a');
    expect(at(buf, 3, GROUND_Y + 1)).toBe('#5d8c33');
    // Até 9 linhas abaixo do topo não há escurecimento.
    expect(at(buf, 0, GROUND_Y + 9)).toBe('#5d8c33');
    expect(at(buf, 5, SCENE_HEIGHT - 1)).toBe('#456c24');
  });

  it('ground salpica a textura com o sorteio dado', () => {
    const buf = createBuffer(20, SCENE_HEIGHT);
    painter(buf).ground('#000000', '#111111', '#ff0000', '#000000', seeded(11), 30);
    expect(buf.pixels.filter((c) => c === '#ff0000').length).toBeGreaterThan(0);
    const again = createBuffer(20, SCENE_HEIGHT);
    painter(again).ground('#000000', '#111111', '#ff0000', '#000000', seeded(11), 30);
    expect(bufferDigest(again)).toBe(bufferDigest(buf));
  });
});

describe('cor vinda de dado do usuário', () => {
  it('toPixelColor normaliza #rgb e #rrggbb', () => {
    expect(toPixelColor('#ABCDEF', '#808080')).toBe('#abcdef');
    expect(toPixelColor('#F0a', '#808080')).toBe('#ff00aa');
  });

  it('toPixelColor devolve o substituto sem lançar quando a cor não serve', () => {
    expect(toPixelColor('rgb(10, 20, 30)', '#808080')).toBe('#808080');
    expect(toPixelColor('red', '#808080')).toBe('#808080');
    expect(toPixelColor('#11223344', '#808080')).toBe('#808080');
    expect(toPixelColor('', '#808080')).toBe('#808080');
    expect(toPixelColor(null, '#808080')).toBe('#808080');
    expect(toPixelColor(undefined, '#808080')).toBe('#808080');
  });

  it('toPixelColor normaliza o próprio substituto', () => {
    expect(toPixelColor(null, '#AbC')).toBe('#aabbcc');
  });
});

describe('desenho composto (trava de regressão)', () => {
  it('a mesma cena de pincéis mantém a impressão digital', () => {
    const buf = createBuffer(32, SCENE_HEIGHT);
    const p = painter(buf);
    const rnd = seeded(11);
    p.gradV(0, GROUND_Y, ['#3a7fbf', '#5fa0d6', '#cde3f2']);
    p.glow(10, 12, 4, 9, '#9fd0ee');
    p.disc(10, 12, 4, '#FFE27A');
    p.hills(47, [[3, 0.05, 1], [2, 0.11, 3]], '#86b663', '#a3cf7c');
    p.rect(20, 50, 6, 12, '#a8432f');
    p.map(['a.b', 'bab'], { a: '#f2e8dc', b: '#7a2c1e' }, 21, 46);
    p.ground('#5d8c33', '#7fae4a', '#4f7a2a', '#456c24', rnd, 40);
    p.ellipse(16, GROUND_Y + 6, 8, 2, '#7d613a');
    p.ellipse(16, GROUND_Y + 10, 6, 2, '#2c2340', 1.2);
    expect(bufferDigest(buf)).toBe(GOLDEN_DIGEST);
  });
});

describe('sorteio e impressão digital do buffer', () => {
  it('seeded(11) repete a sequência e fica entre 0 e 1', () => {
    const a = seeded(11);
    const b = seeded(11);
    const seqA = Array.from({ length: 20 }, a);
    const seqB = Array.from({ length: 20 }, b);
    expect(seqA).toEqual(seqB);
    for (const v of seqA) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it('seeded usa o mesmo sorteio do esboço (primeiro valor da semente 11)', () => {
    expect(seeded(11)()).toBeCloseTo(((11 * 9301 + 49297) % 233280) / 233280, 12);
  });

  it('sementes diferentes dão sequências diferentes', () => {
    expect(seeded(11)()).not.toBe(seeded(12)());
  });

  it('bufferDigest é igual para buffers pintados igual e muda com 1 pixel', () => {
    const paint = () => {
      const buf = createBuffer(16, 8);
      const p = painter(buf);
      p.gradV(0, 8, ['#102030', '#a0b0c0']);
      p.disc(8, 4, 2, '#ffee00');
      return buf;
    };
    const a = paint();
    const b = paint();
    expect(bufferDigest(a)).toBe(bufferDigest(b));
    painter(b).px(0, 0, '#102031');
    expect(bufferDigest(b)).not.toBe(bufferDigest(a));
  });

  it('bufferDigest diferencia pixel vazio de pixel pintado', () => {
    const a = createBuffer(2, 1);
    const b = createBuffer(2, 1);
    painter(b).px(1, 0, '#000000');
    expect(bufferDigest(a)).not.toBe(bufferDigest(b));
  });
});
