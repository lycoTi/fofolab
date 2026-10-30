/**
 * Buffer de pixels do cenário da janela do Fofo e os pincéis que pintam nele.
 *
 * 1 pixel do buffer = 2 px de tela, igual ao Fofo de 64 px. Os pincéis repetem a semântica do motor de
 * pixel do esboço (`docs/specs/14-esbocos/coluna-v2.html`), mas escrevem num vetor em vez de num canvas:
 * assim o cenário é testável sem DOM e o mesmo desenho sai igual em qualquer máquina.
 *
 * Cores no buffer: sempre `'#rrggbb'` minúsculo (aceita `#rgb`/`#rrggbb` em qualquer caixa na entrada);
 * `null` é pixel vazio (transparente). Não há transparência parcial: degradês, brilhos e sombras do esboço
 * são pontilhados (Bayer 4×4) de cor sólida, então nenhum pincel precisa misturar cores.
 * Cor fora do formato é erro de programação e lança sempre, mesmo fora da borda; cor vinda de dado do
 * usuário passa antes por `toPixelColor`, que nunca lança.
 */

export interface PixelBuffer {
  width: number;
  height: number;
  pixels: (string | null)[];
}

/** Onda de morro: altura += amplitude · sen(x · frequência + fase). */
export type HillWave = readonly [amplitude: number, frequency: number, phase: number];

export type Palette = Readonly<Record<string, string>>;

export interface Painter {
  /** Um pixel; coordenada truncada (`| 0`); sem cor não faz nada; fora da borda não pinta. */
  px(x: number, y: number, color: string | null | undefined): void;
  /** Retângulo cheio, cortado na borda; largura/altura ≤ 0 não pinta. */
  rect(x: number, y: number, w: number, h: number, color: string): void;
  /** Mapa de texto: cada caractere com cor na paleta vira um pixel; `.` e caracteres sem cor ficam vazios. */
  map(rows: readonly string[], palette: Palette, x0: number, y0: number): void;
  /** Degradê vertical nas linhas `y0 … y1 − 1`, na largura toda, pontilhado entre as cores vizinhas. */
  gradV(y0: number, y1: number, stops: readonly string[]): void;
  /** Disco cheio de raio `r` (com a folga `r · 0,8` do esboço, que arredonda as bordas). */
  disc(cx: number, cy: number, r: number, color: string): void;
  /** Anel de brilho de `r0` a `r1`, cada vez mais ralo para fora (pontilhado). */
  glow(cx: number, cy: number, r0: number, r1: number, color: string): void;
  /** Elipse cheia; com `dither`, rala para a borda (quanto maior, mais rala). Raio zero não pinta. */
  ellipse(cx: number, cy: number, rx: number, ry: number, color: string, dither?: number): void;
  /** Morros pela soma de senos, cheios do topo até a linha `to` (padrão `GROUND_Y`); `highlight` no topo. */
  hills(base: number, parts: readonly HillWave[], color: string, highlight?: string, to?: number): void;
  /** Chão de `GROUND_Y` até o fim: borda clara, `specks` grãos de textura sorteados e escurecimento embaixo. */
  ground(color: string, highlight: string, texture: string, dark: string, rnd: () => number, specks?: number): void;
}

export const SCENE_HEIGHT = 80;
export const GROUND_Y = 62;

const BAYER_4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
];

/** Limiar do pontilhado ordenado (0…1) no pixel; repete a cada 4 pixels nos dois eixos. */
export function bayerThreshold(x: number, y: number): number {
  return (BAYER_4[y & 3][x & 3] + 0.5) / 16;
}

/** Sorteio determinístico (o mesmo gerador congruente do esboço), para o cenário sair igual sempre. */
export function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

export function createBuffer(width: number, height: number): PixelBuffer {
  return { width, height, pixels: new Array<string | null>(width * height).fill(null) };
}

/** Impressão digital FNV-1a (32 bits) do tamanho e dos pixels: compara desenhos sem guardar o buffer. */
export function bufferDigest(buf: PixelBuffer): string {
  let hash = 0x811c9dc5;
  const feed = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      hash ^= text.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
  };
  feed(`${buf.width}x${buf.height};`);
  for (const color of buf.pixels) feed(color === null ? '-;' : `${color};`);
  return (hash >>> 0).toString(16).padStart(8, '0');
}

const HEX_6 = /^#[0-9a-f]{6}$/;
const HEX_ANY = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

function parseColor(color: string): string | null {
  if (HEX_6.test(color)) return color;
  if (!HEX_ANY.test(color)) return null;
  const hex = color.slice(1).toLowerCase();
  if (hex.length === 6) return `#${hex}`;
  return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`;
}

function normalizeColor(color: string): string {
  const parsed = parseColor(color);
  if (parsed === null) throw new Error(`Cor fora do formato #rrggbb: ${color}`);
  return parsed;
}

/**
 * Cor de dado do usuário (ex.: cor da matéria) pronta para o buffer: `'#rrggbb'` minúsculo ou, se não servir
 * (vazia, `rgb()`, nome, com transparência), o substituto. Nunca lança, porque dado salvo não pode derrubar a tela.
 */
export function toPixelColor(color: string | null | undefined, fallback: string): string {
  const parsed = color ? parseColor(color) : null;
  if (parsed !== null) return parsed;
  return normalizeColor(fallback);
}

