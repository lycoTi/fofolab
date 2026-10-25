import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText, REVEAL_TOTAL_MS } from '../components/RichText';

describe('Texto da IA com formatação', () => {
  it('mostra negrito, itálico e listas sem os símbolos crus', () => {
    const { container } = render(
      <RichText text={'### Síntese\n* **Erros:** \"Risco Fiscal\" não é componente.\n- *Armadilha* de `RI × RC`'} />
    );
    expect(container.textContent).not.toContain('**');
    expect(container.textContent).not.toContain('###');
    expect(screen.getByText('Erros:').tagName).toBe('STRONG');
    expect(screen.getByText('Armadilha').tagName).toBe('EM');
    expect(screen.getByText('RI × RC').tagName).toBe('CODE');
  });

  it('não interpreta HTML vindo da IA', () => {
    const { container } = render(<RichText text={'<img src=x onerror=alert(1)> texto'} />);
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('<img');
  });
});

describe('Resposta surgindo por parágrafo', () => {
  it('cada parágrafo entra depois do anterior; sem reveal, tudo aparece junto', () => {
    const text = 'Primeiro parágrafo.\n\nSegundo parágrafo.\n* item da lista';
    const { container, rerender } = render(<RichText text={text} reveal />);
    const blocks = [...container.querySelectorAll<HTMLElement>('.fofolab-reveal')];
    expect(blocks.map((b) => b.textContent)).toEqual(['Primeiro parágrafo.', 'Segundo parágrafo.', '•item da lista']);
    const delays = blocks.map((b) => parseInt(b.style.animationDelay, 10));
    expect(delays[0]).toBe(0);
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(delays[2]).toBeGreaterThan(delays[1]);
    rerender(<RichText text={text} />);
    expect(container.querySelectorAll('.fofolab-reveal')).toHaveLength(0);
  });

  it('resposta longa não demora mais que o teto para aparecer inteira', () => {
    const text = Array.from({ length: 40 }, (_, i) => `Linha ${i + 1}.`).join('\n');
    const { container } = render(<RichText text={text} reveal />);
    const delays = [...container.querySelectorAll<HTMLElement>('.fofolab-reveal')].map((b) => parseInt(b.style.animationDelay, 10));
    expect(Math.max(...delays)).toBeLessThanOrEqual(REVEAL_TOTAL_MS);
  });
});
