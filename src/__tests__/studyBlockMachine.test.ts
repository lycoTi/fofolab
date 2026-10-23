import { describe, expect, it } from 'vitest';
import {
  phaseProgress,
  planPreview,
  shortBreakMinutes,
  DEFAULT_POMODORO_SETTINGS,
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

  it('pomodoro de 30 → pausa de 6 → pronto para o próximo, gravando cada trecho de foco', () => {
    const { state, recorded } = run([
      { type: 'START', block, now: 0 },
      { type: 'TICK', now: 30 * MIN },
    ]);
    expect(state.phase).toBe('BREAK');
    expect(totalPomodoros(state)).toBe(3);
    expect(recorded).toEqual([{ subjectId: 'subj-arq', topicId: 't-1-1', durationMinutes: 30, pausesCount: 0, wasSkipped: false }]);
    expect(phaseRemainingMs(state, 32 * MIN)).toBe(4 * MIN);

    const afterBreak = run([{ type: 'TICK', now: 36 * MIN }], state);
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

  it('pausa da olhada (silenciosa) não conta como atrito do estudante', () => {
    const { recorded } = run([
      { type: 'START', block, now: 0 },
      { type: 'PAUSE', now: 10 * MIN, silent: true },
      { type: 'RESUME', now: 25 * MIN },
      { type: 'TICK', now: 45 * MIN },
    ]);
    expect(recorded).toEqual([expect.objectContaining({ durationMinutes: 30, pausesCount: 0 })]);
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

describe('barrinha de progresso do bloco', () => {
  it('pomodoro: fração do foco já corrida; pausa: fração da pausa; pronto: sem barra', () => {
    const started = run([{ type: 'SET_MODE', mode: 'POMODORO', focusMinutes: 30 }, { type: 'START', block, now: 0 }]).state;
    expect(phaseProgress(started, 0)).toBe(0);
    expect(phaseProgress(started, 15 * MIN)).toBeCloseTo(0.5);
    const paused = run([{ type: 'PAUSE', now: 6 * MIN }], started).state;
    expect(phaseProgress(paused, 20 * MIN)).toBeCloseTo(0.2);
    const onBreak = run([{ type: 'TICK', now: 30 * MIN }], started).state;
    expect(onBreak.phase).toBe('BREAK');
    expect(phaseProgress(onBreak, 30 * MIN)).toBe(0);
    expect(phaseProgress(run([], initialBlockState).state, 0)).toBeNull();
  });

  it('modo livre com meta: fração da meta; sem meta: sem barra', () => {
    const free = run([{ type: 'SET_MODE', mode: 'LIVRE', focusMinutes: 30 }, { type: 'START', block, now: 0 }]).state;
    expect(phaseProgress(free, 15 * MIN)).toBeCloseTo(15 / (block.targetMinutes ?? 1));
    const noTarget = run([{ type: 'SET_MODE', mode: 'LIVRE', focusMinutes: 30 }, { type: 'START', block: { ...block, targetMinutes: null }, now: 0 }]).state;
    expect(phaseProgress(noTarget, 15 * MIN)).toBeNull();
  });
});

describe('FofoDoro: pausa curta, pausa longa e ciclo entre blocos', () => {
  const DAY = 24 * 60 * MIN;
  const focusEnd = (from: BlockState, at: number) => run([{ type: 'TICK', now: at }], from);
  const longBlock: BlockTarget = { ...block, targetMinutes: 600 };

  it('pausa curta é proporcional ao foco (1 de pausa para cada 5 de foco, mínimo 5) e pode ser fixada à mão', () => {
    expect(shortBreakMinutes(20, DEFAULT_POMODORO_SETTINGS)).toBe(5);
    expect(shortBreakMinutes(25, DEFAULT_POMODORO_SETTINGS)).toBe(5);
    expect(shortBreakMinutes(30, DEFAULT_POMODORO_SETTINGS)).toBe(6);
    expect(shortBreakMinutes(50, DEFAULT_POMODORO_SETTINGS)).toBe(10);
    expect(shortBreakMinutes(50, { ...DEFAULT_POMODORO_SETTINGS, shortBreakMinutes: 8 })).toBe(8);
  });

  it('fim do foco avisa com parabéns e sugere a pausa; fim da pausa espera o estudante', () => {
    const started = run([{ type: 'START', block: longBlock, now: 0 }]).state;
    const step = stepBlock(started, { type: 'TICK', now: 30 * MIN });
    expect(step.state.phase).toBe('BREAK');
    expect(step.state.breakKind).toBe('SHORT');
    expect(step.message).toBe('Parabéns: 30 minutos de foco! Que tal 6 minutos de pausa?');
    const afterBreak = stepBlock(step.state, { type: 'TICK', now: 36 * MIN });
    expect(afterBreak.state.phase).toBe('READY');
    expect(afterBreak.message).toBe('Pausa concluída. Comece o próximo pomodoro quando estiver pronto.');
    // Nenhum tique leva de volta ao foco sozinho
    expect(stepBlock(afterBreak.state, { type: 'TICK', now: 90 * MIN }).state.phase).toBe('READY');
  });

  it('o 4º pomodoro do ciclo leva à pausa longa, e o ciclo recomeça depois dela', () => {
    let state = run([{ type: 'START', block: longBlock, now: 0 }]).state;
    let t = 0;
    for (let i = 0; i < 3; i++) {
      t += 30 * MIN;
      state = focusEnd(state, t).state; // pausa curta
      t += 6 * MIN;
      state = focusEnd(state, t).state; // pronto
      state = run([{ type: 'NEXT', now: t }], state).state;
    }
    expect(state.cyclePomodoros).toBe(3);
    t += 30 * MIN;
    const long = stepBlock(state, { type: 'TICK', now: t });
    expect(long.state.breakKind).toBe('LONG');
    expect(long.message).toBe('4 pomodoros seguidos! Pausa longa de 20 minutos — você mereceu.');
    expect(phaseRemainingMs(long.state, t)).toBe(20 * MIN);
    const after = stepBlock(long.state, { type: 'TICK', now: t + 20 * MIN });
    expect(after.state.phase).toBe('READY');
    expect(after.state.cyclePomodoros).toBe(0);
  });

  it('a contagem do ciclo continua em outro bloco no mesmo dia e zera em outro dia', () => {
    const twoPomodoros = { ...block, targetMinutes: 60 };
    let state = run([{ type: 'START', block: twoPomodoros, now: 0 }]).state;
    state = focusEnd(state, 30 * MIN).state;
    state = focusEnd(state, 36 * MIN).state;
    state = run([{ type: 'NEXT', now: 36 * MIN }, { type: 'TICK', now: 66 * MIN }], state).state;
    expect(state.phase).toBe('DONE');
    expect(state.cyclePomodoros).toBe(2);

    const sameDay = run([{ type: 'START', block: { ...block, subjectId: 'outra' }, now: 70 * MIN }], state).state;
    expect(sameDay.cyclePomodoros).toBe(2);
    expect(sameDay.completedPomodoros).toBe(0);

    const nextDay = run([{ type: 'START', block, now: 2 * DAY }], state).state;
    expect(nextDay.cyclePomodoros).toBe(0);
  });

  it('bloco de um pomodoro só termina sem pausa, com o resumo do foco', () => {
    const one = { ...block, targetMinutes: 30 };
    const started = run([{ type: 'START', block: one, now: 0 }]).state;
    const step = stepBlock(started, { type: 'TICK', now: 30 * MIN });
    expect(step.state.phase).toBe('DONE');
    expect(step.message).toBe('Bloco concluído: 00:30 de foco em Arquitetura e Integração de Sistemas.');
  });

  it('ajustes só mudam entre pomodoros, e valem para a próxima pausa', () => {
    const started = run([{ type: 'START', block: longBlock, now: 0 }]).state;
    const locked = run([{ type: 'SET_SETTINGS', settings: { shortBreakMinutes: 9, longBreakMinutes: 25, longEvery: 3 } }], started).state;
    expect(locked.settings).toEqual(DEFAULT_POMODORO_SETTINGS);
    const idleState = run([{ type: 'SET_SETTINGS', settings: { shortBreakMinutes: 9, longBreakMinutes: 25, longEvery: 3 } }]).state;
    expect(idleState.settings.longEvery).toBe(3);
    const withSettings = run([{ type: 'START', block: longBlock, now: 0 }], idleState).state;
    expect(phaseRemainingMs(focusEnd(withSettings, 30 * MIN).state, 30 * MIN)).toBe(9 * MIN);
  });

  it('prévia do bloco: pomodoros, pausas e tempo total', () => {
    expect(planPreview(100, 25, DEFAULT_POMODORO_SETTINGS, 0)).toEqual({ pomodoros: 4, shortBreaks: 3, longBreaks: 0, totalMinutes: 115 });
    // Já com 2 do ciclo feitos hoje: o 2º pomodoro deste bloco fecha o ciclo e a pausa depois dele é longa
    expect(planPreview(100, 25, DEFAULT_POMODORO_SETTINGS, 2)).toEqual({ pomodoros: 4, shortBreaks: 2, longBreaks: 1, totalMinutes: 100 + 10 + 20 });
  });
});

describe('preferências do FofoDoro neste computador', () => {
  it('lê ajustes salvos e corrige valores estranhos', async () => {
    const { loadPomodoroPrefs, POMODORO_PREFS_KEY } = await import('../features/study-block/useStudyBlock');
    localStorage.setItem(POMODORO_PREFS_KEY, JSON.stringify({ mode: 'POMODORO', focusMinutes: 25, settings: { shortBreakMinutes: 99, longBreakMinutes: 20, longEvery: 4 } }));
    expect(loadPomodoroPrefs().settings.shortBreakMinutes).toBe(15);
    expect(loadPomodoroPrefs().focusMinutes).toBe(25);
    localStorage.setItem(POMODORO_PREFS_KEY, 'isto não é json');
    expect(loadPomodoroPrefs().settings.longEvery).toBe(4);
    localStorage.clear();
  });
});
