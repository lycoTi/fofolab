import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FofoDoro } from '../features/fofodoro/FofoDoro';
import { FofoDoroPreview } from '../features/fofodoro/FofoDoroPreview';
import { FofoDoroRing } from '../features/fofodoro/FofoDoroRing';
import { Toast } from '../features/fofodoro/Toast';
import { initialBlockState, stepBlock, type BlockAction, type BlockState, type BlockTarget } from '../features/study-block/studyBlockMachine';
import type { StudyBlockController } from '../features/study-block/useStudyBlock';

const MIN = 60_000;
const FORBIDDEN_JARGON = ['SQLite', '0 tokens', '_score', 'Seed', 'IndexedDB', 'localStorage', 'Cache', 'null', 'NaN', 'undefined'];
const block: BlockTarget = { subjectId: 's', subjectName: 'TI', topicId: 't', topicCode: '1.1', topicTitle: 'Monolitos', targetMinutes: 100 };

function stateAfter(actions: BlockAction[], from: BlockState = { ...initialBlockState, focusMinutes: 25 }): BlockState {
  return actions.reduce((state, action) => stepBlock(state, action).state, from);
}

function controller(state: BlockState, now: number): StudyBlockController {
  return {
    state,
    now,
    message: null,
    messageId: 0,
    dismissMessage: vi.fn(),
    start: vi.fn(),
    pause: vi.fn(),
    pauseSilently: vi.fn(),
    resume: vi.fn(),
    next: vi.fn(),
    finish: vi.fn(),
    skip: vi.fn(),
    reset: vi.fn(),
    setMode: vi.fn(),
    setSettings: vi.fn(),
    onRecordedRef: { current: () => {} },
  };
}

afterEach(() => vi.useRealTimers());

describe('FofoDoro', () => {
  it('relógio em anel diz a fase, o tempo e quanto já foi', () => {
    render(<FofoDoroRing progress={0.52} tone="focus" timeText="12:04" phaseLabel="Foco" />);
    expect(screen.getByRole('img', { name: 'Foco: 12:04 restantes (52%)' })).toBeTruthy();
  });

  it('no foco: pomodoro do bloco, próxima pausa, quando vem a pausa longa e os botões certos', () => {
    const state = stateAfter([{ type: 'START', block, now: 0 }]);
    const c = controller(state, 13 * MIN);
    render(<FofoDoro controller={c} />);
    expect(screen.getByText('Pomodoro 1 de 4')).toBeTruthy();
    expect(screen.getByText('Depois: pausa de 05:00')).toBeTruthy();
    expect(screen.getByText('Pausa longa de 20:00 depois do 4º seguido')).toBeTruthy();
    expect(screen.getByRole('img', { name: /^Foco: 12:00 restantes/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Pausar' }));
    expect(c.pause).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Concluir bloco' }));
    expect(c.finish).toHaveBeenCalled();
  });

  it('na pausa dá para encerrar antes; depois dela o FofoDoro espera o estudante', () => {
    const onBreak = stateAfter([{ type: 'START', block, now: 0 }, { type: 'TICK', now: 25 * MIN }]);
    const c = controller(onBreak, 26 * MIN);
    const { rerender } = render(<FofoDoro controller={c} />);
    expect(screen.getByRole('img', { name: /^Pausa:/ })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Encerrar pausa' }));
    expect(c.next).toHaveBeenCalled();

    const ready = stateAfter([{ type: 'TICK', now: 30 * MIN }], onBreak);
    const r = controller(ready, 31 * MIN);
    rerender(<FofoDoro controller={r} />);
    expect(screen.getByText('Pronto quando você estiver')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Começar o próximo pomodoro' }));
    expect(r.next).toHaveBeenCalled();
  });

  it('bolinhas do ciclo: feitos, o atual e os que faltam até a pausa longa', () => {
    const second = stateAfter([{ type: 'START', block, now: 0 }, { type: 'TICK', now: 25 * MIN }, { type: 'NEXT', now: 30 * MIN }]);
    render(<FofoDoro controller={controller(second, 31 * MIN)} />);
    expect(screen.getByLabelText('1 de 4 pomodoros até a pausa longa')).toBeTruthy();
  });

  it('ajustes mudam a pausa curta, a longa e a cada quantos', () => {
    const c = controller(stateAfter([]), 0);
    render(<FofoDoroPreview controller={c} targetMinutes={100} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ajustes do FofoDoro' }));
    fireEvent.change(screen.getByLabelText('Pausa curta'), { target: { value: '8' } });
    expect(c.setSettings).toHaveBeenLastCalledWith({ shortBreakMinutes: 8, longBreakMinutes: 20, longEvery: 4 });
    fireEvent.change(screen.getByLabelText('Pausa longa'), { target: { value: '25' } });
    fireEvent.change(screen.getByLabelText('Pausa longa a cada'), { target: { value: '3' } });
    expect(c.setSettings).toHaveBeenCalledWith({ shortBreakMinutes: null, longBreakMinutes: 20, longEvery: 3 });
  });

  it('prévia antes do play: quanto vai estudar e pausar', () => {
    render(<FofoDoroPreview controller={controller(stateAfter([]), 0)} targetMinutes={100} />);
    expect(screen.getByText('4 pomodoros de 25 min + 3 pausas de 5 min → 01:55')).toBeTruthy();
  });

  it('aviso aparece, some sozinho e fecha no botão', () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    render(<Toast message="Parabéns: 25 minutos de foco! Que tal 5 minutos de pausa?" messageId={1} onClose={onClose} />);
    expect(screen.getByRole('status').textContent).toContain('Parabéns: 25 minutos de foco!');
    fireEvent.click(screen.getByRole('button', { name: 'Fechar aviso' }));
    expect(onClose).toHaveBeenCalled();
    act(() => vi.advanceTimersByTime(7000));
  });

  it('AUDITORIA DE UX: FofoDoro e prévia sem jargão técnico', () => {
    const state = stateAfter([{ type: 'START', block, now: 0 }]);
    const { container } = render(
      <>
        <FofoDoro controller={controller(state, MIN)} />
        <FofoDoroPreview controller={controller(stateAfter([]), 0)} targetMinutes={null} />
      </>
    );
    for (const term of FORBIDDEN_JARGON) expect(container.textContent).not.toContain(term);
  });
});
