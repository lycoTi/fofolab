import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { QuestionStatement } from '../features/questions/QuestionStatement';
import { saveHighlights } from '../features/questions/questionHighlights';

describe('QuestionStatement - Grifo tátil no enunciado', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renderiza o texto do enunciado sem grifos iniciais', () => {
    render(
      <QuestionStatement
        questionId="q-stmt-1"
        statement="A confidencialidade de dados no Poder Judiciário pode ser garantida por criptografia."
      />
    );

    expect(screen.getByText(/A confidencialidade de dados no Poder Judiciário/)).toBeTruthy();
    expect(screen.queryByText(/grifo/i)).toBeNull();
  });

  it('exibe grifos salvos no localStorage como elementos mark e contador', () => {
    const text = 'A confidencialidade de dados no Poder Judiciário pode ser garantida por criptografia.';
    const startCripto = text.indexOf('criptografia');
    saveHighlights('q-stmt-2', [
      { start: 2, end: 19 }, // "confidencialidade"
      { start: startCripto, end: startCripto + 'criptografia'.length },
    ]);

    render(<QuestionStatement questionId="q-stmt-2" statement={text} />);

    // Contador de grifos
    expect(screen.getByText('2 grifos')).toBeTruthy();

    // Elementos mark
    const marks = screen.getAllByRole('mark', { hidden: true });
    // Ou pelo seletor de tag mark
    const markTags = document.querySelectorAll('mark');
    expect(markTags.length).toBe(2);
    expect(markTags[0].textContent).toBe('confidencialidade');
    expect(markTags[1].textContent).toBe('criptografia');
  });

  it('clicar em um grifo remove apenas aquele grifo', () => {
    const text = 'A confidencialidade de dados pode ser garantida por criptografia.';
    const startCripto = text.indexOf('criptografia');
    saveHighlights('q-stmt-3', [
      { start: 2, end: 19 },
      { start: startCripto, end: startCripto + 'criptografia'.length },
    ]);

    render(<QuestionStatement questionId="q-stmt-3" statement={text} />);
    expect(screen.getByText('2 grifos')).toBeTruthy();

    // Clica no primeiro grifo para remover
    const marks = document.querySelectorAll('mark');
    fireEvent.click(marks[0]);

    // Agora resta apenas 1 grifo
    expect(screen.getByText('1 grifo')).toBeTruthy();
    expect(document.querySelectorAll('mark').length).toBe(1);
    expect(document.querySelector('mark')!.textContent).toBe('criptografia');
  });

  it('botão limpar remove todos os grifos da questão', () => {
    const text = 'Texto da questão com termos grifados.';
    saveHighlights('q-stmt-4', [{ start: 0, end: 5 }]);

    render(<QuestionStatement questionId="q-stmt-4" statement={text} />);
    expect(screen.getByText('1 grifo')).toBeTruthy();

    const clearBtn = screen.getByRole('button', { name: 'Limpar todos os grifos' });
    fireEvent.click(clearBtn);

    expect(screen.queryByText(/grifo/i)).toBeNull();
    expect(document.querySelectorAll('mark').length).toBe(0);
  });
});
