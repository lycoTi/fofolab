import { describe, expect, it } from 'vitest';
import { buildRoutine, freezeDailyPlan, pickExtraBlock, routineGroup, routineProfileKey } from '../lib/dailyRoutine';
import type { DailyFocusBlock, DailyPlan } from '../lib/dailyPlanner';
import { recalibrationHint } from '../lib/recalibrationHint';
import type { SubjectCycleAllocation, TopicHeatItem } from '../lib/cycleEngine';
import type { FrozenBlock, StudySession, Subject, Topic } from '../types/database';

const subject = (id: string, name: string) => ({ id, name, color: '#f97316' }) as unknown as Subject;
const topic = (id: string, subjectId: string, code: string, parentId: string | null = null) =>
  ({ id, subject_id: subjectId, code, title: `Tópico ${code}`, parent_id: parentId }) as unknown as Topic;
const session = (subjectId: string, minutes: number, type: StudySession['session_type'] = 'POMODORO') =>
  ({ subject_id: subjectId, topic_id: null, duration_minutes: minutes, session_type: type }) as unknown as StudySession;
const frozen = (n: number, subjectId: string, topicId: string | null, minutes: number): FrozenBlock => ({
  blockNumber: n,
  subjectId,
  topicId,
  durationMinutes: minutes,
  reasonText: `motivo ${n}`,
});

const ti = subject('ti', 'TI');
const casp = subject('casp', 'CASP');
const owasp = topic('owasp', 'ti', '2.2.1', 'g22');
const oauth = topic('oauth', 'ti', '2.2.2', 'g22');
const jwt = topic('jwt', 'ti', '2.2.3', 'g22');
const pcasp = topic('pcasp', 'casp', '3.1');
const group22 = topic('g22', 'ti', '2.2');
const topicsBySubject = { ti: [group22, owasp, jwt, oauth], casp: [pcasp] };
const blocks = [frozen(1, 'ti', 'owasp', 60), frozen(2, 'casp', 'pcasp', 40)];

describe('roteiro do dia classificado', () => {
  it('bloco vira feito quando o tempo de hoje na matéria alcança a duração', () => {
    const items = buildRoutine({ blocks, subjects: [ti, casp], topicsBySubject, todaySessions: [session('ti', 35), session('ti', 25)] });
    expect(items.map((i) => i.status)).toEqual(['done', 'current']);
    expect(items[0].studiedMinutes).toBe(60);
  });

  it('o primeiro bloco não feito é o atual, os seguintes são próximos', () => {
    const items = buildRoutine({ blocks, subjects: [ti, casp], topicsBySubject, todaySessions: [] });
    expect(items.map((i) => i.status)).toEqual(['current', 'next']);
    expect(items[0].remainingMinutes).toBe(60);
    expect(items[0].topic?.id).toBe('owasp');
  });

  it('tempo de revisão não conta para o bloco', () => {
    const items = buildRoutine({ blocks, subjects: [ti, casp], topicsBySubject, todaySessions: [session('ti', 60, 'REVIEW')] });
    expect(items[0].status).toBe('current');
  });

  it('dois blocos da mesma matéria consomem o tempo em sequência', () => {
    const twice = [frozen(1, 'ti', 'owasp', 30), frozen(2, 'ti', 'jwt', 30)];
    const items = buildRoutine({ blocks: twice, subjects: [ti], topicsBySubject, todaySessions: [session('ti', 45)] });
    expect(items.map((i) => i.status)).toEqual(['done', 'current']);
    expect(items[1].studiedMinutes).toBe(15);
    expect(items[1].remainingMinutes).toBe(15);
  });

  it('bloco cuja matéria foi apagada sai do roteiro; tópico apagado vira bloco só da matéria', () => {
    const orphan = [frozen(1, 'apagada', null, 30), frozen(2, 'casp', 'sumiu', 40)];
    const items = buildRoutine({ blocks: orphan, subjects: [ti, casp], topicsBySubject, todaySessions: [] });
    expect(items).toHaveLength(1);
    expect(items[0].subject.id).toBe('casp');
    expect(items[0].topic).toBeNull();
  });

  it('o grupo do bloco tem o pai como raiz e todos os tópicos dele, inclusive o do bloco, em ordem', () => {
    const group = routineGroup(owasp, topicsBySubject);
    expect(group.parent?.code).toBe('2.2');
    expect(group.members.map((t) => t.code)).toEqual(['2.2.1', '2.2.2', '2.2.3']);
    expect(routineGroup(pcasp, topicsBySubject)).toEqual({ parent: null, members: [] });
    expect(routineGroup(null, topicsBySubject)).toEqual({ parent: null, members: [] });
  });

  it('congela o plano do motor guardando só o necessário', () => {
    const plan = {
      blocks: [{ blockNumber: 1, subject: ti, topic: owasp, durationMinutes: 50, reasonText: 'Faltam 01:00' } as DailyFocusBlock],
    } as DailyPlan;
    expect(freezeDailyPlan(plan)).toEqual([frozen(1, 'ti', 'owasp', 50)].map((b) => ({ ...b, reasonText: 'Faltam 01:00' })));
  });

  it('bloco extra vem do motor e evita repetir tópico do dia', () => {
    const live = {
      blocks: [
        { blockNumber: 1, subject: ti, topic: owasp, durationMinutes: 40, reasonText: 'a' },
        { blockNumber: 2, subject: ti, topic: jwt, durationMinutes: 30, reasonText: 'b' },
      ],
    } as unknown as DailyPlan;
    expect(pickExtraBlock(live, blocks)?.topicId).toBe('jwt');
    expect(pickExtraBlock({ blocks: [] } as unknown as DailyPlan, blocks)).toBeNull();
  });
});

