import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { TopicHeatItem } from '../lib/cycleEngine';
import type { QuestionAttempt, ReviewItem, StudyPlan, Subject, Topic } from '../types/database';

const reviews = new Map<string, { items: ReviewItem[]; skipped: boolean; createdAt: string }>();
const calls = { diagnosis: vi.fn(), recall: vi.fn(), session: vi.fn() };
vi.mock('../lib/database', () => ({
  getDailyReview: (planId: string, date: string) => reviews.get(`${planId}|${date}`) ?? null,
  saveDailyReview: (planId: string, date: string, items: ReviewItem[]) =>
    reviews.set(`${planId}|${date}`, { items, skipped: false, createdAt: '2026-10-24T09:00:00.000Z' }),
  skipDailyReview: (planId: string, date: string) => {
    const r = reviews.get(`${planId}|${date}`);
    if (r) r.skipped = true;
  },
  getStudySessionsSince: () => [],
  getReviewQuestionCandidates: () => ({}),
  getQuestionWithDissection: () => null,
  getNotebookForTopic: () => ({ content_markdown: 'Minhas notas' }),
  recordQuestionDiagnosis: (...args: unknown[]) => calls.diagnosis(...args),
  recordRecallCheck: (...args: unknown[]) => calls.recall(...args),
  recordStudySession: (...args: unknown[]) => calls.session(...args),
  flushDatabase: () => Promise.resolve(),
}));

const { useDailyReview } = await import('../features/good-morning/useDailyReview');

const DAY = 24 * 60 * 60 * 1000;
const subject = { id: 's1', name: 'Arquitetura' } as unknown as Subject;
const topic = (id: string, daysAgo: number) =>
  ({ id, subject_id: 's1', parent_id: null, code: id, title: `T ${id}`, last_studied_at: new Date(Date.UTC(2026, 9, 24, 12) - daysAgo * DAY).toISOString() }) as unknown as Topic;
const heatOf = (t: Topic, daysAgo: number) =>
  ({ topic: t, memoryHalfLifeDays: 7, daysSinceLastStudy: daysAgo }) as unknown as TopicHeatItem;
const cold = topic('frio', 20);

function setup(plan: Partial<StudyPlan>, now: Date, attempts: QuestionAttempt[] = []) {
  const onRecorded = vi.fn();
  const hook = renderHook(
    (p: { now: Date }) =>
      useDailyReview({
        dbReady: true,
        plan: { id: 'p1', daily_review_enabled: 1, ...plan } as StudyPlan,
        subjects: [subject],
        topicsBySubject: { s1: [cold] },
        heat: [heatOf(cold, 20)],
        attempts,
        questionLogs: [],
        recallChecks: [],
        dataVersion: 0,
        onRecorded,
        now: () => p.now,
      }),
    { initialProps: { now } }
  );
  return { ...hook, onRecorded };
}

beforeEach(() => {
  reviews.clear();
  calls.diagnosis.mockReset();
  calls.recall.mockReset();
  calls.session.mockReset();
});

describe('useDailyReview', () => {
  it('desligada: não sorteia nem grava nada', () => {
    const { result } = setup({ daily_review_enabled: 0 }, new Date(2026, 9, 24, 8));
    expect(result.current.enabled).toBe(false);
    expect(reviews.size).toBe(0);
  });

  it('sorteia uma vez por dia e mostra a pergunta aberta do tópico sem questão', () => {
    const { result } = setup({}, new Date(2026, 9, 24, 8));
    expect([...reviews.keys()]).toEqual(['p1|2026-10-24']);
    expect(result.current.items.map((i) => i.topicId)).toEqual(['frio']);
    expect(result.current.current).toMatchObject({ topicLabel: 'frio T frio', subjectName: 'Arquitetura', notebookExcerpt: 'Minhas notas' });
  });

  it('virar o dia com o app aberto sorteia a revisão do dia novo', () => {
    const { rerender } = setup({}, new Date(2026, 9, 24, 23, 50));
    rerender({ now: new Date(2026, 9, 25, 0, 10) });
    expect([...reviews.keys()].sort()).toEqual(['p1|2026-10-24', 'p1|2026-10-25']);
  });

  it('autoavaliar grava a autoavaliação e o tempo como revisão, e avisa o App', () => {
    const { result, onRecorded } = setup({}, new Date(2026, 9, 24, 8));
    act(() => result.current.rateRecall('GOOD', 130));
    expect(calls.recall).toHaveBeenCalledWith({ subjectId: 's1', topicId: 'frio', rating: 'GOOD' });
    expect(calls.session).toHaveBeenCalledWith(expect.objectContaining({ subjectId: 's1', topicId: 'frio', durationMinutes: 2, sessionType: 'REVIEW' }));
    expect(onRecorded).toHaveBeenCalled();
  });

  it('tópico apagado depois do sorteio é pulado; o seguinte aparece e a revisão não termina antes da hora', () => {
    reviews.set('p1|2026-10-24', {
      items: [
        { topicId: 'sumiu', subjectId: 's1', kind: 'OPEN', questionId: null, reason: 'COOLING' },
        { topicId: 'frio', subjectId: 's1', kind: 'OPEN', questionId: null, reason: 'COOLING' },
      ],
      skipped: false,
      createdAt: '2026-10-24T09:00:00.000Z',
    });
    const { result } = setup({}, new Date(2026, 9, 24, 8));
    expect(result.current.items.map((i) => i.topicId)).toEqual(['frio']);
    expect(result.current.current?.item.topicId).toBe('frio');
  });

  it('pular marca o dia como pulado', () => {
    const { result } = setup({}, new Date(2026, 9, 24, 8));
    act(() => result.current.skip());
    expect(result.current.skipped).toBe(true);
  });
});
