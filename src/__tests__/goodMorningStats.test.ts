import { describe, expect, it } from 'vitest';
import { confidenceCalibration, editalProgress, studyCalendar } from '../lib/goodMorningStats';
import type { QuestionAttempt, StudySession, Topic } from '../types/database';

const NOW = new Date(2026, 9, 24, 8, 0);
const DAY = 24 * 60 * 60 * 1000;
const iso = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * DAY).toISOString();
const topic = (id: string, mastery: number, studiedDaysAgo: number | null) =>
  ({ id, mastery_score: mastery, last_studied_at: studiedDaysAgo === null ? null : iso(studiedDaysAgo) }) as unknown as Topic;

describe('Cobertura × proficiência e ritmo (pedagogia do FofoLab: nunca misturar visto com não visto)', () => {
  // 10 tópicos: 4 vistos (domínio 80, 60, 70, 50), 6 nunca vistos
  const topics = [topic('a', 80, 3), topic('b', 60, 5), topic('c', 70, 20), topic('d', 50, 40), ...['e', 'f', 'g', 'h', 'i', 'j'].map((id) => topic(id, 0, null))];

  it('cobertura conta os vistos; proficiência é a média só deles', () => {
    const result = editalProgress({ leafTopics: topics, firstStudyDates: {}, examDate: '2026-12-13', now: NOW });
    expect(result.coveragePercent).toBe(40);
    expect(result.proficiencyPercent).toBe(65);
    expect([result.seenTopics, result.totalTopics]).toEqual([4, 10]);
  });

  it('tópico só com registro de fora (sem data no tópico) conta como visto', () => {
    const result = editalProgress({ leafTopics: [topic('x', 0, null)], firstStudyDates: { x: iso(2) }, examDate: null, now: NOW });
    expect(result.coveragePercent).toBe(100);
  });

  it('ritmo: quanto falta por semana até a prova e o ritmo das últimas 2 semanas', () => {
    // 6 faltando em 50 dias (~7,1 semanas) → 1 por semana; começados nas últimas 2 semanas: a (3 dias) e b (5 dias) → 1 por semana
    const result = editalProgress({ leafTopics: topics, firstStudyDates: { a: iso(3), b: iso(5), c: iso(20), d: iso(40) }, examDate: '2026-12-13', now: NOW });
    expect(result.paceLine).toBe('Faltam 6 tópicos para ver o edital inteiro até a prova: cerca de 1 por semana. Seu ritmo nas últimas 2 semanas: 1 por semana.');
    expect(result.onPace).toBe(true);
  });

  it('abaixo do ritmo necessário: diz o fato, sem alarme', () => {
    const many = Array.from({ length: 60 }, (_, n) => topic(`n${n}`, 0, null));
    const result = editalProgress({ leafTopics: [...many, topic('a', 70, 3)], firstStudyDates: { a: iso(3) }, examDate: '2026-11-07', now: NOW });
    expect(result.onPace).toBe(false);
    expect(result.paceLine).toContain('cerca de 30 por semana');
  });

  it('tudo visto, sem data da prova ou sem tópicos vistos', () => {
    expect(editalProgress({ leafTopics: [topic('a', 70, 3)], firstStudyDates: {}, examDate: '2026-12-13', now: NOW }).paceLine).toBe(
      'Você já viu todos os tópicos do edital. Agora é revisar e treinar.'
    );
    expect(editalProgress({ leafTopics: topics, firstStudyDates: {}, examDate: null, now: NOW }).paceLine).toBeNull();
    expect(editalProgress({ leafTopics: [topic('z', 0, null)], firstStudyDates: {}, examDate: null, now: NOW }).proficiencyPercent).toBeNull();
  });
});

describe('Calibração da confiança (a partir da Revisão do dia)', () => {
  const attempt = (confidence: QuestionAttempt['confidence'], correct: boolean) => ({ confidence, is_correct: correct ? 1 : 0 }) as QuestionAttempt;

  it('acerto por nível de confiança, só com amostra mínima', () => {
    const attempts = [
      ...Array.from({ length: 4 }, () => attempt('SURE', true)),
      attempt('SURE', false),
      attempt('THINK', true),
      attempt('THINK', false),
      attempt('THINK', false),
      attempt('GUESS', true),
      attempt(null, true),
    ];
    expect(confidenceCalibration(attempts)).toEqual([
      { confidence: 'SURE', label: 'Sei', answered: 5, accuracyPercent: 80 },
      { confidence: 'THINK', label: 'Acho que sei', answered: 3, accuracyPercent: 33 },
    ]);
  });

  it('com menos de 8 respostas marcadas, ainda não há o que mostrar', () => {
    expect(confidenceCalibration([attempt('SURE', true), attempt('SURE', true), attempt('THINK', false)])).toEqual([]);
  });
});

describe('Últimas 4 semanas', () => {
  const session = (daysAgo: number, minutes: number) => ({ started_at: iso(daysAgo), duration_minutes: minutes }) as StudySession;

  it('28 dias terminando hoje, com o tempo e o nível de cada dia', () => {
    const days = studyCalendar([session(0, 20), session(0, 25), session(1, 130), session(40, 60)], NOW);
    expect(days).toHaveLength(28);
    expect(days[27]).toMatchObject({ dateKey: '2026-10-24', minutes: 45, level: 2 });
    expect(days[26]).toMatchObject({ dateKey: '2026-10-23', minutes: 130, level: 4 });
    expect(days[0]).toMatchObject({ dateKey: '2026-09-27', minutes: 0, level: 0 });
  });
});
