import { fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { FofoSprite } from '../features/mascot/FofoSprite';
import { FofoWardrobeButton } from '../features/mascot/FofoWardrobeButton';
import { FOFO_POSES, FOFO_SPRITES } from '../features/mascot/fofoSprites.generated';
import { POSE_LABELS, type PoseId } from '../features/mascot/poses';
import { OUTFIT_LABELS, type OutfitId } from '../features/mascot/wardrobe';

const INDEX_CSS = readFileSync('src/index.css', 'utf8');
const REDUCED_MOTION = '@media (prefers-reduced-motion: reduce)';

/** Miolo dos blocos de "reduzir movimento", sem o @media em volta: o jsdom não tem como ligar essa preferência. */
function reducedMotionRules(css: string): string {
  const parts: string[] = [];
  let from = css.indexOf(REDUCED_MOTION);
  while (from !== -1) {
    const open = css.indexOf('{', from);
    let depth = 1;
    let i = open + 1;
    while (depth > 0) {
      if (css[i] === '{') depth += 1;
      if (css[i] === '}') depth -= 1;
      i += 1;
    }
    parts.push(css.slice(open + 1, i - 1));
    from = css.indexOf(REDUCED_MOTION, i);
  }
  return parts.join('\n');
}

/** Opacidade do quadro de olhos fechados com o CSS real do app; com "reduzir movimento", as regras dele vêm por último,
 *  como no fim do index.css. */
function eyesClosedOpacity(closedEyes: Element, reducedMotion: boolean): string {
  const style = document.createElement('style');
  style.textContent = reducedMotion ? `${INDEX_CSS}\n${reducedMotionRules(INDEX_CSS)}` : INDEX_CSS;
  document.head.appendChild(style);
  try {
    return getComputedStyle(closedEyes).opacity;
  } finally {
    style.remove();
  }
}

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

  it('as poses também têm desenho completo e aparecem com o nome da pose', () => {
    for (const id of Object.keys(POSE_LABELS) as PoseId[]) {
      const pose = FOFO_POSES[id];
      expect(pose.A).toHaveLength(32);
      expect(pose.B.every((row) => row.length === 32)).toBe(true);
    }
    render(<FofoSprite pose="pensando" />);
    expect(screen.getByRole('img', { name: 'Fofo pensando' }).getAttribute('data-pose')).toBe('pensando');
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

  it('dormindo na roupa: o quadro de olhos fechados fica por cima', () => {
    const { container } = render(<FofoSprite outfit="natal" motion="asleep" decorative />);
    const svg = container.querySelector('svg[data-motion="asleep"]');
    expect(svg).not.toBeNull();
    // A roupa continua: dormir aqui não troca o desenho pela pose
    expect(svg?.hasAttribute('data-pose')).toBe(false);
    const closedEyes = container.querySelector('.fofo-blink') as Element;
    expect(eyesClosedOpacity(closedEyes, false)).toBe('1');
  });

  it('dormindo com "reduzir movimento" ligado, continua de olhos fechados', () => {
    const { container } = render(<FofoSprite outfit="natal" motion="asleep" decorative />);
    const closedEyes = container.querySelector('.fofo-blink') as Element;
    expect(eyesClosedOpacity(closedEyes, true)).toBe('1');
  });

  it('acordado e parado, os olhos ficam abertos', () => {
    const { container } = render(<FofoSprite outfit="natal" motion="still" decorative />);
    const closedEyes = container.querySelector('.fofo-blink') as Element;
    expect(eyesClosedOpacity(closedEyes, true)).toBe('0');
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
