import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AnswerOptions } from '../features/answer-flow/AnswerOptions';
import { ConfidencePicker } from '../features/answer-flow/ConfidencePicker';
import { DiagnosisPicker } from '../features/answer-flow/DiagnosisPicker';

const FORBIDDEN_JARGON = ['SURE', 'RECENT', 'GUESS', 'STUDYING', 'LUCKY_GUESS', 'MISCONCEPTION', 'BASE_GAP', 'null', 'undefined'];

describe('Confiança antes de responder', () => {
  it('quatro opções: Sei, Estou estudando, Acho que sei, Vou chutar', () => {
    const onChange = vi.fn();
    render(<ConfidencePicker value={null} onChange={onChange} />);
    expect(screen.getByText('Antes de responder: quão seguro você está?')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Estou estudando' }));
    expect(onChange).toHaveBeenCalledWith('RECENT');
    fireEvent.click(screen.getByRole('button', { name: 'Vou chutar' }));
    expect(onChange).toHaveBeenCalledWith('GUESS');
    expect(screen.getByRole('button', { name: 'Sei' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Acho que sei' })).toBeTruthy();
  });
});

describe('Diagnóstico depois de responder', () => {
  it('acerto: o deduzido vem marcado e dá para trocar entre Dominei, Pegando o jeito, Acertei na dúvida e Acertei no chute', () => {
    const onChange = vi.fn();
    render(<DiagnosisPicker isCorrect confidence="RECENT" value="STUDYING" onChange={onChange} />);
    expect(screen.getByRole('button', { name: /Pegando o jeito/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Acertei na dúvida/ }));
    expect(onChange).toHaveBeenCalledWith('DOUBT');
    expect(screen.getByRole('button', { name: /Dominei/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Acertei no chute/ })).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Confundi/ })).toBeNull();
  });

  it('erro: "Por quê?" com as três causas', () => {
    const onChange = vi.fn();
    const { container } = render(<DiagnosisPicker isCorrect={false} confidence="THINK" value="BASE_GAP" onChange={onChange} />);
    expect(screen.getByText('Por quê?')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Não sabia/ }).getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(screen.getByRole('button', { name: /Confundi com outra coisa/ }));
    expect(onChange).toHaveBeenCalledWith('MISCONCEPTION');
    expect(screen.getByRole('button', { name: /Pegadinha ou desatenção/ })).toBeTruthy();
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });

  it('falsa certeza ganha a linha que convida a entender de onde veio a ideia; chute errado é acolhido', () => {
    const { rerender } = render(<DiagnosisPicker isCorrect={false} confidence="SURE" value="BASE_GAP" onChange={vi.fn()} />);
    expect(screen.getByText('Você tinha certeza. Vale entender de onde veio essa ideia.')).toBeTruthy();
    rerender(<DiagnosisPicker isCorrect={false} confidence="GUESS" value="BASE_GAP" onChange={vi.fn()} />);
    expect(screen.queryByText(/Você tinha certeza/)).toBeNull();
    expect(screen.getByText(/primeiro contato/i)).toBeTruthy();
  });
});

describe('AnswerOptions: riscador de alternativas (eliminação de distratores)', () => {
  const options = [
    { key: 'A', text: 'Opção A', label: 'A) Opção A' },
    { key: 'B', text: 'Opção B', label: 'B) Opção B' },
    { key: 'C', text: 'Opção C', label: 'C) Opção C' },
  ];

  it('exibe o botão de riscar e aciona onToggleEliminate ao clicar', () => {
    const onToggle = vi.fn();
    render(
      <AnswerOptions
        options={options}
        finalAnswer="C"
        picked={null}
        eliminated={['A']}
        onToggleEliminate={onToggle}
        onPick={vi.fn()}
      />
    );

    // Opção A possui classe de line-through
    const buttonA = screen.getByRole('button', { name: 'A) Opção A' });
    expect(buttonA.className).toContain('line-through');

    // Botão de restaurar alternativa A
    const restoreA = screen.getByRole('button', { name: 'Restaurar alternativa A' });
    expect(restoreA).toBeTruthy();
    fireEvent.click(restoreA);
    expect(onToggle).toHaveBeenCalledWith('A');

    // Botão de descartar alternativa B
    const discardB = screen.getByRole('button', { name: 'Descartar alternativa B' });
    expect(discardB).toBeTruthy();
    fireEvent.click(discardB);
    expect(onToggle).toHaveBeenCalledWith('B');
  });
});
