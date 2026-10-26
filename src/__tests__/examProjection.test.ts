import { describe, expect, it } from 'vitest';
import { estimateTopicMinutes, projectTopics, realPace, stretchStartKey, TOPIC_MINUTES_BY_LEVEL, topicLevel, weekSlots } from '../lib/examProjection';
import type { StudySession, Subject, Topic } from '../types/database';

const NOW = new Date(2026, 9, 26, 10, 0); // segunda 26/10/2026
const DAY = 86_400_000;
const daysAgo = (n: number) => new Date(NOW.getTime() - n * DAY).toISOString();

const subject = (level: number) => ({ id: 's', initial_knowledge_level: level }) as unknown as Subject;
const topic = (id: string, level: number | null = null) => ({ id, subject_id: 's', initial_knowledge_level: level }) as unknown as Topic;
const session = (topicId: string, minutes: number, at: string, skipped = 0): StudySession => ({
  id: `${topicId}-${at}`, subject_id: 's', topic_id: topicId, duration_minutes: minutes, session_type: 'POMODORO',
  pauses_count: 0, was_skipped: skipped, started_at: at,
});

describe('Tempo por tópico (spec 13 §4.3)', () => {
  it('autoavaliação: Nunca vi 02:00 · Já vi por cima 01:30 · Sei bem 01:00 · Domino 00:30', () => {
    expect(TOPIC_MINUTES_BY_LEVEL).toEqual({ 1: 120, 2: 90, 3: 60, 4: 30 });
  });

  it('nível do tópico vence o da matéria; nulo herda; fora de 1–4 fica no limite', () => {
    expect(topicLevel(topic('a', 3), subject(1))).toBe(3);
    expect(topicLevel(topic('a', null), subject(2))).toBe(2);
    expect(topicLevel(topic('a', 9), subject(2))).toBe(4);
    expect(topicLevel(topic('a', 0), subject(2))).toBe(1);
  });

  it('sem nível próprio, o tópico herda o do grupo (o Wizard avalia os grupos) antes do da matéria', () => {
    expect(topicLevel(topic('a', null), subject(1), 4)).toBe(4);
    expect(topicLevel(topic('a', 2), subject(1), 4)).toBe(2);
    expect(topicLevel(topic('a', null), subject(1), null)).toBe(1);
  });

  it('ritmo real: média dos minutos nos tópicos vistos pela 1ª vez nas últimas 4 semanas', () => {
    const leaf = new Set(['a', 'b', 'c', 'd', 'e']);
    const pace = realPace({
      sessions: [
        session('a', 60, daysAgo(3)), session('a', 30, daysAgo(2)),
        session('b', 50, daysAgo(10)),
        session('c', 40, daysAgo(40)), // visto pela 1ª vez há 40 dias: fora
        session('d', 90, daysAgo(5), 1), // pulada: não conta
      ],
      firstStudyDates: { a: daysAgo(3), b: daysAgo(10), c: daysAgo(40), d: daysAgo(5), e: daysAgo(4) },
      leafTopicIds: leaf,
      now: NOW,
    });
    // a = 90, b = 50; d só tem sessão pulada e e só tem registro de fora (sem minutos): ficam de fora
    expect(pace).toEqual({ minutesPerTopic: 70, sample: 2 });
  });

  it('sem histórico, nenhum ritmo', () => {
    expect(realPace({ sessions: [], firstStudyDates: {}, leafTopicIds: new Set(), now: NOW })).toEqual({ minutesPerTopic: null, sample: 0 });
  });

  it('mistura pela confiança C = n ÷ (n + 5): 0 tópicos → autoavaliação; 5 → metade; 45 → quase o real', () => {
    expect(estimateTopicMinutes(120, { minutesPerTopic: null, sample: 0 })).toBe(120);
    expect(estimateTopicMinutes(120, { minutesPerTopic: 60, sample: 5 })).toBe(90);
    expect(estimateTopicMinutes(120, { minutesPerTopic: 60, sample: 45 })).toBe(65);
  });
});

