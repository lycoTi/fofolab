import { describe, expect, it } from 'vitest';
import { FOFO_THEMES } from '../features/mascot/fofoThemes';

// Converte #RRGGBB em matiz (0–360) e saturação (0–1) para comparar com as faixas das cores de status.
function hexToHsl(hex: string): { h: number; s: number; l: number } {
  const value = hex.replace('#', '');
  const r = parseInt(value.slice(0, 2), 16) / 255;
  const g = parseInt(value.slice(2, 4), 16) / 255;
  const b = parseInt(value.slice(4, 6), 16) / 255;
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

function inBand(h: number, from: number, to: number): boolean {
  return h >= from && h <= to;
}

describe('paletas das roupas do Fofo', () => {
  it('nenhuma roupa usa cor de status como destaque', () => {
    for (const theme of Object.values(FOFO_THEMES)) {
      const { h, s } = hexToHsl(theme.palette.accent);
      // Cor quase cinza não se confunde com status.
      if (s < 0.35) continue;
      expect(inBand(h, 90, 170), `${theme.id} verde`).toBe(false);
      expect(inBand(h, 190, 245), `${theme.id} azul`).toBe(false);
      expect(h >= 330 || h <= 10, `${theme.id} vermelho/rosa`).toBe(false);
    }
  });
});
