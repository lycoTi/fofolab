import { describe, expect, it } from 'vitest';
import type { RoutineItem, RoutineStatus } from '../lib/dailyRoutine';
import { BETWEEN_BLOCKS_MINUTES, buildDayTrack, humanReason, roundToFiveMinutes, type DayTrack } from '../lib/dayTrack';
import { pickNowBlock, type NowBlock } from '../lib/nowBlock';
import { formatTimeOfDay } from '../lib/timeFormat';
import {
  initialBlockState,
  remainingBlockMs,
  stepBlock,
  type BlockState,
  type BlockTarget,
} from '../features/study-block/studyBlockMachine';
import type { Subject, Topic } from '../types/database';

const MIN = 60_000;
const NOW = new Date(2026, 9, 29, 14, 0);

function subject(id: string, name: string): Subject {
  return { id, name, color: '#888888' } as Subject;
}

function topic(id: string, subjectId: string, code: string, title: string): Topic {
  return { id, subject_id: subjectId, parent_id: null, code, title } as Topic;
}

const adm = subject('s-adm', 'Direito Administrativo');
const port = subject('s-port', 'Português');
const ti = subject('s-ti', 'Tecnologia da Informação');
const tAdm = topic('t-adm', adm.id, '3.1', 'Licitações');
const tPort = topic('t-port', port.id, '1.2', 'Crase');
const tTi = topic('t-ti', ti.id, '2.2.1', 'OWASP Top 10');
const tLooked = topic('t-olhada', ti.id, '4.1', 'Redes');

let blockNumber = 0;
function item(subj: Subject, top: Topic | null, status: RoutineStatus, durationMinutes: number, studiedMinutes = 0): RoutineItem {
  blockNumber += 1;
  return {
    block: { blockNumber, subjectId: subj.id, topicId: top?.id ?? null, durationMinutes, reasonText: 'Faltam 02:00 desta matéria na sua meta da semana.' },
    subject: subj,
    topic: top,
    status,
    studiedMinutes,
    remainingMinutes: durationMinutes - studiedMinutes,
  };
}

function targetOf(i: RoutineItem): BlockTarget {
  return {
    subjectId: i.subject.id,
    subjectName: i.subject.name,
    topicId: i.topic?.id ?? null,
    topicCode: i.topic?.code ?? null,
    topicTitle: i.topic?.title ?? null,
    targetMinutes: i.remainingMinutes,
  };
}

function started(target: BlockTarget, from: BlockState = initialBlockState, at = NOW.getTime()): BlockState {
  return stepBlock(from, { type: 'START', block: target, now: at }).state;
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
  if (value && typeof value === 'object') {
    Object.values(value).forEach((v) => allDates(v, found));
  }
  return found;
}

function expectNoInvalidDates(track: DayTrack) {
  for (const date of allDates(track)) {
    expect(Number.isNaN(date.getTime())).toBe(false);
    expect(formatTimeOfDay(roundToFiveMinutes(date))).toMatch(/^\d{2}:\d{2}$/);
  }
  // Os números também não podem virar NaN
  if (track.done) expect(Number.isFinite(track.done.minutes)).toBe(true);
}

const at = (h: number, m: number) => new Date(2026, 9, 29, h, m);
const subjects = [adm, port, ti];
const topics = [tAdm, tPort, tTi, tLooked];

