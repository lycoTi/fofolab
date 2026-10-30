import { describe, expect, it } from 'vitest';
import { buildDayTrack, type DayTrack } from '../features/routine/dayTrack';
import { pickNowBlock } from '../features/routine/nowBlock';
import { initialBlockState, stepBlock, type BlockState } from '../features/study-block/studyBlockMachine';
import type { RoutineItem } from '../lib/dailyRoutine';
import { adm, item, port, subjects, tAdm, ti, topics, tPort, targetOf, tTi } from './helpers/routineFixtures';

/**
 * As horas do trilho conferidas contra a própria máquina do FofoDoro: cada bloco é "estudado" com START, TICK e NEXT
 * sem atraso, com 10 min entre blocos. Assim a pausa longa que cai no meio do bloco seguinte (o ciclo continua entre
 * blocos do mesmo dia) aparece na estimativa do mesmo jeito que vai aparecer no relógio.
 */
const MIN = 60_000;
const at = (h: number, m: number) => new Date(2026, 9, 29, h, m);

const isActive = (state: BlockState) => state.phase !== 'IDLE' && state.phase !== 'DONE';

/** Leva o bloco até o fim sem pausas apertadas: cada fase termina na hora e o próximo pomodoro começa na hora. */
function runToDone(from: BlockState, now: number): { state: BlockState; end: number } {
  let state = from;
  let time = now;
  while (state.phase !== 'DONE') {
    if (state.phase === 'READY') {
      state = stepBlock(state, { type: 'NEXT', now: time }).state;
      continue;
    }
    time = state.phaseEndsAt ?? time;
    state = stepBlock(state, { type: 'TICK', now: time }).state;
  }
  return { state, end: time };
}

/** O dia de verdade: termina (ou começa agora) o primeiro bloco e estuda os outros com 10 min entre eles. */
function simulate(from: BlockState, now: Date, items: RoutineItem[]) {
  let state = from;
  let time = now.getTime();
  const queue = [...items];
  // O primeiro item é o "agora": já rodando, só termina; parado, começa agora
  const first = queue.shift();
  if (!isActive(state) && first) state = stepBlock(state, { type: 'START', block: targetOf(first), now: time }).state;
  ({ state, end: time } = runToDone(state, time));
  const nowEnd = time;
  const starts: number[] = [];
  for (const next of queue) {
    time += 10 * MIN;
    starts.push(time);
    state = stepBlock(state, { type: 'START', block: targetOf(next), now: time }).state;
    ({ state, end: time } = runToDone(state, time));
  }
  return { nowEnd, starts, end: time };
}

function track(items: RoutineItem[], block: BlockState, now: Date): DayTrack {
  const nowBlock = pickNowBlock({ items, extra: null, block: block.block, active: isActive(block), subjects, topics });
  return buildDayTrack({ items, extra: null, nowBlock, block, now });
}

function expectMatchesMachine(result: DayTrack, simulated: ReturnType<typeof simulate>) {
  expect(result.nowEndsAt?.getTime()).toBe(simulated.nowEnd);
  expect(result.upcoming.map((s) => s.startsAt.getTime())).toEqual(simulated.starts);
  expect(result.endsAt?.getTime()).toBe(simulated.end);
}

describe('O trilho bate com a máquina do FofoDoro (ciclo continua entre blocos)', () => {
  it('blocos de 90 min: o 2º começa com a pausa longa (o 4º pomodoro seguido cai no 1º dele)', () => {
    const items = [item(ti, tTi, 'current', 90), item(adm, tAdm, 'next', 90), item(port, tPort, 'next', 90)];
    const result = track(items, initialBlockState, at(14, 0));
    // 1º: 3 × 30 + 2 pausas de 6 = 102 → 15:42; 2º: ciclo 3 → 90 + longa 20 + curta 6 = 116; 3º: ciclo 2 → 90 + 6 + 20
    expect(result.nowEndsAt).toEqual(at(15, 42));
    expect(result.upcoming[0].startsAt).toEqual(at(15, 52));
    expect(result.upcoming[1].startsAt).toEqual(at(17, 58));
    expect(result.endsAt).toEqual(at(19, 54));
    expectMatchesMachine(result, simulate(initialBlockState, at(14, 0), items));
  });

  it('antes do play, depois de um bloco já feito hoje (ciclo em 3)', () => {
    const earlier = item(port, tPort, 'done', 90, 90);
    const earlierTarget = { ...targetOf(earlier), targetMinutes: 90 };
    const before = runToDone(stepBlock(initialBlockState, { type: 'START', block: earlierTarget, now: at(12, 0).getTime() }).state, 0).state;
    expect(before.cyclePomodoros).toBe(3);
    const items = [earlier, item(ti, tTi, 'current', 120), item(adm, tAdm, 'next', 60), item(port, tPort, 'next', 90), item(ti, tTi, 'next', 30)];
    expectMatchesMachine(track(items, before, at(14, 0)), simulate(before, at(14, 0), items.slice(1)));
  });

  it('no meio do foco: o ciclo do fim do bloco atual passa para os seguintes', () => {
    const current = item(ti, tTi, 'current', 120);
    const items = [current, item(adm, tAdm, 'next', 90), item(port, tPort, 'next', 90)];
    const block = stepBlock(initialBlockState, { type: 'START', block: targetOf(current), now: at(13, 40).getTime() }).state;
    expectMatchesMachine(track(items, block, at(14, 0)), simulate(block, at(14, 0), items));
  });

  it('numa pausa de verdade: começou 13:00 com meta 120, 1º pomodoro acabou 13:30, agora 13:32 → termina 15:18', () => {
    const current = item(ti, tTi, 'current', 120);
    const items = [current, item(adm, tAdm, 'next', 90)];
    let block = stepBlock(initialBlockState, { type: 'START', block: targetOf(current), now: at(13, 0).getTime() }).state;
    block = stepBlock(block, { type: 'TICK', now: at(13, 30).getTime() }).state;
    expect(block.phase).toBe('BREAK');
    const result = track(items, block, at(13, 32));
    // 4 da pausa curta + 3 × 30 + 2 pausas curtas de 6 (ciclo 2 e 3) = 106 min
    expect(result.nowEndsAt).toEqual(at(15, 18));
    expectMatchesMachine(result, simulate(block, at(13, 32), items));
  });
});
