import { describe, expect, it } from 'vitest';
import { estimateTopicMinutes, realPace, TOPIC_MINUTES_BY_LEVEL, topicLevel } from '../lib/examProjection';
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