describe('"Agora" é o bloco rodando, senão o atual do roteiro', () => {
  it('sem bloco rodando: o item atual, sem rótulo', () => {
    const done = item(port, tPort, 'done', 50, 50);
    const current = item(ti, tTi, 'current', 120);
    const now = pickNowBlock({ items: [done, current], extra: null, block: null, active: false, subjects, topics });
    expect(now).toEqual<NowBlock>({ subject: ti, topic: tTi, item: current, tag: null, running: false });
  });

  it('bloco rodando no item atual: esse item, rodando, sem rótulo', () => {
    const current = item(ti, tTi, 'current', 120);
    const now = pickNowBlock({ items: [current], extra: null, block: targetOf(current), active: true, subjects, topics });
    expect(now).toEqual<NowBlock>({ subject: ti, topic: tTi, item: current, tag: null, running: true });
  });

  it('bloco rodando num item já cumprido (meta batida na pausa): esse item com "meta cumprida"', () => {
    const doneRunning = item(ti, tTi, 'done', 120, 120);
    const current = item(adm, tAdm, 'current', 60);
    const now = pickNowBlock({ items: [doneRunning, current], extra: null, block: targetOf(doneRunning), active: true, subjects, topics });
    expect(now?.item).toBe(doneRunning);
    expect(now?.tag).toBe('meta cumprida');
    expect(now?.running).toBe(true);
  });

  it('bloco rodando fora do roteiro: matéria e tópico achados por id, sem item, "fora do roteiro"', () => {
    const current = item(adm, tAdm, 'current', 60);
    const looked: BlockTarget = { ...targetOf(current), subjectId: ti.id, topicId: tLooked.id, targetMinutes: null };
    const now = pickNowBlock({ items: [current], extra: null, block: looked, active: true, subjects, topics });
    expect(now).toEqual<NowBlock>({ subject: ti, topic: tLooked, item: null, tag: 'fora do roteiro', running: true });
  });

  it('roteiro cumprido sem nada rodando: o bloco extra', () => {
    const extra = item(adm, tAdm, 'current', 60);
    const now = pickNowBlock({ items: [item(ti, tTi, 'done', 120, 120)], extra, block: null, active: false, subjects, topics });
    expect(now?.item).toBe(extra);
    expect(now?.tag).toBeNull();
    expect(now?.running).toBe(false);
  });

  it('bloco que já terminou (não ativo) não conta como rodando', () => {
    const current = item(ti, tTi, 'current', 120);
    const now = pickNowBlock({ items: [current], extra: null, block: targetOf(item(adm, tAdm, 'next', 60)), active: false, subjects, topics });
    expect(now?.item).toBe(current);
    expect(now?.running).toBe(false);
  });

  it('nada no roteiro e nada rodando: null', () => {
    expect(pickNowBlock({ items: [], extra: null, block: null, active: false, subjects, topics })).toBeNull();
  });
});

