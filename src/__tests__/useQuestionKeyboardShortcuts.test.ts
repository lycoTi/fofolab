import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { useQuestionKeyboardShortcuts, type UseQuestionKeyboardShortcutsOptions } from '../features/questions/useQuestionKeyboardShortcuts';

describe('useQuestionKeyboardShortcuts', () => {
  const defaultOptions: UseQuestionKeyboardShortcutsOptions = {
    enabled: true,
    confidence: null,
    answered: false,
    options: [{ key: 'C' }, { key: 'E' }],
    onConfidence: vi.fn(),
    onPick: vi.fn(),
    onFirstContact: vi.fn(),
    onHint: vi.fn(),
    onNext: vi.fn(),
    onPrev: vi.fn(),
  };

  it('teclas 1 a 4 acionam a calibração de confiança quando não respondida', () => {
    const onConfidence = vi.fn();
    renderHook(() => useQuestionKeyboardShortcuts({ ...defaultOptions, onConfidence }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(onConfidence).toHaveBeenCalledWith('SURE');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(onConfidence).toHaveBeenCalledWith('RECENT');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(onConfidence).toHaveBeenCalledWith('THINK');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '4' }));
    expect(onConfidence).toHaveBeenCalledWith('GUESS');
  });

  it('tecla C e E acionam a escolha de alternativa apenas quando a confiança já foi escolhida', () => {
    const onPick = vi.fn();
    const { rerender } = renderHook(
      (props) => useQuestionKeyboardShortcuts(props),
      { initialProps: { ...defaultOptions, onPick } as UseQuestionKeyboardShortcutsOptions }
    );

    // Sem confiança escolhida: C não deve selecionar
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(onPick).not.toHaveBeenCalled();

    // Com confiança selecionada: C seleciona
    rerender({ ...defaultOptions, confidence: 'SURE', onPick });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'c' }));
    expect(onPick).toHaveBeenCalledWith('C');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E' }));
    expect(onPick).toHaveBeenCalledWith('E');
  });

  it('tecla P aciona pista e V aciona primeiro contato antes de responder', () => {
    const onHint = vi.fn();
    const onFirstContact = vi.fn();
    renderHook(() =>
      useQuestionKeyboardShortcuts({ ...defaultOptions, onHint, onFirstContact })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }));
    expect(onHint).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'v' }));
    expect(onFirstContact).toHaveBeenCalledTimes(1);
  });

  it('Enter e Espaço avançam para a próxima questão somente após responder', () => {
    const onNext = vi.fn();
    const { rerender } = renderHook(
      (props: UseQuestionKeyboardShortcutsOptions) => useQuestionKeyboardShortcuts(props),
      { initialProps: { ...defaultOptions, answered: false, onNext } }
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onNext).not.toHaveBeenCalled();

    rerender({ ...defaultOptions, answered: true, onNext });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(onNext).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    expect(onNext).toHaveBeenCalledTimes(2);
  });

  it('Seta Direita avança e Seta Esquerda recua na navegação', () => {
    const onNext = vi.fn();
    const onPrev = vi.fn();
    renderHook(() => useQuestionKeyboardShortcuts({ ...defaultOptions, onNext, onPrev }));

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    expect(onNext).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('ignora atalhos quando o foco está em inputs ou com teclas modificadoras', () => {
    const onConfidence = vi.fn();
    renderHook(() => useQuestionKeyboardShortcuts({ ...defaultOptions, onConfidence }));

    // Com Ctrl pressionado
    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true }));
    expect(onConfidence).not.toHaveBeenCalled();

    // Com foco em input
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();

    const event = new KeyboardEvent('keydown', { key: '1', bubbles: true });
    input.dispatchEvent(event);
    expect(onConfidence).not.toHaveBeenCalled();

    document.body.removeChild(input);
  });

  it('tecla Alt + Letra aciona o descarte/riscador da alternativa (onToggleEliminate)', () => {
    const onToggleEliminate = vi.fn();
    renderHook(() =>
      useQuestionKeyboardShortcuts({
        ...defaultOptions,
        options: [{ key: 'A' }, { key: 'B' }, { key: 'C' }],
        onToggleEliminate,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', altKey: true }));
    expect(onToggleEliminate).toHaveBeenCalledWith('A');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'B', altKey: true }));
    expect(onToggleEliminate).toHaveBeenCalledWith('B');
  });

  it('quando respondida, teclas 1 a 4 selecionam o autodiagnóstico (onDiagnosis)', () => {
    const onDiagnosis = vi.fn();
    renderHook(() =>
      useQuestionKeyboardShortcuts({
        ...defaultOptions,
        answered: true,
        allowedDiagnoses: ['MASTERED', 'STUDYING', 'LUCKY_GUESS'],
        onDiagnosis,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '1' }));
    expect(onDiagnosis).toHaveBeenCalledWith('MASTERED');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '2' }));
    expect(onDiagnosis).toHaveBeenCalledWith('STUDYING');

    window.dispatchEvent(new KeyboardEvent('keydown', { key: '3' }));
    expect(onDiagnosis).toHaveBeenCalledWith('LUCKY_GUESS');
  });

  it('quando respondida, tecla E aciona onDeepen (abrir explicação com a FofoIA)', () => {
    const onDeepen = vi.fn();
    renderHook(() =>
      useQuestionKeyboardShortcuts({
        ...defaultOptions,
        answered: true,
        onDeepen,
      })
    );

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }));
    expect(onDeepen).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'E' }));
    expect(onDeepen).toHaveBeenCalledTimes(2);
  });
});
