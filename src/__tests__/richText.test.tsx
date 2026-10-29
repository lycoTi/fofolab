import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { RichText, REVEAL_TOTAL_MS } from '../components/RichText';

describe('Texto da IA com formatação', () => {
  it('mostra negrito, itálico e listas sem os símbolos crus', () => {
    const { container } = render(
      <RichText text={'### Síntese\n* **Erros:** "Risco Fiscal" não é componente.\n- *Armadilha* de `RI × RC`'} />
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

  it('renderiza blocos de código com linguagem, pre/code e botão de cópia', () => {
    const markdown = 'Exemplo de comando:\n```sql\nSELECT id, nome FROM questoes;\n```\nFim da explicação.';
    const { container } = render(<RichText text={markdown} />);
    const pre = container.querySelector('pre');
    expect(pre).not.toBeNull();
    expect(pre?.textContent).toContain('SELECT id, nome FROM questoes;');
    expect(screen.getByText('SQL')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Copiar código' })).toBeDefined();
    expect(container.textContent).not.toContain('```');
  });

  it('renderiza tabelas markdown estruturadas com thead, tbody e formatação inline', () => {
    const markdown =
      '| Critério | Síncrono | Assíncrono |\n| :--- | :--- | :--- |\n| **Acoplamento** | Alto | *Baixo* |\n| Latência | Baixa | Variável |';
    const { container } = render(<RichText text={markdown} />);
    const table = container.querySelector('table');
    expect(table).not.toBeNull();
    const ths = container.querySelectorAll('th');
    expect(ths).toHaveLength(3);
    expect(ths[0].textContent).toBe('Critério');
    expect(ths[1].textContent).toBe('Síncrono');
    expect(ths[2].textContent).toBe('Assíncrono');
    const strong = container.querySelector('strong');
    expect(strong?.textContent).toBe('Acoplamento');
    const em = container.querySelector('em');
    expect(em?.textContent).toBe('Baixo');
    expect(container.textContent).not.toContain('| :---');
  });

  it('renderiza listas numeradas com alinhamento e citações em bloco', () => {
    const markdown = '1. Primeiro passo.\n2. Segundo passo.\n> Trecho de lei doutrinário relevante.';
    const { container } = render(<RichText text={markdown} />);
    expect(screen.getByText('1.')).toBeDefined();
    expect(screen.getByText('2.')).toBeDefined();
    const quote = container.querySelector('blockquote');
    expect(quote).not.toBeNull();
    expect(quote?.textContent).toContain('Trecho de lei doutrinário relevante.');
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