export function painter(buf: PixelBuffer): Painter {
  const { width: W, height: H } = buf;

  // Grava cor já normalizada; os pincéis normalizam uma vez por chamada, não por pixel.
  const put = (x: number, y: number, color: string) => {
    const cx = x | 0;
    const cy = y | 0;
    if (cx < 0 || cy < 0 || cx >= W || cy >= H) return;
    buf.pixels[cy * W + cx] = color;
  };

  const px: Painter['px'] = (x, y, color) => {
    if (!color) return;
    put(x, y, normalizeColor(color));
  };

  // Dimensão negativa não pinta, de propósito: o fillRect do canvas pintaria para o lado oposto.
  const fill = (x: number, y: number, w: number, h: number, color: string) => {
    const x0 = x | 0;
    const y0 = y | 0;
    const x1 = Math.min(W, x0 + (w | 0));
    const y1 = Math.min(H, y0 + (h | 0));
    for (let yy = Math.max(0, y0); yy < y1; yy++) for (let xx = Math.max(0, x0); xx < x1; xx++) put(xx, yy, color);
  };

  const rect: Painter['rect'] = (x, y, w, h, color) => fill(x, y, w, h, normalizeColor(color));

  const map: Painter['map'] = (rows, palette, x0, y0) => {
    rows.forEach((row, j) => {
      [...row].forEach((ch, i) => {
        if (ch !== '.' && palette[ch]) px(x0 + i, y0 + j, palette[ch]);
      });
    });
  };

  const gradV: Painter['gradV'] = (y0, y1, stops) => {
    if (stops.length === 0) return;
    const colors = stops.map(normalizeColor);
    if (colors.length === 1) return fill(0, y0, W, y1 - y0, colors[0]);
    // Uma linha só não tem "meio": fica com a primeira cor (o esboço dividiria por zero).
    const span = Math.max(1, y1 - y0 - 1);
    for (let y = y0; y < y1; y++) {
      const pos = ((y - y0) / span) * (colors.length - 1);
      const i = Math.min(colors.length - 2, Math.floor(pos));
      const f = pos - i;
      for (let x = 0; x < W; x++) put(x, y, f > bayerThreshold(x, y) ? colors[i + 1] : colors[i]);
    }
  };

  const disc: Painter['disc'] = (cx, cy, r, color) => {
    const c = normalizeColor(color);
    for (let y = -r; y <= r; y++) {
      for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + r * 0.8) put(cx + x, cy + y, c);
    }
  };

  const glow: Painter['glow'] = (cx, cy, r0, r1, color) => {
    const c = normalizeColor(color);
    for (let y = -r1; y <= r1; y++) {
      for (let x = -r1; x <= r1; x++) {
        const d = Math.hypot(x, y);
        if (d <= r0 || d > r1) continue;
        const strength = (1 - (d - r0) / (r1 - r0)) * 0.85;
        if (strength > bayerThreshold(cx + x, cy + y)) put(cx + x, cy + y, c);
      }
    }
  };

  const ellipse: Painter['ellipse'] = (cx, cy, rx, ry, color, dither) => {
    const c = normalizeColor(color);
    for (let y = -ry; y <= ry; y++) {
      for (let x = -rx; x <= rx; x++) {
        const v = (x * x) / (rx * rx) + (y * y) / (ry * ry);
        // Raio zero dá 0/0 = NaN: como no esboço, NaN não conta como dentro.
        if (!(v <= 1)) continue;
        if (dither && 1 - v <= bayerThreshold(cx + x, cy + y) * dither) continue;
        put(cx + x, cy + y, c);
      }
    }
  };

  // Topo abaixo de `to` dá altura negativa e não pinta a coluna (ver `fill`); o realce do topo continua.
  const hills: Painter['hills'] = (base, parts, color, highlight, to = GROUND_Y) => {
    const c = normalizeColor(color);
    const hi = highlight ? normalizeColor(highlight) : null;
    for (let x = 0; x < W; x++) {
      let h = base;
      for (const [amplitude, frequency, phase] of parts) h += amplitude * Math.sin(x * frequency + phase);
      const top = Math.round(h);
      fill(x, top, 1, to - top + 1, c);
      if (hi) put(x, top, hi);
    }
  };

  const ground: Painter['ground'] = (color, highlight, texture, dark, rnd, specks = 170) => {
    const [base, hi, tex, shade] = [color, highlight, texture, dark].map(normalizeColor);
    // 1. base e borda clara no topo do chão
    fill(0, GROUND_Y, W, H - GROUND_Y, base);
    for (let x = 0; x < W; x++) put(x, GROUND_Y, hi);
    // 2. grãos de textura (sorteia x antes de y, na mesma ordem do esboço, para o desenho bater)
    for (let i = 0; i < specks; i++) {
      const x = rnd() * W;
      const y = GROUND_Y + 2 + rnd() * (H - GROUND_Y - 2);
      put(x, y, tex);
    }
    // 3. escurece da 9ª linha do chão para baixo, cada vez mais denso
    const fadeTop = GROUND_Y + 9;
    for (let y = fadeTop; y < H; y++) {
      for (let x = 0; x < W; x++) if ((y - fadeTop) / (H - fadeTop) > bayerThreshold(x, y)) put(x, y, shade);
    }
  };

  return { px, rect, map, gradV, disc, glow, ellipse, hills, ground };
}
