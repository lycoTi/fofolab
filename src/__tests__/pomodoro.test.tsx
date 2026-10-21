import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PomodoroWidget } from '../components/PomodoroWidget';

const MINUTE = 60_000;

function renderPomodoro(onSessionComplete = vi.fn(), props: Partial<Parameters<typeof PomodoroWidget>[0]> = {}) {
  const utils = render(
    <PomodoroWidget
      subjectId="subj-a"
      subjectName="Matéria A"
      topicId="topic-a"
      topicCode="1.1"
      onSessionComplete={onSessionComplete}
      {...props}
    />
  );
  return { ...utils, onSessionComplete };
}

describe('Pomodoro baseado no relógio real', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('continua contando mesmo com a tela re-renderizando (ex: digitando no caderno)', () => {
    const { rerender, onSessionComplete } = renderPomodoro();
    fireEvent.change(screen.getByLabelText('Duração do bloco Pomodoro'), { target: { value: '25' } });
    fireEvent.click(screen.getByLabelText('Iniciar Pomodoro'));

    // Re-render a cada 300 ms com um callback NOVO (era o que congelava o relógio antes)
    for (let i = 0; i < 100; i++) {
      act(() => {
        vi.advanceTimersByTime(300);
      });
      rerender(
        <PomodoroWidget subjectId="subj-a" subjectName="Matéria A" topicId="topic-a" topicCode="1.1" onSessionComplete={onSessionComplete} />
      );
    }
    // 30 s se passaram: o relógio tem que mostrar 24:30
    expect(screen.getByLabelText('Tempo restante').textContent).toBe('24:30');
  });

  it('registra o bloco inteiro uma única vez ao terminar naturalmente', () => {
    const { onSessionComplete } = renderPomodoro();
    fireEvent.change(screen.getByLabelText('Duração do bloco Pomodoro'), { target: { value: '25' } });
    fireEvent.click(screen.getByLabelText('Iniciar Pomodoro'));

    act(() => {
      vi.advanceTimersByTime(25 * MINUTE + 1000);
    });

    expect(onSessionComplete).toHaveBeenCalledTimes(1);
    expect(onSessionComplete.mock.calls[0][0]).toMatchObject({
      subjectId: 'subj-a',
      topicId: 'topic-a',
      durationMinutes: 25,
      wasSkipped: false,
    });
  });

  it('concluir antes da hora grava só o tempo realmente estudado (sem pausas)', () => {
    const { onSessionComplete } = renderPomodoro();
    fireEvent.click(screen.getByLabelText('Iniciar Pomodoro'));
    act(() => {
      vi.advanceTimersByTime(3 * MINUTE);
    });
    fireEvent.click(screen.getByLabelText('Pausar Pomodoro'));
    act(() => {
      vi.advanceTimersByTime(10 * MINUTE); // pausa não conta
    });
    fireEvent.click(screen.getByLabelText('Iniciar Pomodoro'));
    act(() => {
      vi.advanceTimersByTime(2 * MINUTE);
    });
    fireEvent.click(screen.getByLabelText('Concluir sessão'));

    expect(onSessionComplete).toHaveBeenCalledTimes(1);
    expect(onSessionComplete.mock.calls[0][0]).toMatchObject({ durationMinutes: 5, pausesCount: 1 });
  });

  it('sessão com menos de 1 minuto não é registrada', () => {
    const { onSessionComplete } = renderPomodoro();
    fireEvent.click(screen.getByLabelText('Iniciar Pomodoro'));
    act(() => {
      vi.advanceTimersByTime(20_000);
    });
    fireEvent.click(screen.getByLabelText('Concluir sessão'));

    expect(onSessionComplete).not.toHaveBeenCalled();
    expect(screen.getByText(/menos de 1 minuto/)).toBeTruthy();
  });

  it('a sessão fica com o tópico em que foi iniciada, mesmo se o estudante navegar', () => {
    const { rerender, onSessionComplete } = renderPomodoro();
    fireEvent.click(screen.getByLabelText('Iniciar Pomodoro'));
    act(() => {
      vi.advanceTimersByTime(4 * MINUTE);
    });
    rerender(
      <PomodoroWidget subjectId="subj-b" subjectName="Matéria B" topicId="topic-b" topicCode="2.1" onSessionComplete={onSessionComplete} />
    );
    fireEvent.click(screen.getByLabelText('Concluir sessão'));

    expect(onSessionComplete.mock.calls[0][0]).toMatchObject({ subjectId: 'subj-a', topicId: 'topic-a', durationMinutes: 4 });
  });

  it('aceita a duração sugerida pelo bloco do "Meu Dia" quando está parado', () => {
    renderPomodoro(vi.fn(), { presetRequest: { minutes: 54, nonce: 1 } });
    expect(screen.getByLabelText('Tempo restante').textContent).toBe('54:00');
  });
});
