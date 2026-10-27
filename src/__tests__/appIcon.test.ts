import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

/** Regra de identidade: o ícone é o Fofo desenhado pixel a pixel (tools/mascote/icon.cjs), sem imagem gerada por IA. */
describe('Ícone do FofoLab', () => {
  it('o favicon é o desenho de 16 px em quadradinhos, sem imagem embutida', () => {
    const svg = readFileSync(join(__dirname, '../../public/favicon-fofolab.svg'), 'utf8');
    expect(svg).toContain('viewBox="0 0 16 16"');
    expect(svg).toContain('shape-rendering="crispEdges"');
    expect(svg).not.toMatch(/<image|data:image/);
  });
});
