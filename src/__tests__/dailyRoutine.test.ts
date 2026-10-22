import { describe, expect, it } from 'vitest';
import { buildRoutine, freezeDailyPlan, pickExtraBlock, routineSiblings } from '../lib/dailyRoutine';
import type { DailyFocusBlock, DailyPlan } from '../lib/dailyPlanner';
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
const topicsBySubject = { ti: [owasp, jwt, oauth], casp: [pcasp] };
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

  it('irmãos são os tópicos do mesmo grupo', () => {
    expect(routineSiblings(owasp, topicsBySubject).map((t) => t.code)).toEqual(['2.2.2', '2.2.3']);
    expect(routineSiblings(pcasp, topicsBySubject)).toEqual([]);
    expect(routineSiblings(null, topicsBySubject)).toEqual([]);
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
