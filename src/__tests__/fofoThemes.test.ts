import { describe, expect, it } from 'vitest';
import { FOFO_THEMES } from '../features/mascot/fofoThemes';
import type { OutfitId } from '../features/mascot/wardrobe';

// Roupas cujo brilho de fundo foi refeito longe das cores de status. Nas demais, a cor fria do brilho é a
// secundária da roupa (como o azul do céu), não o destaque, e continua livre.
const GRADIENT_CHECKED: OutfitId[] = ['natal', 'nomeado', 'prova', 'madrugada'];

// Converte r, g, b (0–255) em matiz (0–360) e saturação (0–1) para comparar com as faixas das cores de status.
function rgbToHsl(r255: number, g255: number, b255: number): { h: number; s: number; l: number } {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l };

  const s = delta / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) {
    h = ((g - b) / delta) % 6;
  } else if (max === g) {
    h = (b - r) / delta + 2;
  } else {
    h = (r - g) / delta + 4;
  }
  h *= 60;
  if (h < 0) h += 360;
  return { h, s, l };
}

function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace('#', '');
  return rgbToHsl(
    parseInt(value.slice(0, 2), 16),
    parseInt(value.slice(2, 4), 16),
    parseInt(value.slice(4, 6), 16),
  );
}

// Aceita #RRGGBB ou rgb()/rgba(); a transparência não muda o matiz.
function colorToHsl(color: string): { h: number; s: number; l: number } {
  if (color.startsWith('#')) return hexToHsl(color);
  const channels = color.match(/\d+(\.\d+)?/g);
  if (!channels || channels.length < 3) throw new Error(`cor não reconhecida: ${color}`);
  return rgbToHsl(Number(channels[0]), Number(channels[1]), Number(channels[2]));
}

function colorsIn(css: string): string[] {
  return css.match(/rgba?\([^)]*\)|#[0-9a-f]{6}\b/gi) ?? [];
}

function inBand(h: number, from: number, to: number): boolean {
  return h >= from && h <= to;
}

function expectOutsideStatus(color: string, label: string) {
  const { h, s } = colorToHsl(color);
  // Cor quase cinza não se confunde com status.
  if (s < 0.35) return;
  expect(inBand(h, 90, 170), `${label} verde (${color})`).toBe(false);
  expect(inBand(h, 190, 245), `${label} azul (${color})`).toBe(false);
  expect(h >= 330 || h <= 10, `${label} vermelho/rosa (${color})`).toBe(false);
}

describe('paletas das roupas do Fofo', () => {
  it('nenhuma roupa usa cor de status como destaque', () => {
    for (const theme of Object.values(FOFO_THEMES)) {
      expect(theme.palette.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expectOutsideStatus(theme.palette.accent, `${theme.id} destaque`);
    }
  });

  it('nenhuma roupa usa cor de status nas linhas', () => {
    for (const theme of Object.values(FOFO_THEMES)) {
      expectOutsideStatus(theme.palette.borderSubtle, `${theme.id} linha`);
    }
  });

  it('o brilho de fundo das roupas refeitas não usa cor de status', () => {
    for (const id of GRADIENT_CHECKED) {
      const colors = colorsIn(FOFO_THEMES[id].palette.ambientGradient);
      expect(colors.length, `${id} sem cores no brilho`).toBeGreaterThan(0);
      for (const color of colors) expectOutsideStatus(color, `${id} brilho`);
    }
  });
});
