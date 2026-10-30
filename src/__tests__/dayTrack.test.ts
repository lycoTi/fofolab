import { describe, expect, it } from 'vitest';
import { BETWEEN_BLOCKS_MINUTES, buildDayTrack, humanReason, roundToFiveMinutes, type DayTrack } from '../features/routine/dayTrack';
import { pickNowBlock } from '../features/routine/nowBlock';
import { formatTimeOfDay } from '../lib/timeFormat';
import { initialBlockState, remainingBlockMs, stepBlock, type BlockState, type BlockTarget } from '../features/study-block/studyBlockMachine';
import type { RoutineItem } from '../lib/dailyRoutine';
import { adm, item, lookedTarget, port, subjects, tAdm, ti, topics, tPort, targetOf, tTi } from './helpers/routineFixtures';

const at = (h: number, m: number) => new Date(2026, 9, 29, h, m);
const NOW = at(14, 0);

function started(target: BlockTarget, from: BlockState = initialBlockState, when = NOW.getTime()): BlockState {
  return stepBlock(from, { type: 'START', block: target, now: when }).state;
}

/** Monta o "agora" e o trilho como o App vai montar. */
function track(items: RoutineItem[], block: BlockState, options: { extra?: RoutineItem | null; now?: Date } = {}) {
  const extra = options.extra ?? null;
  const active = block.phase !== 'IDLE' && block.phase !== 'DONE';
  const nowBlock = pickNowBlock({ items, extra, block: block.block, active, subjects, topics });
  return { nowBlock, track: buildDayTrack({ items, extra, nowBlock, block, now: options.now ?? NOW }) };
}

/** Percorre o resultado inteiro e devolve toda Date que achar (para provar que nenhuma é inválida). */
function allDates(value: unknown, found: Date[] = []): Date[] {
  if (value instanceof Date) {
    found.push(value);
    return found;
  }
  if (Array.isArray(value)) {
    value.forEach((v) => allDates(v, found));
    return found;
  }
  if (value && typeof value === 'object') Object.values(value).forEach((v) => allDates(v, found));
  return found;
}

function expectNoInvalidDates(result: DayTrack) {
  for (const date of allDates(result)) {
    expect(Number.isNaN(date.getTime())).toBe(false);
    expect(formatTimeOfDay(roundToFiveMinutes(date))).toMatch(/^\d{2}:\d{2}$/);
  }
  if (result.done) expect(Number.isFinite(result.done.minutes)).toBe(true);
}

