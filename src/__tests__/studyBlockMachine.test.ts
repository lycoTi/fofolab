import { describe, expect, it } from 'vitest';
import {
  initialBlockState,
  phaseRemainingMs,
  pomodoroCount,
  stepBlock,
  totalPomodoros,
  type BlockAction,
  type BlockState,
  type BlockTarget,
  type RecordedSession,
} from '../features/study-block/studyBlockMachine';

const MIN = 60_000;
const block: BlockTarget = {
  subjectId: 'subj-arq',
  subjectName: 'Arquitetura e Integração de Sistemas',
  topicId: 't-1-1',
  topicCode: '1.1',
  topicTitle: 'Monolitos, microsserviços e arquiteturas orientadas a eventos',
  targetMinutes: 90,
};

/** Aplica as ações em sequência e junta o que foi gravado. */
function run(actions: BlockAction[], from: BlockState = initialBlockState) {
  let state = from;
  const recorded: RecordedSession[] = [];
  for (const action of actions) {
    const step = stepBlock(state, action);
    state = step.state;
    if (step.recorded) recorded.push(step.recorded);
  }
  return { state, recorded };
}

describe('Bloco de estudo em pomodoros', () => {
  it('divide a meta em pomodoros do tamanho escolhido', () => {
    expect(pomodoroCount(108, 30)).toBe(4);
    expect(pomodoroCount(108, 50)).toBe(2);
    expect(pomodoroCount(108, 20)).toBe(5);
    expect(pomodoroCount(10, 50)).toBe(1);
    expect(pomodoroCount(null, 30)).toBe(1);
  });

  it('pomodoro de 30 → pausa de 5 → pronto para o próximo, gravando cada trecho de foco', () => {
    const { state, recorded } = run([
      { type: 'START', block, now: 0 },
      { type: 'TICK', now: 30 * MIN },
    ]);
    expect(state.phase).toBe('BREAK');
    expect(totalPomodoros(state)).toBe(3);
    expect(recorded).toEqual([{ subjectId: 'subj-arq', topicId: 't-1-1', durationMinutes: 30, pausesCount: 0, wasSkipped: false }]);
    expect(phaseRemainingMs(state, 32 * MIN)).toBe(3 * MIN);

    const afterBreak = run([{ type: 'TICK', now: 35 * MIN }], state);
    expect(afterBreak.state.phase).toBe('READY');

    // O próximo pomodoro só começa quando o estudante quiser
    const next = run([{ type: 'NEXT', now: 40 * MIN }], afterBreak.state);
    expect(next.state.phase).toBe('FOCUS');
    expect(phaseRemainingMs(next.state, 40 * MIN)).toBe(30 * MIN);
  });

  it('encerra sozinho no último pomodoro (90 min = 3 de 30)', () => {
    const { state, recorded } = run([
      { type: 'START', block, now: 0 },
      { type: 'TICK', now: 30 * MIN },
      { type: 'NEXT', now: 35 * MIN },
      { type: 'TICK', now: 65 * MIN },
      { type: 'NEXT', now: 70 * MIN },
      { type: 'TICK', now: 100 * MIN },
    ]);
    expect(state.phase).toBe('DONE');
    expect(state.completedPomodoros).toBe(3);
    expect(recorded.map((r) => r.durationMinutes)).toEqual([30, 30, 30]);
  });

  it('pausar não conta como foco e o relógio continua de onde parou', () => {
    const { state, recorded } = run([
      { type: 'START', block, now: 0 },
      { type: 'PAUSE', now: 10 * MIN },
      { type: 'RESUME', now: 25 * MIN },
      { type: 'TICK', now: 44 * MIN }, // ainda faltava 1 min
      { type: 'TICK', now: 45 * MIN },
    ]);
    expect(recorded).toEqual([expect.objectContaining({ durationMinutes: 30, pausesCount: 1 })]);
    expect(state.phase).toBe('BREAK');
  });

  it('concluir no meio grava só o foco feito; pular registra o atrito', () => {
    const finished = run([
      { type: 'START', block, now: 0 },
      { type: 'FINISH', now: 12 * MIN + 30_000 },
    ]);
    expect(finished.state.phase).toBe('DONE');
    expect(finished.recorded).toEqual([expect.objectContaining({ durationMinutes: 12, wasSkipped: false })]);

    const skipped = run([
      { type: 'START', block, now: 0 },
      { type: 'SKIP', now: 5 * MIN },
    ]);
    expect(skipped.state.phase).toBe('IDLE');
    expect(skipped.recorded).toEqual([expect.objectContaining({ durationMinutes: 5, wasSkipped: true })]);
  });

  it('menos de 1 minuto de foco não grava nada; reiniciar descarta', () => {
    expect(run([{ type: 'START', block, now: 0 }, { type: 'FINISH', now: 40_000 }]).recorded).toEqual([]);
    expect(run([{ type: 'START', block, now: 0 }, { type: 'RESET' }]).state.phase).toBe('IDLE');
  });
});

describe('Bloco de estudo no modo livre', () => {
  it('relógio corrido até o estudante concluir, sem pausas automáticas', () => {
    const livre = run([{ type: 'SET_MODE', mode: 'LIVRE', focusMinutes: 30 }]).state;
    const { state, recorded } = run(
      [
        { type: 'START', block, now: 0 },
        { type: 'TICK', now: 200 * MIN },
        { type: 'FINISH', now: 100 * MIN },
      ],
      livre
    );
    expect(phaseRemainingMs(livre, 0)).toBeNull();
    expect(state.phase).toBe('DONE');
    expect(recorded).toEqual([expect.objectContaining({ durationMinutes: 100 })]);
  });

  it('não troca o modo no meio de um trecho de foco', () => {
    const started = run([{ type: 'START', block, now: 0 }]).state;
    expect(run([{ type: 'SET_MODE', mode: 'LIVRE', focusMinutes: 50 }], started).state.mode).toBe('POMODORO');
  });
});
