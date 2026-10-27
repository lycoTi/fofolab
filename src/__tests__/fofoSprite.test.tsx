import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { FofoSprite } from '../features/mascot/FofoSprite';
import { FOFO_SPRITES } from '../features/mascot/fofoSprites.generated';
import { OUTFIT_LABELS, type OutfitId } from '../features/mascot/wardrobe';

describe('Fofo em pixel art', () => {
  it('toda roupa do guarda-roupa tem desenho de 32×32 nos dois quadros e nos olhos fechados', () => {
    for (const id of Object.keys(OUTFIT_LABELS) as OutfitId[]) {
      const sprite = FOFO_SPRITES[id];
      for (const grid of [sprite.A, sprite.B, sprite.closed]) {
        expect(grid).toHaveLength(32);
        expect(grid.every((row) => row.length === 32)).toBe(true);
      }
      // Toda letra usada no desenho tem cor na paleta
      const used = new Set([...sprite.A.join(''), ...sprite.B.join(''), ...sprite.closed.join('')]);
      used.delete('.');
      expect([...used].filter((c) => !sprite.palette[c])).toEqual([]);
    }
  });

  it('aparece com o nome da roupa e no tamanho da escala inteira', () => {
    render(<FofoSprite outfit="natal" scale={2} />);
    const img = screen.getByRole('img', { name: 'Fofo de Natal' });
    expect(img.getAttribute('width')).toBe('64');
    expect(img.getAttribute('height')).toBe('64');
    expect(img.getAttribute('shape-rendering')).toBe('crispEdges');
  });

  it('parado não anima; piscando só pisca; em momento alterna os quadros e pisca', () => {
    const { container, rerender } = render(<FofoSprite outfit="fofodeck" motion="still" />);
    expect(container.querySelector('.fofo-fb')).toBeNull();
    expect(container.querySelector('.fofo-blink')).toBeNull();
    expect(container.querySelector('.fofo-fa')).toBeNull();

    rerender(<FofoSprite outfit="fofodeck" motion="blink" />);
    expect(container.querySelector('.fofo-blink')).not.toBeNull();
    expect(container.querySelector('.fofo-fb')).toBeNull();

    rerender(<FofoSprite outfit="fofodeck" motion="full" />);
    expect(container.querySelector('.fofo-fa')).not.toBeNull();
    expect(container.querySelector('.fofo-fb')).not.toBeNull();
    expect(container.querySelector('.fofo-blink')).not.toBeNull();
  });

  it('ao lado de um texto que já diz o que é, fica escondido do leitor de tela', () => {
    const { container } = render(<FofoSprite outfit="fofodeck" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});