describe('Trilho do dia com horas estimadas (agora 14:00, foco 30, ajustes padrão)', () => {
  it('antes do play com 120 min no atual: termina 16:18 (4 pomodoros + 3 pausas de 6), o próximo às 16:28 ≈ 16:30', () => {
    const next = item(adm, tAdm, 'next', 60);
    const later = item(port, tPort, 'next', 30);
    const { track: result } = track([item(ti, tTi, 'current', 120), next, later], initialBlockState);

    expect(result.nowEndsAt).toEqual(at(16, 18));
    expect(result.upcoming.map((s) => s.item)).toEqual([next, later]);
    expect(result.upcoming[0].startsAt).toEqual(at(16, 28));
    expect(result.upcoming[0].emphasis).toBe('next');
    expect(formatTimeOfDay(roundToFiveMinutes(result.upcoming[0].startsAt))).toBe('16:30');
    // 60 min = 2 pomodoros + 1 pausa de 6 = 66 min; depois o intervalo de 10
    expect(result.upcoming[1].startsAt).toEqual(at(17, 44));
    expect(result.upcoming[1].emphasis).toBe('later');
    expect(result.endsAt).toEqual(at(18, 14));
    expect(result.done).toBeNull();
    expectNoInvalidDates(result);
  });

  it('os feitos viram uma linha: 2 feitos de 50 e 40 min estudados → 2 blocos, 90 min', () => {
    const items = [item(port, tPort, 'done', 50, 50), item(adm, tAdm, 'done', 40, 40), item(ti, tTi, 'current', 120)];
    const { track: result } = track(items, initialBlockState);
    expect(result.done).toEqual({ count: 2, minutes: 90 });
    expect(result.upcoming).toEqual([]);
    expect(result.endsAt).toEqual(result.nowEndsAt);
  });

  it('bloco rodando: o fim do atual é agora + o que falta dele', () => {
    const current = item(ti, tTi, 'current', 120);
    const block = started(targetOf(current), initialBlockState, at(13, 40).getTime());
    const { track: result } = track([current, item(adm, tAdm, 'next', 60)], block);
    expect(result.nowEndsAt).toEqual(new Date(NOW.getTime() + (remainingBlockMs(block, NOW.getTime()) ?? 0)));
    // 10 do pomodoro atual + 3 × 30 + 3 pausas de 6
    expect(result.nowEndsAt).toEqual(at(15, 58));
    expect(result.upcoming[0].startsAt).toEqual(at(16, 8));
    expectNoInvalidDates(result);
  });

  it('modo Livre antes do play: o bloco dura a meta de foco, sem pausas', () => {
    const livre: BlockState = { ...initialBlockState, mode: 'LIVRE' };
    const { track: result } = track([item(ti, tTi, 'current', 120), item(adm, tAdm, 'next', 60)], livre);
    expect(result.nowEndsAt).toEqual(at(16, 0));
    expect(result.upcoming[0].startsAt).toEqual(at(16, BETWEEN_BLOCKS_MINUTES));
    expect(result.endsAt).toEqual(at(17, 10));
  });

  it('meta cumprida na pausa: "agora" é o bloco rodando, fora dos feitos, e o próximo é o novo atual', () => {
    const running = item(ti, tTi, 'done', 60, 60);
    const current = item(adm, tAdm, 'current', 60);
    let block = started(targetOf({ ...running, remainingMinutes: 60 }), initialBlockState, at(13, 0).getTime());
    block = stepBlock(block, { type: 'TICK', now: at(13, 30).getTime() }).state;
    const { nowBlock, track: result } = track([item(port, tPort, 'done', 50, 50), running, current], block);
    expect(nowBlock?.tag).toBe('meta cumprida');
    expect(result.done).toEqual({ count: 1, minutes: 50 });
    expect(result.upcoming.map((s) => s.item)).toEqual([current]);
    expect(result.upcoming[0].emphasis).toBe('next');
    expectNoInvalidDates(result);
  });

  it('Livre sem meta rodando (olhada): sem hora de fim e o roteiro conta como se ele terminasse agora (≈ 14:10)', () => {
    const current = item(adm, tAdm, 'current', 60);
    const next = item(port, tPort, 'next', 30);
    const block = started(lookedTarget(null), { ...initialBlockState, mode: 'LIVRE' }, at(13, 50).getTime());
    const { nowBlock, track: result } = track([item(ti, tTi, 'done', 120, 120), current, next], block);

    expect(nowBlock?.tag).toBe('fora do roteiro');
    expect(result.nowEndsAt).toBeNull();
    expect(result.upcoming.map((s) => s.item)).toEqual([current, next]);
    expect(result.upcoming[0].startsAt).toEqual(at(14, 10));
    expect(formatTimeOfDay(roundToFiveMinutes(result.upcoming[0].startsAt))).toBe('14:10');
    // No modo Livre, o bloco seguinte dura a meta: 14:10 + 60 + 10
    expect(result.upcoming[1].startsAt).toEqual(at(15, 20));
    expect(result.endsAt).toEqual(at(15, 50));
    expectNoInvalidDates(result);
  });

  it('Livre sem meta rodando sem nada depois: nenhuma hora, nenhum NaN', () => {
    const block = started(lookedTarget(null), { ...initialBlockState, mode: 'LIVRE' });
    const { track: result } = track([item(ti, tTi, 'done', 120, 120)], block);
    expect(result).toEqual<DayTrack>({ done: { count: 1, minutes: 120 }, nowEndsAt: null, upcoming: [], endsAt: null });
  });

  it('roteiro cumprido: o extra é o "agora"; se outro bloco roda, o extra vira o próximo', () => {
    const items = [item(ti, tTi, 'done', 120, 120)];
    const extra = item(adm, tAdm, 'current', 60);
    const idle = track(items, initialBlockState, { extra }).track;
    expect(idle.upcoming).toEqual([]);
    expect(idle.nowEndsAt).toEqual(at(15, 6));

    const running = track(items, started(lookedTarget(30)), { extra }).track;
    expect(running.nowEndsAt).toEqual(at(14, 30));
    expect(running.upcoming.map((s) => s.item)).toEqual([extra]);
    expect(running.upcoming[0].startsAt).toEqual(at(14, 40));
  });

  it('atraso só empurra as horas: tudo começa a partir de agora, nunca antes', () => {
    const late = at(21, 37);
    const { track: result } = track([item(ti, tTi, 'current', 120), item(adm, tAdm, 'next', 60)], initialBlockState, { now: late });
    for (const date of allDates(result)) expect(date.getTime()).toBeGreaterThanOrEqual(late.getTime());
    expectNoInvalidDates(result);
  });

  it('sem roteiro e sem bloco: trilho vazio, sem horas', () => {
    const result = buildDayTrack({ items: [], extra: null, nowBlock: null, block: initialBlockState, now: NOW });
    expect(result).toEqual<DayTrack>({ done: null, nowEndsAt: null, upcoming: [], endsAt: null });
  });
});

