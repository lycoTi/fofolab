import type { BlockTarget } from '../../features/study-block/studyBlockMachine';
import type { RoutineItem, RoutineStatus } from '../../lib/dailyRoutine';
import type { Subject, Topic } from '../../types/database';

/** Matérias, tópicos e itens do roteiro mínimos para as regras de "agora" e do trilho do dia. */
function subject(id: string, name: string): Subject {
  return { id, name, color: '#888888' } as Subject;
}

function topic(id: string, subjectId: string, code: string, title: string): Topic {
  return { id, subject_id: subjectId, parent_id: null, code, title } as Topic;
}

export const adm = subject('s-adm', 'Direito Administrativo');
export const port = subject('s-port', 'Português');
export const ti = subject('s-ti', 'Tecnologia da Informação');
export const tAdm = topic('t-adm', adm.id, '3.1', 'Licitações');
export const tPort = topic('t-port', port.id, '1.2', 'Crase');
export const tTi = topic('t-ti', ti.id, '2.2.1', 'OWASP Top 10');
/** Tópico fora do roteiro (olhada). */
export const tLooked = topic('t-olhada', ti.id, '4.1', 'Redes');

export const subjects = [adm, port, ti];
export const topics = [tAdm, tPort, tTi, tLooked];

let blockNumber = 0;
export function item(subj: Subject, top: Topic | null, status: RoutineStatus, durationMinutes: number, studiedMinutes = 0): RoutineItem {
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

export function targetOf(i: RoutineItem): BlockTarget {
  return {
    subjectId: i.subject.id,
    subjectName: i.subject.name,
    topicId: i.topic?.id ?? null,
    topicCode: i.topic?.code ?? null,
    topicTitle: i.topic?.title ?? null,
    targetMinutes: i.remainingMinutes,
  };
}

/** Bloco da olhada: matéria de TI, tópico fora do roteiro. */
export function lookedTarget(targetMinutes: number | null): BlockTarget {
  return { subjectId: ti.id, subjectName: ti.name, topicId: tLooked.id, topicCode: tLooked.code, topicTitle: tLooked.title, targetMinutes };
}
