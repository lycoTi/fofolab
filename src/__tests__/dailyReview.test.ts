import { describe, expect, it } from 'vitest';
import {
  chooseReviewQuestion,
  deriveDiagnosis,
  interleaveBySubject,
  reviewProgress,
  selectDailyReview,
} from '../lib/dailyReview';
import type { TopicHeatItem } from '../lib/cycleEngine';
import type { QuestionAttempt, QuestionLog, RecallCheck, ReviewItem, Topic } from '../types/database';

const NOW = new Date(2026, 9, 24, 8, 0); // 24/10/2026, 08:00 (local)
const DAY = 24 * 60 * 60 * 1000;
const dayKey = (daysAgo: number) => {
  const d = new Date(NOW.getTime() - daysAgo * DAY);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Tópico estudado há `daysAgo` dias (null = nunca), com meia-vida `halfLife`. */
function heat(id: string, subjectId: string, daysAgo: number | null, halfLife = 7): TopicHeatItem {
  const lastStudied = daysAgo === null ? null : new Date(NOW.getTime() - daysAgo * DAY).toISOString();
  return {
    topic: { id, subject_id: subjectId, parent_id: 'g', code: id, title: `Tópico ${id}`, last_studied_at: lastStudied } as unknown as Topic,
    subjectName: subjectId,
    subjectColor: '#fff',
    attemptsCount: 0,
    baseGapCount: 0,
    doubtCount: 0,
    boardTrapCount: 0,
    masteredCount: 0,
    sampleConfidencePercent: 0,
    memoryHalfLifeDays: halfLife,
    daysSinceLastStudy: daysAgo,
    isReverseStudyDiscovery: false,
    heatScore: 1,
    heatBreakdown: { masteryDeficit: 0, diagnosisSignal: 0, prerequisiteBoost: 0, forgettingBoost: 0, examWeightMultiplier: 1 },
    relatedPrerequisiteTitles: [],
  };
}

function select(items: TopicHeatItem[], opts: { studiedDates?: Record<string, string[]>; candidates?: Record<string, { questionId: string; lastAttemptAt: string | null }[]>; leaves?: string[] } = {}) {
  const studiedDates: Record<string, string[]> = {};
  for (const h of items) {
    if (h.daysSinceLastStudy !== null) studiedDates[h.topic.id] = [dayKey(h.daysSinceLastStudy)];
  }
  return selectDailyReview({
    heat: items,
    leafTopicIds: new Set(opts.leaves ?? items.map((h) => h.topic.id)),
    studiedDates: { ...studiedDates, ...opts.studiedDates },
    questionCandidates: opts.candidates ?? {},
    now: NOW,
  });
}

describe('Revisão do dia: quais tópicos entram (spec 09 §5.3)', () => {
  it('nunca visto não entra', () => {
    expect(select([heat('a', 's1', null), heat('b', 's1', 20)]).map((i) => i.topicId)).toEqual(['b']);
  });

  it('estudado hoje fica fora', () => {
    expect(select([heat('a', 's1', 0), heat('b', 's2', 20)]).map((i) => i.topicId)).toEqual(['b']);
  });

  it('registro de fora conta como estudado (mesmo sem data de estudo no tópico)', () => {
    const onlyLog = heat('a', 's1', null);
    const items = select([onlyLog], { studiedDates: { a: [dayKey(12)] } });
    expect(items.map((i) => i.topicId)).toEqual(['a']);
  });

  it('tópico pai fica fora', () => {
    expect(select([heat('pai', 's1', 20), heat('b', 's2', 20)], { leaves: ['b'] }).map((i) => i.topicId)).toEqual(['b']);
  });

  it('até 2 do último dia de estudo, o resto dos que mais esfriaram', () => {
    const items = select([
      heat('ontem1', 's1', 1),
      heat('ontem2', 's2', 1),
      heat('ontem3', 's3', 1),
      heat('frio', 's4', 30),
      heat('morno', 's5', 10),
    ]);
    const lastDay = items.filter((i) => i.reason === 'LAST_DAY').map((i) => i.topicId);
    expect(lastDay).toHaveLength(2);
    expect(items.filter((i) => i.reason === 'COOLING').map((i) => i.topicId).sort()).toEqual(['frio', 'morno']);
  });

  it('tópico só revisado ontem não faz de ontem o "último dia de estudo"', () => {
    // Ontem só houve revisão (de A); o último dia de estudo de verdade foi há 5 dias (B)
    const items = selectDailyReview({
      heat: [heat('A', 's1', 1), heat('B', 's2', 5, 21), heat('C', 's3', 30)],
      leafTopicIds: new Set(['A', 'B', 'C']),
      studiedDates: { A: [dayKey(1), dayKey(20)], B: [dayKey(5)], C: [dayKey(30)] },
      learningDates: { A: [dayKey(20)], B: [dayKey(5)], C: [dayKey(30)] },
      questionCandidates: {},
      now: NOW,
    });
    expect(items.filter((i) => i.reason === 'LAST_DAY').map((i) => i.topicId)).toEqual(['B']);
  });

  it('o último dia de estudo pode ser antes de ontem', () => {
    const items = select([heat('sexta', 's1', 3, 21), heat('frio', 's2', 30)]);
    expect(items.find((i) => i.topicId === 'sexta')!.reason).toBe('LAST_DAY');
  });

  it('chance de lembrar de 90% ou mais não é "esfriando"', () => {
    // Meia-vida de 45 dias, estudado há 5 dias e fora do último dia de estudo: R ≈ 0,93
    const items = select([heat('fresco', 's1', 5, 45), heat('ontem', 's2', 1)]);
    expect(items.map((i) => i.topicId)).toEqual(['ontem']);
  });

  it('máximo 5, um por tópico, e os que mais esfriaram primeiro', () => {
    // t0 é o do último dia de estudo (há 10 dias); dos outros, entram os 4 mais frios
    const many = Array.from({ length: 8 }, (_, n) => heat(`t${n}`, `s${n}`, 10 + n));
    const items = select(many);
    expect(items).toHaveLength(5);
    expect(items.map((i) => i.topicId).sort()).toEqual(['t0', 't4', 't5', 't6', 't7']);
  });

  it('com só 2 elegíveis, a revisão tem 2', () => {
    expect(select([heat('a', 's1', 20), heat('b', 's2', 25)])).toHaveLength(2);
  });

  it('sem questão vira pergunta aberta; com questão, usa a questão', () => {
    const items = select([heat('a', 's1', 20), heat('b', 's2', 25)], { candidates: { a: [{ questionId: 'q1', lastAttemptAt: null }] } });
    expect(items.find((i) => i.topicId === 'a')).toMatchObject({ kind: 'QUESTION', questionId: 'q1' });
    expect(items.find((i) => i.topicId === 'b')).toMatchObject({ kind: 'OPEN', questionId: null });
  });
});

describe('Revisão do dia: questão, ordem e progresso', () => {
  it('prefere questão nunca respondida, depois a respondida há mais tempo', () => {
    expect(chooseReviewQuestion([{ questionId: 'velha', lastAttemptAt: '2026-10-01T10:00:00Z' }, { questionId: 'nova', lastAttemptAt: null }])).toBe('nova');
    expect(
      chooseReviewQuestion([
        { questionId: 'recente', lastAttemptAt: '2026-10-20T10:00:00Z' },
        { questionId: 'antiga', lastAttemptAt: '2026-09-01T10:00:00Z' },
      ])
    ).toBe('antiga');
    expect(chooseReviewQuestion([])).toBeNull();
  });

  it('intercala matérias', () => {
    const item = (topicId: string, subjectId: string): ReviewItem => ({ topicId, subjectId, kind: 'OPEN', questionId: null, reason: 'COOLING' });
    const ordered = interleaveBySubject([item('a1', 'A'), item('a2', 'A'), item('b1', 'B')]);
    expect(ordered.map((i) => i.subjectId)).toEqual(['A', 'B', 'A']);
  });

  it('progresso pelas três origens; nada pendente → sem próximo', () => {
    const since = '2026-10-24T10:00:00.000Z';
    const after = '2026-10-24T10:05:00.000Z';
    const items: ReviewItem[] = [
      { topicId: 'q', subjectId: 's1', kind: 'QUESTION', questionId: 'q1', reason: 'COOLING' },
      { topicId: 'o', subjectId: 's2', kind: 'OPEN', questionId: null, reason: 'COOLING' },
      { topicId: 'x', subjectId: 's3', kind: 'OPEN', questionId: null, reason: 'LAST_DAY' },
    ];
    const attempt = { question_id: 'q1', topic_id: 'q', source: 'DAILY_REVIEW', attempted_at: after } as QuestionAttempt;
    const check = { topic_id: 'o', rating: 'GOOD', checked_at: after } as RecallCheck;
    const log = { topic_id: 'x', logged_at: after } as QuestionLog;

    const none = reviewProgress(items, { attempts: [], recallChecks: [], questionLogs: [] }, since);
    expect(none.nextIndex).toBe(0);

    const partial = reviewProgress(items, { attempts: [attempt], recallChecks: [], questionLogs: [] }, since);
    expect([...partial.doneTopicIds]).toEqual(['q']);
    expect(partial.nextIndex).toBe(1);

    const all = reviewProgress(items, { attempts: [attempt], recallChecks: [check], questionLogs: [log] }, since);
    expect(all.doneTopicIds.size).toBe(3);
    expect(all.nextIndex).toBeNull();
  });

  it('resposta da mesma questão fora da revisão ou antes dela não conclui o item', () => {
    const since = '2026-10-24T10:00:00.000Z';
    const items: ReviewItem[] = [{ topicId: 'q', subjectId: 's1', kind: 'QUESTION', questionId: 'q1', reason: 'COOLING' }];
    const outside = { question_id: 'q1', topic_id: 'q', source: null, attempted_at: '2026-10-24T10:05:00.000Z' } as QuestionAttempt;
    const before = { question_id: 'q1', topic_id: 'q', source: 'DAILY_REVIEW', attempted_at: '2026-10-24T09:00:00.000Z' } as QuestionAttempt;
    expect(reviewProgress(items, { attempts: [outside, before], recallChecks: [], questionLogs: [] }, since).nextIndex).toBe(0);
  });

  it('questão que sumiu depois do sorteio: a autoavaliação conclui o item (não fica em laço)', () => {
    const since = '2026-10-24T10:00:00.000Z';
    const items: ReviewItem[] = [{ topicId: 'q', subjectId: 's1', kind: 'QUESTION', questionId: 'apagada', reason: 'COOLING' }];
    const check = { topic_id: 'q', rating: 'GOOD', checked_at: '2026-10-24T10:05:00.000Z' } as RecallCheck;
    expect(reviewProgress(items, { attempts: [], recallChecks: [check], questionLogs: [] }, since).nextIndex).toBeNull();
  });

  it('diagnóstico já marcado pela confiança e pelo acerto', () => {
    expect(deriveDiagnosis('SURE', true)).toBe('MASTERED');
    expect(deriveDiagnosis('RECENT', true)).toBe('STUDYING');
    expect(deriveDiagnosis('THINK', true)).toBe('DOUBT');
    expect(deriveDiagnosis('GUESS', true)).toBe('LUCKY_GUESS');
    expect(deriveDiagnosis('SURE', false)).toBe('BASE_GAP');
  });
});
