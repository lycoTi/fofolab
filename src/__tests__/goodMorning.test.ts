import { describe, expect, it } from 'vitest';
import { examSituation, greeting, moodLine } from '../lib/goodMorning';
import type { ExamPart, StudyPlan, StudySession, Topic } from '../types/database';

const FORBIDDEN_JARGON = ['SQLite', '0 tokens', '_score', 'Seed', 'IndexedDB', 'localStorage', 'Cache', 'null', 'NaN', 'undefined', 'TEC'];

const NOW = new Date(2026, 9, 24, 8, 0);
const at = (day: number, hour = 10) => new Date(2026, 9, day, hour, 0).toISOString();
const session = (subjectId: string, topicId: string, minutes: number, day: number): StudySession =>
  ({ id: `${subjectId}${topicId}${day}${minutes}`, subject_id: subjectId, topic_id: topicId, duration_minutes: minutes, session_type: 'POMODORO', pauses_count: 0, was_skipped: 0, started_at: at(day) }) as StudySession;
const topic = (id: string, code: string, title: string) => ({ id, code, title }) as unknown as Topic;
const topicsById = {
  arq: topic('arq', '2.1', 'Arquitetura de microsserviços'),
  sql: topic('sql', '3.2', 'SQL'),
  jwt: topic('jwt', '4.1', 'JWT'),
  rest: topic('rest', '2.4', 'REST'),
};

describe('Linha de ânimo com fatos (spec 07 §5.5)', () => {
  it('ontem: tempo, matérias e o tópico que começou', () => {
    const line = moodLine({
      sessions: [session('ti', 'arq', 60, 23), session('banco', 'sql', 40, 23), session('ti', 'arq', 25, 10)],
      firstStudyDates: { arq: at(23), sql: at(10) },
      topicsById,
      now: NOW,
    });
    expect(line).toBe('Ontem: 01:40 de estudo em 2 matérias. Você começou 2.1 Arquitetura de microsserviços.');
  });

  it('último dia de estudo antes de ontem aparece com a data', () => {
    const line = moodLine({ sessions: [session('ti', 'sql', 50, 20)], firstStudyDates: { sql: at(1) }, topicsById, now: NOW });
    expect(line).toBe('Em 20/10: 00:50 de estudo em 1 matéria.');
  });

  it('mais de 2 tópicos começados: os 2 primeiros e "e mais N"', () => {
    const line = moodLine({
      sessions: [session('ti', 'arq', 30, 23), session('ti', 'rest', 30, 23), session('banco', 'sql', 30, 23), session('seg', 'jwt', 30, 23)],
      firstStudyDates: { arq: at(23, 8), rest: at(23, 9), sql: at(23, 10), jwt: at(1) },
      topicsById,
      now: NOW,
    });
    expect(line).toBe('Ontem: 02:00 de estudo em 3 matérias. Você começou 2.1 Arquitetura de microsserviços, 2.4 REST e mais 1.');
  });

  it('sem dia de estudo anterior (ou só hoje), não há linha', () => {
    expect(moodLine({ sessions: [], firstStudyDates: {}, topicsById, now: NOW })).toBeNull();
    expect(moodLine({ sessions: [session('ti', 'arq', 30, 24)], firstStudyDates: {}, topicsById, now: NOW })).toBeNull();
  });
});

describe('Situação por prova (spec 07 §5.5)', () => {
  const plan = { exam_date: '2026-12-13' } as StudyPlan;
  const part = (code: string, name: string, min: number | null, sort: number) =>
    ({ id: code, plan_id: 'p', code, name, item_count: 40, points_per_item: 1, min_score: min, sort_order: sort }) as ExamPart;
  const parts = [part('P1', 'Conhecimentos básicos', 8, 1), part('P2', 'Complementares', 12, 2), part('P3', 'Específicos', 54, 3)];

  it('dias até a prova e cada prova com o quanto já foi visto', () => {
    const result = examSituation({ plan, parts, progress: [{ code: 'P1', coveragePercent: 30 }, { code: 'P2', coveragePercent: 35 }, { code: 'P3', coveragePercent: 40 }], now: NOW });
    expect(result.daysLine).toBe('Faltam 50 dias para a prova (13/12/2026).');
    expect(result.parts).toEqual([
      { code: 'P1', name: 'Conhecimentos básicos', coveragePercent: 30 },
      { code: 'P2', name: 'Complementares', coveragePercent: 35 },
      { code: 'P3', name: 'Específicos', coveragePercent: 40 },
    ]);
    expect(result.warning).toBeNull();
  });

  it('avisa da prova com nota mínima que ficou 20 pontos ou mais atrás das outras', () => {
    const result = examSituation({ plan, parts, progress: [{ code: 'P1', coveragePercent: 12 }, { code: 'P2', coveragePercent: 38 }, { code: 'P3', coveragePercent: 42 }], now: NOW });
    expect(result.warning).toBe('P1 está ficando para trás: 12% visto (as outras: 40%). Ela tem nota mínima.');
  });

  it('prova sem nota mínima não gera aviso', () => {
    const noMin = [part('P1', 'Básicos', null, 1), part('P2', 'Complementares', 12, 2)];
    const result = examSituation({ plan, parts: noMin, progress: [{ code: 'P1', coveragePercent: 5 }, { code: 'P2', coveragePercent: 50 }], now: NOW });
    expect(result.warning).toBeNull();
  });

  it('plano sem provas: só os dias; sem data da prova: sem a linha dos dias', () => {
    const manual = examSituation({ plan, parts: [], progress: [], now: NOW });
    expect(manual.parts).toEqual([]);
    expect(manual.warning).toBeNull();
    expect(examSituation({ plan: { exam_date: null } as StudyPlan, parts, progress: [], now: NOW }).daysLine).toBeNull();
  });

  it('véspera e dia da prova', () => {
    expect(examSituation({ plan: { exam_date: '2026-10-25' } as StudyPlan, parts: [], progress: [], now: NOW }).daysLine).toBe('Falta 1 dia para a prova (25/10/2026).');
    expect(examSituation({ plan: { exam_date: '2026-10-24' } as StudyPlan, parts: [], progress: [], now: NOW }).daysLine).toBe('A prova é hoje (24/10/2026).');
    expect(examSituation({ plan: { exam_date: '2026-10-01' } as StudyPlan, parts: [], progress: [], now: NOW }).daysLine).toBeNull();
  });

  it('saudação pela hora e textos sem jargão', () => {
    expect(greeting(new Date(2026, 9, 24, 7))).toBe('Bom dia');
    expect(greeting(new Date(2026, 9, 24, 14))).toBe('Boa tarde');
    expect(greeting(new Date(2026, 9, 24, 21))).toBe('Boa noite');
    expect(greeting(new Date(2026, 9, 24, 2))).toBe('Boa noite');
    const texts = [
      moodLine({ sessions: [session('ti', 'arq', 60, 23)], firstStudyDates: { arq: at(23) }, topicsById, now: NOW }),
      examSituation({ plan, parts, progress: [{ code: 'P1', coveragePercent: 0 }, { code: 'P2', coveragePercent: 40 }, { code: 'P3', coveragePercent: 40 }], now: NOW }).warning,
    ].join(' ');
    for (const term of FORBIDDEN_JARGON) expect(texts).not.toContain(term);
  });
});
