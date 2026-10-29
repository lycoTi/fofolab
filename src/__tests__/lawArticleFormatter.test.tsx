import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { LawArticleFormatter } from '../features/laws/LawArticleFormatter';

describe('LawArticleFormatter (Vade Mecum Editorial)', () => {
  it('remove asteriscos crus e destaca o rótulo do artigo e o caput', () => {
    const raw = '**Art. 1º** Esta Lei institui o Regime Jurídico dos Servidores Públicos Civis da União.';
    const { container } = render(<LawArticleFormatter articleLabel="Art. 1º" fullText={raw} />);

    // Não deve conter asteriscos crus no texto
    expect(container.textContent).not.toContain('**');
    expect(screen.getByText('Art. 1º')).toBeTruthy();
    expect(screen.getByText(/Esta Lei institui o Regime Jurídico/)).toBeTruthy();
  });

  it('formata incisos romanos com indentação e parágrafos numerados', () => {
    const raw = `**Art. 5º** São requisitos básicos para investidura em cargo público:
I - a nacionalidade brasileira;
II - o gozo dos direitos políticos;
**§ 1º** As atribuições do cargo podem justificar a exigência de outros requisitos.
*(Parágrafo acrescido pela Lei nº 9.515, de 20/11/1997).*`;

    const { container } = render(<LawArticleFormatter articleLabel="Art. 5º" fullText={raw} />);

    expect(screen.getByText('I -')).toBeTruthy();
    expect(screen.getByText(/a nacionalidade brasileira/)).toBeTruthy();
    expect(screen.getByText('II -')).toBeTruthy();
    expect(screen.getByText(/o gozo dos direitos políticos/)).toBeTruthy();
    expect(screen.getByText(/§ 1º/)).toBeTruthy();
    expect(screen.getByText(/Parágrafo acrescido pela Lei/)).toBeTruthy();
    expect(container.textContent).not.toContain('**');
  });

  it('não possui emojis crus no leitor editorial', () => {
    const raw = '**Art. 37** A administração pública direta e indireta obedecerá aos princípios de legalidade.';
    const { container } = render(<LawArticleFormatter articleLabel="Art. 37" fullText={raw} />);

    const emojiRegex = /[\u{1F300}-\u{1F6FF}\u{1F900}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/u;
    expect(emojiRegex.test(container.innerHTML)).toBe(false);
  });
});