describe('Trilho do dia com horas estimadas (agora 14:00, foco 30, ajustes padrão)', () => {
  it('antes do play com 120 min no atual: termina 16:18 (4 pomodoros + 3 pausas de 6), o próximo às 16:28 ≈ 16:30', () => {
    const current = item(ti, tTi, 'current', 120);
    const next = item(adm, tAdm, 'next', 60);
    const later = item(port, tPort, 'next', 30);
    const items = [current, next, later];
    const nowBlock = pickNowBlock({ items, extra: null, block: null, active: false, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block: initialBlockState, now: NOW });

    expect(track.nowEndsAt).toEqual(at(16, 18));
    expect(track.upcoming.map((s) => s.item)).toEqual([next, later]);
    expect(track.upcoming[0].startsAt).toEqual(at(16, 28));
    expect(track.upcoming[0].emphasis).toBe('next');
    expect(formatTimeOfDay(roundToFiveMinutes(track.upcoming[0].startsAt))).toBe('16:30');
    // 60 min = 2 pomodoros + 1 pausa de 6 = 66 min; depois o intervalo de 10
    expect(track.upcoming[1].startsAt).toEqual(at(17, 44));
    expect(track.upcoming[1].emphasis).toBe('later');
    expect(track.endsAt).toEqual(at(18, 14));
    expect(track.done).toBeNull();
    expectNoInvalidDates(track);
  });

  it('os feitos viram uma linha: 2 feitos de 50 e 40 min estudados → 2 blocos, 90 min', () => {
    const items = [item(port, tPort, 'done', 50, 50), item(adm, tAdm, 'done', 40, 40), item(ti, tTi, 'current', 120)];
    const nowBlock = pickNowBlock({ items, extra: null, block: null, active: false, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block: initialBlockState, now: NOW });
    expect(track.done).toEqual({ count: 2, minutes: 90 });
    expect(track.upcoming).toEqual([]);
    expect(track.endsAt).toEqual(track.nowEndsAt);
  });

  it('bloco rodando: o fim do atual é agora + o que falta dele', () => {
    const current = item(ti, tTi, 'current', 120);
    const next = item(adm, tAdm, 'next', 60);
    const items = [current, next];
    const block = started(targetOf(current), initialBlockState, at(13, 40).getTime());
    const nowBlock = pickNowBlock({ items, extra: null, block: block.block, active: true, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block, now: NOW });
    const remaining = remainingBlockMs(block, NOW.getTime()) ?? 0;
    expect(track.nowEndsAt).toEqual(new Date(NOW.getTime() + remaining));
    expect(track.nowEndsAt).toEqual(at(15, 58));
    expect(track.upcoming[0].startsAt).toEqual(at(16, 8));
    expectNoInvalidDates(track);
  });

  it('modo Livre antes do play: o bloco dura a meta de foco, sem pausas', () => {
    const current = item(ti, tTi, 'current', 120);
    const next = item(adm, tAdm, 'next', 60);
    const livre: BlockState = { ...initialBlockState, mode: 'LIVRE' };
    const items = [current, next];
    const nowBlock = pickNowBlock({ items, extra: null, block: null, active: false, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block: livre, now: NOW });
    expect(track.nowEndsAt).toEqual(at(16, 0));
    expect(track.upcoming[0].startsAt).toEqual(at(16, BETWEEN_BLOCKS_MINUTES));
    expect(track.endsAt).toEqual(at(17, 10));
  });

  it('meta cumprida na pausa: "agora" é o bloco rodando, fora dos feitos, e o próximo é o novo atual', () => {
    const before = item(port, tPort, 'done', 50, 50);
    const running = item(ti, tTi, 'done', 60, 60);
    const current = item(adm, tAdm, 'current', 60);
    const items = [before, running, current];
    let block = started({ ...targetOf(running), targetMinutes: 60 }, initialBlockState, at(13, 0).getTime());
    block = stepBlock(block, { type: 'TICK', now: at(13, 30).getTime() }).state;
    const nowBlock = pickNowBlock({ items, extra: null, block: block.block, active: true, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block, now: NOW });
    expect(nowBlock?.tag).toBe('meta cumprida');
    expect(track.done).toEqual({ count: 1, minutes: 50 });
    expect(track.upcoming.map((s) => s.item)).toEqual([current]);
    expect(track.upcoming[0].emphasis).toBe('next');
    expectNoInvalidDates(track);
  });

  it('Livre sem meta rodando (olhada): sem hora de fim e o roteiro conta como se ele terminasse agora (≈ 14:10)', () => {
    const current = item(adm, tAdm, 'current', 60);
    const next = item(port, tPort, 'next', 30);
    const items = [item(ti, tTi, 'done', 120, 120), current, next];
    const looked: BlockTarget = { subjectId: ti.id, subjectName: ti.name, topicId: tLooked.id, topicCode: '4.1', topicTitle: 'Redes', targetMinutes: null };
    const block = started(looked, { ...initialBlockState, mode: 'LIVRE' }, at(13, 50).getTime());
    const nowBlock = pickNowBlock({ items, extra: null, block: block.block, active: true, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block, now: NOW });

    expect(nowBlock?.tag).toBe('fora do roteiro');
    expect(track.nowEndsAt).toBeNull();
    expect(track.upcoming.map((s) => s.item)).toEqual([current, next]);
    expect(track.upcoming[0].startsAt).toEqual(at(14, 10));
    expect(formatTimeOfDay(roundToFiveMinutes(track.upcoming[0].startsAt))).toBe('14:10');
    // No modo Livre, o bloco seguinte dura a meta: 14:10 + 60 + 10
    expect(track.upcoming[1].startsAt).toEqual(at(15, 20));
    expect(track.endsAt).toEqual(at(15, 50));
    expectNoInvalidDates(track);
  });

  it('Livre sem meta rodando sem nada depois: nenhuma hora, nenhum NaN', () => {
    const items = [item(ti, tTi, 'done', 120, 120)];
    const looked: BlockTarget = { subjectId: ti.id, subjectName: ti.name, topicId: tLooked.id, topicCode: '4.1', topicTitle: 'Redes', targetMinutes: null };
    const block = started(looked, { ...initialBlockState, mode: 'LIVRE' });
    const nowBlock = pickNowBlock({ items, extra: null, block: block.block, active: true, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block, now: NOW });
    expect(track).toEqual<DayTrack>({ done: { count: 1, minutes: 120 }, nowEndsAt: null, upcoming: [], endsAt: null });
  });

  it('roteiro cumprido: o extra é o "agora"; se outro bloco roda, o extra vira o próximo', () => {
    const items = [item(ti, tTi, 'done', 120, 120)];
    const extra = item(adm, tAdm, 'current', 60);
    const idleNow = pickNowBlock({ items, extra, block: null, active: false, subjects, topics });
    const idleTrack = buildDayTrack({ items, extra, nowBlock: idleNow, block: initialBlockState, now: NOW });
    expect(idleTrack.upcoming).toEqual([]);
    expect(idleTrack.nowEndsAt).toEqual(at(15, 6));

    const looked: BlockTarget = { subjectId: ti.id, subjectName: ti.name, topicId: tLooked.id, topicCode: '4.1', topicTitle: 'Redes', targetMinutes: 30 };
    const block = started(looked);
    const runningNow = pickNowBlock({ items, extra, block: block.block, active: true, subjects, topics });
    const runningTrack = buildDayTrack({ items, extra, nowBlock: runningNow, block, now: NOW });
    expect(runningTrack.nowEndsAt).toEqual(at(14, 30));
    expect(runningTrack.upcoming.map((s) => s.item)).toEqual([extra]);
    expect(runningTrack.upcoming[0].startsAt).toEqual(at(14, 40));
  });

  it('atraso só empurra as horas: tudo começa a partir de agora, nunca antes', () => {
    const items = [item(ti, tTi, 'current', 120), item(adm, tAdm, 'next', 60)];
    const late = new Date(2026, 9, 29, 21, 37);
    const nowBlock = pickNowBlock({ items, extra: null, block: null, active: false, subjects, topics });
    const track = buildDayTrack({ items, extra: null, nowBlock, block: initialBlockState, now: late });
    for (const date of allDates(track)) expect(date.getTime()).toBeGreaterThanOrEqual(late.getTime());
    expectNoInvalidDates(track);
  });

  it('sem roteiro e sem bloco: trilho vazio, sem horas', () => {
    const track = buildDayTrack({ items: [], extra: null, nowBlock: null, block: initialBlockState, now: NOW });
    expect(track).toEqual<DayTrack>({ done: null, nowEndsAt: null, upcoming: [], endsAt: null });
  });
});

describe('Horas arredondadas para 5 min (a mais próxima)', () => {
  it('arredonda para o múltiplo de 5 mais próximo e zera os segundos', () => {
    expect(roundToFiveMinutes(at(16, 28))).toEqual(at(16, 30));
    expect(roundToFiveMinutes(at(16, 18))).toEqual(at(16, 20));
    expect(roundToFiveMinutes(at(16, 22))).toEqual(at(16, 20));
    expect(roundToFiveMinutes(new Date(2026, 9, 29, 16, 27, 30))).toEqual(at(16, 30));
    expect(roundToFiveMinutes(new Date(2026, 9, 29, 16, 20, 45))).toEqual(at(16, 20));
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