describe('aviso discreto de recalibrar', () => {
  const alloc = (id: string, name: string, level: number, mastery: number, weight = 1) =>
    ({ subject: { id, name, initial_knowledge_level: level, exam_weight: weight }, studiedTopicsMastery: mastery }) as unknown as SubjectCycleAllocation;
  const heat = (subjectId: string, confidence: number) =>
    ({ topic: { subject_id: subjectId }, sampleConfidencePercent: confidence }) as unknown as TopicHeatItem;

  it('matéria marcada como dominada e errando muito, com amostra suficiente, sugere recalibrar', () => {
    const hint = recalibrationHint([alloc('casp', 'CASP', 3, 35)], [heat('casp', 60), heat('casp', 60)]);
    expect(hint).toEqual({ subjectName: 'CASP', direction: 'harder' });
  });

  it('com amostra pequena não sugere nada', () => {
    expect(recalibrationHint([alloc('casp', 'CASP', 3, 35)], [heat('casp', 30)])).toBeNull();
  });

  it('marcou "nunca vi" e está acertando muito: sugere recalibrar para mais fácil', () => {
    expect(recalibrationHint([alloc('ti', 'TI', 1, 75)], [heat('ti', 55)])).toEqual({ subjectName: 'TI', direction: 'easier' });
  });

  it('com várias, fala primeiro da que pesa mais na prova', () => {
    const hint = recalibrationHint([alloc('a', 'A', 3, 30, 1), alloc('b', 'B', 4, 40, 2)], [heat('a', 60), heat('b', 60)]);
    expect(hint?.subjectName).toBe('B');
  });
});

describe('assinatura do perfil do roteiro', () => {
  const planOf = (hours: number, strategy: string | null) => ({ id: 'p', weekly_hours_target: hours, strategy_mode: strategy }) as unknown as import('../types/database').StudyPlan;
  const subj = (level: number, minutes: number, mastery = 50) =>
    ({ id: 'ti', initial_knowledge_level: level, cycle_allocated_minutes: minutes, measured_mastery_score: mastery }) as unknown as Subject;
  const base = routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] });

  it('muda quando horas, estratégia, autoavaliação ou distribuição do ciclo mudam', () => {
    expect(routineProfileKey(planOf(21, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] })).not.toBe(base);
    expect(routineProfileKey(planOf(14, 'BASE_COMUM'), [subj(2, 300)], { ti: [owasp] })).not.toBe(base);
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(3, 300)], { ti: [owasp] })).not.toBe(base);
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 400)], { ti: [owasp] })).not.toBe(base);
    const leveled = { ...owasp, initial_knowledge_level: 3 } as Topic;
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [leveled] })).not.toBe(base);
  });

  it('não muda só porque o estudante estudou (domínio mudou)', () => {
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300, 90)], { ti: [owasp] })).toBe(base);
  });

  it('muda quando a Revisão da semana de hoje muda (semana atípica trocou o dia mais longo)', () => {
    const withReview = routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] }, 150, 90);
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] }, 150, 0)).not.toBe(withReview);
  });

  it('muda quando o tempo de hoje muda ("mudar o tempo de hoje" regrava o roteiro)', () => {
    const today = routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] }, 150);
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] }, 60)).not.toBe(today);
    expect(routineProfileKey(planOf(14, 'MAIS_COBRADOS'), [subj(2, 300)], { ti: [owasp] }, 150)).toBe(today);
  });
});

describe('Revisão da semana no roteiro gravado (spec 13 §4.2)', () => {
  it('o bloco de revisão é gravado com o tipo; o de estudo, como sempre', () => {
    const plan = {
      blocks: [
        { blockNumber: 1, subject: ti, topic: owasp, durationMinutes: 50, reasonText: 'a', kind: 'STUDY' },
        { blockNumber: 2, subject: casp, topic: pcasp, durationMinutes: 60, reasonText: 'b', kind: 'WEEK_REVIEW' },
      ],
    } as unknown as DailyPlan;
    const [study, review] = freezeDailyPlan(plan);
    expect(study.kind).toBeUndefined();
    expect(review.kind).toBe('WEEK_REVIEW');
  });

  it('o bloco de revisão conta pelo tempo da matéria do tópico, como os outros', () => {
    const withReview = [frozen(1, 'ti', 'owasp', 60), { ...frozen(2, 'casp', 'pcasp', 30), kind: 'WEEK_REVIEW' as const }];
    const items = buildRoutine({ blocks: withReview, subjects: [ti, casp], topicsBySubject, todaySessions: [session('ti', 60), session('casp', 30)] });
    expect(items.map((i) => i.status)).toEqual(['done', 'done']);
    expect(items[1].block.kind).toBe('WEEK_REVIEW');
  });
});
