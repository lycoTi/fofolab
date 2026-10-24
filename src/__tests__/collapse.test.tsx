import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { act, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { Collapse } from '../components/Collapse';

const region = (container: HTMLElement) => container.firstElementChild as HTMLElement;

describe('Collapse (abre e fecha com a altura animada)', () => {
  it('aberto: conteúdo acessível e linha da grade inteira', () => {
    const { container } = render(<Collapse open><button type="button">Tópicos</button></Collapse>);
    expect(screen.getByRole('button', { name: 'Tópicos' })).toBeTruthy();
    expect(region(container).style.gridTemplateRows).toBe('1fr');
    expect(region(container).hasAttribute('aria-hidden')).toBe(false);
  });

  it('fechado: altura zero, fora do teclado e dos leitores de tela', () => {
    const { container } = render(<Collapse open={false}><button type="button">Tópicos</button></Collapse>);
    expect(region(container).style.gridTemplateRows).toBe('0fr');
    expect(region(container).getAttribute('aria-hidden')).toBe('true');
    expect(region(container).hasAttribute('inert')).toBe(true);
    expect(screen.queryByRole('button', { name: 'Tópicos' })).toBeNull();
  });

  it('quem pediu menos movimento vê a troca sem animação', () => {
    const { container } = render(<Collapse open>x</Collapse>);
    expect(region(container).className).toContain('motion-reduce:transition-none');
  });

  it('ao fechar, mantém o último conteúdo enquanto a altura encolhe (não some de supetão)', () => {
    const { container, rerender } = render(<Collapse open><p>Relógio do bloco</p></Collapse>);
    rerender(<Collapse open={false}>{null}</Collapse>);
    expect(region(container).textContent).toBe('Relógio do bloco');
  });

  it('terminada a animação de fechar, o conteúdo antigo sai da tela', () => {
    vi.useFakeTimers();
    try {
      const { container, rerender } = render(<Collapse open><p>Relógio do bloco</p></Collapse>);
      rerender(<Collapse open={false}>{null}</Collapse>);
      act(() => vi.advanceTimersByTime(300));
      expect(region(container).textContent).toBe('');
    } finally {
      vi.useRealTimers();
    }
  });

  it('reabrir antes de terminar de fechar mostra o conteúdo novo', () => {
    const { container, rerender } = render(<Collapse open><p>antigo</p></Collapse>);
    rerender(<Collapse open={false}>{null}</Collapse>);
    rerender(<Collapse open><p>novo</p></Collapse>);
    expect(region(container).textContent).toBe('novo');
  });

  it('modais entram com fade de verdade (a classe existe no CSS) e sem animação para quem pediu menos movimento', () => {
    const css = readFileSync(resolve(__dirname, '../index.css'), 'utf8');
    expect(css).toMatch(/\.animate-fade-in\s*\{[^}]*animation:/);
    expect(css).toMatch(/prefers-reduced-motion:\s*reduce[\s\S]*\.animate-fade-in[\s\S]*animation:\s*none/);
  });
});