describe('Horas para tópico novo em cada semana até a reta final (spec 13 §4.3)', () => {
  const EVERY_DAY: [number, number, number, number, number, number, number] = [180, 180, 180, 180, 180, 180, 180];
  const base = { now: NOW, examDate: '2026-12-13', finalStretchDays: 14, pattern: EVERY_DAY, overrides: {}, todayStudiedMinutes: 0, reviewEnabled: true, studiedAny: true };

  it('a reta final começa exatamente N dias antes da prova', () => {
    expect(stretchStartKey('2026-12-13', 14)).toBe('2026-11-29');
    expect(stretchStartKey('2026-12-13', 21)).toBe('2026-11-22');
  });

  it('semanas de hoje até a da prova, com as fases: teoria, últimos tópicos e reta final', () => {
    const slots = weekSlots(base);
    expect(slots.map((s) => s.weekStartKey)).toEqual(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23', '2026-11-30', '2026-12-07']);
    expect(slots.map((s) => s.phase)).toEqual(['TEORIA', 'TEORIA', 'TEORIA', 'TEORIA', 'ULTIMOS', 'RETA_FINAL', 'RETA_FINAL']);
    // Semana dos últimos tópicos: só os 6 dias antes de 29/11 (domingo) contam (a revisão dela cai no domingo, já na reta final)
    expect(slots[4].newTopicMinutes).toBe(6 * 180);
    expect(slots[5].newTopicMinutes).toBe(0);
  });

  it('a semana de hoje desconta o que já foi estudado hoje e a Revisão da semana', () => {
    const slots = weekSlots({ ...base, todayStudiedMinutes: 60 });
    expect(slots[0].newTopicMinutes).toBe(7 * 180 - 60 - 90);
    expect(weekSlots({ ...base, reviewEnabled: false })[0].newTopicMinutes).toBe(7 * 180);
  });

  it('sem nenhum tópico estudado ainda, a revisão desta semana não é descontada (o roteiro ainda não a faz)', () => {
    const slots = weekSlots({ ...base, studiedAny: false });
    expect(slots[0].newTopicMinutes).toBe(7 * 180);
    expect(slots[1].newTopicMinutes).toBe(7 * 180 - 90);
  });

  it('cada semana sabe quantos dias tem para tópico novo', () => {
    expect(weekSlots(base).map((s) => s.days)).toEqual([7, 7, 7, 7, 6, 0, 0]);
  });

  it('semana atípica de folga (7 exceções 0) não tem tempo para tópico novo', () => {
    const off = Object.fromEntries(['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-05', '2026-11-06', '2026-11-07', '2026-11-08'].map((k) => [k, 0]));
    expect(weekSlots({ ...base, overrides: off })[1].newTopicMinutes).toBe(0);
  });

  it('hoje já dentro da reta final: tudo é reta final; prova no passado: nenhuma semana', () => {
    const inStretch = weekSlots({ ...base, now: new Date(2026, 11, 1, 9, 0) });
    expect(inStretch.every((s) => s.phase === 'RETA_FINAL' && s.newTopicMinutes === 0)).toBe(true);
    expect(weekSlots({ ...base, now: new Date(2026, 11, 20, 9, 0) })).toEqual([]);
  });
});

describe('Projetor: tópicos que faltam pelas semanas (spec 13 §4.3)', () => {
  const slot = (key: string, minutes: number, phase: 'TEORIA' | 'ULTIMOS' | 'RETA_FINAL' = 'TEORIA') => ({
    weekStart: new Date(`${key}T00:00:00`), weekStartKey: key, newTopicMinutes: minutes, phase, days: phase === 'RETA_FINAL' ? 0 : 7,
  });
  const queue = (id: string, minutes: number[]) => minutes.map((m, i) => ({ topicId: `${id}${i + 1}`, minutes: m }));

  it('o avanço parcial conta na cobertura; os tópicos novos das semanas somam o total', () => {
    const r = projectTopics([slot('2026-10-26', 90), slot('2026-11-02', 30)], [
      { subjectId: 'a', partCode: null, share: 1, totalLeaf: 2, seen: 0, queue: queue('a', [60, 60]) },
    ]);
    expect(r.weeks.map((w) => w.coveragePercent)).toEqual([75, 100]);
    expect(r.weeks.reduce((acc, w) => acc + w.newTopics, 0)).toBe(2);
    expect(r.leftForLater).toEqual([]);
  });

  it('muitas matérias com tópicos longos: nenhuma semana cheia aparece com 0 tópico novo', () => {
    const subjectsMany = Array.from({ length: 15 }, (_, i) => ({
      subjectId: `s${i}`, partCode: null, share: 1 / 15, totalLeaf: 20, seen: 0, queue: queue(`s${i}-`, Array(20).fill(120)),
    }));
    const r = projectTopics(['2026-10-26', '2026-11-02', '2026-11-09', '2026-11-16'].map((k) => slot(k, 1260)), subjectsMany);
    for (const w of r.weeks) expect(w.newTopics).toBeGreaterThan(5);
  });

  it('cobertura arredondada para baixo: com tópico ficando para depois, nunca mostra 100%', () => {
    const r = projectTopics([slot('2026-10-26', 11_900)], [
      { subjectId: 'a', partCode: null, share: 1, totalLeaf: 200, seen: 0, queue: queue('a', Array(200).fill(60)) },
    ]);
    expect(r.leftForLater.length).toBe(2);
    expect(r.weeks[0].coveragePercent).toBe(99);
  });

  it('matéria que fecha devolve o tempo às outras, na proporção delas', () => {
    const r = projectTopics([slot('2026-10-26', 200)], [
      { subjectId: 'a', partCode: null, share: 0.5, totalLeaf: 1, seen: 0, queue: queue('a', [30]) },
      { subjectId: 'b', partCode: null, share: 0.5, totalLeaf: 3, seen: 0, queue: queue('b', [60, 60, 60]) },
    ]);
    // A fecha (1) e B faz 2 inteiros + 50 de 60 minutos do 3º
    expect(r.weeks[0].newTopics).toBe(4);
    expect(r.seenAtStretch.get('b')).toBeCloseTo(2 + 50 / 60, 5);
    expect(r.leftForLater).toEqual(['b3']);
  });

  it('reta final não recebe tópico novo e o % visto para nela', () => {
    const r = projectTopics([slot('2026-11-23', 120, 'ULTIMOS'), slot('2026-11-30', 0, 'RETA_FINAL')], [
      { subjectId: 'a', partCode: null, share: 1, totalLeaf: 10, seen: 4, queue: queue('a', [60, 60, 60, 60, 60, 60]) },
    ]);
    expect(r.weeks.map((w) => w.newTopics)).toEqual([2, 0]);
    expect(r.weeks.map((w) => w.coveragePercent)).toEqual([60, 60]);
    expect(r.leftForLater).toEqual(['a3', 'a4', 'a5', 'a6']);
  });

  it('o que não cabe fica para depois: o fim da fila de cada matéria, matéria a matéria', () => {
    const r = projectTopics([slot('2026-10-26', 120)], [
      { subjectId: 'a', partCode: null, share: 0.5, totalLeaf: 2, seen: 0, queue: queue('a', [60, 60]) },
      { subjectId: 'b', partCode: null, share: 0.5, totalLeaf: 2, seen: 0, queue: queue('b', [60, 60]) },
    ]);
    expect(r.leftForLater).toEqual(['a2', 'b2']);
  });

  it('partes do ciclo todas 0: divisão igual; sem fila nenhuma: nada muda e não trava', () => {
    const equal = projectTopics([slot('2026-10-26', 120)], [
      { subjectId: 'a', partCode: null, share: 0, totalLeaf: 1, seen: 0, queue: queue('a', [60]) },
      { subjectId: 'b', partCode: null, share: 0, totalLeaf: 1, seen: 0, queue: queue('b', [60]) },
    ]);
    expect(equal.weeks[0].newTopics).toBe(2);
    const empty = projectTopics([slot('2026-10-26', 600)], [{ subjectId: 'a', partCode: null, share: 1, totalLeaf: 3, seen: 3, queue: [] }]);
    expect(empty.weeks[0]).toMatchObject({ newTopics: 0, coveragePercent: 100 });
    expect(projectTopics([slot('2026-10-26', 60)], []).weeks[0].coveragePercent).toBe(0);
  });
});
