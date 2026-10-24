import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { SubjectCycleAllocation, TopicHeatItem } from '../lib/cycleEngine';
import type { ExamPart, StudyPlan, StudySession, Subject, Topic } from '../types/database';

const yesterdaySession = {
  id: 's',
  subject_id: 'arq',
  topic_id: 'micro',
  duration_minutes: 50,
  session_type: 'POMODORO',
  started_at: new Date(2026, 9, 23, 10).toISOString(),
} as StudySession;

vi.mock('../lib/database', () => ({
  getDailyReview: () => null,
  saveDailyReview: vi.fn(),
  skipDailyReview: vi.fn(),
  getStudySessionsSince: () => [yesterdaySession],
  getTopicFirstStudyDates: () => ({}),
  getReviewQuestionCandidates: () => ({}),
  getQuestionWithDissection: () => null,
  getNotebookForTopic: () => null,
  recordQuestionDiagnosis: vi.fn(),
  recordRecallCheck: vi.fn(),
  recordStudySession: vi.fn(),
  flushDatabase: () => Promise.resolve(),
}));

// Revisão já sorteada no "banco": um tópico em pergunta aberta
const reviewState = { items: [{ topicId: 'micro', subjectId: 'arq', kind: 'OPEN', questionId: null, reason: 'COOLING' }], skipped: false, createdAt: '2026-10-24T09:00:00.000Z' };
vi.mock('../features/good-morning/useDailyReview', async () => ({
  useDailyReview: (p: { plan: StudyPlan }) => ({
    enabled: p.plan.daily_review_enabled !== 0,
    items: reviewState.items,
    doneCount: 0,
    skipped: false,
    current: { item: reviewState.items[0], topicLabel: '2.1 Microsserviços', subjectName: 'Arquitetura', question: null, notebookExcerpt: null },
    answerQuestion: vi.fn(),
    rateRecall: vi.fn(),
    skip: vi.fn(),
  }),
}));

const { GoodMorningView } = await import('../features/good-morning/GoodMorningView');

const subject = { id: 'arq', name: 'Arquitetura', exam_part_id: 'P3' } as unknown as Subject;
const micro = { id: 'micro', subject_id: 'arq', code: '2.1', title: 'Microsserviços', parent_id: null } as unknown as Topic;
const part = { id: 'P3', plan_id: 'p', code: 'P3', name: 'Específicos', item_count: 90, points_per_item: 2, min_score: 54, sort_order: 3 } as ExamPart;

function view(plan: Partial<StudyPlan> = {}, onStart = vi.fn()) {
  return render(
    <GoodMorningView
      dbReady
      plan={{ id: 'p', exam_date: '2026-12-13', daily_review_enabled: 1, ...plan } as StudyPlan}
      subjects={[subject]}
      topicsBySubject={{ arq: [micro] }}
      heat={[] as TopicHeatItem[]}
      allocations={[{ subject, coveragePercent: 25 } as unknown as SubjectCycleAllocation]}
      examParts={[part]}
      attempts={[]}
      questionLogs={[]}
      recallChecks={[]}
      weekSessions={[yesterdaySession]}
      dataVersion={0}
      nextBlock={{ subjectName: 'Arquitetura' }}
      onStartNextBlock={onStart}
      onRecorded={vi.fn()}
      onLogOutside={vi.fn()}
      now={() => new Date(2026, 9, 24, 8)}
    />
  );
}

describe('Aba Início ("Bom dia")', () => {
  it('ordem: saudação, linha de ânimo, revisão e situação', () => {
    const { container } = view();
    const text = container.textContent ?? '';
    const order = ['Bom dia', 'Ontem: 00:50 de estudo em 1 matéria.', 'Revisão do dia · 1 de 1', 'Faltam 50 dias para a prova (13/12/2026).', 'P3'];
    const positions = order.map((t) => text.indexOf(t));
    expect(positions.every((p) => p >= 0)).toBe(true);
    expect([...positions].sort((a, b) => a - b)).toEqual(positions);
  });

  it('revisão desligada não aparece', () => {
    view({ daily_review_enabled: 0 });
    expect(screen.queryByRole('region', { name: 'Revisão do dia' })).toBeNull();
    expect(screen.getByText('Faltam 50 dias para a prova (13/12/2026).')).toBeTruthy();
  });

  it('o botão do bloco começa o roteiro de hoje', () => {
    const onStart = vi.fn();
    view({}, onStart);
    fireEvent.click(screen.getByRole('button', { name: 'Começar o bloco de Arquitetura' }));
    expect(onStart).toHaveBeenCalled();
  });
});