describe('Horas arredondadas para 5 min (para cima, nos minutos inteiros)', () => {
  it('sobe para o próximo múltiplo de 5 e ignora os segundos', () => {
    expect(roundToFiveMinutes(at(16, 28))).toEqual(at(16, 30));
    expect(roundToFiveMinutes(at(16, 18))).toEqual(at(16, 20));
    expect(roundToFiveMinutes(at(16, 22))).toEqual(at(16, 25));
    expect(roundToFiveMinutes(at(16, 20))).toEqual(at(16, 20));
    expect(roundToFiveMinutes(new Date(2026, 9, 29, 16, 20, 45))).toEqual(at(16, 20));
    expect(roundToFiveMinutes(new Date(2026, 9, 29, 16, 27, 30))).toEqual(at(16, 30));
  });

  it('Livre com a meta já passada: o fim é "agora" e a hora exibida não fica antes do relógio', () => {
    const now = new Date(2026, 9, 29, 14, 2, 40);
    const current = item(ti, tTi, 'current', 30);
    const livre = started(targetOf(current), { ...initialBlockState, mode: 'LIVRE' }, at(13, 0).getTime());
    const { track: result } = track([current], livre, { now });
    expect(result.nowEndsAt).toEqual(now);
    expect(formatTimeOfDay(roundToFiveMinutes(now))).toBe('14:05');
  });

  it('passa da meia-noite sem quebrar', () => {
    expect(roundToFiveMinutes(at(23, 58))).toEqual(new Date(2026, 9, 30, 0, 0));
  });
});

describe('Motivo humano do bloco', () => {
  it('fica só a frase até o primeiro " • ", com ponto final', () => {
    expect(humanReason('Faltam 08:45 desta matéria na sua meta da semana • Peso 1.5x • Domínio 64%.')).toBe(
      'Faltam 08:45 desta matéria na sua meta da semana.'
    );
  });

  it('o bloco extra perde o "(peso Xx)"', () => {
    expect(humanReason('Meta da semana cumprida — bloco extra na matéria de maior prioridade (peso 2x).')).toBe(
      'Meta da semana cumprida — bloco extra na matéria de maior prioridade.'
    );
  });

  it('Revisão da semana e Reta final já são humanos e ficam iguais', () => {
    const review = 'Revisão da semana: 2.1 Crase foi estudado há 6 dias.';
    const stretch = 'Reta final: revisar 2.1 Crase (estudado há 3 dias).';
    expect(humanReason(review)).toBe(review);
    expect(humanReason(stretch)).toBe(stretch);
  });

  it('texto vazio: nenhum motivo', () => {
    expect(humanReason('')).toBeNull();
    expect(humanReason('   ')).toBeNull();
  });
});
