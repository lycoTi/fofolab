import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { FofoSprite } from '../features/mascot/FofoSprite';
import { FofoWardrobeButton } from '../features/mascot/FofoWardrobeButton';
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

  it('o movimento (parado, só pisca, se mexe) fica marcado para o CSS animar os quadros', () => {
    const { rerender } = render(<FofoSprite outfit="fofodeck" motion="still" />);
    expect(screen.getByRole('img').getAttribute('data-motion')).toBe('still');
    rerender(<FofoSprite outfit="fofodeck" motion="full" />);
    expect(screen.getByRole('img').getAttribute('data-motion')).toBe('full');
  });

  it('ao lado de um texto que já diz o que é, fica escondido do leitor de tela', () => {
    const { container } = render(<FofoSprite outfit="fofodeck" decorative />);
    expect(screen.queryByRole('img')).toBeNull();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });
});

describe('Guarda-roupa ao clicar no Fofo', () => {
  function setup(over: Partial<Parameters<typeof FofoWardrobeButton>[0]> = {}) {
    const props = {
      outfit: 'fazendeiro' as OutfitId,
      automatic: 'fazendeiro' as OutfitId,
      fixedOutfit: null,
      appointed: false,
      onChooseOutfit: vi.fn(),
      onAppointedChange: vi.fn(),
      ...over,
    };
    render(<FofoWardrobeButton {...props} />);
    return props;
  }

  it('abre o guarda-roupa, escolhe uma roupa fixa ou volta para a automática, e fecha com Esc', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Guarda-roupa do Fofo/ }));
    const dialog = screen.getByRole('dialog', { name: 'Guarda-roupa do Fofo' });
    expect(dialog).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Fofo de Natal' }));
    expect(props.onChooseOutfit).toHaveBeenCalledWith('natal');
    fireEvent.click(screen.getByRole('button', { name: /Automática/ }));
    expect(props.onChooseOutfit).toHaveBeenLastCalledWith(null);
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('"Fui nomeado!" marca; marcado, oferece desfazer', () => {
    const props = setup();
    fireEvent.click(screen.getByRole('button', { name: /Guarda-roupa do Fofo/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Fui nomeado!' }));
    expect(props.onAppointedChange).toHaveBeenCalledWith(true);
  });
});
